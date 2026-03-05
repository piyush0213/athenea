/**
 * Hook for Custodial Wallet Management
 * 
 * Provides easy access to custody service from React components
 * Now uses BLOCKCHAIN as source of truth for balances!
 */

import { useState, useEffect, useCallback } from 'react';
import { getCustodyService } from './wallet-custody';
import { getBlockchainBalanceService } from './blockchain-balance';
import { auth } from './firebase';

interface CaseInfo {
    caseId: string;
    displayName: string;
    story: string;
    goalAmount: number;
    currentAmount: number;
    urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    progress: number; // 0-100
    walletAddress: string;
    // NEW: Blockchain data
    balanceInEth?: number;
    isBlockchainVerified?: boolean;
}

export function useCustodialWallet() {
    const [walletAddress, setWalletAddress] = useState<string | null>(null);
    const [caseInfo, setCaseInfo] = useState<CaseInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const custodyService = getCustodyService();
    const blockchainService = getBlockchainBalanceService();

    /**
     * Initialize wallet for current user
     */
    const initializeWallet = useCallback(async () => {
        if (!auth.currentUser) {
            setError('No user logged in');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userId = auth.currentUser.uid;

            // Get or create wallet
            let wallet = await custodyService.getWallet(userId);

            if (!wallet) {
                const address = await custodyService.createCustodialWallet(userId);
                setWalletAddress(address);
                return address;
            }

            setWalletAddress(wallet.address);

            // Load case info if exists
            if (wallet.caseId) {
                const metadata = await custodyService.getCaseMetadata(wallet.caseId);
                if (metadata) {
                    // Get REAL balance from blockchain (not Firestore!)
                    let blockchainBalance = null;
                    let balanceInEth = 0;
                    try {
                        blockchainBalance = await blockchainService.getWalletBalance(metadata.walletAddress);
                        balanceInEth = blockchainBalance.balanceInEth;
                    } catch (e) {
                        console.warn('[useCustodialWallet] Blockchain fallback to Firestore');
                    }

                    const currentAmount = blockchainBalance
                        ? blockchainBalance.balanceInUsd
                        : metadata.currentAmount;

                    setCaseInfo({
                        caseId: metadata.caseId,
                        displayName: metadata.displayName,
                        story: metadata.story,
                        goalAmount: metadata.goalAmount,
                        currentAmount: currentAmount,
                        urgencyLevel: metadata.urgencyLevel,
                        progress: (currentAmount / metadata.goalAmount) * 100,
                        walletAddress: metadata.walletAddress,
                        balanceInEth: balanceInEth,
                        isBlockchainVerified: !!blockchainBalance
                    });
                }
            }

            return wallet.address;

        } catch (err: any) {
            console.error('[useCustodialWallet] Failed to initialize:', err);
            setError(err.message || 'Failed to initialize wallet');
            return null;
        } finally {
            setLoading(false);
        }
    }, [custodyService, blockchainService]);

    /**
     * Create a new case for fundraising
     */
    const createCase = useCallback(async (params: {
        displayName: string;
        story: string;
        goalAmount: number;
        urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
        realName?: string;
        location?: string;
        isPublic?: boolean;
    }) => {
        if (!auth.currentUser) {
            setError('No user logged in');
            return null;
        }

        setLoading(true);
        setError(null);

        try {
            const userId = auth.currentUser.uid;
            const caseId = await custodyService.createCaseWithMetadata(userId, params);

            // Reload case info
            await initializeWallet();

            return caseId;

        } catch (err: any) {
            console.error('[useCustodialWallet] Failed to create case:', err);
            setError(err.message || 'Failed to create case');
            return null;
        } finally {
            setLoading(false);
        }
    }, [custodyService, initializeWallet]);

    /**
     * Refresh case info (e.g., after donation received)
     * NOW USES BLOCKCHAIN as source of truth!
     */
    const refreshCaseInfo = useCallback(async () => {
        if (!caseInfo) return;

        try {
            const metadata = await custodyService.getCaseMetadata(caseInfo.caseId);
            if (metadata) {
                // Get REAL balance from blockchain
                let blockchainBalance = null;
                let balanceInEth = 0;
                try {
                    blockchainBalance = await blockchainService.getWalletBalance(metadata.walletAddress);
                    balanceInEth = blockchainBalance.balanceInEth;
                } catch (e) {
                    console.warn('[useCustodialWallet] Blockchain fallback to Firestore');
                }

                const currentAmount = blockchainBalance
                    ? blockchainBalance.balanceInUsd
                    : metadata.currentAmount;

                setCaseInfo({
                    caseId: metadata.caseId,
                    displayName: metadata.displayName,
                    story: metadata.story,
                    goalAmount: metadata.goalAmount,
                    currentAmount: currentAmount,
                    urgencyLevel: metadata.urgencyLevel,
                    progress: (currentAmount / metadata.goalAmount) * 100,
                    walletAddress: metadata.walletAddress,
                    balanceInEth: balanceInEth,
                    isBlockchainVerified: !!blockchainBalance
                });
            }
        } catch (err) {
            console.error('[useCustodialWallet] Failed to refresh case:', err);
        }
    }, [caseInfo, custodyService, blockchainService]);

    // Auto-initialize on mount
    useEffect(() => {
        if (auth.currentUser) {
            initializeWallet();
        }
    }, [initializeWallet]);

    return {
        walletAddress,
        caseInfo,
        loading,
        error,
        initializeWallet,
        createCase,
        refreshCaseInfo
    };
}

/**
 * Hook for public cases (donation frontend)
 */
export function usePublicCases() {
    const [cases, setCases] = useState<CaseInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const custodyService = getCustodyService();

    const loadPublicCases = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const publicCases = await custodyService.getPublicCases();

            const formattedCases: CaseInfo[] = publicCases.map(c => ({
                caseId: c.caseId,
                displayName: c.displayName,
                story: c.story,
                goalAmount: c.goalAmount,
                currentAmount: c.currentAmount,
                urgencyLevel: c.urgencyLevel,
                progress: (c.currentAmount / c.goalAmount) * 100,
                walletAddress: c.walletAddress
            }));

            setCases(formattedCases);

        } catch (err: any) {
            console.error('[usePublicCases] Failed to load:', err);
            setError(err.message || 'Failed to load cases');
        } finally {
            setLoading(false);
        }
    }, [custodyService]);

    useEffect(() => {
        loadPublicCases();
    }, [loadPublicCases]);

    return {
        cases,
        loading,
        error,
        refresh: loadPublicCases
    };
}
