/**
 * Wallet API Route - Secure Backend Handler
 * 
 * This serverless function handles wallet encryption/decryption operations.
 * The WALLET_SECRET is stored in Vercel environment variables (not exposed to frontend).
 * 
 * Operations:
 * - CREATE: Generate new wallet, encrypt private key, return address
 * - DECRYPT: Decrypt private key for signing transactions (SOS only)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ethers, Wallet } from 'ethers';
import CryptoJS from 'crypto-js';

// Environment variable (from Vercel Dashboard, NOT frontend)
const WALLET_SECRET = process.env.WALLET_SECRET || 'CHANGE_THIS_IN_PRODUCTION';

interface WalletRequest {
    action: 'CREATE' | 'DECRYPT' | 'SIGN_TRANSFER';
    userId: string;
    encryptedPrivateKey?: string; // For decrypt/sign
    destinationAddress?: string; // For transfers
    amount?: string; // For transfers (in wei)
}

// Encrypt private key with user-specific salt
function encryptPrivateKey(privateKey: string, userId: string): string {
    const salt = userId.substring(0, 8);
    const key = `${WALLET_SECRET}_${salt}`;
    return CryptoJS.AES.encrypt(privateKey, key).toString();
}

// Decrypt private key
function decryptPrivateKey(encryptedKey: string, userId: string): string {
    const salt = userId.substring(0, 8);
    const key = `${WALLET_SECRET}_${salt}`;
    const bytes = CryptoJS.AES.decrypt(encryptedKey, key);
    return bytes.toString(CryptoJS.enc.Utf8);
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

    const { action, userId, encryptedPrivateKey, destinationAddress, amount }: WalletRequest = req.body;

    if (!action || !userId) {
        return res.status(400).json({ error: 'Action and userId are required' });
    }

    try {
        switch (action) {
            // ============ CREATE NEW WALLET ============
            case 'CREATE': {
                // Generate new random wallet
                const wallet = Wallet.createRandom();

                // Encrypt private key
                const encrypted = encryptPrivateKey(wallet.privateKey, userId);

                console.log(`[Wallet API] ✅ Created wallet for user ${userId.slice(0, 8)}...`);

                return res.status(200).json({
                    success: true,
                    address: wallet.address,
                    encryptedPrivateKey: encrypted
                });
            }

            // ============ DECRYPT WALLET (for SOS) ============
            case 'DECRYPT': {
                if (!encryptedPrivateKey) {
                    return res.status(400).json({ error: 'encryptedPrivateKey required' });
                }

                // Decrypt private key
                const privateKey = decryptPrivateKey(encryptedPrivateKey, userId);

                if (!privateKey || !privateKey.startsWith('0x')) {
                    return res.status(400).json({ error: 'Failed to decrypt wallet' });
                }

                // Create wallet instance
                const wallet = new Wallet(privateKey);

                console.log(`[Wallet API] ✅ Decrypted wallet for user ${userId.slice(0, 8)}...`);

                return res.status(200).json({
                    success: true,
                    address: wallet.address,
                    privateKey: privateKey // Only return for SOS operations!
                });
            }

            // ============ SIGN AND SEND TRANSFER (for SOS) ============
            case 'SIGN_TRANSFER': {
                if (!encryptedPrivateKey || !destinationAddress) {
                    return res.status(400).json({
                        error: 'encryptedPrivateKey and destinationAddress required'
                    });
                }

                // Decrypt private key
                const privateKey = decryptPrivateKey(encryptedPrivateKey, userId);

                if (!privateKey || !privateKey.startsWith('0x')) {
                    return res.status(400).json({ error: 'Failed to decrypt wallet' });
                }

                // Connect to Fraxtal Testnet
                const provider = new ethers.JsonRpcProvider('https://rpc.testnet.frax.com');
                const wallet = new Wallet(privateKey, provider);

                // Get balance
                const balance = await provider.getBalance(wallet.address);

                if (balance <= 0n) {
                    return res.status(200).json({
                        success: true,
                        transferred: false,
                        reason: 'No funds to transfer',
                        balance: '0'
                    });
                }

                // Calculate gas and transfer amount
                const feeData = await provider.getFeeData();
                const gasLimit = 21000n;
                const gasCost = (feeData.maxFeePerGas || feeData.gasPrice || 0n) * gasLimit;
                const transferAmount = balance - gasCost;

                if (transferAmount <= 0n) {
                    return res.status(200).json({
                        success: true,
                        transferred: false,
                        reason: 'Balance too low for gas',
                        balance: ethers.formatEther(balance)
                    });
                }

                // Send transaction
                const tx = await wallet.sendTransaction({
                    to: destinationAddress,
                    value: transferAmount,
                    gasLimit
                });

                console.log(`[Wallet API] ⏳ SOS Transfer sent: ${tx.hash}`);

                // Wait for confirmation
                const receipt = await tx.wait();

                console.log(`[Wallet API] ✅ SOS Transfer confirmed: ${receipt?.hash}`);

                return res.status(200).json({
                    success: true,
                    transferred: true,
                    txHash: receipt?.hash,
                    amount: ethers.formatEther(transferAmount),
                    destination: destinationAddress
                });
            }

            default:
                return res.status(400).json({ error: `Unknown action: ${action}` });
        }

    } catch (error: any) {
        console.error('[Wallet API] ❌ Error:', error);
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message
        });
    }
}
