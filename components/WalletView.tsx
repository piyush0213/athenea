
import React, { useEffect, useState } from 'react';
import { WalletState } from '../types';
import { useAthenaAgent } from '../lib/useAthenaAgent';
import { useCustodialWallet } from '../lib/useCustodialWallet';
import { useBlockchainBalance } from '../lib/useBlockchainBalance';
import { Loader2, RefreshCw, TrendingUp, Users, CreditCard, Settings, X, ArrowRight, Wallet, Send, Banknote } from 'lucide-react';
import { auth, getSafeContact, SafeContactInfo } from '../lib/firebase';
import { WithdrawalModal } from './WithdrawalModal';

interface WalletViewProps {
  onOpenSettings: () => void;
}

export const WalletView: React.FC<WalletViewProps> = ({ onOpenSettings }) => {
  const { vaultState, isLoading, refreshVaultState, isOnline, agentState, triggerSOS } = useAthenaAgent();

  // Custodial wallet hook
  const { caseInfo, refreshCaseInfo } = useCustodialWallet();

  // Blockchain balance hook (REAL balance from blockchain)
  const { balance: blockchainBalance, loading: balanceLoading } = useBlockchainBalance(
    caseInfo?.walletAddress || null
  );

  // Modal states
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState('');
  const [depositPhone, setDepositPhone] = useState('');
  const [depositCode, setDepositCode] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [safeContact, setSafeContact] = useState<SafeContactInfo | null>(null);

  // Local wallet state that combines blockchain data with UI state
  const [wallet, setWallet] = useState<WalletState>({
    totalValue: 0,
    savings: 0,
    yieldEarned: 0,
    communityAngels: 0,
    freedomGoalAmount: 0, // Will be set from escape plan
    apy: 5.4,
  });

  // Load safe contact from Firestore
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

  // Sync with blockchain state when available
  useEffect(() => {
    if (vaultState) {
      setWallet(prev => ({
        ...prev,
        totalValue: vaultState.totalValueUsd,
        savings: vaultState.fraxBalance,
        yieldEarned: vaultState.sFraxValueInFrax - vaultState.sFraxBalance, // Accrued yield
        apy: vaultState.apy,
      }));
    }
  }, [vaultState]);

  // Load escape plan from Firestore on mount
  useEffect(() => {
    const loadPlanFromFirestore = async () => {
      const { auth, loadEscapePlan } = await import('../lib/firebase');
      const user = auth.currentUser;
      if (user) {
        try {
          const plan = await loadEscapePlan(user.uid);
          if (plan?.freedomGoal?.targetAmount) {
            setWallet(prev => ({
              ...prev,
              freedomGoalAmount: plan.freedomGoal.targetAmount,
            }));
            console.log('[WalletView] Loaded goal from Firestore:', plan.freedomGoal.targetAmount);
          }
        } catch (e) {
          console.warn('[WalletView] Failed to load plan:', e);
        }
      }
    };
    loadPlanFromFirestore();
  }, []);

  // Also sync with agentState if updated during session
  useEffect(() => {
    if (agentState.escapePlan?.freedomGoal) {
      setWallet(prev => ({
        ...prev,
        freedomGoalAmount: agentState.escapePlan!.freedomGoal.targetAmount,
      }));
    }
  }, [agentState.escapePlan]);

  // Note: Yield simulation removed to show real values only
  // Real yield comes from blockchain via vaultState

  const progressPercentage = wallet.freedomGoalAmount > 0
    ? Math.min((wallet.totalValue / wallet.freedomGoalAmount) * 100, 100)
    : 0;

  const handleRefresh = async () => {
    await refreshVaultState();
  };

  const handleRecharge = async () => {
    if (!rechargeAmount || parseFloat(rechargeAmount) <= 0) return;
    if (!depositCode && !depositPhone) { // Basic validation
      alert('Please enter payment details (Phone or Code)');
      return;
    }

    setIsProcessing(true);
    // Simulate deposit verification
    await new Promise(resolve => setTimeout(resolve, 2000));

    const amount = parseFloat(rechargeAmount);
    setWallet(prev => ({
      ...prev,
      savings: prev.savings + amount,
      totalValue: prev.totalValue + amount
    }));

    setIsProcessing(false);
    setShowRechargeModal(false);
    setRechargeAmount('');
    setDepositPhone('');
    setDepositCode('');
    alert('Deposit submitted for verification. Funds added to vault.');
  };

  const handleSendToSafe = async () => {
    if (!safeContact) return;

    setIsProcessing(true);
    // Simulate transfer (in real app, would trigger actual blockchain transfer)
    await new Promise(resolve => setTimeout(resolve, 2500));

    // Show success
    setIsProcessing(false);
    setShowSendModal(false);
    alert(`Transfer initiated: $${wallet.totalValue.toFixed(2)} to ${safeContact.name}`);
  };

  return (
    <div className="p-6 space-y-6 h-full overflow-y-auto pb-24">

      {/* Header Line */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold text-athena-500">Freedom Vault</h2>
          {/* Connection Status Indicator */}
          <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
            {isOnline ? 'FRAXTAL L2' : 'CONNECTING...'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-neutral-700 transition disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
          </button>
          <button
            onClick={onOpenSettings}
            className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center text-gray-400 hover:text-white hover:bg-neutral-700 transition"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Balance Card */}
      <div className="bg-gradient-to-br from-athena-900 to-athena-800 p-6 rounded-3xl shadow-2xl border border-athena-600 relative overflow-hidden">
        {/* Abstract Background Shape */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-athena-500/10 rounded-full blur-3xl -mr-10 -mt-10"></div>

        <div className="relative z-10">
          <p className="text-athena-100 text-sm font-medium opacity-80">Total Freedom Funds</p>
          <h3 className="text-5xl font-bold text-white mt-2 tracking-tight">
            ${wallet.totalValue.toFixed(2)}
          </h3>

          {/* Progress Bar */}
          <div className="mt-6">
            <div className="flex justify-between text-xs font-semibold mb-2">
              <span className="text-athena-200">{progressPercentage.toFixed(0)}% of Goal</span>
              <span className="text-athena-200/60">${wallet.freedomGoalAmount} Goal</span>
            </div>
            <div className="w-full bg-black/30 h-3 rounded-full overflow-hidden backdrop-blur-sm">
              <div
                className="bg-white h-full rounded-full shadow-[0_0_15px_rgba(255,255,255,0.5)] transition-all duration-1000 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Human Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setShowRechargeModal(true)}
          className="bg-green-600 hover:bg-green-500 text-white py-4 rounded-2xl font-bold transition flex flex-col items-center justify-center shadow-lg shadow-green-900/20 group active:scale-95"
        >
          <div className="bg-green-500/20 p-2 rounded-full mb-2 group-hover:bg-green-500/30 transition">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
          </div>
          <span>⚡ Recharge</span>
        </button>

        <button
          onClick={() => setShowWithdrawalModal(true)}
          className="bg-purple-600 hover:bg-purple-500 text-white py-4 rounded-2xl font-bold transition flex flex-col items-center justify-center shadow-lg shadow-purple-900/20 group active:scale-95"
        >
          <div className="bg-purple-500/20 p-2 rounded-full mb-2 group-hover:bg-purple-500/30 transition">
            <Banknote className="w-6 h-6" />
          </div>
          <span>💸 Retirar a Yape</span>
        </button>
      </div>

      {/* Funding Sources (Social Impact) */}
      <div className="bg-neutral-900/50 p-5 rounded-3xl border border-neutral-800">
        <h4 className="text-gray-400 text-xs uppercase tracking-wider font-bold mb-4 ml-1">Funding Sources</h4>
        <div className="space-y-4">

          {/* Angels */}
          <div className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white font-medium text-sm flex items-center gap-2">
                  Community Angels
                  {balanceLoading && (
                    <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                  )}
                </p>
                {caseInfo ? (
                  <p className="text-xs text-purple-400">
                    {caseInfo.displayName} - {caseInfo.progress.toFixed(0)}% funded
                    {blockchainBalance && (
                      <span className="ml-2 text-green-400">
                        • {blockchainBalance.balanceInEth.toFixed(4)} frxETH
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-purple-400">12 Anonymous Donors</p>
                )}
              </div>
            </div>
            <div className="text-right">
              <span className="text-white font-mono font-bold block">
                +${blockchainBalance
                  ? blockchainBalance.balanceInUsd.toFixed(2)
                  : (caseInfo ? caseInfo.currentAmount.toFixed(2) : wallet.communityAngels.toFixed(2))
                }
              </span>
              {blockchainBalance && (
                <span className="text-xs text-green-400">Blockchain ✓</span>
              )}
            </div>
          </div>

          {/* Yield */}
          <div className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">Yield Earned (sFRAX)</p>
                <p className="text-xs text-green-400">Stablecoin Growth ({wallet.apy}% APY)</p>
              </div>
            </div>
            <span className="text-green-400 font-mono font-bold">+${wallet.yieldEarned.toFixed(4)}</span>
          </div>

          {/* Savings */}
          <div className="flex items-center justify-between p-3 hover:bg-white/5 rounded-xl transition">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center">
                <CreditCard className="w-6 h-6" />
              </div>
              <div>
                <p className="text-white font-medium text-sm">My Savings</p>
                <p className="text-xs text-blue-400">Encrypted Deposits</p>
              </div>
            </div>
            <span className="text-white font-mono font-bold">+${wallet.savings.toFixed(2)}</span>
          </div>

        </div>
      </div>

      {/* ============ RECHARGE MODAL ============ */}
      {showRechargeModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-3xl p-6 w-full max-w-sm border border-neutral-700 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-green-500" />
                Recharge Vault
              </h3>
              <button
                onClick={() => setShowRechargeModal(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 uppercase tracking-wider">Amount (USD)</label>
                <div className="relative mt-2">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xl">$</span>
                  <input
                    type="number"
                    value={rechargeAmount}
                    onChange={e => setRechargeAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black border border-neutral-700 rounded-xl pl-10 pr-4 py-4 text-2xl font-mono text-white focus:border-green-500 outline-none"
                  />
                </div>
              </div>

              {/* Quick Amounts */}
              <div className="flex gap-2">
                {[10, 25, 50, 100].map(amount => (
                  <button
                    key={amount}
                    onClick={() => setRechargeAmount(amount.toString())}
                    className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition"
                  >
                    ${amount}
                  </button>
                ))}
              </div>

              {/* Payment Methods */}
              <div className="bg-neutral-800 rounded-xl p-4 space-y-3">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Deposit Options</p>

                {/* Yape */}
                <div className="flex items-center gap-3 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                  <span className="text-2xl">📱</span>
                  <div className="flex-1">
                    <p className="text-purple-400 font-medium text-sm">Yape / Plin</p>
                    <p className="text-gray-500 text-xs">Send to: +51 999 888 777</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText('+51999888777'); alert('Number copied!') }}
                    className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded"
                  >
                    COPY
                  </button>
                </div>

                {/* Crypto */}
                <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <span className="text-2xl">🔐</span>
                  <div className="flex-1">
                    <p className="text-green-400 font-medium text-sm">USDC / FRAX (Fraxtal)</p>
                    <p className="text-gray-500 text-xs font-mono truncate">0x4Bca7eb...81605</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText('0x4Bca7ebC3Cba0ea5Ada962E319BfB8353De81605'); alert('Address copied!') }}
                    className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded"
                  >
                    COPY
                  </button>
                </div>
              </div>

              {/* Payment Verification Form */}
              <div className="bg-neutral-800 rounded-xl p-4 space-y-4">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Payment Proof</p>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Your Phone Number (Yape/Plin)</label>
                  <input
                    type="text"
                    value={depositPhone}
                    onChange={e => setDepositPhone(e.target.value)}
                    placeholder="+51 900 000 000"
                    className="w-full bg-black/50 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:border-green-500 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">Approval Code / Hash</label>
                  <input
                    type="text"
                    value={depositCode}
                    onChange={e => setDepositCode(e.target.value)}
                    placeholder="Operation #123456"
                    className="w-full bg-black/50 border border-neutral-700 rounded-lg px-3 py-2 text-sm text-white focus:border-green-500 outline-none"
                  />
                </div>
              </div>

              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-sm">
                <p className="text-green-400 font-medium mb-1">🔐 How it works</p>
                <p className="text-gray-400 text-xs">
                  1. Send amount to <strong>+51 980 500 802</strong> (Athena Vault)<br />
                  2. Enter your details above for verification<br />
                  3. Funds are converted to sFRAX (5.4% APY)
                </p>
              </div>

              <button
                onClick={handleRecharge}
                disabled={isProcessing || !rechargeAmount || (!depositCode && !depositPhone)}
                className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-neutral-700 disabled:text-gray-500 text-white rounded-xl font-bold transition flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    Confirm Deposit
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ SEND TO SAFE MODAL ============ */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 rounded-3xl p-6 w-full max-w-sm border border-neutral-700 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-orange-500" />
                Send to Safe Contact
              </h3>
              <button
                onClick={() => setShowSendModal(false)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {safeContact ? (
              <div className="space-y-4">
                {/* Contact Info */}
                <div className="bg-neutral-800 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Sending To</p>
                  <p className="text-white font-bold">{safeContact.name}</p>
                  <p className="text-gray-400 text-sm">{safeContact.relationship}</p>
                  <p className="text-gray-500 text-xs mt-1 font-mono">
                    {safeContact.contactInfo || safeContact.phoneNumber || safeContact.walletAddress}
                  </p>

                  {/* Method Badge */}
                  <div className="mt-3">
                    {safeContact.withdrawalMethod === 'PHONE' ? (
                      <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs">📱 Mobile Money</span>
                    ) : safeContact.withdrawalMethod === 'CASH_CODE' ? (
                      <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-xs">💵 Cash Pickup</span>
                    ) : (
                      <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded text-xs">🔐 Crypto Wallet</span>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Amount to Send</p>
                  <p className="text-3xl font-mono font-bold text-white mt-1">
                    ${wallet.totalValue.toFixed(2)}
                  </p>
                  <p className="text-orange-400 text-xs mt-1">
                    Entire vault balance will be transferred
                  </p>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm">
                  <p className="text-red-400 font-medium mb-1">⚠️ Warning</p>
                  <p className="text-gray-400 text-xs">
                    This will transfer ALL funds to your safe contact.
                    Use the SOS button for emergency situations.
                  </p>
                </div>

                <button
                  onClick={handleSendToSafe}
                  disabled={isProcessing}
                  className="w-full py-4 bg-orange-600 hover:bg-orange-500 disabled:bg-neutral-700 text-white rounded-xl font-bold transition flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Transferring...
                    </>
                  ) : (
                    <>
                      Confirm Transfer
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto bg-neutral-800 rounded-full flex items-center justify-center mb-4">
                  <Users className="w-8 h-8 text-gray-600" />
                </div>
                <p className="text-gray-400 mb-2">No Safe Contact Set</p>
                <p className="text-gray-600 text-sm mb-4">
                  Complete your escape plan with Athena to set up an emergency contact.
                </p>
                <button
                  onClick={() => setShowSendModal(false)}
                  className="text-athena-400 text-sm hover:underline"
                >
                  Go to Plan tab
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Withdrawal Modal */}
      <WithdrawalModal
        isOpen={showWithdrawalModal}
        onClose={() => setShowWithdrawalModal(false)}
        availableBalance={blockchainBalance?.balanceInUsd || caseInfo?.currentAmount || 0}
        caseId={caseInfo?.caseId || ''}
      />
    </div>
  );
};
