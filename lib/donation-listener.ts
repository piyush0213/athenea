    /**
 * Donation Listener Service
 * 
 * Monitors blockchain for incoming donations to custodial wallets
 * and updates Firestore case amounts automatically
 */

import { ethers } from 'ethers';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

const FRAXTAL_TESTNET_RPC = 'https://rpc.testnet.frax.com';
const POLL_INTERVAL = 15000; // Check every 15 seconds
const FRXETH_TO_USD = 2000; // Rough conversion

export class DonationListener {
    private provider: ethers.JsonRpcProvider;
    private isListening: boolean = false;
    private lastCheckedBlock: number = 0;

    constructor() {
        this.provider = new ethers.JsonRpcProvider(FRAXTAL_TESTNET_RPC);
    }

    async startListening() {
        if (this.isListening) {
            console.log('[DonationListener] Already listening');
            return;
        }

        this.isListening = true;
        this.lastCheckedBlock = await this.provider.getBlockNumber();

        console.log(`[DonationListener] Started listening from block ${this.lastCheckedBlock}`);

        this.pollForDonations();
    }

    stopListening() {
        this.isListening = false;
        console.log('[DonationListener] Stopped listening');
    }

    private async pollForDonations() {
        while (this.isListening) {
            try {
                await this.checkForNewDonations();
            } catch (error) {
                console.error('[DonationListener] Error checking donations:', error);
            }

            await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
        }
    }

    private async checkForNewDonations() {
        const currentBlock = await this.provider.getBlockNumber();

        if (currentBlock <= this.lastCheckedBlock) {
            return;
        }

        const activeCases = await this.getActiveCases();
        const walletAddresses = new Set(activeCases.map(c => c.walletAddress.toLowerCase()));

        for (let blockNum = this.lastCheckedBlock + 1; blockNum <= currentBlock; blockNum++) {
            try {
                const block = await this.provider.getBlock(blockNum, true);
                if (!block || !block.transactions) continue;

                for (const tx of block.transactions) {
                    if (typeof tx === 'string') continue;

                    const txReceipt = tx as ethers.TransactionResponse;
                    const toAddress = txReceipt.to?.toLowerCase();

                    if (toAddress && walletAddresses.has(toAddress)) {
                        await this.processDonation(txReceipt, activeCases);
                    }
                }
            } catch (e) {
                // Skip block on error
            }
        }

        this.lastCheckedBlock = currentBlock;
    }

    private async processDonation(
        tx: ethers.TransactionResponse,
        activeCases: Array<{ caseId: string; walletAddress: string; currentAmount: number }>
    ) {
        const toAddress = tx.to?.toLowerCase();
        const caseInfo = activeCases.find(c => c.walletAddress.toLowerCase() === toAddress);

        if (!caseInfo) return;

        const valueInEth = parseFloat(ethers.formatEther(tx.value));
        if (valueInEth === 0) return;

        const usdValue = valueInEth * FRXETH_TO_USD;
        const newAmount = caseInfo.currentAmount + usdValue;

        console.log(`💰 [DonationListener] Donation detected!`);
        console.log(`   Case: ${caseInfo.caseId}`);
        console.log(`   Amount: ${valueInEth} frxETH ($${usdValue.toFixed(2)})`);

        // Update Firestore
        try {
            await updateDoc(doc(db, `cases/${caseInfo.caseId}`), {
                currentAmount: newAmount,
                lastUpdated: Date.now()
            });
            console.log(`✅ [DonationListener] Updated ${caseInfo.caseId} to $${newAmount.toFixed(2)}`);
        } catch (error) {
            console.error('[DonationListener] Error updating Firestore:', error);
        }
    }

    private async getActiveCases(): Promise<Array<{
        caseId: string;
        walletAddress: string;
        currentAmount: number;
    }>> {
        try {
            const casesQuery = query(
                collection(db, 'cases'),
                where('isActive', '==', true)
            );

            const snapshot = await getDocs(casesQuery);

            return snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    caseId: data.caseId,
                    walletAddress: data.walletAddress,
                    currentAmount: data.currentAmount || 0
                };
            });

        } catch (error) {
            console.error('[DonationListener] Error getting active cases:', error);
            return [];
        }
    }
}

// Singleton instance
let listenerInstance: DonationListener | null = null;

export const getDonationListener = (): DonationListener => {
    if (!listenerInstance) {
        listenerInstance = new DonationListener();
    }
    return listenerInstance;
};

export default DonationListener;
