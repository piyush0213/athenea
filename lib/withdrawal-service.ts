/**
 * P2P Angel Exchange Service
 * 
 * Flujo:
 * 1. Usuaria solicita retiro de $X para "pasajes"
 * 2. Sistema crea orden de exchange
 * 3. Exchanger ve la orden y acepta (envía Yape)
 * 4. Sistema detecta pago (o Exchanger sube comprobante)
 * 5. Sistema libera frxETH al Exchanger
 * 6. Usuaria recibe confirmación
 */

import { db, auth } from './firebase';
import {
    collection,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    query,
    where,
    getDocs,
    orderBy,
    onSnapshot,
    Timestamp
} from 'firebase/firestore';

// ============ TYPES ============

export type WithdrawalPurpose =
    | 'TRANSPORT'   // Pasajes, taxi, combustible
    | 'LEGAL'       // Abogado, trámites
    | 'SHELTER'     // Alojamiento, renta
    | 'SUPPLIES'    // Suministros, comida
    | 'MEDICAL'     // Medicinas, atención médica
    | 'CHILDREN'    // Gastos de hijos
    | 'DOCUMENTS'   // DNI, pasaporte, certificados
    | 'OTHER';      // Otros

export type WithdrawalMethod =
    | 'YAPE'           // Mobile money Perú
    | 'PLIN'           // Mobile money Perú
    | 'BCP'            // Banco de Crédito del Perú
    | 'INTERBANK'      // Interbank
    | 'BBVA'           // BBVA Continental
    | 'SCOTIABANK'     // Scotiabank
    | 'BN'             // Banco de la Nación
    | 'CASH_AGENT'     // Retiro en agente (Kasnet, etc)
    | 'CASH_ATM'       // Retiro en cajero sin tarjeta
    | 'WESTERN_UNION'  // Envío internacional
    | 'MONEYGRAM';     // Envío internacional

export type VerificationStatus =
    | 'PENDING'        // Esperando verificación de Athena
    | 'QUESTIONS'      // Athena tiene preguntas
    | 'PROOF_REQUIRED' // Se requiere comprobante (monto > $50)
    | 'APPROVED'       // Athena aprobó
    | 'REJECTED';      // Athena rechazó (posible fraude)

export interface WithdrawalVerification {
    // Checklist de verificación
    planAligned: boolean;      // ¿Coincide con el plan de escape?
    contactNotified: boolean;  // ¿Contacto seguro fue avisado?
    proofProvided: boolean;    // ¿Hay comprobante/foto?
    amountReasonable: boolean; // ¿Monto es razonable para el propósito?

    // Chat de verificación con Athena
    conversation: { role: 'user' | 'athena'; text: string; timestamp: number }[];

    // Comprobantes subidos
    proofs: {
        type: 'PRICE_SCREENSHOT' | 'RECEIPT' | 'INVOICE' | 'CHAT_SCREENSHOT' | 'OTHER';
        imageUrl: string;
        description: string;
        uploadedAt: number;
    }[];

    // Resultado de Athena
    athenaVerdict: VerificationStatus;
    athenaComment: string;
    verifiedAt?: number;
}

export interface WithdrawalRequest {
    id: string;
    caseId: string;
    userId: string;

    // Amount
    amountUsd: number;
    amountCrypto: number; // frxETH equivalent

    // Purpose (for transparency)
    purpose: WithdrawalPurpose;
    description: string;

    // Recipient (safe contact)
    recipientName: string;
    recipientPhone: string;
    recipientMethod: WithdrawalMethod;
    recipientBankAccount?: string; // Para transferencias bancarias

    // AI Verification (custodia)
    verification: WithdrawalVerification;
    requiresProof: boolean; // true si monto > $50

    // Status
    status: 'PENDING_VERIFICATION' | 'PENDING' | 'MATCHED' | 'PAYMENT_SENT' | 'CONFIRMED' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'REJECTED';

    // Exchanger info (when matched)
    exchangerId?: string;
    exchangerWallet?: string;

    // Timestamps
    createdAt: number;
    verifiedAt?: number;
    matchedAt?: number;
    paymentSentAt?: number;
    confirmedAt?: number;
    completedAt?: number;

    // Proof
    paymentProofUrl?: string;
    txHash?: string; // When crypto released

    // Messages
    statusMessage?: string;
}

export interface BudgetItem {
    id: string;
    category: WithdrawalPurpose;
    description: string;
    amount: number;
    isPaid: boolean;
    paidAt?: number;
    withdrawalId?: string;
}

export interface CaseBudget {
    caseId: string;
    totalGoal: number;
    totalFunded: number;
    totalSpent: number;
    items: BudgetItem[];
    lastUpdated: number;
}

// ============ FIRESTORE PATHS ============

const WITHDRAWALS_COLLECTION = 'withdrawals';
const BUDGETS_COLLECTION = 'budgets';
const EXCHANGE_ORDERS_COLLECTION = 'exchangeOrders';

// ============ WITHDRAWAL SERVICE ============

export class WithdrawalService {

    /**
     * PROOF_THRESHOLD: Monto a partir del cual se requiere comprobante
     */
    private PROOF_THRESHOLD = 50; // $50 USD

    /**
     * Create a new withdrawal request with AI verification
     */
    async createWithdrawalRequest(
        userId: string,
        caseId: string,
        params: {
            amountUsd: number;
            purpose: WithdrawalPurpose;
            description: string;
            recipientName: string;
            recipientPhone: string;
            recipientMethod: WithdrawalMethod;
            recipientBankAccount?: string;
        }
    ): Promise<WithdrawalRequest> {
        const id = `W-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        // Convert USD to frxETH (assuming 1 frxETH ≈ $3800 for testnet)
        const ETH_PRICE = 3800;
        const amountCrypto = params.amountUsd / ETH_PRICE;

        // Determine if proof is required
        const requiresProof = params.amountUsd > this.PROOF_THRESHOLD;

        // Initialize verification state
        const verification: WithdrawalVerification = {
            planAligned: false,
            contactNotified: false,
            proofProvided: false,
            amountReasonable: false,
            conversation: [
                {
                    role: 'athena',
                    text: requiresProof
                        ? `Veo que quieres retirar $${params.amountUsd} para ${params.description}. Como es más de $50, necesito verificar algunos detalles. ¿Ya coordinaste con ${params.recipientName} que recibirá este dinero?`
                        : `Veo que quieres retirar $${params.amountUsd} para ${params.description}. ¿Ya coordinaste con ${params.recipientName}?`,
                    timestamp: Date.now()
                }
            ],
            proofs: [],
            athenaVerdict: requiresProof ? 'PROOF_REQUIRED' : 'PENDING',
            athenaComment: requiresProof
                ? 'Se requiere comprobante por monto > $50'
                : 'Verificación en proceso'
        };

        const request: WithdrawalRequest = {
            id,
            caseId,
            userId,
            amountUsd: params.amountUsd,
            amountCrypto,
            purpose: params.purpose,
            description: params.description,
            recipientName: params.recipientName,
            recipientPhone: params.recipientPhone,
            recipientMethod: params.recipientMethod,
            recipientBankAccount: params.recipientBankAccount,
            verification,
            requiresProof,
            status: 'PENDING_VERIFICATION',
            createdAt: Date.now(),
            statusMessage: requiresProof
                ? '🔍 Athena está verificando tu solicitud...'
                : '🔍 Verificación rápida en proceso...'
        };

        // Save to Firestore
        await setDoc(doc(db, WITHDRAWALS_COLLECTION, id), request);

        console.log(`[WithdrawalService] Created withdrawal request: ${id}, requiresProof: ${requiresProof}`);
        return request;
    }

    /**
     * Add a message to the verification conversation
     */
    async addVerificationMessage(
        withdrawalId: string,
        role: 'user' | 'athena',
        text: string
    ): Promise<WithdrawalRequest> {
        const ref = doc(db, WITHDRAWALS_COLLECTION, withdrawalId);
        const snapshot = await getDoc(ref);

        if (!snapshot.exists()) throw new Error('Withdrawal not found');

        const current = snapshot.data() as WithdrawalRequest;
        const updatedConversation = [
            ...current.verification.conversation,
            { role, text, timestamp: Date.now() }
        ];

        await updateDoc(ref, {
            'verification.conversation': updatedConversation
        });

        const updated = await getDoc(ref);
        return updated.data() as WithdrawalRequest;
    }

    /**
     * Add a proof to the verification
     */
    async addProof(
        withdrawalId: string,
        proof: {
            type: 'PRICE_SCREENSHOT' | 'RECEIPT' | 'INVOICE' | 'CHAT_SCREENSHOT' | 'OTHER';
            imageUrl: string;
            description: string;
        }
    ): Promise<WithdrawalRequest> {
        const ref = doc(db, WITHDRAWALS_COLLECTION, withdrawalId);
        const snapshot = await getDoc(ref);

        if (!snapshot.exists()) throw new Error('Withdrawal not found');

        const current = snapshot.data() as WithdrawalRequest;
        const updatedProofs = [
            ...current.verification.proofs,
            { ...proof, uploadedAt: Date.now() }
        ];

        await updateDoc(ref, {
            'verification.proofs': updatedProofs,
            'verification.proofProvided': true
        });

        const updated = await getDoc(ref);
        return updated.data() as WithdrawalRequest;
    }

    /**
     * Athena approves the withdrawal
     */
    async approveWithdrawal(
        withdrawalId: string,
        athenaComment: string
    ): Promise<WithdrawalRequest> {
        const ref = doc(db, WITHDRAWALS_COLLECTION, withdrawalId);

        await updateDoc(ref, {
            'verification.athenaVerdict': 'APPROVED',
            'verification.athenaComment': athenaComment,
            'verification.verifiedAt': Date.now(),
            'verification.planAligned': true,
            'verification.amountReasonable': true,
            status: 'PENDING',
            verifiedAt: Date.now(),
            statusMessage: '✅ Athena aprobó. Buscando Angel Exchanger...'
        });

        const updated = await getDoc(ref);
        return updated.data() as WithdrawalRequest;
    }

    /**
     * Athena rejects the withdrawal (possible fraud)
     */
    async rejectWithdrawal(
        withdrawalId: string,
        reason: string
    ): Promise<WithdrawalRequest> {
        const ref = doc(db, WITHDRAWALS_COLLECTION, withdrawalId);

        await updateDoc(ref, {
            'verification.athenaVerdict': 'REJECTED',
            'verification.athenaComment': reason,
            status: 'REJECTED',
            statusMessage: `❌ Rechazado: ${reason}`
        });

        const updated = await getDoc(ref);
        return updated.data() as WithdrawalRequest;
    }

    /**
     * Get all pending withdrawals (for Exchangers to see)
     */
    async getPendingWithdrawals(): Promise<WithdrawalRequest[]> {
        const q = query(
            collection(db, WITHDRAWALS_COLLECTION),
            where('status', '==', 'PENDING'),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as WithdrawalRequest);
    }

    /**
     * Get withdrawals for a specific case
     */
    async getCaseWithdrawals(caseId: string): Promise<WithdrawalRequest[]> {
        const q = query(
            collection(db, WITHDRAWALS_COLLECTION),
            where('caseId', '==', caseId),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as WithdrawalRequest);
    }

    /**
     * Get user's withdrawals
     */
    async getUserWithdrawals(userId: string): Promise<WithdrawalRequest[]> {
        const q = query(
            collection(db, WITHDRAWALS_COLLECTION),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as WithdrawalRequest);
    }

    /**
     * Exchanger accepts a withdrawal request
     */
    async acceptWithdrawal(
        withdrawalId: string,
        exchangerId: string,
        exchangerWallet: string
    ): Promise<WithdrawalRequest> {
        const ref = doc(db, WITHDRAWALS_COLLECTION, withdrawalId);

        await updateDoc(ref, {
            status: 'MATCHED',
            exchangerId,
            exchangerWallet,
            matchedAt: Date.now(),
            statusMessage: 'Angel Exchanger encontrado! Procesando pago...'
        });

        const updated = await getDoc(ref);
        return updated.data() as WithdrawalRequest;
    }

    /**
     * Exchanger marks payment as sent (with proof)
     */
    async markPaymentSent(
        withdrawalId: string,
        proofUrl: string
    ): Promise<WithdrawalRequest> {
        const ref = doc(db, WITHDRAWALS_COLLECTION, withdrawalId);

        await updateDoc(ref, {
            status: 'PAYMENT_SENT',
            paymentSentAt: Date.now(),
            paymentProofUrl: proofUrl,
            statusMessage: 'Pago enviado! Esperando confirmación...'
        });

        const updated = await getDoc(ref);
        return updated.data() as WithdrawalRequest;
    }

    /**
     * Confirm payment received (can be automatic or manual)
     */
    async confirmPaymentReceived(withdrawalId: string): Promise<WithdrawalRequest> {
        const ref = doc(db, WITHDRAWALS_COLLECTION, withdrawalId);

        await updateDoc(ref, {
            status: 'CONFIRMED',
            confirmedAt: Date.now(),
            statusMessage: 'Pago confirmado! Liberando crypto al Exchanger...'
        });

        const updated = await getDoc(ref);
        return updated.data() as WithdrawalRequest;
    }

    /**
     * Complete the withdrawal (crypto released to Exchanger)
     */
    async completeWithdrawal(
        withdrawalId: string,
        txHash: string
    ): Promise<WithdrawalRequest> {
        const ref = doc(db, WITHDRAWALS_COLLECTION, withdrawalId);

        await updateDoc(ref, {
            status: 'COMPLETED',
            completedAt: Date.now(),
            txHash,
            statusMessage: '✅ Completado! El dinero fue enviado a tu contacto seguro.'
        });

        const updated = await getDoc(ref);
        return updated.data() as WithdrawalRequest;
    }

    /**
     * Cancel a withdrawal
     */
    async cancelWithdrawal(withdrawalId: string, reason: string): Promise<void> {
        const ref = doc(db, WITHDRAWALS_COLLECTION, withdrawalId);

        await updateDoc(ref, {
            status: 'CANCELLED',
            statusMessage: `Cancelado: ${reason}`
        });
    }

    /**
     * Subscribe to withdrawal updates (real-time)
     */
    subscribeToWithdrawal(
        withdrawalId: string,
        callback: (withdrawal: WithdrawalRequest) => void
    ): () => void {
        const ref = doc(db, WITHDRAWALS_COLLECTION, withdrawalId);

        return onSnapshot(ref, (snapshot) => {
            if (snapshot.exists()) {
                callback(snapshot.data() as WithdrawalRequest);
            }
        });
    }
}

// ============ BUDGET SERVICE ============

export class BudgetService {

    /**
     * Create or update case budget with detailed items
     */
    async saveBudget(
        caseId: string,
        items: Omit<BudgetItem, 'id' | 'isPaid'>[]
    ): Promise<CaseBudget> {
        const budgetItems: BudgetItem[] = items.map((item, index) => ({
            ...item,
            id: `BI-${index}-${Date.now()}`,
            isPaid: false
        }));

        const totalGoal = budgetItems.reduce((sum, item) => sum + item.amount, 0);

        const budget: CaseBudget = {
            caseId,
            totalGoal,
            totalFunded: 0, // Will be updated from blockchain
            totalSpent: 0,
            items: budgetItems,
            lastUpdated: Date.now()
        };

        await setDoc(doc(db, BUDGETS_COLLECTION, caseId), budget);
        return budget;
    }

    /**
     * Get case budget
     */
    async getBudget(caseId: string): Promise<CaseBudget | null> {
        const ref = doc(db, BUDGETS_COLLECTION, caseId);
        const snapshot = await getDoc(ref);

        if (snapshot.exists()) {
            return snapshot.data() as CaseBudget;
        }
        return null;
    }

    /**
     * Mark a budget item as paid
     */
    async markItemPaid(
        caseId: string,
        itemId: string,
        withdrawalId: string
    ): Promise<void> {
        const budget = await this.getBudget(caseId);
        if (!budget) return;

        const updatedItems = budget.items.map(item => {
            if (item.id === itemId) {
                return { ...item, isPaid: true, paidAt: Date.now(), withdrawalId };
            }
            return item;
        });

        const totalSpent = updatedItems
            .filter(i => i.isPaid)
            .reduce((sum, i) => sum + i.amount, 0);

        await updateDoc(doc(db, BUDGETS_COLLECTION, caseId), {
            items: updatedItems,
            totalSpent,
            lastUpdated: Date.now()
        });
    }

    /**
     * Update funded amount (from blockchain)
     */
    async updateFundedAmount(caseId: string, amount: number): Promise<void> {
        await updateDoc(doc(db, BUDGETS_COLLECTION, caseId), {
            totalFunded: amount,
            lastUpdated: Date.now()
        });
    }
}

// ============ SINGLETON INSTANCES ============

let withdrawalServiceInstance: WithdrawalService | null = null;
let budgetServiceInstance: BudgetService | null = null;

export const getWithdrawalService = (): WithdrawalService => {
    if (!withdrawalServiceInstance) {
        withdrawalServiceInstance = new WithdrawalService();
    }
    return withdrawalServiceInstance;
};

export const getBudgetService = (): BudgetService => {
    if (!budgetServiceInstance) {
        budgetServiceInstance = new BudgetService();
    }
    return budgetServiceInstance;
};

// ============ HELPER FUNCTIONS ============

export const PURPOSE_LABELS: Record<WithdrawalPurpose, { emoji: string; label: string }> = {
    TRANSPORT: { emoji: '🚗', label: 'Transporte' },
    LEGAL: { emoji: '⚖️', label: 'Legal/Abogado' },
    SHELTER: { emoji: '🏠', label: 'Alojamiento' },
    SUPPLIES: { emoji: '📦', label: 'Suministros' },
    MEDICAL: { emoji: '🏥', label: 'Médico' },
    CHILDREN: { emoji: '👶', label: 'Hijos' },
    DOCUMENTS: { emoji: '📄', label: 'Documentos' },
    OTHER: { emoji: '💰', label: 'Otro' }
};

export const formatPurpose = (purpose: WithdrawalPurpose): string => {
    const info = PURPOSE_LABELS[purpose];
    return `${info.emoji} ${info.label}`;
};
