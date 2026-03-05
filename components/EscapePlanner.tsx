import React, { useState, useEffect, useRef } from 'react';
import { sendPlannerMessage } from '../services/geminiService';
import { EscapePlan, ChatMessage } from '../types';
import { Cpu, Cloud, CloudOff, Loader2, Check, Send } from 'lucide-react';
import {
  auth,
  saveChatMessage,
  loadChatHistory,
  saveEscapePlan,
  loadEscapePlan,
  saveSafeContact
} from '../lib/firebase';

const INITIAL_MESSAGE: ChatMessage = {
  role: 'model',
  text: "Hola 💜 Soy Athena, tu guardiana silenciosa. Primero, quiero que sepas que eres increíblemente valiente por buscar ayuda.\n\nEsta es una herramienta REAL de protección. Puedo ayudarte a:\n• Construir una Bóveda de Libertad secreta (ahorros invisibles para él)\n• Documentar evidencia con timestamps legales\n• Crear un plan de escape de emergencia\n\n¿Cómo te sientes ahora mismo? ¿Estás en un lugar seguro para hablar?"
};

export const EscapePlanner: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [plan, setPlan] = useState<EscapePlan | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [completedPhases, setCompletedPhases] = useState<{ [key: number]: boolean }>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  // Internal tab navigation: 'plan' or 'chat'
  const [activeTab, setActiveTab] = useState<'plan' | 'chat'>('chat');

  // Load chat history from Firestore on mount
  useEffect(() => {
    const loadHistory = async () => {
      const user = auth.currentUser;
      if (user) {
        setIsLoadingHistory(true);
        try {
          const history = await loadChatHistory(user.uid, 100);
          if (history.length > 0) {
            const loadedMessages: ChatMessage[] = history.map(msg => ({
              role: msg.role,
              text: msg.text
            }));
            setMessages(loadedMessages);
            setIsSynced(true);
          } else {
            setMessages([INITIAL_MESSAGE]);
            await saveChatMessage(user.uid, INITIAL_MESSAGE);
            setIsSynced(true);
          }
          const savedPlan = await loadEscapePlan(user.uid);
          if (savedPlan && savedPlan.isReady) {
            setPlan(savedPlan);
          }
        } catch (error) {
          console.error('[EscapePlanner] Failed to load history:', error);
          setIsSynced(false);
        } finally {
          setIsLoadingHistory(false);
        }
      } else {
        setIsLoadingHistory(false);
        setIsSynced(false);
      }
    };
    loadHistory();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMsg: ChatMessage = { role: 'user', text: inputText };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    const user = auth.currentUser;
    if (user) {
      try {
        await saveChatMessage(user.uid, userMsg);
      } catch (error) {
        console.error('[EscapePlanner] Failed to save user message:', error);
      }
    }

    try {
      const response = await sendPlannerMessage([...messages, userMsg], userMsg.text);
      setIsTyping(false);

      if (response.plan) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        const caseId = `ATHENA-${timestamp}-${random}`;
        const poolContractAddress = '0x4Bca7ebC3Cba0ea5Ada962E319BfB8353De81605';

        const enhancedPlan = {
          ...response.plan,
          caseId,
          poolContractAddress
        };

        if (user) {
          try {
            await saveEscapePlan(user.uid, enhancedPlan);
            if (response.plan.emergencyContact && response.plan.emergencyContact.name) {
              const withdrawalMethod = (response.plan.emergencyContact as any).withdrawalMethod || 'PHONE';
              const contactData: any = {
                name: response.plan.emergencyContact.name,
                relationship: response.plan.emergencyContact.relationship || 'Emergency Contact',
                withdrawalMethod: withdrawalMethod,
                contactInfo: response.plan.emergencyContact.contactInfo || ''
              };
              await saveSafeContact(user.uid, contactData);
            }

            const { getCustodyService } = await import('../lib/wallet-custody');
            const custodyService = getCustodyService();
            let walletAddress = (await custodyService.getWallet(user.uid))?.address;
            if (!walletAddress) {
              walletAddress = await custodyService.createCustodialWallet(user.uid);
            }

            const riskLevel = response.plan.riskLevel || 5;
            let urgencyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'MEDIUM';
            if (riskLevel >= 9) urgencyLevel = 'CRITICAL';
            else if (riskLevel >= 7) urgencyLevel = 'HIGH';
            else if (riskLevel >= 4) urgencyLevel = 'MEDIUM';
            else urgencyLevel = 'LOW';

            await custodyService.createCaseWithMetadata(user.uid, {
              displayName: `Case ${caseId.split('-')[2]}`,
              story: `Seeking help to reach freedom. Goal: $${response.plan.freedomGoal.targetAmount} for ${response.plan.destination || 'safe location'}.`,
              goalAmount: response.plan.freedomGoal.targetAmount,
              urgencyLevel,
              isPublic: true
            });

            console.log(`✅ Case metadata created for ${caseId}`);
          } catch (error) {
            console.error('[EscapePlanner] Failed to save plan:', error);
          }
        }

        setIsAnalyzing(true);
        setTimeout(() => {
          setIsAnalyzing(false);
          setPlan(enhancedPlan);
          setActiveTab('plan'); // Switch to plan tab
        }, 2500);
      } else {
        const modelMsg: ChatMessage = { role: 'model', text: response.text };
        setMessages(prev => [...prev, modelMsg]);
        if (user) {
          try {
            await saveChatMessage(user.uid, modelMsg);
          } catch (error) {
            console.error('[EscapePlanner] Failed to save model message:', error);
          }
        }
      }
    } catch (error) {
      setIsTyping(false);
      const errorMsg: ChatMessage = { role: 'model', text: 'Conexión interrumpida. Por favor intenta de nuevo.' };
      setMessages(prev => [...prev, errorMsg]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSend();
  };

  // Handle creating a new plan (asks if circumstances have changed)
  const handleNewPlan = async () => {
    const user = auth.currentUser;

    // Message for updating the plan
    const updatePlanMessage: ChatMessage = {
      role: 'model',
      text: `💜 Entiendo que quieres actualizar tu plan. Las situaciones pueden cambiar, y es importante mantener tu estrategia actualizada.

Cuéntame, ¿ha cambiado algo desde la última vez?

Por ejemplo:
• ¿Tu destino de escape es diferente ahora?
• ¿Alguna persona de confianza ya no es segura?
• ¿Ha cambiado tu situación financiera?
• ¿El nivel de peligro ha aumentado o disminuido?
• ¿Tienes nuevos contactos de apoyo?

No te preocupes si el plan anterior ya no aplica. Juntas crearemos uno nuevo que se ajuste a tu realidad actual. 🛡️`
    };

    // Reset to new plan conversation
    setMessages([INITIAL_MESSAGE, updatePlanMessage]);
    setActiveTab('chat');

    // Save the update message to history
    if (user) {
      try {
        await saveChatMessage(user.uid, updatePlanMessage);
      } catch (error) {
        console.error('[EscapePlanner] Failed to save new plan message:', error);
      }
    }
  };

  // 1. LOADING HISTORY SCREEN
  if (isLoadingHistory) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-neutral-950 p-6">
        <Loader2 className="w-10 h-10 text-athena-500 animate-spin mb-4" />
        <p className="text-gray-400 text-sm">Cargando historial...</p>
      </div>
    );
  }

  // 2. ANALYSIS LOADING SCREEN
  if (isAnalyzing) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-black p-6 space-y-6 animate-in fade-in duration-700">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-athena-900 border-t-athena-500 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl">🧠</span>
          </div>
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-xl font-mono text-athena-500 font-bold tracking-widest animate-pulse">
            ATHENA AI PROCESANDO...
          </h2>
          <div className="text-xs text-gray-500 font-mono space-y-1">
            <p>Escaneando Rutas Seguras...</p>
            <p>Calculando Costos...</p>
            <p>Encriptando Datos...</p>
          </div>
        </div>
      </div>
    );
  }

  // 3. MAIN VIEW WITH TABS
  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Header with internal tabs */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-900/50">
        <div className="flex justify-between items-center mb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span className="w-2 h-2 bg-athena-500 rounded-full animate-pulse"></span>
              Athena Planner
            </h2>
            <p className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">ADK-TS ONLINE</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-mono ${isSynced ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
              {isSynced ? <Cloud className="w-3 h-3" /> : <CloudOff className="w-3 h-3" />}
              {isSynced ? 'SYNCED' : 'LOCAL'}
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-400">
              <Cpu className="w-3 h-3" />
              ADK-TS
            </div>
          </div>
        </div>

        {/* Internal Tabs */}
        <div className="flex bg-neutral-800 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('plan')}
            className={`flex-1 py-2 px-4 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${activeTab === 'plan'
              ? 'bg-athena-600 text-white shadow-lg'
              : plan ? 'text-gray-400 hover:text-white' : 'text-gray-600'
              }`}
          >
            📋 MI PLAN
            {plan && <span className="w-2 h-2 bg-green-500 rounded-full"></span>}
            {!plan && <span className="text-[9px] text-gray-500 ml-1">(vacío)</span>}
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex-1 py-2 px-4 text-xs font-bold rounded-lg transition flex items-center justify-center gap-2 ${activeTab === 'chat'
              ? 'bg-athena-600 text-white shadow-lg'
              : 'text-gray-400 hover:text-white'
              }`}
          >
            💬 {plan ? 'CONSULTAR' : 'CREAR PLAN'}
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'plan' ? (
        // PLAN TAB
        <div className="flex-1 overflow-y-auto p-4">
          {plan ? (
            <div className="animate-in fade-in duration-500 space-y-4">
              {/* Header */}
              <div className="flex justify-between items-end border-b border-neutral-800 pb-4">
                <div>
                  <p className="text-[10px] text-athena-500 font-bold uppercase tracking-widest mb-1">Estrategia Generada</p>
                  <h2 className="text-2xl font-bold text-white">Operación Libertad</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleNewPlan}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-athena-600 hover:bg-athena-500 text-white transition-all flex items-center gap-1.5 shadow-lg"
                  >
                    🔄 Nuevo Plan
                  </button>
                  <span className={`px-3 py-1 rounded text-xs font-bold border ${plan.riskLevel >= 8 ? 'bg-red-900/30 border-red-500 text-red-500' : 'bg-yellow-900/30 border-yellow-500 text-yellow-500'}`}>
                    RIESGO {plan.riskLevel}
                  </span>
                </div>
              </div>

              {/* Financial Goal */}
              <div className="bg-neutral-900/50 rounded-2xl p-4 border border-neutral-800">
                <h3 className="text-gray-400 text-xs uppercase mb-2">Meta de Libertad</h3>
                <div className="flex items-end gap-2 mb-3">
                  <span className="text-4xl font-mono font-bold text-white">${plan.freedomGoal.targetAmount}</span>
                  <span className="text-gray-500 text-sm mb-1">{plan.freedomGoal.currency}</span>
                </div>
                <div className="w-full bg-black h-2 rounded-full overflow-hidden">
                  <div className="bg-athena-500 h-full" style={{ width: `${Math.max(5, (plan.freedomGoal.currentAmount / plan.freedomGoal.targetAmount) * 100)}%` }}></div>
                </div>
                <p className="text-[10px] text-gray-500 mt-2">
                  Actual: ${plan.freedomGoal.currentAmount} • Destino: {plan.destination}
                </p>
              </div>

              {/* Emergency Contact */}
              {plan.emergencyContact?.name && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3">
                  <h4 className="text-green-400 text-xs font-bold mb-1">🆘 Contacto: {plan.emergencyContact.name}</h4>
                  <p className="text-[10px] text-gray-400">{plan.emergencyContact.relationship} • {plan.emergencyContact.contactInfo}</p>
                </div>
              )}

              {/* Phases */}
              <div className="space-y-2">
                <h3 className="text-gray-300 font-bold text-sm">Plan de Libertad ({Object.values(completedPhases).filter(Boolean).length}/7)</h3>
                {[
                  { num: 1, title: '🚨 Seguridad Inmediata', content: plan.strategy.step1 },
                  { num: 2, title: '📷 Documentación', content: plan.strategy.step2 },
                  { num: 3, title: '⚖️ Preparación Legal', content: plan.strategy.step3 },
                  { num: 4, title: '💰 Seguridad Financiera', content: plan.strategy.step4 },
                  { num: 5, title: '🤝 Red de Apoyo', content: plan.strategy.step5 },
                  { num: 6, title: '🚗 Plan de Escape', content: plan.strategy.step6 },
                  { num: 7, title: '🏠 Post-Escape', content: plan.strategy.step7 },
                ].filter(p => p.content).map((phase) => (
                  <button
                    key={phase.num}
                    onClick={() => setCompletedPhases(prev => ({ ...prev, [phase.num]: !prev[phase.num] }))}
                    className={`w-full text-left bg-neutral-900 border rounded-xl p-3 transition ${completedPhases[phase.num] ? 'border-athena-500/50 bg-athena-500/5' : 'border-neutral-800'}`}
                  >
                    <div className="flex gap-3 items-start">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${completedPhases[phase.num] ? 'bg-athena-500 text-white' : 'border-2 border-neutral-600'}`}>
                        {completedPhases[phase.num] ? <Check className="w-3 h-3" /> : <span className="text-[10px] text-gray-500">{phase.num}</span>}
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-xs font-bold ${completedPhases[phase.num] ? 'text-athena-400 line-through' : 'text-white'}`}>{phase.title}</h4>
                        <p className="text-gray-400 text-[11px] mt-1">{phase.content}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Next Steps */}
              {plan.nextSteps && plan.nextSteps.length > 0 && (
                <div className="bg-athena-900/20 border border-athena-500/30 rounded-xl p-3">
                  <h4 className="text-athena-400 text-xs font-bold mb-2">🎯 Próximos Pasos</h4>
                  <ul className="space-y-1">
                    {plan.nextSteps.map((step, i) => (
                      <li key={i} className="text-[11px] text-gray-300 flex gap-2">
                        <span className="text-athena-500">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Case ID */}
              {plan.caseId && (
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3">
                  <p className="text-[10px] text-gray-500 mb-1">CASE ID (para donaciones)</p>
                  <div className="flex items-center justify-between">
                    <code className="text-xs text-purple-400">{plan.caseId}</code>
                    <button
                      onClick={() => { navigator.clipboard.writeText(plan.caseId || ''); alert('¡Copiado!'); }}
                      className="text-[10px] text-purple-400 hover:text-purple-300"
                    >
                      COPIAR
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // No plan placeholder
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-20 h-20 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
                <span className="text-4xl opacity-50">📋</span>
              </div>
              <h3 className="text-lg font-bold text-gray-400 mb-2">No tienes un plan aún</h3>
              <p className="text-sm text-gray-600 mb-6 max-w-xs">
                Ve a la pestaña "CREAR PLAN" para hablar con Athena y generar tu plan de escape personalizado.
              </p>
              <button
                onClick={() => setActiveTab('chat')}
                className="px-6 py-3 bg-athena-600 hover:bg-athena-500 text-white rounded-xl font-bold text-sm transition"
              >
                💬 Crear Mi Plan
              </button>
            </div>
          )}
        </div>
      ) : (
        // CHAT TAB
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                  ? 'bg-athena-600 text-white rounded-br-none'
                  : 'bg-neutral-800 text-gray-200 rounded-bl-none border border-neutral-700'
                  }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-neutral-800 rounded-2xl p-4 rounded-bl-none flex gap-1 items-center border border-neutral-700">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-75"></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce delay-150"></span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions if plan exists */}
          {plan && (
            <div className="px-4 pb-2 flex gap-2 flex-wrap">
              {['¿Cuánto me falta?', '¿Qué normativas?', '¿Próximo paso?'].map((q) => (
                <button
                  key={q}
                  onClick={() => setInputText(q)}
                  className="text-[10px] px-2 py-1 bg-neutral-800 text-gray-400 rounded-full hover:bg-neutral-700 hover:text-white transition"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="p-4 bg-neutral-900 border-t border-neutral-800">
            <div className="flex gap-2">
              <input
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={plan ? "Pregunta sobre tu plan..." : "Describe tu situación..."}
                className="flex-1 bg-black border border-neutral-700 rounded-xl px-4 py-3 text-white focus:border-athena-500 outline-none transition placeholder-gray-600"
              />
              <button
                onClick={handleSend}
                disabled={!inputText.trim() || isTyping}
                className="bg-athena-600 hover:bg-athena-500 disabled:opacity-50 text-white p-3 rounded-xl transition shadow-lg shadow-athena-900/50"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EscapePlanner;