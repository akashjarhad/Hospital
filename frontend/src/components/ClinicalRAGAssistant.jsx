import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Sparkles, Send, Loader2, Search, ShieldCheck, 
  CheckCircle2, AlertCircle, FileText, Database, CornerDownRight, 
  ExternalLink, Copy, Check, RefreshCw, ChevronDown, ChevronUp,
  Pill, AlertTriangle, FlaskConical, Stethoscope, HeartPulse, User
} from 'lucide-react';
import api from '../api/axios';

const QUICK_PROMPTS = [
  { icon: Pill, label: 'Current Medications', query: 'What active medications and dosages are currently prescribed for this patient?' },
  { icon: AlertTriangle, label: 'Allergies & Reactions', query: 'List all documented allergies, adverse reactions, and severity levels.' },
  { icon: FlaskConical, label: 'Abnormal Lab Results', query: 'What are the most recent abnormal laboratory or diagnostic test results?' },
  { icon: Stethoscope, label: 'Diagnosis & Encounters', query: 'Summarize the primary admission diagnosis, chief complaints, and visit history.' },
  { icon: HeartPulse, label: 'Medical History', query: 'What past medical conditions or chronic diseases are recorded?' },
  { icon: User, label: 'Emergency Contact', query: 'Who is the recorded emergency contact and next of kin for this patient?' },
];

export const ClinicalRAGAssistant = ({ 
  patientId, 
  transferId = null, 
  patientName = 'Patient',
  onSourceSelect = null,
  compact = false 
}) => {
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Hello, I am the **MedTransfer Grounded RAG Assistant**. I can answer clinical questions regarding **${patientName}** strictly based on authorized, consented records with verified source citations.`,
      sources: [],
      evidence: [],
      model: 'Grounded RAG',
      timestamp: new Date()
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [expandedEvidenceId, setExpandedEvidenceId] = useState(null);

  const chatEndRef = useRef(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].id === 'welcome') {
        return [{
          id: 'welcome',
          sender: 'assistant',
          text: `Hello, I am the **MedTransfer Grounded RAG Assistant**. I can answer clinical questions regarding **${patientName}** strictly based on authorized, consented records with verified source citations.`,
          sources: [],
          evidence: [],
          model: 'Grounded RAG',
          timestamp: new Date()
        }];
      }
      return prev;
    });
  }, [patientName]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleAsk = async (queryText = inputQuery) => {
    const q = (queryText || '').trim();
    if (!q || loading || !patientId) return;

    const userMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputQuery('');
    setLoading(true);
    setLoadingStep('Retrieving authorized patient chunks & grounding context...');

    try {
      const payload = {
        question: q,
        ...(transferId ? { transfer_id: transferId } : {})
      };

      setLoadingStep('Executing grounded inference with Clinical LLM...');
      const res = await api.post(`/patients/${patientId}/ai/search`, payload, { timeout: 60000 });

      if (res.data?.success) {
        const data = res.data.data;
        const assistantMessage = {
          id: `assistant-${Date.now()}`,
          sender: 'assistant',
          text: data.answer || 'Information not found in authorized patient records.',
          sources: data.source_references || [],
          evidence: data.evidence || [],
          evidenceCount: data.evidence_count || 0,
          model: data.model || 'Grounded RAG',
          label: data.label || 'Decision Support Draft',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(res.data?.message || 'Failed to retrieve answer.');
      }
    } catch (err) {
      console.error('RAG search error:', err);
      const errorMessage = {
        id: `assistant-err-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ **RAG Query Note**: ${err.response?.data?.message || err.message || 'Unable to complete search. Ensure patient records and consent boundaries are valid.'}`,
        sources: [],
        evidence: [],
        isError: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      setLoadingStep('');
    }
  };

  const handleCopy = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderFormattedText = (text, sources = []) => {
    if (!text) return null;
    
    // Format source citations [SourceID] into interactive badges
    const parts = text.split(/(\[[A-Za-z0-9_\-\/]+\])/g);
    
    return (
      <span className="leading-relaxed whitespace-pre-wrap">
        {parts.map((part, idx) => {
          const match = part.match(/^\[([A-Za-z0-9_\-\/]+)\]$/);
          if (match) {
            const sourceId = match[1];
            return (
              <button
                key={idx}
                onClick={() => onSourceSelect ? onSourceSelect(sourceId) : null}
                className="inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-mono font-bold bg-brand-50 border border-brand-200 text-brand-700 hover:bg-brand-100 hover:border-brand-300 transition-colors cursor-pointer"
                title={`Click to inspect source: ${sourceId}`}
              >
                {sourceId}
              </button>
            );
          }
          return part;
        })}
      </span>
    );
  };

  return (
    <div className={`flex flex-col bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden ${compact ? 'h-[500px]' : 'h-[620px]'}`}>
      
      {/* Header */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-extrabold text-white tracking-wide">Grounded Clinical RAG Assistant</h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Live EHR Context
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Retrieving from authorized records of <span className="text-brand-300 font-semibold">{patientName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 px-2.5 py-1 rounded-lg bg-slate-800/80 border border-slate-700">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-400" />
            Zero PHI Leakage Guard
          </span>
          <button
            onClick={() => setMessages([messages[0]])}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            title="Clear Chat History"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Suggested Quick Chips */}
      <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800/80 overflow-x-auto scrollbar-none flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0 flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-brand-400" /> Quick Ask:
        </span>
        {QUICK_PROMPTS.map((prompt, i) => {
          const Icon = prompt.icon;
          return (
            <button
              key={i}
              onClick={() => handleAsk(prompt.query)}
              disabled={loading}
              className="px-2.5 py-1 rounded-lg bg-slate-800/90 hover:bg-brand-900/60 border border-slate-700/80 hover:border-brand-500/40 text-slate-200 hover:text-brand-200 text-xs font-medium shrink-0 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Icon className="h-3.5 w-3.5 text-brand-400" />
              {prompt.label}
            </button>
          );
        })}
      </div>

      {/* Chat Messages Area */}
      <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-900/50">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-in fade-in duration-200`}
            >
              <div className="flex items-center gap-2 mb-1 px-1">
                <span className="text-[10px] font-semibold text-slate-400">
                  {isUser ? 'You (Clinician)' : 'Clinical RAG Engine'}
                </span>
                <span className="text-[9px] text-slate-400">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              <div
                className={`max-w-[88%] rounded-2xl p-4 text-xs ${
                  isUser
                    ? 'bg-brand-600 text-white rounded-tr-none shadow-md'
                    : msg.isError
                    ? 'bg-red-950/60 border border-red-800/60 text-red-200 rounded-tl-none'
                    : 'bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-tl-none shadow-lg'
                }`}
              >
                <div>
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    renderFormattedText(msg.text, msg.sources)
                  )}
                </div>

                {/* Sources & Evidence Bar for Assistant responses */}
                {!isUser && !msg.isError && (
                  <div className="mt-3 pt-3 border-t border-slate-700/60 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Database className="h-3 w-3 text-brand-400" />
                        <span>Sources: </span>
                        {msg.sources && msg.sources.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {msg.sources.map((src, idx) => (
                              <span
                                key={idx}
                                className="px-1.5 py-0.5 rounded bg-brand-950 border border-brand-500/40 text-brand-300 font-mono text-[10px]"
                              >
                                {src}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Pre-screened authorized chart</span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {msg.evidence && msg.evidence.length > 0 && (
                          <button
                            onClick={() => setExpandedEvidenceId(expandedEvidenceId === msg.id ? null : msg.id)}
                            className="text-[10px] text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-0.5 cursor-pointer"
                          >
                            {expandedEvidenceId === msg.id ? 'Hide Evidence' : `View Evidence (${msg.evidence.length})`}
                            {expandedEvidenceId === msg.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        )}
                        <button
                          onClick={() => handleCopy(msg.id, msg.text)}
                          className="text-[10px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          {copiedId === msg.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                          {copiedId === msg.id ? 'Copied' : 'Copy'}
                        </button>
                      </div>
                    </div>

                    {/* Collapsible Evidence Chunks Drawer */}
                    {expandedEvidenceId === msg.id && msg.evidence && (
                      <div className="mt-2 p-3 rounded-xl bg-slate-950/80 border border-slate-700/70 space-y-2">
                        <span className="text-[10px] font-bold text-brand-300 uppercase tracking-wider flex items-center gap-1">
                          <FileText className="h-3 w-3" /> Retrieved Evidence Chunks:
                        </span>
                        {msg.evidence.map((chunk, cIdx) => (
                          <div key={cIdx} className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span className="font-mono text-brand-400">{chunk.source_id}</span>
                              <span>Grounded match</span>
                            </div>
                            <p className="italic text-slate-200">"{chunk.text}"</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Live Loading Indicator */}
        {loading && (
          <div className="flex flex-col items-start animate-in fade-in duration-200">
            <div className="flex items-center gap-2 mb-1 px-1">
              <span className="text-[10px] font-semibold text-slate-400">Clinical RAG Engine</span>
            </div>
            <div className="bg-slate-800/90 border border-brand-500/30 rounded-2xl rounded-tl-none p-4 text-xs text-slate-200 flex items-center gap-3 shadow-lg">
              <Loader2 className="h-4 w-4 text-brand-400 animate-spin shrink-0" />
              <div>
                <p className="font-semibold text-brand-300">{loadingStep || 'Processing query...'}</p>
                <p className="text-[10px] text-slate-400">Enforcing category consent and retrieving factual chunks</p>
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk();
        }}
        className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
      >
        <div className="relative flex-1">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={`Ask any clinical question about ${patientName}...`}
            disabled={loading}
            className="w-full px-4 py-2.5 pl-9 rounded-xl bg-slate-900 border border-slate-700/80 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
          />
          <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
        </div>

        <button
          type="submit"
          disabled={!inputQuery.trim() || loading}
          className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-brand-900/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Ask RAG
        </button>
      </form>
    </div>
  );
};
