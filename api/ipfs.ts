/**
 * IPFS API Route - Secure Backend Handler
 * 
 * This serverless function handles all IPFS/Pinata uploads.
 * The PINATA_JWT is stored in Vercel environment variables (not exposed to frontend).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Environment variable (from Vercel Dashboard, NOT frontend)
const PINATA_JWT = process.env.PINATA_JWT || '';
const PINATA_API_URL = 'https://api.pinata.cloud';
const PUBLIC_GATEWAY = 'https://ipfs.io/ipfs';

interface IPFSUploadRequest {
    content: string; // Base64 encoded content
    filename: string;
    contentType: string;
    metadata?: {
        type: string;
        description: string;
        caseId?: string;
    };
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

    console.log('[IPFS API] Request received');

    if (!PINATA_JWT) {
        console.warn('[IPFS API] No Pinata JWT configured, using demo mode');
        const fakeCid = 'Qm' + Array(44).fill(0).map(() =>
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(
                Math.floor(Math.random() * 62)
            )
        ).join('');

        return res.status(200).json({
            success: true,
            cid: fakeCid,
            ipfsUrl: `ipfs://${fakeCid}`,
            gatewayUrl: `${PUBLIC_GATEWAY}/${fakeCid}`,
            size: 0,
            demo: true
        });
    }

    const { content, filename, contentType, metadata }: IPFSUploadRequest = req.body;

    if (!content) {
        return res.status(400).json({ error: 'Content is required' });
    }

    try {
        // Convert base64 to buffer - handle data URL prefix if present
        let base64Data = content;
        if (content.includes(',')) {
            base64Data = content.split(',')[1];
        }

        const buffer = Buffer.from(base64Data, 'base64');
        console.log('[IPFS API] Buffer size:', buffer.length, 'bytes');
        console.log('[IPFS API] Content type:', contentType);

        // Determine if content is text or binary
        const isTextContent = contentType?.startsWith('text/') || contentType === 'application/json';

        if (isTextContent) {
            // For text content, use pinJSONToIPFS with the content directly
            const textContent = Buffer.from(base64Data, 'base64').toString('utf-8');

            const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${PINATA_JWT}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    pinataContent: {
                        content: textContent,
                        type: metadata?.type || 'TEXT',
                        timestamp: Date.now()
                    },
                    pinataMetadata: {
                        name: filename || `athena-evidence-${Date.now()}`
                    },
                    pinataOptions: {
                        cidVersion: 1
                    }
                })
            });

            const responseText = await response.text();
            console.log('[IPFS API] Pinata response status:', response.status);

            if (!response.ok) {
                console.error('[IPFS API] Pinata error:', responseText);
                return res.status(response.status).json({
                    success: false,
                    error: 'Pinata upload failed',
                    details: responseText
                });
            }

            const result = JSON.parse(responseText);
            const cid = result.IpfsHash;

            console.log('[IPFS API] ✅ Text content uploaded:', cid);

            return res.status(200).json({
                success: true,
                cid,
                ipfsUrl: `ipfs://${cid}`,
                gatewayUrl: `${PUBLIC_GATEWAY}/${cid}`,
                size: result.PinSize || textContent.length,
                timestamp: new Date().toISOString()
            });
        }

        // For BINARY files (images, audio, video), store as base64 JSON wrapper
        // This is a workaround for FormData issues in Vercel serverless
        const response = await fetch(`${PINATA_API_URL}/pinning/pinJSONToIPFS`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${PINATA_JWT}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                pinataContent: {
                    data: base64Data,
                    mimeType: contentType,
                    filename: filename || `evidence-${Date.now()}`,
                    type: metadata?.type || 'MEDIA',
                    description: metadata?.description || '',
                    timestamp: Date.now()
                },
                pinataMetadata: {
                    name: filename || `athena-evidence-${Date.now()}`,
                    keyvalues: {
                        type: metadata?.type || 'UNKNOWN',
                        contentType: contentType,
                        caseId: metadata?.caseId || 'anonymous'
                    }
                },
                pinataOptions: {
                    cidVersion: 1
                }
            })
        });

        const responseText = await response.text();
        console.log('[IPFS API] Pinata response status:', response.status);

        if (!response.ok) {
            console.error('[IPFS API] Pinata error:', responseText);
            return res.status(response.status).json({
                success: false,
                error: 'Pinata upload failed',
                details: responseText
            });
        }

        const result = JSON.parse(responseText);
        const cid = result.IpfsHash;

        console.log('[IPFS API] ✅ Binary file uploaded:', cid);

        return res.status(200).json({
            success: true,
            cid,
            ipfsUrl: `ipfs://${cid}`,
            gatewayUrl: `${PUBLIC_GATEWAY}/${cid}`,
            size: result.PinSize || buffer.length,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error('[IPFS API] Exception:', error.message);
        return res.status(500).json({
            success: false,
            error: 'Internal server error',
            message: error.message
        });
    }
}
