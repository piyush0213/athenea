/**
 * IQAI ATP Logs Service
 * 
 * Sends humanized logs to the IQAI ATP Dashboard for Athena agent.
 * NOW USES SECURE API ROUTE - API key not exposed in frontend!
 */

// ATP Configuration (public info only - safe to expose)
export const ATP_CONFIG = {
    agentContract: "0xce4f65d10b16ff7ab32581d3f66d570ac76d03b4",
    tokenContract: "0xee30b1d751c32cfed78826ed6377927d7ff85892",
    liquidityPool: "0x805c15c2d7e13c32bde69ef3982bc3f1e835ba24",
    network: "Fraxtal",
    chainId: 252
};

type LogAction =
    | 'USER_JOINED'
    | 'PLAN_STARTED'
    | 'PLAN_COMPLETED'
    | 'VAULT_DEPOSIT'
    | 'VAULT_MILESTONE'
    | 'EVIDENCE_SECURED'
    | 'WITHDRAWAL_COMPLETED'
    | 'SOS_TRIGGERED'
    | 'DONATION_RECEIVED';

/**
 * Send a log to IQAI ATP Dashboard via secure API route
 */
export async function sendATPLog(
    action: LogAction,
    data?: { amount?: number; goal?: number; percent?: number; type?: string },
    txHash?: string
): Promise<boolean> {
    try {
        const response = await fetch('/api/atp-log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, data, txHash })
        });

        const result = await response.json();

        if (result.success) {
            console.log('[ATP-LOG] ✅ Sent:', action);
            return true;
        } else {
            console.warn('[ATP-LOG] ⚠️ Failed:', result.error);
            return false;
        }
    } catch (error) {
        console.error('[ATP-LOG] ❌ Error:', error);
        return false;
    }
}

// Convenience functions
export const atpLogs = {
    userJoined: () => sendATPLog('USER_JOINED'),
    planStarted: () => sendATPLog('PLAN_STARTED'),
    planCompleted: (goal: number) => sendATPLog('PLAN_COMPLETED', { goal }),
    deposit: (amount: number) => sendATPLog('VAULT_DEPOSIT', { amount }),
    milestone: (percent: number) => sendATPLog('VAULT_MILESTONE', { percent }),
    evidenceSecured: (type: string) => sendATPLog('EVIDENCE_SECURED', { type }),
    withdrawalCompleted: () => sendATPLog('WITHDRAWAL_COMPLETED'),
    sosTriggered: () => sendATPLog('SOS_TRIGGERED'),
    donationReceived: (amount: number) => sendATPLog('DONATION_RECEIVED', { amount })
};

export default atpLogs;
