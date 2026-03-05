/**
 * Blockchain SOS Service
 * 
 * Executes REAL blockchain operations for SOS protocol on Fraxtal Testnet.
 * Uses the user's custodial wallet to sign and send transactions.
 */

import { ethers, Wallet } from 'ethers';
import { getCustodyService } from './wallet-custody';
import { auth } from './firebase';

// Fraxtal Testnet Configuration
const FRAXTAL_TESTNET_RPC = 'https://rpc.testnet.frax.com';
const FRAXTAL_TESTNET_CHAIN_ID = 2522;

export interface SOSBlockchainResult {
    success: boolean;
    logs: string[];
    txHashes: string[];
    transferredAmount: number;
    destinationAddress: string;
    error?: string;
}

export class BlockchainSOSService {
    private provider: ethers.JsonRpcProvider;
    private custodyService: ReturnType<typeof getCustodyService>;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(FRAXTAL_TESTNET_RPC);
        this.custodyService = getCustodyService();
    }

    /**
     * Execute REAL SOS Protocol on Blockchain
     * 
     * Steps:
     * 1. Get user's custodial wallet
     * 2. Check balance
     * 3. Transfer ALL native tokens (frxETH) to safe destination
     * 4. Log to ATP Dashboard
     */
    async executeSOS(destinationAddress: string): Promise<SOSBlockchainResult> {
        const logs: string[] = [];
        const txHashes: string[] = [];

        logs.push('🆘 INITIATING SOS PROTOCOL...');
        logs.push(`📍 Network: Fraxtal Testnet`);

        try {
            // Step 1: Get current user
            const user = auth.currentUser;
            if (!user) {
                throw new Error('No authenticated user');
            }

            logs.push(`👤 User authenticated: ${user.uid.slice(0, 8)}...`);

            // Step 2: Get custodial wallet instance (decrypted)
            const wallet = await this.custodyService.getWalletInstance(user.uid);
            if (!wallet) {
                throw new Error('No custodial wallet found');
            }

            // Connect wallet to provider
            const connectedWallet = wallet.connect(this.provider);
            logs.push(`💳 Wallet loaded: ${wallet.address.slice(0, 10)}...`);

            // Step 3: Check balance
            const balance = await this.provider.getBalance(wallet.address);
            const balanceInEth = parseFloat(ethers.formatEther(balance));
            logs.push(`💰 Balance: ${balanceInEth.toFixed(6)} frxETH`);

            if (balanceInEth <= 0) {
                logs.push('⚠️ No funds to transfer');
                return {
                    success: true,
                    logs,
                    txHashes: [],
                    transferredAmount: 0,
                    destinationAddress
                };
            }

            // Step 4: Calculate gas and transfer amount
            const gasPrice = await this.provider.getFeeData();
            const gasLimit = 21000n; // Standard transfer
            const gasCost = (gasPrice.maxFeePerGas || gasPrice.gasPrice || 0n) * gasLimit;

            // Transfer balance minus gas
            const transferAmount = balance - gasCost;

            if (transferAmount <= 0n) {
                logs.push('⚠️ Balance too low to cover gas');
                return {
                    success: false,
                    logs,
                    txHashes: [],
                    transferredAmount: 0,
                    destinationAddress,
                    error: 'Insufficient balance for gas'
                };
            }

            const transferAmountEth = parseFloat(ethers.formatEther(transferAmount));
            logs.push(`📤 Transferring ${transferAmountEth.toFixed(6)} frxETH...`);
            logs.push(`📍 To: ${destinationAddress.slice(0, 10)}...${destinationAddress.slice(-6)}`);

            // Step 5: Send transaction
            const tx = await connectedWallet.sendTransaction({
                to: destinationAddress,
                value: transferAmount,
                gasLimit: gasLimit
            });

            logs.push(`⏳ TX sent: ${tx.hash.slice(0, 16)}...`);
            logs.push('⌛ Waiting for confirmation...');

            // Wait for confirmation
            const receipt = await tx.wait();
            txHashes.push(receipt!.hash);

            logs.push(`✅ TX confirmed! Block: ${receipt!.blockNumber}`);
            logs.push(`🔗 https://fraxscan.com/tx/${receipt!.hash}`);

            // Step 6: Log to ATP Dashboard
            try {
                const { atpLogs } = await import('./atp-logs');
                await atpLogs.sosTriggered();
                logs.push('📡 Activity logged to ATP Dashboard');
            } catch (e) {
                console.warn('[SOS] Failed to log to ATP');
            }

            logs.push('');
            logs.push('═══════════════════════════════════════');
            logs.push('✅ SOS PROTOCOL COMPLETE');
            logs.push(`💰 Transferred: ${transferAmountEth.toFixed(6)} frxETH`);
            logs.push('🔒 Funds sent to safe destination');
            logs.push('═══════════════════════════════════════');

            return {
                success: true,
                logs,
                txHashes,
                transferredAmount: transferAmountEth * 2000, // Rough USD conversion
                destinationAddress
            };

        } catch (error: any) {
            console.error('[BlockchainSOS] Error:', error);
            logs.push(`❌ Error: ${error.message}`);

            return {
                success: false,
                logs,
                txHashes,
                transferredAmount: 0,
                destinationAddress,
                error: error.message
            };
        }
    }

    /**
     * Check if SOS can be executed (has balance)
     */
    async canExecuteSOS(): Promise<{ canExecute: boolean; balance: number; reason?: string }> {
        try {
            const user = auth.currentUser;
            if (!user) {
                return { canExecute: false, balance: 0, reason: 'Not authenticated' };
            }

            const wallet = await this.custodyService.getWallet(user.uid);
            if (!wallet) {
                return { canExecute: false, balance: 0, reason: 'No wallet found' };
            }

            const balance = await this.provider.getBalance(wallet.address);
            const balanceInEth = parseFloat(ethers.formatEther(balance));

            if (balanceInEth <= 0.0001) { // Minimum for gas
                return { canExecute: false, balance: balanceInEth, reason: 'Insufficient balance' };
            }

            return { canExecute: true, balance: balanceInEth };

        } catch (error: any) {
            return { canExecute: false, balance: 0, reason: error.message };
        }
    }
}

// Singleton
let sosServiceInstance: BlockchainSOSService | null = null;

export function getBlockchainSOSService(): BlockchainSOSService {
    if (!sosServiceInstance) {
        sosServiceInstance = new BlockchainSOSService();
    }
    return sosServiceInstance;
}

export default BlockchainSOSService;
