/**
 * Firebase Configuration & Services
 * 
 * Provides:
 * - Firebase App initialization
 * - Authentication (Email/Password)
 * - Firestore for chat memory and user data
 */

import { initializeApp } from 'firebase/app';
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    User
} from 'firebase/auth';
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    getDoc,
    addDoc,
    query,
    orderBy,
    limit,
    getDocs,
    serverTimestamp,
    Timestamp
} from 'firebase/firestore';

// ============ FIREBASE CONFIG ============
// Configuration loaded from environment variables (.env.local)
// See .env.firebase for reference

// @ts-ignore - Vite env types
const env = (import.meta as any).env || {};

const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY || "",
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: env.VITE_FIREBASE_APP_ID || "",
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || ""
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// ============ TYPES ============

export interface AthenaUser {
    uid: string;
    displayName: string;
    email: string;
    createdAt: Date;
    caseId?: string;
    safeContactAddress?: string;
}

export interface ChatMessage {
    id?: string;
    role: 'user' | 'model';
    text: string;
    timestamp?: Date;
}

export interface UserSession {
    user: AthenaUser | null;
    isLoading: boolean;
    error: string | null;
}

// ============ AUTH FUNCTIONS ============

/**
 * Register new user with email and password
 */
export async function registerUser(
    email: string,
    password: string,
    displayName: string
): Promise<AthenaUser> {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Create user profile in Firestore
        const athenaUser: AthenaUser = {
            uid: user.uid,
            displayName,
            email: user.email || email,
            createdAt: new Date(),
            caseId: `ATHENA-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
        };

        await setDoc(doc(db, 'users', user.uid), {
            ...athenaUser,
            createdAt: serverTimestamp()
        });

        console.log('[Firebase] User registered:', athenaUser.displayName);

        // Send log to IQAI ATP Dashboard
        import('./atp-logs').then(({ atpLogs }) => {
            atpLogs.userJoined();
        }).catch(() => { });

        return athenaUser;

    } catch (error: any) {
        console.error('[Firebase] Registration error:', error);
        throw new Error(getAuthErrorMessage(error.code));
    }
}

/**
 * Sign in existing user
 */
export async function loginUser(email: string, password: string): Promise<AthenaUser> {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Get user profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
            const data = userDoc.data();
            return {
                uid: user.uid,
                displayName: data.displayName,
                email: data.email,
                createdAt: data.createdAt?.toDate() || new Date(),
                caseId: data.caseId,
                safeContactAddress: data.safeContactAddress
            };
        }

        // Fallback if no Firestore profile
        return {
            uid: user.uid,
            displayName: user.email?.split('@')[0] || 'Agent',
            email: user.email || email,
            createdAt: new Date()
        };

    } catch (error: any) {
        console.error('[Firebase] Login error:', error);
        throw new Error(getAuthErrorMessage(error.code));
    }
}

/**
 * Sign out current user
 */
export async function logoutUser(): Promise<void> {
    try {
        await signOut(auth);
        console.log('[Firebase] User signed out');
    } catch (error) {
        console.error('[Firebase] Logout error:', error);
    }
}

/**
 * Get current user profile
 */
export async function getCurrentUser(): Promise<AthenaUser | null> {
    const user = auth.currentUser;

    if (!user) return null;

    try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
            const data = userDoc.data();
            return {
                uid: user.uid,
                displayName: data.displayName,
                email: data.email,
                createdAt: data.createdAt?.toDate() || new Date(),
                caseId: data.caseId,
                safeContactAddress: data.safeContactAddress
            };
        }

        return null;
    } catch (error) {
        console.error('[Firebase] Get user error:', error);
        return null;
    }
}

/**
 * Subscribe to auth state changes
 */
export function onAuthChange(callback: (user: User | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
}

// ============ FIRESTORE CHAT FUNCTIONS ============

/**
 * Save chat message to Firestore
 */
export async function saveChatMessage(
    userId: string,
    message: { role: 'user' | 'model'; text: string }
): Promise<string> {
    try {
        const chatRef = collection(db, 'users', userId, 'chat_history');
        const docRef = await addDoc(chatRef, {
            role: message.role,
            text: message.text,
            timestamp: serverTimestamp()
        });
        return docRef.id;
    } catch (error) {
        console.error('[Firebase] Save chat error:', error);
        throw error;
    }
}

/**
 * Load chat history from Firestore
 */
export async function loadChatHistory(
    userId: string,
    messageLimit: number = 50
): Promise<ChatMessage[]> {
    try {
        const chatRef = collection(db, 'users', userId, 'chat_history');
        const q = query(chatRef, orderBy('timestamp', 'asc'), limit(messageLimit));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            role: doc.data().role,
            text: doc.data().text,
            timestamp: doc.data().timestamp?.toDate() || new Date()
        }));
    } catch (error) {
        console.error('[Firebase] Load chat error:', error);
        return [];
    }
}

/**
 * Save escape plan to Firestore
 */
export async function saveEscapePlan(userId: string, plan: any): Promise<void> {
    try {
        await setDoc(doc(db, 'users', userId, 'plans', 'current'), {
            ...plan,
            updatedAt: serverTimestamp()
        });

        // Send log to IQAI ATP Dashboard
        if (plan.isReady && plan.freedomGoal?.targetAmount) {
            import('./atp-logs').then(({ atpLogs }) => {
                atpLogs.planCompleted(plan.freedomGoal.targetAmount);
            }).catch(() => { });
        }
    } catch (error) {
        console.error('[Firebase] Save plan error:', error);
    }
}

/**
 * Load escape plan from Firestore
 */
export async function loadEscapePlan(userId: string): Promise<any | null> {
    try {
        const planDoc = await getDoc(doc(db, 'users', userId, 'plans', 'current'));
        return planDoc.exists() ? planDoc.data() : null;
    } catch (error) {
        console.error('[Firebase] Load plan error:', error);
        return null;
    }
}

// ============ SAFE CONTACT FUNCTIONS ============

export type WithdrawalMethod = 'WALLET' | 'PHONE' | 'CASH_CODE';

export interface SafeContactInfo {
    name: string;
    relationship: string;
    withdrawalMethod: WithdrawalMethod;

    // For WALLET method
    walletAddress?: string;

    // For PHONE method (Yape, M-Pesa, etc.)
    phoneNumber?: string;
    phoneCountry?: string;

    // For CASH_CODE method (Western Union, MoneyGram)
    fullName?: string;
    country?: string;

    // Legacy field (backwards compatibility)
    contactInfo?: string;

    createdAt?: Date;
}

/**
 * Save or update safe contact for SOS feature
 */
export async function saveSafeContact(
    userId: string,
    contact: SafeContactInfo
): Promise<void> {
    try {
        await setDoc(doc(db, 'users', userId, 'safe_contact', 'primary'), {
            ...contact,
            createdAt: serverTimestamp()
        });

        // Also update the user document for quick access
        await setDoc(doc(db, 'users', userId), {
            safeContactName: contact.name,
            safeContactInfo: contact.contactInfo
        }, { merge: true });

        console.log('[Firebase] Safe contact saved:', contact.name);
    } catch (error) {
        console.error('[Firebase] Save contact error:', error);
    }
}

/**
 * Get safe contact for SOS feature
 */
export async function getSafeContact(userId: string): Promise<SafeContactInfo | null> {
    try {
        // 1. Try dedicated contact document first
        const contactDoc = await getDoc(doc(db, 'users', userId, 'safe_contact', 'primary'));

        if (contactDoc.exists()) {
            const data = contactDoc.data();
            return {
                name: data.name,
                relationship: data.relationship,
                withdrawalMethod: data.withdrawalMethod || 'WALLET',
                walletAddress: data.walletAddress,
                phoneNumber: data.phoneNumber,
                phoneCountry: data.phoneCountry,
                fullName: data.fullName,
                country: data.country,
                contactInfo: data.contactInfo,
                createdAt: data.createdAt?.toDate()
            };
        }

        // 2. Fallback: Try to get from active Escape Plan
        // This handles cases where plan was generated but settings not explicitly saved
        const planDoc = await getDoc(doc(db, 'users', userId, 'plans', 'current'));
        if (planDoc.exists()) {
            const plan = planDoc.data();
            if (plan.emergencyContact) {
                const ec = plan.emergencyContact;
                return {
                    name: ec.name,
                    relationship: ec.relationship,
                    withdrawalMethod: ec.withdrawalMethod || 'PHONE',
                    contactInfo: ec.contactInfo,
                    phoneNumber: ec.withdrawalMethod === 'PHONE' ? ec.contactInfo : undefined,
                    walletAddress: ec.withdrawalMethod === 'WALLET' ? ec.contactInfo : undefined,
                    fullName: ec.name,
                    createdAt: plan.updatedAt?.toDate() || new Date()
                };
            }
        }

        return null;
    } catch (error) {
        console.error('[Firebase] Get contact error:', error);
        return null;
    }
}

/**
 * Legacy function - redirects to saveSafeContact
 */
export async function updateSafeContact(
    userId: string,
    safeContactAddress: string
): Promise<void> {
    await saveSafeContact(userId, {
        name: 'Emergency Contact',
        relationship: 'Unknown',
        withdrawalMethod: 'WALLET',
        walletAddress: safeContactAddress,
        contactInfo: safeContactAddress
    });
}

// ============ EVIDENCE LOCKER STORAGE ============

/**
 * Save evidence item to Firestore
 */
export async function saveEvidence(userId: string, evidence: {
    id: string;
    timestamp: number;
    content: string;
    type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO';
    hash: string;
    status: 'PENDING' | 'SECURED_ON_CHAIN';
    ipfsCid?: string;
    ipfsUrl?: string;
    analysis?: {
        category: string;
        riskLevel: number;
        summary: string;
    };
}): Promise<void> {
    try {
        await setDoc(doc(db, 'users', userId, 'evidence', evidence.id), {
            ...evidence,
            // Don't store mediaData in Firestore (too large, use IPFS instead)
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        console.log('[Firebase] Evidence saved:', evidence.id);

        // Send log to IQAI ATP Dashboard
        import('./atp-logs').then(({ atpLogs }) => {
            atpLogs.evidenceSecured(evidence.type);
        }).catch(() => { });
    } catch (error) {
        console.error('[Firebase] Save evidence error:', error);
        throw error;
    }
}

/**
 * Load all evidence items from Firestore
 */
export async function loadEvidence(userId: string, maxItems: number = 50): Promise<any[]> {
    try {
        const evidenceRef = collection(db, 'users', userId, 'evidence');
        const q = query(evidenceRef, orderBy('timestamp', 'desc'), limit(maxItems));
        const snapshot = await getDocs(q);

        return snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (error) {
        console.error('[Firebase] Load evidence error:', error);
        return [];
    }
}

/**
 * Delete evidence item from Firestore
 */
export async function deleteEvidence(userId: string, evidenceId: string): Promise<void> {
    try {
        const { deleteDoc } = await import('firebase/firestore');
        await deleteDoc(doc(db, 'users', userId, 'evidence', evidenceId));
        console.log('[Firebase] Evidence deleted:', evidenceId);
    } catch (error) {
        console.error('[Firebase] Delete evidence error:', error);
    }
}

// ============ HELPERS ============

function getAuthErrorMessage(code: string): string {
    switch (code) {
        case 'auth/email-already-in-use':
            return 'This email is already registered. Try logging in.';
        case 'auth/weak-password':
            return 'Password should be at least 6 characters.';
        case 'auth/invalid-email':
            return 'Invalid email address.';
        case 'auth/user-not-found':
            return 'No account found with this email.';
        case 'auth/wrong-password':
            return 'Incorrect password.';
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try later.';
        default:
            return 'Authentication failed. Please try again.';
    }
}

export default app;
