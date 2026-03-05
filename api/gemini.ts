/**
 * Gemini API Route - Secure Backend Handler
 * 
 * This serverless function handles all Gemini AI requests including MULTIMODAL.
 * The API key is stored in Vercel environment variables (not exposed to frontend).
 * 
 * Features:
 * - Text chat with history
 * - Image analysis (Gemini 2.0 Vision)
 * - Audio analysis
 * - Video analysis
 * 
 * SECURITY: Rate limiting + IP blocking implemented
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment variable (from Vercel Dashboard, NOT frontend)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// ============ RATE LIMITING + IP BLOCKING ============
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // Max 5 requests per minute per IP
const BLOCK_THRESHOLD = 1; // Block after FIRST rate limit violation
const BLOCK_DURATION_MS = 86400000; // Block for 24 HOURS

// HARDCODED BLOCKLIST - Known attackers
const PERMANENT_BLOCKLIST: string[] = [
    '208.77.244.6', // DDoS attacker - Dec 16, 2024
];

interface RateLimitEntry {
    count: number;
    firstRequest: number;
    violations: number;
}

interface BlockedIP {
    blockedAt: number;
    reason: string;
}

const rateLimitMap = new Map<string, RateLimitEntry>();
const blockedIPs = new Map<string, BlockedIP>();

function getClientIP(req: VercelRequest): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (typeof realIp === 'string') {
        return realIp;
    }
    return 'unknown';
}

function isIPBlocked(ip: string): { blocked: boolean; remainingMs: number; permanent: boolean } {
    if (PERMANENT_BLOCKLIST.includes(ip)) {
        console.error(`🚫 [SECURITY] PERMANENTLY BLOCKED IP: ${ip}`);
        return { blocked: true, remainingMs: 999999999, permanent: true };
    }

    const blocked = blockedIPs.get(ip);
    if (!blocked) {
        return { blocked: false, remainingMs: 0, permanent: false };
    }

    const now = Date.now();
    const elapsed = now - blocked.blockedAt;

    if (elapsed >= BLOCK_DURATION_MS) {
        blockedIPs.delete(ip);
        rateLimitMap.delete(ip);
        return { blocked: false, remainingMs: 0, permanent: false };
    }

    return { blocked: true, remainingMs: BLOCK_DURATION_MS - elapsed, permanent: false };
}

function blockIP(ip: string, reason: string): void {
    blockedIPs.set(ip, { blockedAt: Date.now(), reason });
    console.error(`🚫 [SECURITY] IP BLOCKED: ${ip} - ${reason}`);
}

function checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetIn: number; blocked: boolean } {
    const now = Date.now();

    const blockStatus = isIPBlocked(ip);
    if (blockStatus.blocked) {
        return { allowed: false, remaining: 0, resetIn: blockStatus.remainingMs, blocked: true };
    }

    const entry = rateLimitMap.get(ip);

    if (rateLimitMap.size > 1000) {
        for (const [key, val] of rateLimitMap.entries()) {
            if (now - val.firstRequest > RATE_LIMIT_WINDOW_MS) {
                rateLimitMap.delete(key);
            }
        }
    }

    if (!entry || (now - entry.firstRequest > RATE_LIMIT_WINDOW_MS)) {
        const previousViolations = entry?.violations || 0;
        rateLimitMap.set(ip, { count: 1, firstRequest: now, violations: previousViolations });
        return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1, resetIn: RATE_LIMIT_WINDOW_MS, blocked: false };
    }

    if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
        entry.violations = (entry.violations || 0) + 1;

        if (entry.violations >= BLOCK_THRESHOLD) {
            blockIP(ip, `Exceeded rate limit ${BLOCK_THRESHOLD} times`);
            return { allowed: false, remaining: 0, resetIn: BLOCK_DURATION_MS, blocked: true };
        }

        const resetIn = RATE_LIMIT_WINDOW_MS - (now - entry.firstRequest);
        console.warn(`[Rate Limit] IP ${ip} violation #${entry.violations}`);
        return { allowed: false, remaining: 0, resetIn, blocked: false };
    }

    entry.count++;
    return {
        allowed: true,
        remaining: RATE_LIMIT_MAX_REQUESTS - entry.count,
        blocked: false,
        resetIn: RATE_LIMIT_WINDOW_MS - (now - entry.firstRequest)
    };
}
// ============ END RATE LIMITING ============

// Available models
const MODELS = {
    flash: 'gemini-2.5-flash',
    pro: 'gemini-2.5-pro'
};

interface GeminiRequest {
    action: 'chat' | 'analyze';
    message: string;
    history?: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
    systemPrompt?: string;
    model?: 'flash' | 'pro';
    // Multimodal support
    mediaData?: string; // Base64 encoded image/audio/video
    mediaType?: string; // MIME type like 'image/jpeg', 'audio/webm', etc.
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // ============ ALLOWED ORIGINS ============
    const ALLOWED_ORIGINS = [
        'https://athenea-nine.vercel.app',
        'https://athenea.vercel.app',
    ];

    const API_SECRET = process.env.INTERNAL_API_SECRET || '';

    const origin = req.headers.origin || req.headers.referer || '';
    const requestOrigin = origin.replace(/\/$/, '');

    const isAllowedOrigin = ALLOWED_ORIGINS.some(allowed =>
        requestOrigin.startsWith(allowed) || requestOrigin === allowed
    );

    // CORS
    if (isAllowedOrigin) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    } else {
        res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Token');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Origin validation (production only)
    if (!isAllowedOrigin && process.env.NODE_ENV === 'production') {
        console.error(`🚫 [SECURITY] Blocked origin: ${origin}`);
        return res.status(403).json({ error: 'Forbidden', message: 'Unauthorized origin' });
    }

    // API token validation
    if (API_SECRET) {
        const clientToken = req.headers['x-api-token'] || req.body?.apiToken;
        if (clientToken !== API_SECRET) {
            console.error(`🚫 [SECURITY] Invalid API token`);
            return res.status(401).json({ error: 'Unauthorized', message: 'Invalid API token' });
        }
    }

    // Rate limiting
    const clientIP = getClientIP(req);
    const rateLimit = checkRateLimit(clientIP);

    res.setHeader('X-RateLimit-Limit', RATE_LIMIT_MAX_REQUESTS.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetIn / 1000).toString());

    if (rateLimit.blocked) {
        return res.status(403).json({
            error: 'Access denied',
            message: 'IP blocked due to excessive requests',
            retryAfter: Math.ceil(rateLimit.resetIn / 1000)
        });
    }

    if (!rateLimit.allowed) {
        return res.status(429).json({
            error: 'Too many requests',
            retryAfter: Math.ceil(rateLimit.resetIn / 1000)
        });
    }

    if (!GEMINI_API_KEY) {
        console.error('[Gemini API] No API key configured');
        return res.status(500).json({ error: 'Gemini not configured' });
    }

    const { action, message, history, systemPrompt, model = 'flash', mediaData, mediaType }: GeminiRequest = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const modelId = MODELS[model] || MODELS.flash;
        const apiUrl = `${GEMINI_API_URL}/${modelId}:generateContent?key=${GEMINI_API_KEY}`;

        // Build parts array - supports multimodal content
        const userParts: any[] = [];

        // If media is provided, add it first (Gemini expects media before text)
        if (mediaData && mediaType) {
            // Clean base64 data (remove data URL prefix if present)
            let cleanBase64 = mediaData;
            if (mediaData.includes(',')) {
                cleanBase64 = mediaData.split(',')[1];
            }

            userParts.push({
                inline_data: {
                    mime_type: mediaType,
                    data: cleanBase64
                }
            });
            console.log(`[Gemini API] Multimodal request: ${mediaType}`);
        }

        // Add text message
        userParts.push({ text: message });

        // Build request body
        const contents = [
            ...(history || []),
            { role: 'user', parts: userParts }
        ];

        const requestBody: any = {
            contents,
            generationConfig: {
                temperature: action === 'analyze' ? 0.3 : 0.7,
                maxOutputTokens: action === 'analyze' ? 4096 : 2048,
                topP: 0.95,
                topK: 40
            }
        };

        // Add system instruction if provided
        if (systemPrompt) {
            requestBody.systemInstruction = {
                parts: [{ text: systemPrompt }]
            };
        }

        // Call Gemini API
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('[Gemini API] Error:', errorText);
            return res.status(response.status).json({
                error: 'Gemini API error',
                details: errorText
            });
        }

        const data = await response.json();

        // Extract response text
        const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const finishReason = data.candidates?.[0]?.finishReason || 'STOP';
        const usageMetadata = data.usageMetadata || {};

        return res.status(200).json({
            success: true,
            response: responseText,
            model: modelId,
            finishReason,
            usage: {
                promptTokens: usageMetadata.promptTokenCount || 0,
                responseTokens: usageMetadata.candidatesTokenCount || 0,
                totalTokens: usageMetadata.totalTokenCount || 0
            }
        });

    } catch (error: any) {
        console.error('[Gemini API] Exception:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
