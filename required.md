ACT AS: Senior Full Stack Developer & Blockchain Architect specialized in Agentic Workflows.

PROJECT: "Athena" (The Stealth Financial Shield)
TYPE: Mobile-First PWA (Next.js 14 App Router + Tailwind CSS).

CONTEXT: 
We are building a stealth app disguised as a calculator for victims of domestic violence. Behind the calculator interface (`Math-OS`), there is an Autonomous AI Agent that manages a financial vault and secures evidence on-chain.

--------------------------------------------------
TECH STACK DEFINITION:

1. BLOCKCHAIN LAYERS:
   - Primary Settlement: Ethereum (L1).
   - Execution/Asset Layer: Fraxtal (L2) by Frax Finance.
   - Core Asset: sFRAX (Staked Frax) for yield-bearing savings.

2. AGENT ORCHESTRATION:
   - Framework Pattern: IQAI ADK-TS (Agent Development Kit).
   - Reference Repo: https://github.com/IQAIcom/adk-ts
   - *Instruction:* Since we are prototyping, create a TypeScript class `AthenaAgent` that implements the ADK-TS philosophy: 
     (Perception -> Reasoning/Planning -> Action Execution).

3. LIBRARIES:
   - `ethers.js` (v6): For wallet management and transaction simulation.
   - `@google/generative-ai`: For the Agent's reasoning brain (Gemini 1.5 Flash).
   - `lucide-react`: For UI icons.

--------------------------------------------------
CORE AGENT & BLOCKCHAIN LOGIC TO IMPLEMENT:

A. THE AGENT ARCHITECTURE 
   The Agent must act as an autonomous orchestrator. Implement these methods:
   - `createAnonymousCase()`: Generates a unique Case ID and assigns a "Deposit Address" for external crowdfunding (The Public Pool).
   - `secureEvidence(text, media)`: Takes user input, hashes it (SHA-256), and simulates a transaction to Fraxtal L2 containing the hash in the `calldata`. This creates an immutable record.
   - `optimizeYield()`: Simulates checking sFRAX APY and moving idle USDC into sFRAX.

B. THE BLOCKCHAIN SERVICE (`lib/frax-service.ts`):
   Create a robust service using `ethers.js` with a "Hybrid Mock" pattern:
   - Define the ABI for sFRAX (ERC-4626 standard: deposit/redeem).
   - Function `getBalance()`: Tries to read from Mainnet; if it fails/timeouts, returns a simulated increasing balance (e.g., 1250.00 -> 1250.005) to demonstrate Yield in the video.
   - Function `triggerSOS(trustedContact)`: Simulates an instant liquidation of sFRAX -> FRAX -> Transfer to the contact.

C. THE CAMOUFLAGE UI (`app/page.tsx`):
   - A fully functional Calculator.
   - SECRET TRIGGERS:
     - `1999=` -> Redirects to Dashboard (The Vault).
     - `1+1=` -> Triggers the Agent Onboarding Chat (Plan Generation).
     - `9/11=` -> Flash Toast showing current sFRAX Balance.

--------------------------------------------------
DELIVERABLES REQUIRED NOW:

1. Project Folder Structure (Next.js App Router).
2. Code for `lib/frax-service.ts` (The Blockchain Layer with Mock Fallback).
3. Code for `lib/agent.ts` (The ADK-TS Logic Class).
4. Code for `app/page.tsx` (The Calculator with Secret Triggers).
5. Code for `app/dashboard/page.tsx` (The Vault UI showing sFRAX Yield & Evidence Locker).

*Style Note:* Use a dark, "Cyberpunk/Stealth" aesthetic for the Dashboard. Violet/Black colors (matching Frax/IQAI vibes).