/**
 * Manual Case Creation Script
 * 
 * Run this in browser console to create metadata for existing case
 */

// Paste this in browser console (F12) when logged in to the app

(async () => {
    const { getCustodyService } = await import('./lib/wallet-custody');
    const { auth } = await import('./lib/firebase');

    const custodyService = getCustodyService();
    const user = auth.currentUser;

    if (!user) {
        console.error('❌ No user logged in');
        return;
    }

    console.log('Creating case metadata for user:', user.uid);

    try {
        // Get or create wallet
        let walletAddress = (await custodyService.getWallet(user.uid))?.address;
        if (!walletAddress) {
            walletAddress = await custodyService.createCustodialWallet(user.uid);
            console.log('✅ Wallet created:', walletAddress);
        } else {
            console.log('✅ Wallet found:', walletAddress);
        }

        // Create case metadata
        const caseId = await custodyService.createCaseWithMetadata(user.uid, {
            displayName: 'Case RV46', // Change this to your case ID suffix
            story: 'Seeking help to reach freedom. Mother escaping domestic violence with 2 children.',
            goalAmount: 450, // Change to your goal amount
            urgencyLevel: 'HIGH', // LOW, MEDIUM, HIGH, or CRITICAL
            isPublic: true
        });

        console.log('✅ Case metadata created:', caseId);
        console.log('🎉 Done! Refresh /donate page to see your case');

    } catch (error) {
        console.error('❌ Error:', error);
    }
})();
