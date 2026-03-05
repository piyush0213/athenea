/**
 * Initialize Donation Listener
 * 
 * Add this to your App.tsx to start monitoring donations
 */

import { useEffect } from 'react';
import { getDonationListener } from './donation-listener';

export function useDonationListener() {
    useEffect(() => {
        const listener = getDonationListener();

        // Start listening when app mounts
        listener.startListening();

        console.log('🎧 Donation listener started');

        // Cleanup on unmount
        return () => {
            listener.stopListening();
            console.log('🎧 Donation listener stopped');
        };
    }, []);
}
