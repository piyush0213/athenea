/**
 * Public Donation Page - ENHANCED VERSION
 * Better scroll, richer UI, more engaging design
 */

import React, { useState } from 'react';
import { usePublicCases } from '../lib/useCustodialWallet';
import {
    Heart, Users, X, Loader2, Wallet, Copy, Check, Shield,
    ChevronDown, ExternalLink, Sparkles, TrendingUp, Gift,
    ArrowRight, Zap, Globe
} from 'lucide-react';

declare global {
    interface Window {
        ethereum?: any;
    }
}

const FRAXTAL_TESTNET = {
    chainId: '0x9DB',
    chainName: 'Fraxtal Testnet',
    nativeCurrency: { name: 'Frax Ether', symbol: 'frxETH', decimals: 18 },
    rpcUrls: ['https://rpc.testnet.frax.com'],
    blockExplorerUrls: ['https://fraxscan.com']
};

export default function PublicDonationPage() {
    const { cases, loading, error, refresh } = usePublicCases();

    const [showDonationModal, setShowDonationModal] = useState(false);
    const [showTutorial, setShowTutorial] = useState(false);
    const [selectedCase, setSelectedCase] = useState<any>(null);
    const [donationAmount, setDonationAmount] = useState('0.01');
    const [isDonating, setIsDonating] = useState(false);
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

    const handleCopyAddress = (address: string) => {
        navigator.clipboard.writeText(address);
        setCopiedAddress(address);
        setTimeout(() => setCopiedAddress(null), 2000);
    };

    const handleDonateWithMetaMask = async () => {
        if (!selectedCase || !window.ethereum) {
            alert('Instala MetaMask: https://metamask.io');
            return;
        }

        setIsDonating(true);
        try {
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });

            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: FRAXTAL_TESTNET.chainId }],
                });
            } catch (switchError: any) {
                if (switchError.code === 4902) {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [FRAXTAL_TESTNET],
                    });
                }
            }

            const amountInWei = '0x' + (parseFloat(donationAmount) * 1e18).toString(16);
            const txHash = await window.ethereum.request({
                method: 'eth_sendTransaction',
                params: [{ from: accounts[0], to: selectedCase.walletAddress, value: amountInWei }],
            });

            alert(`✅ ¡Gracias!\n\nTX: ${txHash}`);
            setShowDonationModal(false);
        } catch (error: any) {
            if (error.code !== 4001) alert('Error: ' + error.message);
        } finally {
            setIsDonating(false);
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-10 h-10 text-violet-500 animate-spin mx-auto mb-4" />
                    <p className="text-neutral-400">Cargando casos...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 bg-[#0a0a0a] flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error}</p>
                    <button onClick={refresh} className="px-6 py-3 bg-violet-600 text-white rounded-xl font-medium">
                        Reintentar
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div
            className="bg-[#0a0a0a] text-white"
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                overflowY: 'scroll',
                overflowX: 'hidden'
            }}
        >
            {/* Background effects */}
            <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-violet-600/5 rounded-full blur-[150px] pointer-events-none" />
            <div className="fixed bottom-0 right-0 w-[400px] h-[400px] bg-fuchsia-600/5 rounded-full blur-[150px] pointer-events-none" />

            {/* Hero Section */}
            <header className="relative border-b border-white/5 bg-gradient-to-b from-violet-950/20 to-transparent">
                <div className="max-w-6xl mx-auto px-6 py-16 md:py-20">
                    {/* Badge */}
                    <div className="flex items-center gap-3 mb-6">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                            <Heart className="w-4 h-4 text-violet-400" fill="currentColor" />
                            <span className="text-violet-400 text-sm font-medium">ANGELS POOL</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                            <span className="text-emerald-400 text-xs font-medium">LIVE</span>
                        </div>
                    </div>

                    {/* Title */}
                    <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
                        Ayuda a una mujer a<br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
                            alcanzar su libertad
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-neutral-400 max-w-2xl mb-8">
                        100% de tu donación va directo a su wallet en blockchain.
                        Sin intermediarios. Sin comisiones. Total transparencia.
                    </p>

                    {/* Stats */}
                    <div className="flex flex-wrap gap-6">
                        <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                            <Users className="w-5 h-5 text-violet-400" />
                            <div>
                                <p className="text-white font-bold">{cases.length}</p>
                                <p className="text-neutral-500 text-xs">Casos activos</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                            <Shield className="w-5 h-5 text-emerald-400" />
                            <div>
                                <p className="text-white font-bold">Fraxtal L2</p>
                                <p className="text-neutral-500 text-xs">Verificado on-chain</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/5">
                            <TrendingUp className="w-5 h-5 text-yellow-400" />
                            <div>
                                <p className="text-white font-bold">4.5% APY</p>
                                <p className="text-neutral-500 text-xs">Yield en espera</p>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* How to donate */}
            <section className="border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6">
                    <button
                        onClick={() => setShowTutorial(!showTutorial)}
                        className="w-full py-5 flex items-center justify-between text-neutral-400 hover:text-white transition group"
                    >
                        <span className="flex items-center gap-2">
                            <Zap className="w-4 h-4 text-yellow-400" />
                            <span>¿Cómo donar? Es fácil y rápido</span>
                        </span>
                        <ChevronDown className={`w-5 h-5 transition-transform ${showTutorial ? 'rotate-180' : ''}`} />
                    </button>

                    {showTutorial && (
                        <div className="pb-8 grid md:grid-cols-3 gap-4">
                            <div className="p-5 bg-gradient-to-br from-violet-500/10 to-transparent rounded-2xl border border-violet-500/20">
                                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center mb-4">
                                    <span className="text-violet-400 font-bold">1</span>
                                </div>
                                <h4 className="font-medium text-white mb-2">Elige un caso</h4>
                                <p className="text-sm text-neutral-400">
                                    Revisa las historias y elige a quién ayudar
                                </p>
                            </div>
                            <div className="p-5 bg-gradient-to-br from-fuchsia-500/10 to-transparent rounded-2xl border border-fuchsia-500/20">
                                <div className="w-10 h-10 rounded-xl bg-fuchsia-500/20 flex items-center justify-center mb-4">
                                    <span className="text-fuchsia-400 font-bold">2</span>
                                </div>
                                <h4 className="font-medium text-white mb-2">Click en "Donar"</h4>
                                <p className="text-sm text-neutral-400">
                                    Conecta MetaMask y elige el monto
                                </p>
                            </div>
                            <div className="p-5 bg-gradient-to-br from-emerald-500/10 to-transparent rounded-2xl border border-emerald-500/20">
                                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
                                    <span className="text-emerald-400 font-bold">3</span>
                                </div>
                                <h4 className="font-medium text-white mb-2">¡Listo!</h4>
                                <p className="text-sm text-neutral-400">
                                    Tu donación llega directa a su wallet
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Cases Grid */}
            <main className="max-w-6xl mx-auto px-6 py-12">
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Gift className="w-6 h-6 text-violet-400" />
                        Casos que necesitan tu ayuda
                    </h2>
                    <button
                        onClick={refresh}
                        className="text-sm text-neutral-500 hover:text-white transition flex items-center gap-1"
                    >
                        <Loader2 className="w-4 h-4" />
                        Actualizar
                    </button>
                </div>

                {cases.length === 0 ? (
                    <div className="text-center py-20">
                        <Heart className="w-16 h-16 text-neutral-700 mx-auto mb-4" />
                        <p className="text-neutral-500 text-lg">No hay casos activos en este momento</p>
                        <p className="text-neutral-600 text-sm mt-2">Vuelve pronto para ayudar</p>
                    </div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-6">
                        {cases.map((caseInfo) => (
                            <article
                                key={caseInfo.caseId}
                                className="bg-gradient-to-br from-white/[0.03] to-transparent border border-white/10 rounded-3xl p-6 hover:border-violet-500/30 transition-all duration-300 group"
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-xl font-bold text-white mb-1 group-hover:text-violet-300 transition">
                                            {caseInfo.displayName}
                                        </h3>
                                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${caseInfo.urgencyLevel === 'CRITICAL'
                                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                            : caseInfo.urgencyLevel === 'HIGH'
                                                ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                                                : 'bg-violet-500/20 text-violet-400 border border-violet-500/30'
                                            }`}>
                                            <Sparkles className="w-3 h-3" />
                                            {caseInfo.urgencyLevel === 'CRITICAL' ? 'Crítico' :
                                                caseInfo.urgencyLevel === 'HIGH' ? 'Urgente' : 'Activo'}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-bold text-white">${caseInfo.goalAmount}</p>
                                        <p className="text-xs text-neutral-500">Meta</p>
                                    </div>
                                </div>

                                {/* Story */}
                                <p className="text-neutral-400 mb-5 leading-relaxed line-clamp-3">
                                    {caseInfo.story}
                                </p>

                                {/* Budget breakdown */}
                                <div className="mb-5 p-4 bg-black/30 rounded-2xl border border-white/5">
                                    <p className="text-xs text-neutral-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Globe className="w-3 h-3" />
                                        Uso de los fondos
                                    </p>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="text-neutral-400">⚖️ Legal</span>
                                            <span className="text-white font-medium">$400</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-neutral-400">🚗 Transporte</span>
                                            <span className="text-white font-medium">$100</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-neutral-400">🏠 Alojamiento</span>
                                            <span className="text-white font-medium">$500</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-neutral-400">📦 Suministros</span>
                                            <span className="text-white font-medium">$100</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Progress bar */}
                                <div className="mb-5">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-neutral-400">Recaudado</span>
                                        <span className="text-white font-bold">
                                            ${caseInfo.currentAmount.toFixed(0)} / ${caseInfo.goalAmount.toFixed(0)}
                                        </span>
                                    </div>
                                    <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(caseInfo.progress, 100)}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-1 text-right">
                                        {caseInfo.progress.toFixed(0)}% completado
                                    </p>
                                </div>

                                {/* Wallet address */}
                                <div className="flex items-center gap-2 mb-5 p-3 bg-black/20 rounded-xl">
                                    <code className="text-neutral-500 text-xs font-mono flex-1 truncate">
                                        {caseInfo.walletAddress}
                                    </code>
                                    <button
                                        onClick={() => handleCopyAddress(caseInfo.walletAddress)}
                                        className="p-2 hover:bg-white/10 rounded-lg transition"
                                        title="Copiar wallet"
                                    >
                                        {copiedAddress === caseInfo.walletAddress ? (
                                            <Check className="w-4 h-4 text-emerald-400" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-neutral-500" />
                                        )}
                                    </button>
                                    <a
                                        href={`https://fraxscan.com/address/${caseInfo.walletAddress}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="p-2 hover:bg-white/10 rounded-lg transition"
                                        title="Ver en explorador"
                                    >
                                        <ExternalLink className="w-4 h-4 text-neutral-500" />
                                    </a>
                                </div>

                                {/* CTA */}
                                <button
                                    onClick={() => {
                                        setSelectedCase(caseInfo);
                                        setShowDonationModal(true);
                                    }}
                                    className="w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-2 shadow-lg shadow-violet-900/30 hover:shadow-violet-900/50 hover:scale-[1.02] active:scale-[0.98]"
                                >
                                    <Heart className="w-5 h-5" fill="currentColor" />
                                    Donar ahora
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </article>
                        ))}
                    </div>
                )}
            </main>

            {/* Footer */}
            <footer className="border-t border-white/5 py-16 mt-12">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    {/* Trust badges */}
                    <div className="flex flex-wrap justify-center items-center gap-8 mb-8">
                        <div className="flex items-center gap-2 text-neutral-500">
                            <Shield className="w-5 h-5" />
                            <span>Verificado en Fraxtal</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-500">
                            <Heart className="w-5 h-5" />
                            <span>0% comisiones</span>
                        </div>
                        <div className="flex items-center gap-2 text-neutral-500">
                            <Sparkles className="w-5 h-5" />
                            <span>100% transparente</span>
                        </div>
                    </div>

                    <p className="text-neutral-600 text-sm mb-4">
                        Powered by Fraxtal L2 • Athena AI Agent
                    </p>

                    <a
                        href="https://app.iqai.com/agents/0xce4f65d10b16ff7ab32581d3f66d570ac76d03b4"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-violet-400 hover:text-violet-300 text-sm transition"
                    >
                        <ExternalLink className="w-4 h-4" />
                        Ver agente Athena en IQAI
                    </a>
                </div>
            </footer>

            {/* Donation Modal */}
            {showDonationModal && selectedCase && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gradient-to-br from-[#151515] to-[#0f0f0f] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold text-white">
                                    Donar a {selectedCase.displayName}
                                </h3>
                                <p className="text-neutral-500 text-sm">
                                    Meta: ${selectedCase.goalAmount}
                                </p>
                            </div>
                            <button
                                onClick={() => setShowDonationModal(false)}
                                className="p-2 hover:bg-white/10 rounded-xl transition"
                            >
                                <X className="w-5 h-5 text-neutral-400" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="text-sm text-neutral-400 block mb-2">
                                    Cantidad (frxETH)
                                </label>
                                <input
                                    type="number"
                                    value={donationAmount}
                                    onChange={(e) => setDonationAmount(e.target.value)}
                                    step="0.001"
                                    className="w-full px-5 py-4 bg-black/50 border border-white/10 rounded-2xl text-2xl font-mono text-center focus:border-violet-500 outline-none transition"
                                />
                            </div>

                            <div className="flex gap-2">
                                {['0.01', '0.05', '0.1', '0.5'].map((amt) => (
                                    <button
                                        key={amt}
                                        onClick={() => setDonationAmount(amt)}
                                        className={`flex-1 py-3 rounded-xl text-sm font-bold transition ${donationAmount === amt
                                            ? 'bg-violet-600 text-white'
                                            : 'bg-white/5 text-neutral-400 hover:bg-white/10'
                                            }`}
                                    >
                                        {amt}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleDonateWithMetaMask}
                                disabled={isDonating}
                                className="w-full py-5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:from-neutral-700 disabled:to-neutral-700 text-white rounded-2xl font-bold transition-all flex items-center justify-center gap-3 shadow-lg shadow-violet-900/30"
                            >
                                {isDonating ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Wallet className="w-5 h-5" />
                                        Confirmar con MetaMask
                                    </>
                                )}
                            </button>

                            <p className="text-center text-xs text-neutral-500">
                                💜 100% va directo a su wallet on-chain
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
