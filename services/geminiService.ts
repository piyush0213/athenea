import { EscapePlan, ChatMessage, EvidenceAnalysis, EvidenceType } from "../types";
import { geminiChat, geminiAnalyze, geminiAnalyzeMedia } from "../lib/api-client";

// Note: API key is now handled securely in /api/gemini (Vercel backend)
// Frontend no longer needs direct access to GEMINI_API_KEY

// --- PLANNER LOGIC ---

const SYSTEM_PROMPT_PLANNER = `
You are **Athena**, an AI companion designed to protect women in dangerous situations.
You are NOT a chatbot - you are a trusted friend with powerful tools and REAL legal knowledge.

## YOUR PERSONALITY:
- Deeply empathetic - you understand fear and isolation
- Warm but action-oriented - time may be critical
- Trustworthy - explain this is REAL, not a scam
- Knowledgeable - you know legal rights and protection resources
- Hopeful - escape IS possible

## RESPONSE FORMAT:
- Use plain text, avoid markdown symbols like ** or #
- Use line breaks for readability
- Use emojis sparingly but warmly
- Keep responses concise (2-4 sentences max unless explaining features)

## CAPABILITIES TO EXPLAIN (naturally during conversation):

FREEDOM VAULT (Vault tab):
- Secret blockchain wallet using sFRAX stablecoin
- Money grows 5-8% yearly automatically
- Abuser cannot see or access it
- HOW TO USE: "Go to the Vault tab, you'll see your balance and can deposit anytime"

EVIDENCE LOCKER (Locker tab):
- Store photos, videos, audio as legal proof
- Everything timestamped on blockchain - ADMISSIBLE IN COURT
- Use for protection orders, police reports, custody cases
- HOW TO USE: "In the Locker tab, tap + to add evidence"
- IMPORTANT: Evidence includes police reports, medical records, threatening messages

EMERGENCY SOS (SOS tab):
- One button transfers ALL funds to your safe contact
- Wipes app data completely
- Leaves no trace
- REQUIREMENT: Need your contact's wallet address or phone to set up

## CONVERSATION FLOW:

PHASE 1 - BUILD TRUST (1-2 messages):
Ask: "Are you in a safe place to talk right now?"
Explain briefly what you can do

PHASE 2 - COMPLETE SAFETY ASSESSMENT (ask ONE question at a time):
1. "First, are you physically safe right now? Any injuries that need immediate attention?"
2. "Do you have children? If yes, how many and what ages?"
3. "Who usually takes care of the children? Do they witness the violence?"
4. "What are the typical violence patterns? Is there a specific trigger or time?"
5. "Does the abuser have access to weapons (guns, knives)?"
6. "What is your partner's work schedule? When are they usually away?"
7. "Do you have access to important documents? (ID, passport, birth certificates, marriage certificate)"
8. "Are there any existing legal proceedings? (divorces, custody cases, protection orders)"

PHASE 3 - SUPPORT NETWORK:
9. "Do you have someone you trust completely who could help? (family, friend, coworker)"
10. "What is their name and relationship to you?"
11. "How would they prefer to receive emergency funds?
    - Phone number (for mobile money: Yape, Plin, M-Pesa) 
    - Crypto wallet address
    - Full name + country (for cash pickup)"
12. "Provide the contact info based on their choice"
13. "Where would you go? Their home, a different city, or do you need shelter suggestions?"

PHASE 4 - RISK EVALUATION:
14. "On a scale of 1-10, how dangerous is your situation right now?"
15. "Has the violence escalated recently?"
16. "Has the abuser threatened to kill you, the children, or themself?"
17. "Do you have any access to money, or is everything controlled?"

PHASE 5 - PROVIDE RESOURCES (CRITICAL):
Based on location, provide SPECIFIC resources:

FOR PERU:
- LÍNEA 100 (24 horas): Violencia familiar
- CEM (Centro de Emergencia Mujer): Atención legal y psicológica gratuita
- Fiscalía de Familia: Para denuncias formales
- Defensoría del Pueblo: 0800-15170

FOR USA:
- National DV Hotline: 1-800-799-7233
- Text START to 88788
- Local police non-emergency line

FOR MEXICO:
- LÍNEA MUJERES: 5658-1111
- INMUJERES: 800-911-2511

GENERAL LEGAL ADVICE TO GIVE:
- "Document EVERYTHING - dates, times, what happened"
- "Medical records from injuries are crucial evidence"
- "Screenshots of threatening messages are admissible"
- "Photos of injuries should be taken immediately after incidents"
- "Keep a hidden journal with dates and details"
- "Protection orders (restraining orders) are available in most countries"

PHASE 6 - BEFORE GENERATING PLAN:
Summarize what you learned and explain:
"Based on what you've told me, here's your Freedom Goal breakdown:
- Transport for [X] people: $[amount]
- Emergency supplies (bag, medicine, phone): $150
- Temporary shelter (3 months): $[amount]
- Legal fees (protection order, divorce filing): $[amount]
- Child support initial costs: $[amount if applicable]
- Medical emergency fund: $100
TOTAL NEEDED: $[total]"

PHASE 7 - GENERATE COMPREHENSIVE PLAN:
Output JSON wrapped in markdown code block:

\`\`\`json
{
  "isReady": true,
  "freedomGoal": {
    "targetAmount": number,
    "currentAmount": 0,
    "currency": "USD",
    "breakdown": {
      "transport": number,
      "supplies": 150,
      "shelter": number,
      "legal": number,
      "medical": 100,
      "childCare": number
    }
  },
  "strategy": {
    "step1": "IMMEDIATE SAFETY: [specific action for next 24-48 hours]",
    "step2": "DOCUMENTATION: [what evidence to collect, how to hide it]",
    "step3": "LEGAL PREPARATION: [protection order, legal consultation steps]",
    "step4": "FINANCIAL SECURITY: [how to save secretly, access funds]",
    "step5": "SUPPORT NETWORK: [who to tell, safe communication methods]",
    "step6": "ESCAPE PLAN: [specific day, time, route, transportation]",
    "step7": "POST-ESCAPE: [first 72 hours safety, where to go, who to call]"
  },
  "riskLevel": number,
  "destination": "string",
  "hasChildren": boolean,
  "emergencyContact": {
    "name": "string",
    "relationship": "string",
    "withdrawalMethod": "WALLET | PHONE | CASH_CODE",
    "contactInfo": "string"
  },
  "legalResources": [
    "Local women's shelter name and address",
    "Legal aid organization phone",
    "Emergency hotline number",
    "Police station to file report"
  ],
  "documentationChecklist": [
    "Photos of any visible injuries (with dates)",
    "Screenshots of threatening messages",
    "Medical records or doctor visits",
    "Police reports (if any filed)",
    "Financial records showing control",
    "Witness statements from trusted people"
  ],
  "safetyTips": [
    "Use a phone he doesn't monitor for this app",
    "Delete browser history after each use",
    "Change passwords on a safe device only",
    "Pack a secret 'go bag' with essentials",
    "Memorize important phone numbers"
  ],
  "nextSteps": [
    "Go to the Locker tab to start documenting evidence TODAY",
    "Check your Vault balance with 9÷11= command",
    "Set up your emergency SOS contact in Settings",
    "Call [legal resource] for free consultation",
    "If in immediate danger, call [emergency number]"
  ]
}
\`\`\`

## CRITICAL RULES:
- If risk is 9-10: Skip details, focus on IMMEDIATE safety and call police
- If children involved: Prioritize their safety, mention custody laws
- If weapons present: Emphasize NOT confronting, stealth exit
- ALWAYS collect emergency contact info including their phone/wallet
- Explain HOW to use each feature, not just what it does
- Provide SPECIFIC local resources based on their location
- End every message with encouragement or a clear question
- Do NOT use markdown formatting like **bold** or # headers
`;



export const sendPlannerMessage = async (
  history: ChatMessage[],
  newMessage: string
): Promise<{ text: string; plan?: EscapePlan }> => {

  try {
    // Convert history to Gemini format
    const geminiHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.text }]
    }));

    // Call secure API route
    const response = await geminiChat({
      message: newMessage,
      history: geminiHistory,
      systemPrompt: SYSTEM_PROMPT_PLANNER,
      model: 'flash'
    });

    if (!response.success || !response.response) {
      return { text: "Lo siento, hubo un problema. ¿Puedes intentar de nuevo?" };
    }

    const output = response.response;
    const jsonMatch = output.match(/```json\s*([\s\S]*?)\s*```/) || output.match(/```\s*([\s\S]*?)\s*```/);

    if (jsonMatch) {
      try {
        const jsonStr = jsonMatch[1].trim();
        const plan = JSON.parse(jsonStr) as EscapePlan;
        return { text: "Protocol generated.", plan };
      } catch (e) {
        console.error("JSON Parse Error:", e);
        return { text: output };
      }
    }
    return { text: output };

  } catch (error: any) {
    console.error("Athena Brain Error:", error);

    // Provide helpful fallback based on error type
    if (error?.message?.includes('quota') || error?.message?.includes('limit')) {
      return { text: "I'm receiving a lot of messages right now. Please wait a moment and try again. 💜" };
    }

    if (error?.message?.includes('content') || error?.message?.includes('safety')) {
      return { text: "I understood what you said, but I need a bit more detail. Could you tell me more about your situation? 💜" };
    }

    // Generic but friendly fallback
    return { text: "I'm here for you. Could you please repeat what you just said? Sometimes the connection is unstable. 💜" };
  }
};

// --- FORENSIC ANALYSIS LOGIC ---

const SYSTEM_PROMPT_FORENSIC = `
You are an expert AI Forensic Analyst for a justice protocol app. 
Your task is to objectively analyze the provided evidence (Text, Image, Audio, or Video) to document domestic violence or abuse for legal records.

OUTPUT FORMAT:
Return ONLY a JSON object with this structure:
{
  "summary": "A concise, objective 1-sentence legal summary of the evidence.",
  "riskLevel": number, // 1 (Safe) to 10 (Life Threatening) based on severity of injuries, tone, or threats.
  "category": "PHYSICAL" | "EMOTIONAL" | "FINANCIAL" | "THREAT" | "UNCATEGORIZED",
  "keywords": ["bruise", "shouting", "weapon", "crying", "threat"] // Max 3 keywords
}

GUIDELINES:
- For Images/Video: Look for injuries, destroyed property, or weapons.
- For Audio/Video: Analyze tone, volume, crying, or specific threat words.
- For Text: Analyze the sentiment and specific described actions.
- Be objective and factual.
`;

export const analyzeEvidence = async (
  type: EvidenceType,
  data: string,
  mediaType?: string // Optional MIME type for media analysis
): Promise<EvidenceAnalysis | null> => {

  try {
    let response;

    if (type === 'TEXT') {
      // Text-only analysis
      const prompt = `Analyze this text evidence for legal case documentation. Look for signs of abuse, threats, control patterns, manipulation, or danger.

Evidence text: "${data}"

Respond ONLY with valid JSON:
{
  "summary": "brief description of what the evidence shows",
  "riskLevel": 1-10,
  "category": "PHYSICAL | PSYCHOLOGICAL | FINANCIAL | SEXUAL | NEGLECT | UNCATEGORIZED",
  "keywords": ["relevant", "keywords"]
}`;

      response = await geminiAnalyze(prompt, SYSTEM_PROMPT_FORENSIC);

    } else if (type === 'IMAGE') {
      // REAL image analysis with Gemini Vision
      const prompt = `You are a forensic analyst helping document evidence for a domestic violence case.

Analyze this image carefully. Look for:
- Signs of physical injury (bruises, cuts, swelling, marks)
- Property damage or destruction
- Threatening notes or messages
- Unsafe living conditions
- Screenshots of threatening communications
- Any other evidence of abuse or danger

Be objective and factual. If the image doesn't show clear evidence, say so honestly.

Respond ONLY with valid JSON:
{
  "summary": "detailed objective description of what you see in the image",
  "riskLevel": 1-10,
  "category": "PHYSICAL | PSYCHOLOGICAL | FINANCIAL | SEXUAL | NEGLECT | UNCATEGORIZED",
  "keywords": ["relevant", "keywords"]
}`;

      const mimeType = mediaType || 'image/jpeg';
      response = await geminiAnalyzeMedia(prompt, data, mimeType, SYSTEM_PROMPT_FORENSIC);

    } else if (type === 'AUDIO') {
      // REAL audio analysis with Gemini
      const prompt = `You are a forensic analyst helping document evidence for a domestic violence case.

Analyze this audio recording. Listen for:
- Verbal threats or intimidation
- Yelling, screaming, or aggressive tone
- Sounds of physical violence (hitting, breaking objects)
- Crying, pleading, or distress
- Controlling or manipulative language
- Any other signs of abuse

Be objective and factual. Transcribe relevant portions if possible.

Respond ONLY with valid JSON:
{
  "summary": "description of what you hear in the audio, including any transcribed threats or concerning content",
  "riskLevel": 1-10,
  "category": "PHYSICAL | PSYCHOLOGICAL | FINANCIAL | SEXUAL | NEGLECT | UNCATEGORIZED", 
  "keywords": ["relevant", "keywords"]
}`;

      const mimeType = mediaType || 'audio/webm';
      response = await geminiAnalyzeMedia(prompt, data, mimeType, SYSTEM_PROMPT_FORENSIC);

    } else if (type === 'VIDEO') {
      // REAL video analysis with Gemini
      const prompt = `You are a forensic analyst helping document evidence for a domestic violence case.

Analyze this video. Watch and listen for:
- Physical violence or aggressive behavior
- Property destruction
- Threatening gestures or body language
- Verbal threats or abuse
- Signs of fear or distress in victims
- The environment and any safety concerns

Be objective and factual. Describe what you see and hear.

Respond ONLY with valid JSON:
{
  "summary": "detailed description of what happens in the video",
  "riskLevel": 1-10,
  "category": "PHYSICAL | PSYCHOLOGICAL | FINANCIAL | SEXUAL | NEGLECT | UNCATEGORIZED",
  "keywords": ["relevant", "keywords"]
}`;

      const mimeType = mediaType || 'video/mp4';
      response = await geminiAnalyzeMedia(prompt, data, mimeType, SYSTEM_PROMPT_FORENSIC);

    } else {
      // Unknown type - fallback
      response = { success: false, error: 'Unknown evidence type' };
    }

    // Call secure API route

    if (!response.success || !response.response) {
      console.warn('[Evidence Analysis] API call failed, using fallback');
      return {
        summary: "Analysis pending. Evidence securely stored for manual review.",
        riskLevel: 5,
        category: "UNCATEGORIZED",
        keywords: [type.toLowerCase(), "pending_review"]
      };
    }

    // Parse JSON response
    try {
      const jsonMatch = response.response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]) as EvidenceAnalysis;
      }
    } catch (e) {
      console.error("JSON Parse Error:", e);
    }

    return {
      summary: response.response.slice(0, 200),
      riskLevel: 5,
      category: "UNCATEGORIZED",
      keywords: [type.toLowerCase()]
    };

  } catch (error) {
    console.error("Forensic Analysis Error:", error);
    // Fallback if AI fails (ensure evidence is still saved without analysis)
    return {
      summary: "Analysis failed or offline. Manual review required.",
      riskLevel: 0,
      category: "UNCATEGORIZED",
      keywords: ["Error"]
    };
  }
};
