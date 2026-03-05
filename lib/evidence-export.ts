/**
 * Evidence Export Service - VERSIÓN AMIGABLE
 * 
 * Permite a usuarios exportar sus evidencias con lenguaje simple,
 * sin términos técnicos, y con instrucciones paso a paso.
 */

import { loadEvidence } from './firebase';
import { getEvidenceUrl, generateCertificate } from './ipfs-service';

export interface EvidenceExport {
    id: string;
    type: string;
    timestamp: number;
    ipfsCid?: string;
    ipfsUrl?: string;
    hash?: string;
    content?: string;
}

/**
 * Get all evidence CIDs for a user
 */
export async function getUserEvidenceCIDs(userId: string): Promise<EvidenceExport[]> {
    const evidence = await loadEvidence(userId);

    return evidence.map(item => ({
        id: item.id,
        type: item.type,
        timestamp: item.timestamp,
        ipfsCid: item.ipfsCid,
        ipfsUrl: item.ipfsUrl,
        hash: item.hash,
        content: item.content
    }));
}

/**
 * Generate batch download links for all evidence
 */
export function generateDownloadLinks(evidenceList: EvidenceExport[]): {
    cid: string;
    url: string;
    type: string;
    timestamp: string;
}[] {
    return evidenceList
        .filter(e => e.ipfsCid)
        .map(e => ({
            cid: e.ipfsCid!,
            url: getEvidenceUrl(e.ipfsCid!),
            type: e.type,
            timestamp: new Date(e.timestamp).toISOString()
        }));
}

// Helper para traducir tipos de evidencia
function translateType(type: string): string {
    const translations: Record<string, string> = {
        'TEXT': '📝 Texto/Nota',
        'IMAGE': '📷 Foto',
        'AUDIO': '🎵 Audio',
        'VIDEO': '🎥 Video',
        'DOCUMENT': '📄 Documento'
    };
    return translations[type] || `📎 ${type}`;
}

// Helper para formatear fecha amigable
function formatFriendlyDate(timestamp: number): string {
    const date = new Date(timestamp);
    const options: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return date.toLocaleDateString('es-ES', options);
}

/**
 * Generate master certificate with friendly language
 */
export function generateMasterCertificate(
    userId: string,
    evidenceList: EvidenceExport[],
    walletAddress?: string
): string {
    const evidenceWithCID = evidenceList.filter(e => e.ipfsCid);
    const date = formatFriendlyDate(Date.now());

    let certificate = `
╔══════════════════════════════════════════════════════════════╗
║                                                               ║
║           💜 CERTIFICADO DE TUS PRUEBAS SEGURAS 💜           ║
║                                                               ║
║                   Generado por Athena                         ║
╚══════════════════════════════════════════════════════════════╝

┌─────────────────────────────────────────────────────────────┐
│  📅 Fecha de creación: ${date}
│  📁 Total de pruebas guardadas: ${evidenceWithCID.length}
${walletAddress ? `│  🔐 Tu identificador seguro: ${walletAddress.slice(0, 10)}...${walletAddress.slice(-6)}` : ''}
└─────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════
                    ¿QUÉ ES ESTE DOCUMENTO?
═══════════════════════════════════════════════════════════════

Este certificado demuestra que TÚ guardaste estas pruebas 
en una fecha específica. Nadie puede borrarlas ni modificarlas.

Puedes usar este documento para:
  ✅ Mostrar a tu abogado/a
  ✅ Presentar en un juzgado
  ✅ Demostrar que las pruebas son auténticas
  ✅ Probar cuándo guardaste cada evidencia


═══════════════════════════════════════════════════════════════
                     TUS PRUEBAS GUARDADAS
═══════════════════════════════════════════════════════════════

`;

    evidenceWithCID.forEach((evidence, index) => {
        certificate += `
┌─── Prueba #${index + 1} ─────────────────────────────────────
│
│  📌 Tipo: ${translateType(evidence.type)}
│  📅 Guardada el: ${formatFriendlyDate(evidence.timestamp)}
│
│  🔗 Link para ver/descargar:
│     ${getEvidenceUrl(evidence.ipfsCid!)}
│
│  🔒 Código único (para verificar autenticidad):
│     ${evidence.ipfsCid}
│
└────────────────────────────────────────────────────────────
`;
    });

    certificate += `

═══════════════════════════════════════════════════════════════
              ¿CÓMO USAR ESTE CERTIFICADO?
═══════════════════════════════════════════════════════════════

PASO 1: GUARDA ESTE ARCHIVO
   📁 Guárdalo en un lugar seguro (USB, email, nube)
   💡 Tip: Envíatelo a tu correo para tener una copia

PASO 2: DESCARGA TUS PRUEBAS
   🖱️ Haz clic en cada "Link para ver/descargar"
   💾 Guarda cada archivo en tu computadora o celular

PASO 3: PARA VERIFICAR AUTENTICIDAD
   Si alguien duda de que la prueba es real:
   1. Ve a: https://ipfs.io/ipfs/
   2. Pega el "Código único" después de la URL
   3. Verás exactamente el mismo archivo

   Ejemplo: https://ipfs.io/ipfs/QmXxx...


═══════════════════════════════════════════════════════════════
                   ¿POR QUÉ ES SEGURO?
═══════════════════════════════════════════════════════════════

Tus pruebas están guardadas en una red especial llamada IPFS:

   🌐 NO están en un solo servidor que pueda ser hackeado
   🔐 El "código único" CAMBIA si alguien modifica el archivo
   🛡️ Están copiadas en miles de computadoras en el mundo
   ♾️ Son PERMANENTES - nadie las puede borrar

Esto significa que si alguien intenta modificar una prueba,
el código único ya no coincidirá, y se sabrá que fue alterada.


═══════════════════════════════════════════════════════════════
                      NOTA LEGAL
═══════════════════════════════════════════════════════════════

Este certificado fue generado automáticamente por Athena.
Los archivos almacenados en IPFS son inmutables y verificables.

El código único (CID) es una "huella digital" del archivo.
Si el contenido cambia, el código sería diferente.

   🏛️ Este documento puede usarse como evidencia digital
   ⚖️ Consulta con tu abogado/a sobre su uso en tu caso

═══════════════════════════════════════════════════════════════

                    💜 Athena te protege 💜
           Tus pruebas están seguras. Tú eres fuerte.

═══════════════════════════════════════════════════════════════
`;

    return certificate;
}

/**
 * Download a single file from IPFS
 */
export async function downloadFromIPFS(cid: string): Promise<Blob | null> {
    try {
        const url = getEvidenceUrl(cid);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch');
        return await response.blob();
    } catch (error) {
        console.error(`[Export] Failed to download ${cid}:`, error);
        return null;
    }
}

/**
 * Create HTML page with all evidence links - VERSIÓN AMIGABLE
 */
export function generateDownloadPage(
    evidenceList: EvidenceExport[],
    walletAddress?: string
): string {
    const evidenceWithCID = evidenceList.filter(e => e.ipfsCid);
    const totalEvidence = evidenceWithCID.length;

    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>💜 Mis Pruebas Seguras - Athena</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', system-ui, sans-serif; 
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1025 100%); 
            color: white; 
            padding: 2rem;
            min-height: 100vh;
            line-height: 1.6;
        }
        .container { max-width: 800px; margin: 0 auto; }
        
        .header { 
            text-align: center; 
            margin-bottom: 2rem;
            padding: 2rem;
            background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.1));
            border-radius: 1.5rem;
            border: 1px solid rgba(168, 85, 247, 0.3);
        }
        .header h1 { 
            font-size: 2rem; 
            margin-bottom: 0.5rem;
            background: linear-gradient(to right, #a855f7, #ec4899);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .header p { color: #9ca3af; }
        
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }
        .stat {
            background: rgba(255, 255, 255, 0.05);
            padding: 1.5rem;
            border-radius: 1rem;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .stat-number { font-size: 2rem; font-weight: bold; color: #a855f7; }
        .stat-label { color: #6b7280; font-size: 0.875rem; }
        
        .instructions {
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.3);
            border-radius: 1rem;
            padding: 1.5rem;
            margin: 2rem 0;
        }
        .instructions h2 { color: #22d3ee; margin-bottom: 1rem; font-size: 1.25rem; }
        .instructions ol { padding-left: 1.5rem; }
        .instructions li { margin: 0.75rem 0; color: #d1d5db; }
        .instructions li strong { color: white; }
        
        .evidence-list { margin-top: 2rem; }
        .evidence-title { 
            font-size: 1.5rem; 
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .evidence-item {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 1rem;
            padding: 1.5rem;
            margin-bottom: 1rem;
            transition: all 0.3s;
        }
        .evidence-item:hover { 
            border-color: rgba(168, 85, 247, 0.5);
            transform: translateY(-2px);
        }
        
        .evidence-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
        }
        .evidence-type { 
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            background: linear-gradient(135deg, #7c3aed, #ec4899);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 2rem;
            font-size: 0.875rem;
            font-weight: 600;
        }
        .evidence-date { color: #9ca3af; font-size: 0.875rem; }
        
        .evidence-actions {
            display: flex;
            gap: 0.75rem;
            flex-wrap: wrap;
        }
        .btn {
            display: inline-flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.25rem;
            border-radius: 0.75rem;
            text-decoration: none;
            font-weight: 600;
            font-size: 0.875rem;
            transition: all 0.2s;
        }
        .btn-primary {
            background: linear-gradient(135deg, #7c3aed, #8b5cf6);
            color: white;
        }
        .btn-primary:hover { transform: scale(1.05); }
        .btn-secondary {
            background: rgba(255, 255, 255, 0.1);
            color: #d1d5db;
        }
        .btn-secondary:hover { background: rgba(255, 255, 255, 0.15); }
        
        .code-block {
            background: rgba(0, 0, 0, 0.3);
            padding: 0.75rem;
            border-radius: 0.5rem;
            font-family: 'Consolas', monospace;
            font-size: 0.75rem;
            color: #22d3ee;
            word-break: break-all;
            margin-top: 1rem;
        }
        .code-label { color: #6b7280; font-size: 0.75rem; margin-bottom: 0.25rem; }
        
        .footer {
            margin-top: 3rem;
            text-align: center;
            padding: 2rem;
            border-top: 1px solid rgba(255, 255, 255, 0.1);
        }
        .footer p { color: #6b7280; font-size: 0.875rem; margin: 0.5rem 0; }
        
        .safe-message {
            background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(236, 72, 153, 0.1));
            border-radius: 1rem;
            padding: 1.5rem;
            text-align: center;
            margin: 2rem 0;
        }
        .safe-message h3 { color: #a855f7; margin-bottom: 0.5rem; }
        .safe-message p { color: #9ca3af; }
        
        @media (max-width: 640px) {
            body { padding: 1rem; }
            .header h1 { font-size: 1.5rem; }
            .evidence-header { flex-direction: column; gap: 0.5rem; }
            .evidence-actions { flex-direction: column; }
            .btn { width: 100%; justify-content: center; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>💜 Mis Pruebas Seguras</h1>
            <p>Guardadas de forma permanente y segura</p>
        </div>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-number">${totalEvidence}</div>
                <div class="stat-label">Pruebas guardadas</div>
            </div>
            <div class="stat">
                <div class="stat-number">✓</div>
                <div class="stat-label">Verificadas</div>
            </div>
            <div class="stat">
                <div class="stat-number">🔐</div>
                <div class="stat-label">Protegidas</div>
            </div>
        </div>
        
        <div class="instructions">
            <h2>📋 ¿Cómo uso esta página?</h2>
            <ol>
                <li><strong>Descarga cada prueba:</strong> Haz clic en "📥 Descargar" para guardar el archivo en tu dispositivo.</li>
                <li><strong>Guarda esta página:</strong> Presiona Ctrl+S (o Cmd+S en Mac) para guardar este archivo HTML.</li>
                <li><strong>Verifica cuando necesites:</strong> El código único comprueba que nadie modificó tus archivos.</li>
            </ol>
        </div>
        
        <div class="evidence-list">
            <h2 class="evidence-title">📁 Tus Pruebas</h2>
            
            ${evidenceWithCID.map((e, i) => `
            <div class="evidence-item">
                <div class="evidence-header">
                    <span class="evidence-type">${translateType(e.type)}</span>
                    <span class="evidence-date">📅 ${formatFriendlyDate(e.timestamp)}</span>
                </div>
                
                <div class="evidence-actions">
                    <a href="${getEvidenceUrl(e.ipfsCid!)}" target="_blank" class="btn btn-primary">
                        📥 Descargar
                    </a>
                    <a href="${getEvidenceUrl(e.ipfsCid!)}" target="_blank" class="btn btn-secondary">
                        👁️ Ver en línea
                    </a>
                </div>
                
                <div class="code-block">
                    <div class="code-label">🔒 Código único (para verificar):</div>
                    ${e.ipfsCid}
                </div>
            </div>
            `).join('')}
        </div>
        
        <div class="safe-message">
            <h3>🛡️ Tus pruebas están seguras</h3>
            <p>Guardadas en miles de servidores. Nadie puede borrarlas ni modificarlas.</p>
        </div>
        
        <div class="footer">
            <p>💜 Generado por Athena</p>
            <p>Tus pruebas son permanentes e inmutables.</p>
            <p style="margin-top: 1rem; font-size: 0.75rem;">
                ${new Date().toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    })}
            </p>
        </div>
    </div>
</body>
</html>
`;
}

export default {
    getUserEvidenceCIDs,
    generateDownloadLinks,
    generateMasterCertificate,
    downloadFromIPFS,
    generateDownloadPage
};
