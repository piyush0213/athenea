/**
 * React Hook for Blockchain Balance
 * 
 * Fetches REAL balance from blockchain, not Firestore
 */

import { useState, useEffect } from 'react';
import { getBlockchainBalanceService } from './blockchain-balance';

export function useBlockchainBalance(walletAddress: string | null) {
    const [balance, setBalance] = useState<{
        balanceInEth: number;
        balanceInUsd: number;
        lastUpdated: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!walletAddress) {
            setLoading(false);
            return;
        }

        const fetchBalance = async () => {
            setLoading(true);
            setError(null);

            try {
                const balanceService = getBlockchainBalanceService();
                const result = await balanceService.getWalletBalance(walletAddress);
                setBalance(result);
            } catch (err: any) {
                console.error('Error fetching blockchain balance:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchBalance();

        // Refresh every 30 seconds
        const interval = setInterval(fetchBalance, 30000);

        return () => clearInterval(interval);
    }, [walletAddress]);

    return { balance, loading, error };
}

export function useCaseBalance(caseId: string | null) {
    const [caseBalance, setCaseBalance] = useState<{
        currentAmount: number;
        walletAddress: string;
        balanceInEth: number;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!caseId) {
            setLoading(false);
            return;
        }

        const fetchCaseBalance = async () => {
            setLoading(true);
            setError(null);

            try {
                const balanceService = getBlockchainBalanceService();
                const result = await balanceService.getCaseBalance(caseId);
                setCaseBalance(result);
            } catch (err: any) {
                console.error('Error fetching case balance:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchCaseBalance();

        // Refresh every 30 seconds
        const interval = setInterval(fetchCaseBalance, 30000);

        return () => clearInterval(interval);
    }, [caseId]);

    return { caseBalance, loading, error };
}
