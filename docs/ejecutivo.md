# Athena (Liberta Agent) - Resumen Ejecutivo

## 🎯 Visión General
**Athena** es un agente de IA autónomo diseñado para empoderar a mujeres atrapadas en situaciones de violencia doméstica o abuso financiero. Actúa como un *Planificador de Escape* encubierto de grado militar, proporcionando libertad financiera invisible y recolección de evidencia legalmente válida, todo oculto tras la interfaz de una calculadora o aplicación de estilo de vida inofensiva.

### 🛑 El Problema
El **99%** de las víctimas de violencia doméstica sufren abuso financiero. Sin dinero propio ni evidencia inmutable (que a menudo es borrada por los abusadores de los teléfonos), escapar es logísticamente imposible. Las víctimas necesitan una forma de **ahorrar dinero** y **documentar abusos** sin dejar rastro digital en sus estados de cuenta bancarios tradicionales o galerías de fotos.

### 💡 La Solución
Una aplicación móvil descentralizada (dApp) impulsada por IA que ofrece:
1.  **Bóveda de Libertad:** Una cuenta de ahorros criptográfica secreta (en stablecoins) que genera intereses y es indetectable por el abusador.
2.  **Locker Inmutable:** Almacenamiento de evidencia (fotos/audio/texto) en IPFS asegurado por blockchain, creando un registro legal permanente fuera del alcance del abusador.
3.  **Botón de Pánico (SOS):** Un protocolo de emergencia de un solo toque que liquida todos los activos y los transfiere a un contacto de confianza instantáneamente.

---

## 🏗️ Arquitectura Técnica de Agentes

Athena utiliza una arquitectura de **Agente Híbrido** siguiendo el estándar **OQAI ADK-TS**:

### 1. El Cerebro (LlmAgent)
*   **Tecnología:** Google Gemini 2.5 Flash Lite + `@iqai/adk`.
*   **Función:** Planificación estratégica y soporte emocional.
*   **Capacidades:**
    *   Evalúa el nivel de riesgo (1-10) mediante conversación natural.
    *   Genera planes de escape tácticos paso a paso (JSON estructurado).
    *   Calcula presupuestos de "Libertad" personalizados.

### 2. El Músculo (Core ADK Pattern)
*   **Tecnología:** `AthenaAgent` (Clase TypeScript) + Fraxtal L2 Blockchain.
*   **Función:** Ejecución segura, determinista y financiera.
*   **Patrón:** *Percepción → Razonamiento → Acción*.
    *   **Percepción:** Monitorea saldos en tiempo real y estado de la red.
    *   **Acción:**
        *   `createAnonymousCase()`: Genera identidades descentralizadas.
        *   `secureEvidence()`: Hashea evidencia y la ancla en la blockchain.
        *   `triggerSOS()`: Ejecuta contratos inteligentes de liquidación de emergencia.

---

## 🛠️ Stack Tecnológico

| Capa | Tecnologías | Propósito |
| :--- | :--- | :--- |
| **Frontend** | React, Vite, Tailwind CSS, Lucide | UI "Stealth" rápida y reactiva (Mobile-first). |
| **IA / Agente** | Google Vertex AI, Gemini 2.5, **IQAI ADK-TS** | Razonamiento, planificación y empatía. |
| **Blockchain** | **Fraxtal L2** (OP Stack), Ethers.js | Transacciones rápidas, baratas y privadas. |
| **Smart Contracts** | Solidity (`AthenaPool.sol`) | Lógica de pool de donaciones y seguridad de fondos. |
| **Almacenamiento** | Firebase (Auth/Firestore) + **IPFS (Pinata)** | Persistencia de usuario + Evidencia inmutable. |

---

## 🚀 Hoja de Ruta e Impacto

*   **Fase 1 (Actual):** MVP funcional con Bóveda, Locker y Planificador IA. Despliegue en Fraxtal Testnet.
*   **Fase 2:** Integración de "Angels Pool" para donaciones anónimas de la comunidad cripto a casos específicos.
*   **Fase 3:** Disfraz dinámico (la app cambia de apariencia según el código de acceso: Calculadora, Recetas, Period Tracker).

---
**Desarrollado para el Hackathon OQAI x Google Cloud.**
*Tecnología que salva vidas.*
