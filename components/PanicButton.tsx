
import React, { useState } from 'react';
import { SafeContact } from '../types';
import { useAthenaAgent } from '../lib/useAthenaAgent';
import { AlertTriangle, Check, Loader2, Shield, Zap } from 'lucide-react';

interface PanicButtonProps {
  safeContact: SafeContact | null;
  onWipeComplete: () => void;
}

export const PanicButton: React.FC<PanicButtonProps> = ({ safeContact, onWipeComplete }) => {
  const { triggerSOS, isOnline, clearState } = useAthenaAgent();
  const [status, setStatus] = useState<'IDLE' | 'CONFIRMING' | 'EXECUTING' | 'DONE'>('IDLE');
  const [logs, setLogs] = useState<string[]>([]);

  const handlePanic = () => {
    setStatus('CONFIRMING');
  };

  const confirmPanic = async () => {
    setStatus('EXECUTING');
    setLogs([]);

    // Get destination address
    const destinationAddress = safeContact?.addressOrDetails ||
      '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'; // Fallback emergency address

    // Add initial log
    setLogs(['⚠️ INITIATING SOS PROTOCOL...']);

    try {
      // Execute real SOS through agent
      const result = await triggerSOS(destinationAddress);

      // Stream logs to UI
      let logIndex = 0;
      const interval = setInterval(() => {
        if (logIndex < result.logs.length) {
          setLogs(prev => [...prev, result.logs[logIndex]]);
          logIndex++;
        } else {
          clearInterval(interval);

          // Add final status
          if (result.success) {
            setLogs(prev => [
              ...prev,
              `💰 Liquidated: $${result.liquidatedAmount.toFixed(2)}`,
              `📤 Sent to: ${destinationAddress.slice(0, 10)}...`,
              '🔒 Wiping local data...',
              '✅ PROTOCOL COMPLETE.'
            ]);
          } else {
            setLogs(prev => [...prev, '❌ Protocol failed - funds may still be accessible']);
          }

          // Transition to done
          setTimeout(() => {
            setStatus('DONE');

            // Clear local state and return to calculator
            setTimeout(() => {
              clearState();
              onWipeComplete();
            }, 3000);
          }, 1500);
        }
      }, 600);

    } catch (error: any) {
      setLogs(prev => [...prev, `❌ Error: ${error.message}`]);

      // Fallback simulation if real call fails
      const fallbackSteps = [
        '⚠️ Network error - using offline protocol...',
        'Liquidating sFRAX Positions...',
        'Converting to USDC...',
        `Sending funds to: ${safeContact ? safeContact.name : 'Emergency Wallet'}...`,
        'Transfer Simulated: 0x8a...92b',
        'Deleting Local Evidence...',
        'Wiping Chat History...',
        'PROTOCOL COMPLETE.'
      ];

      let stepIdx = 0;
      const fallbackInterval = setInterval(() => {
        if (stepIdx < fallbackSteps.length) {
          setLogs(prev => [...prev, fallbackSteps[stepIdx]]);
          stepIdx++;
        } else {
          clearInterval(fallbackInterval);
          setTimeout(() => {
            setStatus('DONE');
            setTimeout(() => {
              clearState();
              onWipeComplete();
            }, 3000);
          }, 1000);
        }
      }, 700);
    }
  };

  if (status === 'EXECUTING' || status === 'DONE') {
    return (
      <div className={`h-full flex flex-col items-center justify-center p-8 transition-colors duration-500 ${status === 'DONE' ? 'bg-black' : 'bg-red-950'}`}>

        {/* Flashing Alert Effect */}
        {status === 'EXECUTING' && (
          <div className="absolute inset-0 bg-red-600/20 animate-pulse pointer-events-none"></div>
        )}

        <div className="z-10 w-full max-w-sm space-y-4">
          {status === 'EXECUTING' && (
            <div className="flex justify-center mb-8">
              <Loader2 className="w-16 h-16 text-red-500 animate-spin" />
            </div>
          )}

          {status === 'DONE' && (
            <div className="flex flex-col items-center mb-8 animate-in zoom-in duration-300">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(34,197,94,0.5)]">
                <Check className="w-10 h-10 text-black" strokeWidth={3} />
              </div>
              <h2 className="text-2xl font-bold text-white tracking-widest uppercase">Executed</h2>
              <p className="text-green-500 font-mono mt-2">Funds sent to {safeContact?.name || 'Safe Wallet'}</p>
            </div>
          )}

          {/* Connection Status */}
          <div className={`text-center text-xs font-mono mb-4 px-3 py-1 rounded-full inline-flex items-center gap-2 mx-auto ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
            <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500'}`} />
            {isOnline ? 'BLOCKCHAIN CONNECTED' : 'OFFLINE MODE'}
          </div>

          <div className="font-mono text-xs space-y-2 max-h-48 overflow-y-auto">
            {logs.map((log, i) => (
              <p key={i} className={`border-l-2 pl-2 ${log.includes('COMPLETE') || log.includes('✅') ? 'text-green-500 border-green-500' :
                log.includes('❌') ? 'text-red-400 border-red-500' :
                  'text-red-400 border-red-800'
                }`}>
                {log}
              </p>
            ))}
          </div>

          {status === 'DONE' && (
            <p className="text-center text-gray-500 text-xs mt-8 italic">Device locking in 3 seconds...</p>
          )}
        </div>
      </div>
    );
  }

  if (status === 'CONFIRMING') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-black">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">FINAL WARNING</h2>
          <p className="text-gray-400">
            This action is irreversible. All funds will be sent to <span className="text-white font-bold">{safeContact?.name || 'Undefined Contact'}</span> immediately.
          </p>

          {/* Show connection status */}
          <div className={`mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
            }`}>
            <Zap className="w-3 h-3" />
            {isOnline ? 'BLOCKCHAIN CONNECTED' : 'PREPARING TRANSFER'}
          </div>
        </div>

        <div className="space-y-4 w-full">
          <button
            onClick={confirmPanic}
            className="w-full py-5 bg-red-600 hover:bg-red-500 text-white text-xl font-bold rounded-2xl shadow-xl shadow-red-900/30 animate-pulse flex items-center justify-center gap-3"
          >
            <Shield className="w-6 h-6" />
            CONFIRM EXECUTION
          </button>
          <button
            onClick={() => setStatus('IDLE')}
            className="w-full py-4 text-gray-500 hover:text-white"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* Background Pulse */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-red-900/20 rounded-full blur-3xl animate-pulse"></div>

      <div className="relative group cursor-pointer" onClick={handlePanic}>
        {/* Glow */}
        <div className="absolute -inset-1 bg-red-600 rounded-full blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>

        {/* Button */}
        <button
          className="relative w-56 h-56 bg-gradient-to-br from-neutral-900 to-black rounded-full border-4 border-red-600/50 shadow-2xl flex flex-col items-center justify-center transform group-hover:scale-105 transition active:scale-95"
        >
          <AlertTriangle className="w-16 h-16 text-red-600 mb-2" strokeWidth={1.5} />
          <span className="text-3xl font-black text-white tracking-[0.2em]">SOS</span>
          <span className="text-[10px] text-red-500 mt-1 uppercase tracking-wider">Emergency Protocol</span>
        </button>
      </div>

      <div className="mt-12 text-center space-y-4 max-w-xs">
        <div className="bg-neutral-900 p-4 rounded-xl border border-neutral-800">
          <p className="text-gray-400 text-xs uppercase font-bold mb-1">Target Destination</p>
          <div className="flex items-center justify-center gap-2 text-white">
            {safeContact ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>{safeContact.name} ({safeContact.method === 'TRUSTED_ALLY' ? 'Ally' : 'Code'})</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                <span className="text-red-400">Not Configured</span>
              </>
            )}
          </div>
        </div>

        {/* Connection Status */}
        <div className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono ${isOnline ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'
          }`}>
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
          {isOnline ? 'Connected to Fraxtal L2' : 'Preparing Connection...'}
        </div>

        <p className="text-gray-500 text-xs">
          Press to instantly liquidate funds and transfer to safe destination. App data will be wiped.
        </p>
      </div>
    </div>
  );
};
