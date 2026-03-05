/**
 * API Client - Helper for calling secure API routes
 * 
 * All sensitive operations go through these API routes.
 * API keys are stored in Vercel (not exposed to frontend).
 */

// ============ GEMINI API ============

interface GeminiChatRequest {
    message: string;
    history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
    systemPrompt?: string;
    model?: 'flash' | 'pro';
}

interface GeminiResponse {
    success: boolean;
    response?: string;
    model?: string;
    error?: string;
    usage?: {
        promptTokens: number;
        responseTokens: number;
        totalTokens: number;
    };
}

/**
 * Chat with Gemini AI via secure API route
 */
export async function geminiChat(request: GeminiChatRequest): Promise<GeminiResponse> {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'chat',
                ...request
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'API call failed' };
        }

        return {
            success: true,
            response: data.response,
            model: data.model,
            usage: data.usage
        };
    } catch (error: any) {
        console.error('[API Client] Gemini error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Analyze content with Gemini (lower temperature, more tokens)
 */
export async function geminiAnalyze(
    content: string,
    systemPrompt?: string
): Promise<GeminiResponse> {
    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'analyze',
                message: content,
                systemPrompt,
                model: 'flash' // Use flash for analysis (fast)
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'API call failed' };
        }

        return {
            success: true,
            response: data.response,
            model: data.model,
            usage: data.usage
        };
    } catch (error: any) {
        console.error('[API Client] Gemini analyze error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Analyze media (image/audio/video) with Gemini multimodal
 * This sends the actual media data to Gemini for real analysis
 */
export async function geminiAnalyzeMedia(
    prompt: string,
    mediaData: string, // Base64 encoded media
    mediaType: string, // MIME type like 'image/jpeg', 'audio/webm', etc.
    systemPrompt?: string
): Promise<GeminiResponse> {
    try {
        console.log(`[API Client] Analyzing ${mediaType} with Gemini`);

        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                action: 'analyze',
                message: prompt,
                systemPrompt,
                model: 'flash',
                mediaData, // Base64 image/audio/video
                mediaType  // MIME type
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('[API Client] Gemini media analysis failed:', data.error);
            return { success: false, error: data.error || 'Media analysis failed' };
        }

        console.log('[API Client] Gemini media analysis successful');
        return {
            success: true,
            response: data.response,
            model: data.model,
            usage: data.usage
        };
    } catch (error: any) {
        console.error('[API Client] Gemini media analyze error:', error);
        return { success: false, error: error.message };
    }
}

// ============ IPFS API (Paso 2) ============

interface IPFSUploadResponse {
    success: boolean;
    cid?: string;
    url?: string;
    error?: string;
}

/**
 * Upload file to IPFS via secure API route
 * @param content - Base64 encoded content
 * @param filename - Name of the file
 * @param contentType - MIME type
 */
export async function ipfsUpload(
    content: string,
    filename: string,
    contentType: string
): Promise<IPFSUploadResponse> {
    try {
        const response = await fetch('/api/ipfs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content, filename, contentType })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error || 'Upload failed' };
        }

        return {
            success: true,
            cid: data.cid,
            url: data.url
        };
    } catch (error: any) {
        console.error('[API Client] IPFS upload error:', error);
        return { success: false, error: error.message };
    }
}

// ============ ATP LOG API (Paso 3) ============

type ATPLogAction =
    | 'USER_JOINED'
    | 'PLAN_COMPLETED'
    | 'EVIDENCE_SECURED'
    | 'SOS_TRIGGERED'
    | 'DONATION_RECEIVED';

interface ATPLogResponse {
    success: boolean;
    message?: string;
    error?: string;
}

/**
 * Send log to IQAI ATP Dashboard via secure API route
 */
export async function atpLog(
    action: ATPLogAction,
    data?: { goal?: number; type?: string; amount?: number },
    txHash?: string
): Promise<ATPLogResponse> {
    try {
        const response = await fetch('/api/atp-log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ action, data, txHash })
        });

        const result = await response.json();

        return {
            success: result.success || response.ok,
            message: result.message,
            error: result.error
        };
    } catch (error: any) {
        console.error('[API Client] ATP log error:', error);
        return { success: false, error: error.message };
    }
}

// ============ CONVENIENCE EXPORTS ============

export const api = {
    gemini: {
        chat: geminiChat,
        analyze: geminiAnalyze
    },
    ipfs: {
        upload: ipfsUpload
    },
    atp: {
        log: atpLog,
        userJoined: () => atpLog('USER_JOINED'),
        planCompleted: (goal: number) => atpLog('PLAN_COMPLETED', { goal }),
        evidenceSecured: (type: string) => atpLog('EVIDENCE_SECURED', { type }),
        sosTriggered: () => atpLog('SOS_TRIGGERED'),
        donationReceived: (amount: number) => atpLog('DONATION_RECEIVED', { amount })
    }
};

export default api;
