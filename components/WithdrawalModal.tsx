/**
 * Smart Withdrawal Modal with AI Custody
 * 
 * Flow:
 * 1. Select amount
 * 2. Select purpose
 * 3. Select method (Yape, Bank, ATM, etc.)
 * 4. Chat with Athena for verification (if > $50 requires proof)
 * 5. Processing
 * 6. Success/Error
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, Clock, Send, DollarSign, Upload, Camera, MessageCircle, Building, Smartphone, CreditCard, Globe } from 'lucide-react';
import {
    getWithdrawalService,
    WithdrawalRequest,
    WithdrawalPurpose,
    WithdrawalMethod,
    PURPOSE_LABELS
} from '../lib/withdrawal-service';
import { auth, getSafeContact, SafeContactInfo } from '../lib/firebase';

interface WithdrawalModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableBalance: number;
    caseId: string;
}

const PURPOSES: { value: WithdrawalPurpose; emoji: string; label: string }[] = [
    { value: 'TRANSPORT', emoji: '🚗', label: 'Transporte' },
    { value: 'LEGAL', emoji: '⚖️', label: 'Legal' },
    { value: 'SHELTER', emoji: '🏠', label: 'Alojamiento' },
    { value: 'SUPPLIES', emoji: '📦', label: 'Suministros' },
    { value: 'MEDICAL', emoji: '🏥', label: 'Médico' },
    { value: 'CHILDREN', emoji: '👶', label: 'Hijos' },
    { value: 'DOCUMENTS', emoji: '📄', label: 'Documentos' },
    { value: 'OTHER', emoji: '💰', label: 'Otro' },
];

const METHODS: { value: WithdrawalMethod; icon: React.ReactNode; label: string; color: string }[] = [
    { value: 'YAPE', icon: <Smartphone className="w-5 h-5" />, label: 'Yape', color: 'bg-purple-500' },
    { value: 'PLIN', icon: <Smartphone className="w-5 h-5" />, label: 'Plin', color: 'bg-green-500' },
    { value: 'BCP', icon: <Building className="w-5 h-5" />, label: 'BCP', color: 'bg-blue-600' },
    { value: 'INTERBANK', icon: <Building className="w-5 h-5" />, label: 'Interbank', color: 'bg-green-600' },
    { value: 'BBVA', icon: <Building className="w-5 h-5" />, label: 'BBVA', color: 'bg-blue-800' },
    { value: 'CASH_AGENT', icon: <CreditCard className="w-5 h-5" />, label: 'Agente', color: 'bg-orange-500' },
    { value: 'WESTERN_UNION', icon: <Globe className="w-5 h-5" />, label: 'Western Union', color: 'bg-yellow-500' },
];

type Step = 'amount' | 'purpose' | 'method' | 'verification' | 'processing' | 'success' | 'error';

export const WithdrawalModal: React.FC<WithdrawalModalProps> = ({
    isOpen,
    onClose,
    availableBalance,
    caseId
}) => {
    const [step, setStep] = useState<Step>('amount');
    const [amount, setAmount] = useState('');
    const [purpose, setPurpose] = useState<WithdrawalPurpose | null>(null);
    const [description, setDescription] = useState('');
    const [method, setMethod] = useState<WithdrawalMethod | null>(null);
    const [bankAccount, setBankAccount] = useState('');
    const [safeContact, setSafeContact] = useState<SafeContactInfo | null>(null);
    const [withdrawal, setWithdrawal] = useState<WithdrawalRequest | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Verification chat state
    const [chatInput, setChatInput] = useState('');
    const [isAthenaTyping, setIsAthenaTyping] = useState(false);
    const chatScrollRef = useRef<HTMLDivElement>(null);

    const withdrawalService = getWithdrawalService();
    const requiresProof = parseFloat(amount || '0') > 50;

    useEffect(() => {
        const loadContact = async () => {
            const user = auth.currentUser;
            if (user) {
                const contact = await getSafeContact(user.uid);
                setSafeContact(contact);
            }
        };
        loadContact();
    }, []);

    // Auto-scroll chat
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [withdrawal?.verification?.conversation]);

    // Subscribe to withdrawal updates
    useEffect(() => {
        if (!withdrawal) return;

        const unsubscribe = withdrawalService.subscribeToWithdrawal(
            withdrawal.id,
            (updated) => {
                setWithdrawal(updated);
                if (updated.status === 'COMPLETED') setStep('success');
                else if (updated.status === 'FAILED' || updated.status === 'REJECTED') {
                    setStep('error');
                    setError(updated.statusMessage || 'Error en el proceso');
                }
            }
        );

        return () => unsubscribe();
    }, [withdrawal?.id]);

    const handleCreateWithdrawal = async () => {
        if (!purpose || !amount || !safeContact || !method) return;

        const user = auth.currentUser;
        if (!user) return;

        try {
            const request = await withdrawalService.createWithdrawalRequest(
                user.uid,
                caseId,
                {
                    amountUsd: parseFloat(amount),
                    purpose,
                    description: description || PURPOSE_LABELS[purpose].label,
                    recipientName: safeContact.name,
                    recipientPhone: safeContact.contactInfo || '',
                    recipientMethod: method,
                    recipientBankAccount: bankAccount || undefined
                }
            );

            setWithdrawal(request);
            setStep('verification');
        } catch (err: any) {
            setError(err.message);
            setStep('error');
        }
    };

    const handleSendMessage = async () => {
        if (!chatInput.trim() || !withdrawal) return;

        const userMessage = chatInput.trim();
        setChatInput('');
        setIsAthenaTyping(true);

        // Add user message
        await withdrawalService.addVerificationMessage(withdrawal.id, 'user', userMessage);

        // Simulate Athena response
        setTimeout(async () => {
            const lowerMsg = userMessage.toLowerCase();
            let athenaResponse = '';

            if (lowerMsg.includes('sí') || lowerMsg.includes('si') || lowerMsg.includes('ya')) {
                if (requiresProof && !withdrawal.verification.proofProvided) {
                    athenaResponse = '¡Perfecto! Como el monto es mayor a $50, necesito que subas una foto del precio o comprobante. Usa el botón 📷 para subir la imagen.';
                } else {
                    athenaResponse = '✅ Entendido. Todo parece estar en orden. Voy a aprobar tu retiro ahora.';
                    // Auto-approve after short delay
                    setTimeout(async () => {
                        await withdrawalService.approveWithdrawal(withdrawal.id, 'Verificación completada');
                        // Start processing
                        setStep('processing');
                        simulateExchange();
                    }, 1500);
                }
            } else if (lowerMsg.includes('no')) {
                athenaResponse = 'Por tu seguridad, te recomiendo coordinar primero con tu contacto antes de retirar. ¿Quieres que te ayude con algo más?';
            } else {
                athenaResponse = 'Entiendo. ¿Ya coordinaste con ' + withdrawal.recipientName + ' que recibirá el dinero?';
            }

            await withdrawalService.addVerificationMessage(withdrawal.id, 'athena', athenaResponse);
            setIsAthenaTyping(false);
        }, 1500);
    };

    const handleUploadProof = async () => {
        if (!withdrawal) return;

        // Simulate proof upload
        const fakeProofUrl = 'https://example.com/proof-' + Date.now();
        await withdrawalService.addProof(withdrawal.id, {
            type: 'PRICE_SCREENSHOT',
            imageUrl: fakeProofUrl,
            description: 'Captura de precio'
        });

        setIsAthenaTyping(true);
        setTimeout(async () => {
            await withdrawalService.addVerificationMessage(
                withdrawal.id,
                'athena',
                `📸 Recibí tu comprobante. Veo que es para ${PURPOSE_LABELS[purpose!].label}. ¡Todo verificado! ✅ Procediendo con tu retiro de $${amount}.`
            );
            setIsAthenaTyping(false);

            // Approve and start processing
            setTimeout(async () => {
                await withdrawalService.approveWithdrawal(withdrawal.id, 'Comprobante verificado');
                setStep('processing');
                simulateExchange();
            }, 1000);
        }, 2000);
    };

    const simulateExchange = () => {
        if (!withdrawal) return;

        setTimeout(async () => {
            await withdrawalService.acceptWithdrawal(withdrawal.id, 'demo-exchanger', '0x...');
        }, 2000);

        setTimeout(async () => {
            await withdrawalService.markPaymentSent(withdrawal.id, 'demo-proof');
        }, 4000);

        setTimeout(async () => {
            await withdrawalService.confirmPaymentReceived(withdrawal.id);
            const txHash = '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join('');
            await withdrawalService.completeWithdrawal(withdrawal.id, txHash);
        }, 6000);
    };

    const handleClose = () => {
        setStep('amount');
        setAmount('');
        setPurpose(null);
        setDescription('');
        setMethod(null);
        setBankAccount('');
        setWithdrawal(null);
        setError(null);
        setChatInput('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-neutral-900 rounded-3xl w-full max-w-md border border-neutral-700 animate-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] flex flex-col">

                {/* Header */}
                <div className="flex justify-between items-center p-5 border-b border-neutral-800 shrink-0">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-500" />
                        Retirar Fondos
                    </h3>
                    <button onClick={handleClose} className="text-gray-500 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-5 overflow-y-auto flex-1">

                    {/* Step 1: Amount */}
                    {step === 'amount' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 uppercase tracking-wider">Monto a retirar</label>
                                <div className="relative mt-2">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">$</span>
                                    <input
                                        type="number"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-black border border-neutral-700 rounded-xl pl-10 pr-4 py-4 text-2xl font-mono text-white focus:border-green-500 outline-none"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    Disponible: <span className="text-green-400">${availableBalance.toFixed(2)}</span>
                                    {parseFloat(amount || '0') > 50 && (
                                        <span className="ml-2 text-yellow-400">• Se pedirá comprobante</span>
                                    )}
                                </p>
                            </div>

                            <div className="flex gap-2 flex-wrap">
                                {[25, 50, 100, 200].map(amt => (
                                    <button
                                        key={amt}
                                        onClick={() => setAmount(Math.min(amt, availableBalance).toString())}
                                        disabled={amt > availableBalance}
                                        className="px-4 py-2 bg-neutral-800 rounded-lg text-sm text-gray-300 hover:bg-neutral-700 disabled:opacity-30"
                                    >
                                        ${amt}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={() => setStep('purpose')}
                                disabled={!amount || parseFloat(amount) <= 0 || parseFloat(amount) > availableBalance}
                                className="w-full py-4 bg-athena-600 hover:bg-athena-500 disabled:opacity-50 text-white rounded-xl font-bold"
                            >
                                Continuar
                            </button>
                        </div>
                    )}

                    {/* Step 2: Purpose */}
                    {step === 'purpose' && (
                        <div className="space-y-4">
                            <label className="text-xs text-gray-500 uppercase">¿Para qué es?</label>
                            <div className="grid grid-cols-4 gap-2">
                                {PURPOSES.map(p => (
                                    <button
                                        key={p.value}
                                        onClick={() => setPurpose(p.value)}
                                        className={`p-2 rounded-xl text-center transition ${purpose === p.value ? 'bg-athena-600 border-athena-500' : 'bg-neutral-800 border-neutral-700'
                                            } border`}
                                    >
                                        <span className="text-xl">{p.emoji}</span>
                                        <p className="text-[10px] text-white mt-1">{p.label}</p>
                                    </button>
                                ))}
                            </div>

                            {purpose && (
                                <input
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="Descripción (ej: 3 pasajes Lima-Huancayo)"
                                    className="w-full bg-black border border-neutral-700 rounded-xl px-4 py-3 text-white text-sm"
                                />
                            )}

                            <div className="flex gap-2">
                                <button onClick={() => setStep('amount')} className="flex-1 py-3 bg-neutral-800 text-white rounded-xl">
                                    Atrás
                                </button>
                                <button
                                    onClick={() => setStep('method')}
                                    disabled={!purpose}
                                    className="flex-1 py-3 bg-athena-600 disabled:opacity-50 text-white rounded-xl font-bold"
                                >
                                    Continuar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Method */}
                    {step === 'method' && (
                        <div className="space-y-4">
                            <label className="text-xs text-gray-500 uppercase">¿Cómo quieres recibirlo?</label>

                            <div className="grid grid-cols-3 gap-2">
                                {METHODS.map(m => (
                                    <button
                                        key={m.value}
                                        onClick={() => setMethod(m.value)}
                                        className={`p-3 rounded-xl text-center transition ${method === m.value ? 'ring-2 ring-athena-500' : ''
                                            } bg-neutral-800`}
                                    >
                                        <div className={`w-8 h-8 rounded-full ${m.color} mx-auto flex items-center justify-center text-white mb-1`}>
                                            {m.icon}
                                        </div>
                                        <p className="text-[10px] text-white">{m.label}</p>
                                    </button>
                                ))}
                            </div>

                            {method && ['BCP', 'INTERBANK', 'BBVA', 'SCOTIABANK', 'BN'].includes(method) && (
                                <input
                                    value={bankAccount}
                                    onChange={e => setBankAccount(e.target.value)}
                                    placeholder="Número de cuenta"
                                    className="w-full bg-black border border-neutral-700 rounded-xl px-4 py-3 text-white"
                                />
                            )}

                            {safeContact && (
                                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                                    <p className="text-xs text-gray-400">Destinatario:</p>
                                    <p className="text-white font-medium">{safeContact.name}</p>
                                    <p className="text-sm text-green-400">{safeContact.contactInfo}</p>
                                </div>
                            )}

                            <div className="flex gap-2">
                                <button onClick={() => setStep('purpose')} className="flex-1 py-3 bg-neutral-800 text-white rounded-xl">
                                    Atrás
                                </button>
                                <button
                                    onClick={handleCreateWithdrawal}
                                    disabled={!method}
                                    className="flex-1 py-3 bg-green-600 disabled:opacity-50 text-white rounded-xl font-bold flex items-center justify-center gap-2"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    Verificar con Athena
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Verification Chat */}
                    {step === 'verification' && withdrawal && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-athena-400 text-sm">
                                <MessageCircle className="w-4 h-4" />
                                <span>Chat de Verificación</span>
                                {requiresProof && !withdrawal.verification.proofProvided && (
                                    <span className="text-yellow-400 text-xs">(Requiere comprobante)</span>
                                )}
                            </div>

                            {/* Chat Messages */}
                            <div ref={chatScrollRef} className="h-48 overflow-y-auto space-y-2 bg-black/50 rounded-xl p-3">
                                {withdrawal.verification.conversation.map((msg, i) => (
                                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] rounded-xl p-2 text-xs ${msg.role === 'user' ? 'bg-athena-600 text-white' : 'bg-neutral-800 text-gray-200'
                                            }`}>
                                            {msg.text}
                                        </div>
                                    </div>
                                ))}
                                {isAthenaTyping && (
                                    <div className="flex justify-start">
                                        <div className="bg-neutral-800 rounded-xl p-2 flex gap-1">
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                                            <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Proof Upload Button */}
                            {requiresProof && !withdrawal.verification.proofProvided && (
                                <button
                                    onClick={handleUploadProof}
                                    className="w-full py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-xl text-sm flex items-center justify-center gap-2"
                                >
                                    <Camera className="w-4 h-4" />
                                    📷 Subir Comprobante
                                </button>
                            )}

                            {/* Chat Input */}
                            <div className="flex gap-2">
                                <input
                                    value={chatInput}
                                    onChange={e => setChatInput(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleSendMessage()}
                                    placeholder="Responde a Athena..."
                                    className="flex-1 bg-black border border-neutral-700 rounded-xl px-3 py-2 text-white text-sm"
                                />
                                <button
                                    onClick={handleSendMessage}
                                    disabled={!chatInput.trim() || isAthenaTyping}
                                    className="bg-athena-600 disabled:opacity-50 p-2 rounded-xl"
                                >
                                    <Send className="w-4 h-4 text-white" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 5: Processing */}
                    {step === 'processing' && withdrawal && (
                        <div className="text-center py-6 space-y-4">
                            <div className="relative mx-auto w-16 h-16">
                                <div className="absolute inset-0 rounded-full border-4 border-athena-900 border-t-athena-500 animate-spin"></div>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xl">🤝</span>
                                </div>
                            </div>

                            <h4 className="text-white font-bold">{withdrawal.statusMessage}</h4>

                            <div className="space-y-2 text-left bg-neutral-800 rounded-xl p-3 text-xs">
                                {['PENDING', 'MATCHED', 'PAYMENT_SENT', 'CONFIRMED', 'COMPLETED'].map((s, i) => (
                                    <div key={s} className={`flex items-center gap-2 ${['MATCHED', 'PAYMENT_SENT', 'CONFIRMED', 'COMPLETED'].slice(0, ['MATCHED', 'PAYMENT_SENT', 'CONFIRMED', 'COMPLETED'].indexOf(withdrawal.status) + 1).includes(s as any)
                                            ? 'text-green-400'
                                            : 'text-gray-500'
                                        }`}>
                                        {['MATCHED', 'PAYMENT_SENT', 'CONFIRMED', 'COMPLETED'].indexOf(withdrawal.status) >= i - 1
                                            ? <CheckCircle className="w-3 h-3" />
                                            : <Clock className="w-3 h-3" />
                                        }
                                        <span>{['Athena aprobó', 'Angel encontrado', 'Pago enviado', 'Confirmado', '¡Completado!'][i]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Step 6: Success */}
                    {step === 'success' && withdrawal && (
                        <div className="text-center py-6 space-y-4">
                            <div className="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
                                <CheckCircle className="w-8 h-8 text-green-500" />
                            </div>

                            <h4 className="text-white font-bold text-xl">¡Dinero Enviado!</h4>
                            <p className="text-gray-400 text-sm">
                                ${withdrawal.amountUsd} enviados a {withdrawal.recipientName}
                            </p>

                            <button onClick={handleClose} className="w-full py-3 bg-athena-600 text-white rounded-xl font-bold">
                                Cerrar
                            </button>
                        </div>
                    )}

                    {/* Step 7: Error */}
                    {step === 'error' && (
                        <div className="text-center py-6 space-y-4">
                            <div className="w-16 h-16 mx-auto bg-red-500/20 rounded-full flex items-center justify-center">
                                <AlertCircle className="w-8 h-8 text-red-500" />
                            </div>
                            <h4 className="text-white font-bold">Error</h4>
                            <p className="text-red-400 text-sm">{error}</p>
                            <button onClick={() => { setStep('amount'); setError(null); }} className="w-full py-3 bg-neutral-800 text-white rounded-xl">
                                Intentar de nuevo
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default WithdrawalModal;
