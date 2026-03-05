/**
 * Athena ADK-TS Agent Implementation
 * 
 * IQAI ATP Deployed Agent:
 * - Agent Contract: 0xce4f65d10b16ff7ab32581d3f66d570ac76d03b4
 * - Token: $ATHENA (0xee30b1d751c32cfed78826ed6377927d7ff85892)
 * - Network: Fraxtal Mainnet
 * 
 * Uses IQAI's real ADK-TS framework with:
 * - LlmAgent for conversation with Gemini
 * - FunctionTool for blockchain operations
 * - InMemorySessionService for chat context
 * 
 * This is the real agent that powers the Escape Planner chat.
 */

import {
    LlmAgent,
    FunctionTool,
    InMemorySessionService,
    AgentBuilder,
    type InvocationContext
} from "@iqai/adk";
import { z } from "zod";
import { getFraxService, VaultState } from "./frax-service";
import { generateHash } from "../services/cryptoUtils";
import { ethers } from "ethers";

// ============ ATP ON-CHAIN CONFIGURATION ============

// IQAI ATP Agent Contracts (Fraxtal Mainnet)
const ATP_CONFIG = {
    agentContract: "0xce4f65d10b16ff7ab32581d3f66d570ac76d03b4",
    tokenContract: "0xee30b1d751c32cfed78826ed6377927d7ff85892",
    liquidityPool: "0x805c15c2d7e13c32bde69ef3982bc3f1e835ba24",
    governanceContract: "0x68a088406d66d67b90f2825b1c0254f71842d91a",
    network: "Fraxtal",
    chainId: 252,
    rpcUrl: "https://rpc.frax.com"
};

// Agent's on-chain wallet (the Agent Contract itself holds tokens)
const AGENT_WALLET = ATP_CONFIG.agentContract;

// Note: IQAI logs now go through secure /api/atp-log route
// No API key needed in frontend

// ============ HUMANIZED LOG MESSAGES ============

// Generate pseudonym from user ID (privacy-preserving)
function generatePseudonym(userId?: string): string {
    const names = [
        "Luna", "Aurora", "Esperanza", "Victoria", "Valentía",
        "Fortaleza", "Libertad", "Estrella", "Mariposa", "Fénix",
        "Amanecer", "Renacer", "Guerrera", "Valiente", "Luz"
    ];
    const randomName = names[Math.floor(Math.random() * names.length)];
    const randomLetters = String.fromCharCode(65 + Math.floor(Math.random() * 26)) +
        String.fromCharCode(65 + Math.floor(Math.random() * 26));
    return `${randomName} ${randomLetters}.`;
}

// Humanized log message templates
const LOG_TEMPLATES = {
    // New user journeys
    USER_JOINED: (pseudo: string) =>
        `💜 ¡${pseudo} ha iniciado su camino hacia la libertad! Athena la acompañará en cada paso. Juntas somos más fuertes. #NuevaEsperanza`,

    // Escape plan creation
    PLAN_STARTED: (pseudo: string) =>
        `🦋 ${pseudo} está creando su plan de escape con Athena. Cada paso cuenta, cada decisión es valiente. #PlaneandoLibertad`,

    PLAN_COMPLETED: (pseudo: string, goal: number) =>
        `✨ ¡${pseudo} tiene su Freedom Goal definida! Meta: $${goal} para su nueva vida. El camino está trazado. #MetaDeLibertad`,

    // Vault activities
    VAULT_DEPOSIT: (pseudo: string, amount: number) =>
        `💰 ${pseudo} añadió $${amount.toFixed(2)} a su Freedom Vault. Cada centavo es un paso más cerca de la libertad. #AhorrandoEsperanza`,

    VAULT_MILESTONE: (pseudo: string, percent: number) =>
        `🎯 ¡${pseudo} alcanzó el ${percent}% de su Freedom Goal! El vuelo a la libertad está cada vez más cerca. 🦅 #ProgresoReal`,

    // Evidence secured
    EVIDENCE_SECURED: (pseudo: string, type: string) =>
        `🔐 ${pseudo} aseguró evidencia (${type}) en blockchain. Protegida para siempre, nadie puede borrarla. #EvidenciaSegura`,

    // Withdrawal (for safety, never reveal details)
    WITHDRAWAL_REQUESTED: (pseudo: string) =>
        `💸 ${pseudo} solicitó acceso a sus fondos. Athena verificó la solicitud. El dinero es suyo, su decisión es respetada. #LibertadFinanciera`,

    WITHDRAWAL_COMPLETED: (pseudo: string) =>
        `✅ Fondos transferidos exitosamente para ${pseudo}. Un paso más en su camino a la libertad. #MisiónCumplida`,

    // Emergency SOS
    SOS_TRIGGERED: (pseudo: string) =>
        `🆘 EMERGENCIA: ${pseudo} activó el protocolo SOS. Athena está transfiriendo todos los fondos a su lugar seguro. #ProtocoloDeEmergencia`,

    SOS_COMPLETED: (pseudo: string) =>
        `🛡️ Protocolo SOS completado para ${pseudo}. Fondos asegurados. Que encuentre paz y seguridad. 💜 #SOSExitoso`,

    // General activity
    BUDGET_CALCULATED: (pseudo: string, amount: number) =>
        `📊 Athena calculó el presupuesto de escape para ${pseudo}: $${amount}. Cada número representa esperanza. #PlanificaciónSegura`,

    SAFE_CONTACT_SET: (pseudo: string) =>
        `👥 ${pseudo} configuró su contacto de emergencia. Una red de apoyo es esencial. #RedDeApoyo`,

    // Donations received
    DONATION_RECEIVED: (amount: number, caseId: string) =>
        `💜 ¡Donación de $${amount.toFixed(2)} recibida! La comunidad se une para apoyar. Gracias, ángeles donadores. #ComunidadSolidaria`
};

/**
 * Send humanized log to IQAI ATP Dashboard
 * Creates beautiful, supportive messages that appear in the agent's activity feed
 */
async function logAgentActivity(
    action: string,
    data: any,
    txHash?: string,
    userId?: string
) {
    const pseudo = generatePseudonym(userId);

    // Generate humanized message based on action
    let humanizedMessage = "";

    switch (action) {
        case "USER_JOINED":
            humanizedMessage = LOG_TEMPLATES.USER_JOINED(pseudo);
            break;
        case "PLAN_STARTED":
            humanizedMessage = LOG_TEMPLATES.PLAN_STARTED(pseudo);
            break;
        case "PLAN_COMPLETED":
            humanizedMessage = LOG_TEMPLATES.PLAN_COMPLETED(pseudo, data.targetAmount || 0);
            break;
        case "VAULT_DEPOSIT":
            humanizedMessage = LOG_TEMPLATES.VAULT_DEPOSIT(pseudo, data.amount || 0);
            break;
        case "VAULT_MILESTONE":
            humanizedMessage = LOG_TEMPLATES.VAULT_MILESTONE(pseudo, data.percent || 0);
            break;
        case "SECURE_EVIDENCE":
            humanizedMessage = LOG_TEMPLATES.EVIDENCE_SECURED(pseudo, data.type || "documento");
            break;
        case "WITHDRAWAL_REQUESTED":
            humanizedMessage = LOG_TEMPLATES.WITHDRAWAL_REQUESTED(pseudo);
            break;
        case "WITHDRAWAL_COMPLETED":
            humanizedMessage = LOG_TEMPLATES.WITHDRAWAL_COMPLETED(pseudo);
            break;
        case "SOS_INITIATED":
            humanizedMessage = LOG_TEMPLATES.SOS_TRIGGERED(pseudo);
            break;
        case "SOS_COMPLETED":
            humanizedMessage = LOG_TEMPLATES.SOS_COMPLETED(pseudo);
            break;
        case "CALCULATE_BUDGET":
            humanizedMessage = LOG_TEMPLATES.BUDGET_CALCULATED(pseudo, data.targetAmount || 0);
            break;
        case "SAFE_CONTACT_SET":
            humanizedMessage = LOG_TEMPLATES.SAFE_CONTACT_SET(pseudo);
            break;
        case "DONATION_RECEIVED":
            humanizedMessage = LOG_TEMPLATES.DONATION_RECEIVED(data.amount || 0, data.caseId || "");
            break;
        default:
            // Fallback for other actions
            humanizedMessage = `💜 Athena continúa protegiendo a quienes más lo necesitan. Cada acción cuenta. #ProtecciónActiva`;
    }

    // Always log to console
    console.log("[ATP-LOG]", humanizedMessage);

    // Send to secure API route (no API key in frontend)
    try {
        const response = await fetch('/api/atp-log', {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: action,
                data: data,
                txHash: txHash
            })
        });

        if (response.ok) {
            console.log("[ATP-LOG] ✅ Sent via secure API");
        } else {
            console.warn("[ATP-LOG] ⚠️ Failed to send");
        }
    } catch (error) {
        console.error("[ATP-LOG] ❌ Error sending log:", error);
    }
}

// ============ SCHEMAS ============

// Input schema for escape planning
const EscapePlanRequestSchema = z.object({
    message: z.string().describe("User's message or question")
});

// Output schema for the generated plan
const EscapePlanSchema = z.object({
    isReady: z.boolean(),
    freedomGoal: z.object({
        targetAmount: z.number(),
        currentAmount: z.number(),
        currency: z.string()
    }),
    strategy: z.object({
        step1: z.string(),
        step2: z.string(),
        step3: z.string()
    }),
    riskLevel: z.number().min(1).max(10),
    destination: z.string()
});

// ============ TOOL FUNCTIONS ============

const fraxService = getFraxService();

/**
 * Get current vault balance
 */
async function getVaultBalance(): Promise<VaultState> {
    const state = await fraxService.getVaultState();
    logAgentActivity("GET_VAULT_BALANCE", {
        totalValueUsd: state.totalValueUsd,
        sFraxBalance: state.sFraxBalance,
        isOnline: state.isOnline
    });
    return state;
}

/**
 * Calculate escape budget based on parameters
 */
function calculateBudget(params: {
    dependents: number;
    destination: string;
    riskLevel: number;
    hasOwnMoney: boolean;
}): {
    targetAmount: number;
    breakdown: string;
    urgency: string;
} {
    const TRANSPORT_PER_PERSON = 30;
    const EMERGENCY_FOOD = 100;
    const TEMP_SHELTER_PER_NIGHT = 75;
    const NIGHTS_NEEDED = params.riskLevel >= 8 ? 1 : 3;

    const transportCost = (params.dependents + 1) * TRANSPORT_PER_PERSON;
    const shelterCost = params.hasOwnMoney ? 0 : TEMP_SHELTER_PER_NIGHT * NIGHTS_NEEDED;
    const totalTarget = transportCost + EMERGENCY_FOOD + shelterCost;

    const breakdown = `Transport: $${transportCost} (${params.dependents + 1} people), Food: $${EMERGENCY_FOOD}, Shelter: $${shelterCost}`;
    const urgency = params.riskLevel >= 8 ? "CRITICAL - Immediate action required" :
        params.riskLevel >= 5 ? "HIGH - Plan within 2 weeks" :
            "MODERATE - Build savings gradually";

    logAgentActivity("CALCULATE_BUDGET", {
        dependents: params.dependents,
        destination: params.destination,
        riskLevel: params.riskLevel,
        targetAmount: totalTarget
    });

    return { targetAmount: totalTarget, breakdown, urgency };
}

/**
 * Store evidence hash on blockchain (ON-CHAIN ACTION)
 */
async function secureEvidence(params: {
    description: string;
    type: string;
}): Promise<{ hash: string; status: string }> {
    const content = `${params.type}: ${params.description} | ${Date.now()}`;
    const hash = await generateHash(content);
    const result = await fraxService.storeEvidenceHash(hash);

    // Log on-chain activity to ATP
    logAgentActivity("SECURE_EVIDENCE", {
        type: params.type,
        hash: result.txHash || hash,
        status: result.success ? "SECURED_ON_CHAIN" : "PENDING_SYNC",
        txHash: result.txHash
    });

    return {
        hash: result.txHash || hash,
        status: result.success ? "SECURED_ON_CHAIN" : "PENDING_SYNC"
    };
}

/**
 * Trigger emergency SOS protocol (CRITICAL ON-CHAIN ACTION)
 */
async function triggerEmergencySOS(params: {
    destinationAddress: string;
}): Promise<{ success: boolean; message: string }> {
    // Log BEFORE executing (in case of failure)
    logAgentActivity("SOS_INITIATED", {
        destination: params.destinationAddress,
        timestamp: Date.now()
    });

    const result = await fraxService.triggerSOS(params.destinationAddress);

    // Log result
    logAgentActivity("SOS_COMPLETED", {
        success: result.success,
        liquidatedAmount: result.liquidatedAmount,
        transferredAmount: result.transferredAmount,
        txHashes: result.txHashes
    });

    return {
        success: result.success,
        message: result.success
            ? `Emergency protocol executed. $${result.transferredAmount.toFixed(2)} sent to safe destination.`
            : "Protocol initiated but requires confirmation."
    };
}

// ============ AGENT INSTRUCTION ============

const ATHENA_INSTRUCTION = `You are Athena, an autonomous AI agent specialized in protecting vulnerable women from domestic violence.

YOUR PERSONALITY:
- Empathetic but direct
- Security-focused and discreet  
- Action-oriented - you help create concrete plans
- You NEVER judge or question why someone needs to escape

YOUR CAPABILITIES (USE THESE TOOLS):
1. **calculate_budget** - Calculate financial requirements for escape based on dependents, destination, and risk level
2. **get_vault_balance** - Check current savings in the Freedom Vault
3. **secure_evidence** - Store evidence hash on blockchain for legal records
4. **trigger_sos** - Execute emergency liquidation and fund transfer

YOUR PROCESS:
1. GATHER INFO: Ask about dependents, destination preferences, risk level (1-10), and current financial access
2. CALCULATE: Use calculate_budget tool to determine the Freedom Goal
3. CREATE PLAN: Generate a 3-phase strategy based on urgency
4. SUPPORT: Help document evidence and build savings

RESPONSE GUIDELINES:
- Ask questions ONE AT A TIME, not all at once
- Be conversational and warm, not clinical
- When you have enough info (dependents, destination, risk, finances), use calculate_budget tool
- Always end with a supportive message

WHEN GENERATING FINAL PLAN:
After gathering all info, output a JSON plan in this format:
\`\`\`json
{
  "isReady": true,
  "freedomGoal": {"targetAmount": NUMBER, "currentAmount": 0, "currency": "USD"},
  "strategy": {"step1": "...", "step2": "...", "step3": "..."},
  "riskLevel": NUMBER,
  "destination": "City/Location"
}
\`\`\``;

// ============ CREATE AGENT ============

// Session service for maintaining chat context
const sessionService = new InMemorySessionService();

// Create the Athena LLM Agent
export const athenaLlmAgent = new LlmAgent({
    name: "athena_planner",
    description: "Autonomous AI agent for escape planning and financial protection of vulnerable women",

    // Model configuration
    model: "gemini-2.5-flash-lite",

    // Agent instructions
    instruction: ATHENA_INSTRUCTION,

    // Tools for blockchain and planning operations
    tools: [
        new FunctionTool(getVaultBalance, {
            name: "get_vault_balance",
            description: "Get current balance and status of the Freedom Vault (sFRAX savings)"
        }),
        new FunctionTool(calculateBudget, {
            name: "calculate_budget",
            description: "Calculate the target Freedom Goal amount based on escape parameters. Call this when you know: number of dependents, destination city, risk level (1-10), and whether they have access to their own money.",
            schema: z.object({
                dependents: z.number().describe("Number of people escaping with the user (children, elderly)"),
                destination: z.string().describe("Target city or location for escape"),
                riskLevel: z.number().min(1).max(10).describe("Current danger level 1-10"),
                hasOwnMoney: z.boolean().describe("Whether user has access to their own funds")
            })
        }),
        new FunctionTool(secureEvidence, {
            name: "secure_evidence",
            description: "Store evidence of abuse on the blockchain for legal records",
            schema: z.object({
                description: z.string().describe("Description of the evidence"),
                type: z.string().describe("Type: PHOTO, AUDIO, VIDEO, or TEXT")
            })
        }),
        new FunctionTool(triggerEmergencySOS, {
            name: "trigger_sos",
            description: "EMERGENCY ONLY: Liquidate all funds and transfer to safe destination. This is irreversible.",
            schema: z.object({
                destinationAddress: z.string().describe("Wallet address or identifier of safe contact")
            })
        })
    ],

    // Session management for chat context continuity
    sessionService: sessionService,

    // Generation config for balanced responses
    generateContentConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
        topP: 0.9,
    },

    // App identification
    appName: "athena_app",
    userId: "athena_user"
});

// ============ AGENT RUNNER ============

let agentRunner: any = null;
let isInitialized = false;

/**
 * Initialize the agent runner (call once on app start)
 */
export async function initializeAthenaAgent(): Promise<void> {
    if (isInitialized) return;

    try {
        const result = await AgentBuilder.create()
            .withAgent(athenaLlmAgent)
            .build();

        agentRunner = result.runner;
        isInitialized = true;
        console.log("[ADK-TS] Athena Agent initialized successfully");
    } catch (error) {
        console.error("[ADK-TS] Failed to initialize agent:", error);
        throw error;
    }
}

/**
 * Send a message to the Athena agent and get response
 */
export async function sendMessageToAgent(message: string): Promise<{
    text: string;
    plan?: any;
}> {
    // Lazy initialization
    if (!isInitialized) {
        await initializeAthenaAgent();
    }

    if (!agentRunner) {
        throw new Error("Agent not initialized");
    }

    try {
        // Send message to agent
        const response = await agentRunner.ask(message);

        // Try to extract JSON plan if present
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
            response.match(/```\s*([\s\S]*?)\s*```/);

        if (jsonMatch) {
            try {
                const plan = JSON.parse(jsonMatch[1].trim());
                if (plan.isReady !== undefined) {
                    return { text: "Plan generated.", plan };
                }
            } catch {
                // Not valid JSON, return as text
            }
        }

        return { text: response };

    } catch (error: any) {
        console.error("[ADK-TS] Agent error:", error);
        return {
            text: "I'm experiencing a temporary connection issue. Please try again in a moment."
        };
    }
}

/**
 * Reset agent session (for new conversations)
 */
export function resetAgentSession(): void {
    // The InMemorySessionService will create a new session on next interaction
    console.log("[ADK-TS] Agent session reset");
}

export default athenaLlmAgent;
