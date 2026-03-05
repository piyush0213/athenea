
import React, { useState, useEffect } from 'react';
import { AppMode, AgentTab } from './types';
import Calculator from './components/Calculator';
import AgentDashboard from './components/AgentDashboard';
import PublicDonationPage from './components/PublicDonationPage';
import { getAthenaAgent } from './lib/athena-agent';
import { useDonationListener } from './lib/useDonationListener';

export default function App() {
  const [mode, setMode] = useState<AppMode>(AppMode.CALCULATOR);
  const [initialTab, setInitialTab] = useState<AgentTab>('HOME');

  // Flash Message State (for the 9/11= command)
  const [flashMsg, setFlashMsg] = useState<string | null>(null);

  // Check if we're on /donate route
  const isDonationPage = window.location.pathname === '/donate';

  // Initialize agent on mount
  const agent = getAthenaAgent();

  // Start donation listener (monitors blockchain for incoming donations)
  useDonationListener();

  const handleCommand = async (cmd: string) => {
    switch (cmd) {
      case 'GENESIS': // 1+1=
        // Create anonymous case if not exists
        const agentState = agent.getState();
        if (!agentState.case) {
          await agent.createAnonymousCase();
        }
        setInitialTab('PLAN');
        setMode(AppMode.ONBOARDING_CHAT);
        setTimeout(() => setMode(AppMode.AGENT_DASHBOARD), 300);
        break;

      case 'LOGIN': // 1999=
        setInitialTab('HOME');
        setTimeout(() => setMode(AppMode.AGENT_DASHBOARD), 300);
        break;

      case 'FLASH_CHECK': // 9/11=
        // Get real balance from agent
        try {
          const { balance } = await agent.quickBalanceCheck();
          setFlashMsg(balance);
        } catch {
          setFlashMsg('$---.--');
        }
        setTimeout(() => setFlashMsg(null), 3000);
        break;

      case 'POOL_STATUS': // 7x7=
        // Get pool status from agent
        try {
          const { percentage } = await agent.getPoolStatus();
          setFlashMsg(`Pool: ${percentage.toFixed(0)}%`);
        } catch {
          setFlashMsg('Pool: 0%');
        }
        setTimeout(() => setFlashMsg(null), 3000);
        break;

      case 'SOS': // 0/0=
        // Show alert and optionally trigger quick SOS
        setFlashMsg('⚠️ ALERT SENT');
        setTimeout(() => setFlashMsg(null), 2000);
        break;

      case 'WIPE': // ...
        // Clear agent state and return to calculator
        agent.clearLocalState();
        setMode(AppMode.CALCULATOR);
        setFlashMsg('CACHE CLEARED');
        setTimeout(() => setFlashMsg(null), 2000);
        break;

      default:
        break;
    }
  };

  // If on /donate route, show public donation page
  if (isDonationPage) {
    return <PublicDonationPage />;
  }

  return (
    <div className="h-full w-full bg-black relative">

      {/* Flash Message Overlay - Simulates text on Calculator Screen or Glitch */}
      {flashMsg && (
        <div className="absolute top-1/4 left-0 right-0 z-50 text-center animate-pulse">
          <div className="inline-block bg-neutral-800/90 text-athena-500 font-mono text-4xl px-6 py-4 rounded-xl shadow-2xl border border-athena-500/50 backdrop-blur-md">
            {flashMsg}
          </div>
        </div>
      )}

      {mode === AppMode.CALCULATOR ? (
        <Calculator onCommand={handleCommand} />
      ) : (
        <AgentDashboard
          startTab={initialTab}
          onWipe={() => handleCommand('WIPE')}
        />
      )}
    </div>
  );
}
