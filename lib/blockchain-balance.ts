/**
 * Blockchain Balance Service
 * 
 * Fetches REAL balance from blockchain (source of truth)
 * Firestore is just a cache for performance
 */

import { ethers } from 'ethers';
import { getCustodyService } from './wallet-custody';

const FRAXTAL_TESTNET_RPC = 'https://rpc.testnet.frax.com';
const FRXETH_TO_USD = 2000; // Rough conversion, use oracle in production

export class BlockchainBalanceService {
    private provider: ethers.JsonRpcProvider;
    private custodyService: ReturnType<typeof getCustodyService>;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(FRAXTAL_TESTNET_RPC);
        this.custodyService = getCustodyService();
    }

    /**
     * Get REAL balance from blockchain for a wallet address
     */
    async getWalletBalance(walletAddress: string): Promise<{
        balanceInEth: number;
        balanceInUsd: number;
        lastUpdated: number;
    }> {
        try {
            const balance = await this.provider.getBalance(walletAddress);
            const balanceInEth = parseFloat(ethers.formatEther(balance));
            const balanceInUsd = balanceInEth * FRXETH_TO_USD;

            return {
                balanceInEth,
                balanceInUsd,
                lastUpdated: Date.now()
            };

        } catch (error) {
            console.error('[BlockchainBalance] Error fetching balance:', error);
            throw new Error('Failed to fetch wallet balance');
        }
    }

    /**
     * Get balance for a case (by caseId)
     * This is the CORRECT way - blockchain is source of truth
     */
    async getCaseBalance(caseId: string): Promise<{
        currentAmount: number;
        walletAddress: string;
        balanceInEth: number;
    }> {
        try {
            // 1. Get case metadata from Firestore (just for wallet address)
            const caseMetadata = await this.custodyService.getCaseMetadata(caseId);

            if (!caseMetadata) {
                throw new Error('Case not found');
            }

            // 2. Get REAL balance from blockchain
            const { balanceInEth, balanceInUsd } = await this.getWalletBalance(
                caseMetadata.walletAddress
            );

            // 3. Update Firestore cache (optional but recommended for performance)
            if (balanceInUsd !== caseMetadata.currentAmount) {
                await this.custodyService.updateCaseAmount(caseId, balanceInUsd);
                console.log(`[BlockchainBalance] Synced ${caseId}: $${balanceInUsd.toFixed(2)}`);
            }

            return {
                currentAmount: balanceInUsd,
                walletAddress: caseMetadata.walletAddress,
                balanceInEth
            };

        } catch (error) {
            console.error('[BlockchainBalance] Error getting case balance:', error);
            throw error;
        }
    }

    /**
     * Sync ALL active cases with blockchain
     * Call this periodically to keep Firestore cache fresh
     */
    async syncAllCases(): Promise<void> {
        try {
            const publicCases = await this.custodyService.getPublicCases();

            console.log(`[BlockchainBalance] Syncing ${publicCases.length} cases...`);

            for (const caseInfo of publicCases) {
                try {
                    const { balanceInUsd } = await this.getWalletBalance(caseInfo.walletAddress);

                    if (balanceInUsd !== caseInfo.currentAmount) {
                        await this.custodyService.updateCaseAmount(caseInfo.caseId, balanceInUsd);
                        console.log(`  ✅ ${caseInfo.caseId}: $${balanceInUsd.toFixed(2)}`);
                    }
                } catch (error) {
                    console.error(`  ❌ ${caseInfo.caseId}: Failed to sync`);
                }
            }

            console.log(`[BlockchainBalance] Sync complete`);

        } catch (error) {
            console.error('[BlockchainBalance] Error syncing cases:', error);
        }
    }

    /**
     * Get transaction history for a wallet
     * Shows all donations received (even if sent outside the app)
     */
    async getTransactionHistory(walletAddress: string, limit: number = 10): Promise<Array<{
        from: string;
        value: string;
        valueInEth: number;
        valueInUsd: number;
        timestamp: number;
        txHash: string;
    }>> {
        try {
            const currentBlock = await this.provider.getBlockNumber();
            const transactions: any[] = [];

            // Check last 1000 blocks (adjust as needed)
            const blocksToCheck = Math.min(1000, currentBlock);

            for (let i = 0; i < blocksToCheck && transactions.length < limit; i++) {
                const blockNum = currentBlock - i;
                const block = await this.provider.getBlock(blockNum, true);

                if (!block || !block.transactions) continue;

                for (const tx of block.transactions) {
                    if (typeof tx === 'string') continue;

                    const txReceipt = tx as ethers.TransactionResponse;

                    if (txReceipt.to?.toLowerCase() === walletAddress.toLowerCase()) {
                        const valueInEth = parseFloat(ethers.formatEther(txReceipt.value));

                        if (valueInEth > 0) {
                            transactions.push({
                                from: txReceipt.from,
                                value: txReceipt.value.toString(),
                                valueInEth,
                                valueInUsd: valueInEth * FRXETH_TO_USD,
                                timestamp: block.timestamp * 1000,
                                txHash: txReceipt.hash
                            });

                            if (transactions.length >= limit) break;
                        }
                    }
                }
            }

            return transactions.sort((a, b) => b.timestamp - a.timestamp);

        } catch (error) {
            console.error('[BlockchainBalance] Error fetching transaction history:', error);
            return [];
        }
    }
}

// Singleton instance
let balanceServiceInstance: BlockchainBalanceService | null = null;

export const getBlockchainBalanceService = (): BlockchainBalanceService => {
    if (!balanceServiceInstance) {
        balanceServiceInstance = new BlockchainBalanceService();
    }
    return balanceServiceInstance;
};

export default BlockchainBalanceService;
