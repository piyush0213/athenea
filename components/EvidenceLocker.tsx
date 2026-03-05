
import React, { useState, useRef, useEffect } from 'react';
import { EvidenceItem, EvidenceType } from '../types';
import { generateHash, mockTransaction } from '../services/cryptoUtils';
import { analyzeEvidence } from '../services/geminiService';
import { useAthenaAgent } from '../lib/useAthenaAgent';
import { uploadBase64ToIPFS, uploadTextToIPFS, generateCertificate, getEvidenceUrl } from '../lib/ipfs-service';
import { auth, saveEvidence, loadEvidence } from '../lib/firebase';
import { generateMasterCertificate, generateDownloadPage, getUserEvidenceCIDs } from '../lib/evidence-export';
import { Lock, Wifi, WifiOff, Loader2, Download, ExternalLink, FileDown } from 'lucide-react';

export const EvidenceLocker: React.FC = () => {
  const { secureEvidence, isOnline, isLoading: agentLoading } = useAthenaAgent();
  const [logs, setLogs] = useState<EvidenceItem[]>([]);
  const [activeTab, setActiveTab] = useState<EvidenceType>('TEXT');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [isLoadingEvidence, setIsLoadingEvidence] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Export all evidence as HTML page
  const handleExportEvidence = async () => {
    const user = auth.currentUser;
    if (!user) return;

    setIsExporting(true);
    try {
      const evidenceList = await getUserEvidenceCIDs(user.uid);

      // Generate HTML download page
      const htmlContent = generateDownloadPage(evidenceList);
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const url = URL.createObjectURL(blob);

      // Download
      const a = document.createElement('a');
      a.href = url;
      a.download = `athena-evidencias-${new Date().toISOString().split('T')[0]}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Also generate certificate
      const certificate = generateMasterCertificate(user.uid, evidenceList);
      const certBlob = new Blob([certificate], { type: 'text/plain' });
      const certUrl = URL.createObjectURL(certBlob);
      const b = document.createElement('a');
      b.href = certUrl;
      b.download = `athena-certificado-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(b);
      setTimeout(() => {
        b.click();
        document.body.removeChild(b);
        URL.revokeObjectURL(certUrl);
      }, 500);

    } catch (error) {
      console.error('[Export] Error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  // Load evidence from Firestore on mount
  useEffect(() => {
    const loadSavedEvidence = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const savedEvidence = await loadEvidence(user.uid);
          setLogs(savedEvidence as EvidenceItem[]);
        } catch (e) {
          console.warn('[EvidenceLocker] Failed to load evidence:', e);
        }
      }
      setIsLoadingEvidence(false);
    };
    loadSavedEvidence();
  }, []);

  // TEXT INPUT STATE
  const [inputText, setInputText] = useState('');

  // IMAGE INPUT STATE
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputCameraRef = useRef<HTMLInputElement>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement>(null);

  // VIDEO INPUT STATE
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null);
  const videoInputCameraRef = useRef<HTMLInputElement>(null);
  const videoInputGalleryRef = useRef<HTMLInputElement>(null);

  // AUDIO INPUT STATE
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioInputRef = useRef<HTMLInputElement>(null); // For upload

  // --- HELPERS ---

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // --- HANDLERS ---

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await fileToBase64(file);
      setSelectedImage(base64);
    }
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await fileToBase64(file);
      setSelectedVideo(base64);
    }
  };

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const base64 = await fileToBase64(file);
      setAudioUrl(URL.createObjectURL(file));
      setAudioBlob(file);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        // Stop all tracks to release mic
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Mic Error:", err);
      alert("Microphone access needed for audio evidence.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const handleSave = async () => {
    setIsProcessing(true);
    setProcessingStatus('Encrypting Data...');

    let content = '';
    let mediaData = undefined;

    // Prepare data based on active tab
    if (activeTab === 'TEXT') {
      if (!inputText.trim()) { setIsProcessing(false); return; }
      content = inputText;
    } else if (activeTab === 'IMAGE') {
      if (!selectedImage) { setIsProcessing(false); return; }
      content = "Photo Evidence";
      mediaData = selectedImage;
    } else if (activeTab === 'VIDEO') {
      if (!selectedVideo) { setIsProcessing(false); return; }
      content = "Video Evidence";
      mediaData = selectedVideo;
    } else if (activeTab === 'AUDIO') {
      if (!audioBlob) { setIsProcessing(false); return; }
      content = "Audio Evidence";
      mediaData = await blobToBase64(audioBlob);
    }

    // 0. Upload to IPFS first
    setProcessingStatus('Uploading to IPFS...');
    let ipfsResult = null;
    try {
      if (activeTab === 'TEXT') {
        ipfsResult = await uploadTextToIPFS(content, {
          type: 'TEXT',
          description: content.substring(0, 100),
          timestamp: Date.now()
        });
      } else if (mediaData) {
        const mimeType = activeTab === 'IMAGE' ? 'image/jpeg' :
          activeTab === 'VIDEO' ? 'video/mp4' : 'audio/webm';
        ipfsResult = await uploadBase64ToIPFS(mediaData, mimeType, {
          type: activeTab,
          description: inputText || `${activeTab} Evidence`,
          timestamp: Date.now()
        });
      }
      if (ipfsResult?.success) {
        console.log('[IPFS] Uploaded:', ipfsResult.cid);
      }
    } catch (e) {
      console.warn('[IPFS] Upload failed, continuing with hash only:', e);
    }

    // 1. AI Analysis
    setProcessingStatus('AI Forensic Analysis...');
    // Only send to AI if we have mediaData or text
    const analysisData = mediaData || content;
    // Determine MIME type for media analysis
    const mimeTypeForAnalysis = activeTab === 'IMAGE' ? 'image/jpeg' :
      activeTab === 'VIDEO' ? 'video/mp4' :
        activeTab === 'AUDIO' ? 'audio/webm' : undefined;
    const analysis = await analyzeEvidence(activeTab, analysisData, mimeTypeForAnalysis);

    // 2. Generate Hash locally first
    setProcessingStatus('Hashing Evidence...');
    const rawData = content + (mediaData || '') + Date.now().toString();
    const hash = await generateHash(rawData);

    // 3. Store hash on-chain using AthenaAgent (real blockchain or fallback)
    setProcessingStatus(isOnline ? 'Storing on Fraxtal L2...' : 'Simulating blockchain...');

    try {
      // Use the agent to secure evidence on-chain
      const evidenceRecord = await secureEvidence(
        rawData,
        activeTab,
        analysis ? {
          category: analysis.category,
          riskLevel: analysis.riskLevel,
          summary: analysis.summary
        } : undefined
      );

      const newItem: EvidenceItem = {
        id: evidenceRecord.id || Date.now().toString(),
        timestamp: Date.now(),
        content: activeTab === 'TEXT' ? content : (inputText || content),
        type: activeTab,
        mediaData: mediaData,
        hash: evidenceRecord.hash || hash,
        status: (evidenceRecord.status === 'ON_CHAIN' || ipfsResult?.cid) ? 'SECURED_ON_CHAIN' : 'PENDING',
        analysis: analysis || undefined,
        ipfsCid: ipfsResult?.cid,
        ipfsUrl: ipfsResult?.gatewayUrl
      };

      // Save to Firestore for persistence
      const user = auth.currentUser;
      if (user) {
        await saveEvidence(user.uid, {
          id: newItem.id,
          timestamp: newItem.timestamp,
          content: newItem.content,
          type: newItem.type,
          hash: newItem.hash,
          status: newItem.status,
          ipfsCid: newItem.ipfsCid,
          ipfsUrl: newItem.ipfsUrl,
          analysis: newItem.analysis
        });
      }

      setLogs([newItem, ...logs]);
    } catch (error) {
      // Fallback if agent fails
      console.error('[EvidenceLocker] Agent failed, using local storage:', error);

      const newItem: EvidenceItem = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        content: activeTab === 'TEXT' ? content : (inputText || content),
        type: activeTab,
        mediaData: mediaData,
        hash: hash,
        status: 'PENDING',
        analysis: analysis || undefined
      };

      setLogs([newItem, ...logs]);
    }

    // Reset States
    setInputText('');
    setSelectedImage(null);
    setSelectedVideo(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setIsProcessing(false);
    setProcessingStatus('');
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950">

      {/* Header Area */}
      <div className="p-6 pb-0">
        <div className="flex justify-between items-start mb-2">
          <h2 className="text-2xl font-bold text-athena-500">Immutable Locker</h2>
          <div className="flex items-center gap-2">
            {/* Export Button */}
            <button
              onClick={handleExportEvidence}
              disabled={isExporting || logs.length === 0}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-medium bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition disabled:opacity-50"
            >
              {isExporting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <FileDown className="w-3 h-3" />
              )}
              Exportar
            </button>
            {/* Connection Status */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-mono ${isOnline ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
              }`}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'ON-CHAIN' : 'PENDING'}
            </div>
          </div>
        </div>
        <p className="text-gray-400 text-xs mb-4">
          Data logged here is hashed on-chain and analyzed by Gemini 2.5 Forensic AI.
        </p>

        {/* Tabs */}
        <div className="flex bg-neutral-900 p-1 rounded-xl mb-6 border border-neutral-800 overflow-x-auto">
          {(['TEXT', 'IMAGE', 'VIDEO', 'AUDIO'] as EvidenceType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 min-w-[60px] py-2 text-[10px] font-bold rounded-lg transition ${activeTab === tab
                ? 'bg-athena-600 text-white shadow-lg'
                : 'text-gray-500 hover:text-white'
                }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="px-6 pb-4 border-b border-neutral-800">

        {/* TEXT INPUT */}
        {activeTab === 'TEXT' && (
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Describe details safely here..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-xl p-4 text-white focus:outline-none focus:border-athena-500 h-48 resize-none text-sm"
          />
        )}

        {/* IMAGE INPUT */}
        {activeTab === 'IMAGE' && (
          <div className="flex flex-col gap-3">
            {/* Hidden Inputs */}
            <input type="file" accept="image/*" capture="environment" ref={fileInputCameraRef} className="hidden" onChange={handleImageSelect} />
            <input type="file" accept="image/*" ref={fileInputGalleryRef} className="hidden" onChange={handleImageSelect} />

            {selectedImage ? (
              <div className="relative h-48 w-full rounded-xl overflow-hidden border border-neutral-700 bg-black">
                <img src={selectedImage} alt="Evidence Preview" className="h-full w-full object-contain" />
                <button
                  onClick={() => setSelectedImage(null)}
                  className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded-full"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 h-32">
                <button
                  onClick={() => fileInputCameraRef.current?.click()}
                  className="border border-dashed border-neutral-700 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-athena-500 hover:bg-neutral-900 transition text-gray-400 hover:text-white"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /></svg>
                  <span className="font-bold text-xs">Camera</span>
                </button>
                <button
                  onClick={() => fileInputGalleryRef.current?.click()}
                  className="border border-dashed border-neutral-700 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-athena-500 hover:bg-neutral-900 transition text-gray-400 hover:text-white"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span className="font-bold text-xs">Upload</span>
                </button>
              </div>
            )}

            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Optional caption..."
              className="bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-sm text-white focus:border-athena-500 outline-none"
            />
          </div>
        )}

        {/* VIDEO INPUT */}
        {activeTab === 'VIDEO' && (
          <div className="flex flex-col gap-3">
            {/* Hidden Inputs */}
            <input type="file" accept="video/*" capture="environment" ref={videoInputCameraRef} className="hidden" onChange={handleVideoSelect} />
            <input type="file" accept="video/*" ref={videoInputGalleryRef} className="hidden" onChange={handleVideoSelect} />

            {selectedVideo ? (
              <div className="relative h-48 w-full rounded-xl overflow-hidden border border-neutral-700 bg-black">
                <video src={selectedVideo} controls className="h-full w-full object-contain" />
                <button
                  onClick={() => setSelectedVideo(null)}
                  className="absolute top-2 right-2 bg-black/70 text-white p-1 rounded-full z-10"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 h-32">
                <button
                  onClick={() => videoInputCameraRef.current?.click()}
                  className="border border-dashed border-neutral-700 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-athena-500 hover:bg-neutral-900 transition text-gray-400 hover:text-white"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                  <span className="font-bold text-xs">Record Video</span>
                </button>
                <button
                  onClick={() => videoInputGalleryRef.current?.click()}
                  className="border border-dashed border-neutral-700 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-athena-500 hover:bg-neutral-900 transition text-gray-400 hover:text-white"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  <span className="font-bold text-xs">Upload Video</span>
                </button>
              </div>
            )}

            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Optional video details..."
              className="bg-neutral-900 border border-neutral-700 rounded-lg p-2 text-sm text-white focus:border-athena-500 outline-none"
            />
          </div>
        )}

        {/* AUDIO INPUT */}
        {activeTab === 'AUDIO' && (
          <div className="flex flex-col items-center justify-center gap-6 py-4 bg-neutral-900 rounded-xl border border-neutral-800 relative">
            <input type="file" accept="audio/*" ref={audioInputRef} className="hidden" onChange={handleAudioSelect} />

            {/* Upload Button Absolute positioned for layout */}
            {!audioUrl && (
              <button
                onClick={() => audioInputRef.current?.click()}
                className="absolute top-2 right-2 text-gray-500 hover:text-white text-xs flex items-center gap-1 border border-neutral-700 px-2 py-1 rounded"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                Upload
              </button>
            )}

            {audioUrl ? (
              <div className="w-full px-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-green-400 font-bold">Audio Ready</span>
                  <button onClick={() => { setAudioUrl(null); setAudioBlob(null); }} className="text-xs text-gray-500 hover:text-white">Delete</button>
                </div>
                <audio src={audioUrl} controls className="w-full h-10" />
              </div>
            ) : (
              <>
                <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all ${isRecording ? 'bg-red-900/20' : 'bg-neutral-800'}`}>
                  {isRecording && <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping"></div>}
                  <button
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-2xl transition-transform active:scale-95 ${isRecording ? 'bg-red-600' : 'bg-athena-600'}`}
                  >
                    {isRecording ? (
                      <div className="w-8 h-8 bg-white rounded-md"></div>
                    ) : (
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-400 font-mono">
                  {isRecording ? "RECORDING..." : "Tap Mic or Upload"}
                </p>
              </>
            )}

            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Optional audio note..."
              className="w-[90%] bg-black border border-neutral-700 rounded-lg p-2 text-sm text-white focus:border-athena-500 outline-none"
            />
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={isProcessing || (activeTab === 'TEXT' && !inputText) || (activeTab === 'IMAGE' && !selectedImage) || (activeTab === 'VIDEO' && !selectedVideo) || (activeTab === 'AUDIO' && !audioBlob)}
          className={`w-full mt-4 py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition
            ${isProcessing ? 'bg-neutral-800 text-gray-500 cursor-wait' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30'}
          `}
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>{processingStatus}</span>
            </div>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              Secure Evidence
            </>
          )}
        </button>
      </div>

      {/* Timeline / History */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Secured Log</h3>

        {logs.map(log => (
          <div key={log.id} className="bg-neutral-900 rounded-xl p-4 border-l-4 border-athena-500 shadow-sm relative overflow-hidden group">
            {/* Subtle Chain Icon bg */}
            <div className="absolute top-2 right-2 opacity-5">
              <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            </div>

            <div className="flex justify-between items-start mb-3 relative z-10">
              <span className="text-[10px] text-gray-400 font-mono">
                {new Date(log.timestamp).toLocaleString()}
              </span>
              <span className="text-[9px] bg-black/50 text-athena-400 px-2 py-0.5 rounded font-mono border border-athena-500/20">
                Tx: {log.hash.substring(0, 8)}...
              </span>
            </div>

            <div className="relative z-10">
              {/* TYPE: TEXT */}
              {log.type === 'TEXT' && (
                <p className="text-gray-200 text-sm whitespace-pre-wrap">{log.content}</p>
              )}

              {/* TYPE: IMAGE */}
              {log.type === 'IMAGE' && log.mediaData && (
                <div className="space-y-2">
                  <img src={log.mediaData} alt="Secured Evidence" className="w-full rounded-lg border border-neutral-700 max-h-48 object-cover" />
                  {log.content !== 'Photo Evidence' && <p className="text-gray-300 text-sm italic">{log.content}</p>}
                </div>
              )}

              {/* TYPE: VIDEO */}
              {log.type === 'VIDEO' && log.mediaData && (
                <div className="space-y-2">
                  <video src={log.mediaData} controls className="w-full rounded-lg border border-neutral-700 max-h-64 bg-black" />
                  {log.content !== 'Video Evidence' && <p className="text-gray-300 text-sm italic">{log.content}</p>}
                </div>
              )}

              {/* TYPE: AUDIO */}
              {log.type === 'AUDIO' && log.mediaData && (
                <div className="space-y-2">
                  <div className="bg-black/40 p-2 rounded-lg flex items-center gap-2">
                    <div className="w-8 h-8 bg-athena-600 rounded-full flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    </div>
                    <audio src={log.mediaData} controls className="w-full h-8" />
                  </div>
                  {log.content !== 'Audio Evidence' && <p className="text-gray-300 text-sm italic">{log.content}</p>}
                </div>
              )}

              {/* --- AI ANALYSIS SECTION --- */}
              {log.analysis && (
                <div className="mt-4 pt-3 border-t border-white/5 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center gap-1 bg-athena-900/40 px-2 py-0.5 rounded text-[10px] text-athena-300 border border-athena-500/20">
                      <span className={`w-1.5 h-1.5 rounded-full ${log.analysis.riskLevel >= 7 ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}></span>
                      <span className="font-bold tracking-wider">RISK LEVEL {log.analysis.riskLevel}/10</span>
                    </div>
                    <span className="text-[10px] text-gray-500 uppercase font-bold border border-neutral-800 px-2 py-0.5 rounded">{log.analysis.category}</span>
                  </div>

                  <p className="text-gray-400 text-xs italic mb-2">"{log.analysis.summary}"</p>

                  <div className="flex flex-wrap gap-1">
                    {log.analysis.keywords.map((kw, i) => (
                      <span key={i} className="text-[9px] text-gray-500 bg-neutral-800 px-1.5 py-0.5 rounded">#{kw}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
