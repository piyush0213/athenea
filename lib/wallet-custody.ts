/**
 * Wallet Custody Service
 * 
 * Manages custodial wallets for users who don't understand crypto.
 * NOW USES SECURE API ROUTE - encryption key not exposed in frontend!
 */

import { ethers, Wallet } from 'ethers';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

// Note: Encryption now handled by /api/wallet route
// No WALLET_SECRET needed in frontend

interface CustodialWallet {
    address: string;
    encryptedPrivateKey: string;
    createdAt: number;
    caseId?: string;
}

interface CaseMetadata {
    caseId: string;
    userId: string;
    walletAddress: string;
    displayName: string;
    story: string;
    goalAmount: number;
    currentAmount: number;
    urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    realName?: string;
    location?: string;
    createdAt: number;
    lastUpdated: number;
    isActive: boolean;
    isPublic: boolean;
}

export class WalletCustodyService {
    private creatingWallets: Set<string> = new Set();

    /**
     * Generate a new custodial wallet for a user via secure API
     */
    async createCustodialWallet(userId: string): Promise<string> {
        if (this.creatingWallets.has(userId)) {
            console.log(`[Custody] Already creating wallet for ${userId}, waiting...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            const existing = await this.getWallet(userId);
            if (existing) return existing.address;
        }

        try {
            this.creatingWallets.add(userId);

            const existingWallet = await this.getWallet(userId);
            if (existingWallet) {
                console.log(`[Custody] Wallet already exists for user ${userId}`);
                return existingWallet.address;
            }

            // Call secure API to create wallet
            const response = await fetch('/api/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'CREATE', userId })
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to create wallet');
            }

            // Save to Firestore
            const custodialWallet: CustodialWallet = {
                address: result.address,
                encryptedPrivateKey: result.encryptedPrivateKey,
                createdAt: Date.now()
            };

            await setDoc(doc(db, `users/${userId}/custody/wallet`), custodialWallet);

            console.log(`[Custody] Created wallet ${result.address} for user ${userId}`);

            return result.address;

        } catch (error) {
            console.error('[Custody] Failed to create wallet:', error);
            throw new Error('Failed to create custodial wallet');
        } finally {
            this.creatingWallets.delete(userId);
        }
    }

    /**
     * Get wallet for a user
     */
    async getWallet(userId: string): Promise<CustodialWallet | null> {
        try {
            const walletDoc = await getDoc(doc(db, `users/${userId}/custody/wallet`));
            if (!walletDoc.exists()) {
                return null;
            }
            return walletDoc.data() as CustodialWallet;
        } catch (error) {
            console.error('[Custody] Failed to get wallet:', error);
            return null;
        }
    }

    /**
     * Get decrypted wallet instance via secure API (for SOS)
     */
    async getWalletInstance(userId: string): Promise<Wallet | null> {
        try {
            const custodialWallet = await this.getWallet(userId);
            if (!custodialWallet) {
                return null;
            }

            // Call secure API to decrypt
            const response = await fetch('/api/wallet', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'DECRYPT',
                    userId,
                    encryptedPrivateKey: custodialWallet.encryptedPrivateKey
                })
            });

            const result = await response.json();

            if (!result.success || !result.privateKey) {
                console.error('[Custody] Failed to decrypt wallet');
                return null;
            }

            return new Wallet(result.privateKey);

        } catch (error) {
            console.error('[Custody] Failed to get wallet instance:', error);
            return null;
        }
    }

    /**
     * Create a case with metadata for public display
     */
    async createCaseWithMetadata(
        userId: string,
        metadata: {
            displayName: string;
            story: string;
            goalAmount: number;
            urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
            realName?: string;
            location?: string;
            isPublic?: boolean;
        }
    ): Promise<string> {
        try {
            let walletAddress = (await this.getWallet(userId))?.address;

            if (!walletAddress) {
                walletAddress = await this.createCustodialWallet(userId);
            }

            const caseId = this.generateCaseId();

            const caseMetadata: any = {
                caseId,
                userId,
                walletAddress,
                displayName: metadata.displayName,
                story: metadata.story,
                goalAmount: metadata.goalAmount,
                currentAmount: 0,
                urgencyLevel: metadata.urgencyLevel,
                createdAt: Date.now(),
                lastUpdated: Date.now(),
                isActive: true,
                isPublic: metadata.isPublic ?? true
            };

            if (metadata.realName) caseMetadata.realName = metadata.realName;
            if (metadata.location) caseMetadata.location = metadata.location;

            await setDoc(doc(db, `cases/${caseId}`), caseMetadata);
            await updateDoc(doc(db, `users/${userId}/custody/wallet`), { caseId });

            console.log(`[Custody] Created case ${caseId} for user ${userId}`);

            return caseId;

        } catch (error) {
            console.error('[Custody] Failed to create case:', error);
            throw new Error('Failed to create case with metadata');
        }
    }

    /**
     * Get case for user
     */
    async getCaseForUser(userId: string): Promise<CaseMetadata | null> {
        try {
            const wallet = await this.getWallet(userId);
            if (!wallet?.caseId) return null;

            const caseDoc = await getDoc(doc(db, `cases/${wallet.caseId}`));
            if (!caseDoc.exists()) return null;

            return caseDoc.data() as CaseMetadata;
        } catch (error) {
            console.error('[Custody] Failed to get case:', error);
            return null;
        }
    }

    /**
     * Update case current amount
     */
    async updateCaseAmount(caseId: string, newAmount: number): Promise<void> {
        try {
            await updateDoc(doc(db, `cases/${caseId}`), {
                currentAmount: newAmount,
                lastUpdated: Date.now()
            });
        } catch (error) {
            console.error('[Custody] Failed to update case amount:', error);
        }
    }

    private generateCaseId(): string {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `ATHENA-${timestamp}-${random}`;
    }

    /**
     * Get case metadata by case ID
     */
    async getCaseMetadata(caseId: string): Promise<CaseMetadata | null> {
        try {
            const caseDoc = await getDoc(doc(db, `cases/${caseId}`));
            if (!caseDoc.exists()) return null;
            return caseDoc.data() as CaseMetadata;
        } catch (error) {
            console.error('[Custody] Failed to get case metadata:', error);
            return null;
        }
    }

    /**
     * Get all public cases for donation page
     */
    async getPublicCases(): Promise<CaseMetadata[]> {
        try {
            const { collection, query, where, getDocs } = await import('firebase/firestore');
            const casesQuery = query(
                collection(db, 'cases'),
                where('isPublic', '==', true),
                where('isActive', '==', true)
            );
            const snapshot = await getDocs(casesQuery);
            return snapshot.docs.map(doc => doc.data() as CaseMetadata);
        } catch (error) {
            console.error('[Custody] Failed to get public cases:', error);
            return [];
        }
    }
}

// Singleton
let custodyServiceInstance: WalletCustodyService | null = null;

export function getCustodyService(): WalletCustodyService {
    if (!custodyServiceInstance) {
        custodyServiceInstance = new WalletCustodyService();
    }
    return custodyServiceInstance;
}

export default WalletCustodyService;
