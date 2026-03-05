/**
 * ATP Logs API Route - Secure Backend Handler
 * 
 * This serverless function sends logs to IQAI ATP Dashboard.
 * The IQAI_API_KEY is stored in Vercel environment variables (not exposed to frontend).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment variable (from Vercel Dashboard, NOT frontend)
const IQAI_API_KEY = process.env.IQAI_API_KEY || '';
const IQAI_LOGS_ENDPOINT = 'https://app.iqai.com/api/logs';

// ATP Configuration (public info)
const ATP_CONFIG = {
    tokenContract: "0xee30b1d751c32cfed78826ed6377927d7ff85892",
    chainId: 252
};

// Generate pseudonym for privacy
function generatePseudonym(): string {
    const names = [
        "Luna", "Aurora", "Esperanza", "Victoria", "Valentía",
        "Fortaleza", "Libertad", "Estrella", "Mariposa", "Fénix",
        "Amanecer", "Renacer", "Guerrera", "Valiente", "Luz"
    ];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomLetters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
        String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `${randomName} ${randomLetters}.`;
}

// Log templates
const TEMPLATES: Record<string, (p: string, d?: any) => string> = {
    USER_JOINED: (p) =>
        `💜 ¡${p} ha iniciado su camino hacia la libertad! Athena la acompañará en cada paso. #NuevaEsperanza`,
    PLAN_STARTED: (p) =>
        `🦋 ${p} está creando su plan de escape con Athena. Cada decisión es valiente. #PlaneandoLibertad`,
    PLAN_COMPLETED: (p, d) =>
        `✨ ¡${p} tiene su Freedom Goal! Meta: $${d?.goal || 0}. El camino está trazado. #MetaDeLibertad`,
    VAULT_DEPOSIT: (p, d) =>
        `💰 ${p} añadió $${(d?.amount || 0).toFixed(2)} a su Freedom Vault. #AhorrandoEsperanza`,
    VAULT_MILESTONE: (p, d) =>
        `🎯 ¡${p} alcanzó el ${d?.percent || 0}% de su Freedom Goal! 🦅 #ProgresoReal`,
    EVIDENCE_SECURED: (p, d) =>
        `🔐 ${p} aseguró evidencia (${d?.type || 'documento'}) en blockchain. #EvidenciaSegura`,
    WITHDRAWAL_COMPLETED: (p) =>
        `✅ Fondos transferidos exitosamente para ${p}. #MisiónCumplida`,
    SOS_TRIGGERED: (p) =>
        `🆘 EMERGENCIA: ${p} activó el protocolo SOS. Fondos en camino a destino seguro. #ProtocoloDeEmergencia`,
    DONATION_RECEIVED: (_, d) =>
        `💜 ¡Donación de $${(d?.amount || 0).toFixed(2)} recibida! Gracias, ángeles donadores. #ComunidadSolidaria`
};

type LogAction = keyof typeof TEMPLATES;

interface ATPLogRequest {
    action: LogAction;
    data?: { goal?: number; amount?: number; percent?: number; type?: string };
    txHash?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { action, data, txHash }: ATPLogRequest = req.body;

    if (!action || !TEMPLATES[action]) {
        return res.status(400).json({ error: 'Invalid action' });
    }

    // Generate message
    const pseudo = generatePseudonym();
    const message = TEMPLATES[action](pseudo, data);

    console.log('[ATP-LOG]', message);

    // If no API key, just log locally and return success
    if (!IQAI_API_KEY) {
        console.warn('[ATP-LOG] No API key configured, logging locally only');
        return res.status(200).json({
            success: true,
            message,
            local: true
        });
    }

    try {
        // Send to IQAI API
        const response = await fetch(IQAI_LOGS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apiKey': IQAI_API_KEY
            },
            body: JSON.stringify({
                agentTokenContract: ATP_CONFIG.tokenContract,
                content: message,
                type: 'Agent',
                txHash: txHash || undefined,
                chainId: ATP_CONFIG.chainId
            })
        });

        if (response.ok) {
            console.log('[ATP-LOG] ✅ Sent to IQAI Dashboard');
            return res.status(200).json({
                success: true,
                message
            });
        } else {
            const errorText = await response.text();
            console.warn('[ATP-LOG] ⚠️ Failed:', errorText);
            return res.status(200).json({
                success: false,
                message,
                error: errorText
            });
        }

    } catch (error: any) {
        console.error('[ATP-LOG] ❌ Error:', error);
        return res.status(500).json({
            error: 'Failed to send log',
            message: error.message
        });
    }
}
