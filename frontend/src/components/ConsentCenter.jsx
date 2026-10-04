import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  ShieldCheck, AlertTriangle, CheckCircle2, XCircle, Clock, 
  Building2, Stethoscope, ArrowRight, Lock, Calendar, FileText, 
  Check, X, RefreshCw, AlertCircle, Sparkles, User, Activity, History 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const ConsentCenter = () => {
  const { user, patient, refreshNotifications } = useAuth();
  const [consents, setConsents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsent, setSelectedConsent] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [signatureNote, setSignatureNote] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [approvedHandover, setApprovedHandover] = useState(null);

  const fetchConsents = async () => {
    setLoading(true);
    try {
      const res = await api.get('/consents/my-consents');
      if (res.data.success) {
        setConsents(res.data.data);
        if (res.data.data.length > 0 && !selectedConsent) {
          setSelectedConsent(res.data.data[0]);
        } else if (selectedConsent) {
          const updated = res.data.data.find(c => c.id === selectedConsent.id);
          if (updated) setSelectedConsent(updated);
        }
      }
    } catch (err) {
      console.error('Error fetching consents:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConsents();
  }, []);

  useEffect(() => {
    setApprovedHandover(null);
    if (!selectedConsent?.transfer_id || (selectedConsent.effective_status || selectedConsent.status) !== 'GRANTED') return;
    api.get(`/transfers/${selectedConsent.transfer_id}/ai/handover`)
      .then(response => setApprovedHandover(response.data.data))
      .catch(() => setApprovedHandover(null));
  }, [selectedConsent?.id, selectedConsent?.effective_status, selectedConsent?.status]);

  const handleApprove = async (consentId) => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await api.post(`/consents/${consentId}/approve`, {
        signature_note: signatureNote || `${patient?.name || user?.name} Digital Consent Authorization`
      });
      if (res.data.success) {
        setFeedback({ type: 'success', message: 'Consent successfully GRANTED. The receiving hospital is now authorized to view your selected records.' });
        fetchConsents();
        refreshNotifications();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to approve consent.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (consentId) => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await api.post(`/consents/${consentId}/reject`, {
        reason: 'Patient declined inter-hospital data exchange.'
      });
      if (res.data.success) {
        setFeedback({ type: 'info', message: 'Consent REJECTED. Your medical records will remain confidential and will NOT be transferred.' });
        fetchConsents();
        refreshNotifications();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to reject consent.' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevoke = async (consentId) => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await api.post(`/consents/${consentId}/revoke`, {
        reason: 'Patient revoked previously granted authorization.'
      });
      if (res.data.success) {
        setFeedback({ type: 'warning', message: 'Consent REVOKED immediately. The receiving hospital can no longer access your data.' });
        fetchConsents();
        refreshNotifications();
      }
    } catch (err) {
      setFeedback({ type: 'error', message: err.response?.data?.message || 'Failed to revoke consent.' });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'GRANTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 text-xs font-bold">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> GRANTED / ACTIVE
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-xs font-bold animate-pulse">
            <Clock className="h-3.5 w-3.5 text-amber-600" /> AWAITING YOUR APPROVAL
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-100 text-red-800 border border-red-300 text-xs font-bold">
            <XCircle className="h-3.5 w-3.5 text-red-600" /> REJECTED
          </span>
        );
      case 'REVOKED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 text-purple-800 border border-purple-300 text-xs font-bold">
            <ShieldCheck className="h-3.5 w-3.5 text-purple-600" /> REVOKED
          </span>
        );
      case 'EXPIRED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold">
            <Clock className="h-3.5 w-3.5 text-slate-500" /> EXPIRED
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-300 border border-brand-400/30 text-xs font-bold uppercase tracking-wider">
              Patient Privacy Center
            </span>
            <span className="text-xs text-slate-400">• Dynamic Consent Management</span>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-white">
            Consent & Data Sharing Authorizations
          </h2>
          <p className="text-xs text-slate-300 mt-1 max-w-2xl">
            You maintain full sovereignty over your medical records. No health data can be transferred between hospitals without your explicit authorization.
          </p>
        </div>

        <button
          onClick={fetchConsents}
          className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto transition-colors cursor-pointer border border-white/10"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Consents
        </button>
      </div>

      {feedback && (
        <div className={`p-4 rounded-xl text-xs flex items-start gap-2.5 border ${
          feedback.type === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-800' :
          feedback.type === 'warning' ? 'bg-purple-50 border-purple-300 text-purple-800' :
          feedback.type === 'info' ? 'bg-amber-50 border-amber-300 text-amber-800' :
          'bg-red-50 border-red-300 text-red-800'
        }`}>
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Main Grid: Left List + Right Detailed Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Consent Requests List */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <FileText className="h-4 w-4 text-brand-600" />
              Transfer Consent Requests ({consents.length})
            </h3>
          </div>

          {loading ? (
            <div className="py-8 text-center text-slate-400">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-brand-600 mb-2" />
              <p className="text-xs font-medium">Loading consent requests...</p>
            </div>
          ) : consents.length === 0 ? (
            <div className="py-8 text-center text-slate-400 space-y-2">
              <ShieldCheck className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-xs font-medium">No pending consent requests</p>
              <p className="text-[11px] text-slate-400">When a physician initiates an inter-hospital transfer, you will be prompted here to review and authorize.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {consents.map((c) => {
                const isSelected = selectedConsent?.id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedConsent(c)}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'bg-brand-50 border-brand-300 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-[10px] font-extrabold px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                        {c.transfer_code || `TRF-000${c.transfer_id}`}
                      </span>
                      {getStatusBadge(c.effective_status || c.status)}
                    </div>

                    <div className="text-xs font-bold text-slate-900 line-clamp-1">
                      {c.requesting_hospital_name} &rarr; {c.receiving_hospital_name}
                    </div>

                    <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      Purpose: {c.purpose}
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{c.data_categories?.length || 0} categories requested</span>
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column: Dedicated Plain-Language Consent Card */}
        <div className="lg:col-span-8">
          {selectedConsent ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              
              {/* Card Header */}
              <div className="p-6 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-md bg-brand-100 text-brand-800 border border-brand-200">
                      {selectedConsent.transfer_code || `TRF-000${selectedConsent.transfer_id}`}
                    </span>
                    <span className="text-xs text-slate-500">• Consent Request Form (v{selectedConsent.consent_version || '1.0'})</span>
                  </div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    Inter-Hospital Medical Data Transfer Consent
                  </h3>
                </div>

                <div>
                  {getStatusBadge(selectedConsent.effective_status || selectedConsent.status)}
                </div>
              </div>

              <div className="p-6 space-y-6">
                
                {/* 1. Who & Where (Plain Language Breakdown) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  
                  {/* Sending Node */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      WHO IS REQUESTING (Originating Facility)
                    </span>
                    <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-brand-600" />
                      {selectedConsent.requesting_hospital_name || 'Hospital A (AIIMS)'}
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                      Attending: <strong>{selectedConsent.requesting_doctor_name || 'Dr. Ramesh Sharma'}</strong>
                    </div>
                  </div>

                  {/* Receiving Node */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      WHERE IS IT GOING (Receiving Facility)
                    </span>
                    <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-emerald-600" />
                      {selectedConsent.receiving_hospital_name || 'Hospital B (Apollo)'}
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                      Receiving Specialist: <strong>{selectedConsent.receiving_doctor_name || 'Dr. Priya Patel'}</strong>
                    </div>
                  </div>

                </div>

                {/* 2. Purpose */}
                <div className="p-4 rounded-xl bg-brand-50/60 border border-brand-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    WHY IS THIS INFORMATION REQUESTED? (Clinical Purpose)
                  </span>
                  <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                    {selectedConsent.purpose || 'Inter-Hospital Patient Transfer for specialized emergency cardiology cath lab intervention.'}
                  </p>
                </div>

                {/* 3. WHAT DATA WILL BE SHARED vs WHAT IS NOT SHARED */}
                <div className="space-y-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                    WHAT EXACT INFORMATION WILL BE SHARED (Data Minimization Breakdown)
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    
                    {/* Permitted Categories */}
                    <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-2.5">
                      <div className="text-xs font-extrabold text-emerald-900 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        Selected Clinical Data (Approved for Transfer):
                      </div>
                      <ul className="space-y-1.5 text-xs text-emerald-950 font-medium">
                        {(selectedConsent.data_categories || []).map((cat, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            <span>{cat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Excluded Categories */}
                    <div className="p-4 rounded-xl bg-red-50/40 border border-red-200 space-y-2.5">
                      <div className="text-xs font-extrabold text-red-900 flex items-center gap-1.5">
                        <XCircle className="h-4 w-4 text-red-500" />
                        Strictly EXCLUDED from Sharing:
                      </div>
                      <ul className="space-y-1.5 text-xs text-red-900/80 font-medium">
                        <li className="flex items-center gap-2">
                          <X className="h-3 w-3 text-red-400" />
                          <span>Financial Information & Billing Invoices</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <X className="h-3 w-3 text-red-400" />
                          <span>Insurance Claims & Policy Details</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <X className="h-3 w-3 text-red-400" />
                          <span>Unrelated Administrative Logs</span>
                        </li>
                        <li className="flex items-center gap-2">
                          <X className="h-3 w-3 text-red-400" />
                          <span>Historical Unrelated Medical Records</span>
                        </li>
                      </ul>
                    </div>

                  </div>
                </div>

                {approvedHandover && (
                  <div className="p-4 rounded-xl bg-purple-50 border border-purple-200 space-y-3">
                    <div className="flex items-center justify-between gap-2"><span className="text-xs font-extrabold text-purple-900 flex items-center gap-1.5"><Sparkles className="h-4 w-4" /> Doctor-Verified AI Transfer Summary</span><span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">VERIFIED BY DOCTOR</span></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">{Object.entries((approvedHandover.edited_content || approvedHandover.original_content)?.sections || {}).map(([key, value]) => <div key={key} className="p-2 rounded-lg bg-white border border-purple-100"><strong className="block text-[9px] uppercase text-purple-700">{key.replaceAll('_', ' ')}</strong><span className="text-slate-700">{Array.isArray(value) ? value.join('; ') : value}</span></div>)}</div>
                    <p className="text-[10px] text-amber-800"><strong>AI-generated draft:</strong> approved by a doctor, but always verify against the original authorized clinical record.</p>
                  </div>
                )}

                {/* 4. Validity Window & Expiration */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Calendar className="h-4 w-4 text-brand-600" />
                    <span>
                      Consent Validity Period:{' '}
                      <strong className="text-slate-900">
                        {new Date(selectedConsent.created_at).toLocaleDateString()} — {new Date(selectedConsent.expires_at || Date.now() + 7*24*3600000).toLocaleDateString()}
                      </strong>
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-500">
                    Auto-expires in 7 days
                  </span>
                </div>

                {/* 5. Patient Action Toolbar */}
                <div className="pt-4 border-t border-slate-200 space-y-4">
                  
                  {(selectedConsent.effective_status || selectedConsent.status) === 'PENDING' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Digital Signature / Confirmation Note (Optional)
                        </label>
                        <input
                          type="text"
                          value={signatureNote}
                          onChange={(e) => setSignatureNote(e.target.value)}
                          placeholder="e.g. I authorize transfer to Apollo Cardiology Department"
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                        <button
                          onClick={() => handleReject(selectedConsent.id)}
                          disabled={actionLoading}
                          className="px-5 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Reject Consent Request
                        </button>
                        <button
                          onClick={() => handleApprove(selectedConsent.id)}
                          disabled={actionLoading}
                          className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center gap-2 cursor-pointer"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Approve & Authorize Transfer</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {(selectedConsent.effective_status || selectedConsent.status) === 'GRANTED' && (
                    <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                      <div className="text-xs text-emerald-900">
                        <strong className="font-bold">Active Authorization:</strong> Granted on{' '}
                        {new Date(selectedConsent.granted_at || selectedConsent.created_at).toLocaleString()}. You may revoke access at any time.
                      </div>
                      <button
                        onClick={() => handleRevoke(selectedConsent.id)}
                        disabled={actionLoading}
                        className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition-all cursor-pointer"
                      >
                        Revoke Consent Now
                      </button>
                    </div>
                  )}

                  {['REJECTED', 'REVOKED', 'EXPIRED'].includes(selectedConsent.effective_status || selectedConsent.status) && (
                    <div className="p-4 rounded-xl bg-slate-100 text-slate-600 text-xs text-center font-medium">
                      This consent is {selectedConsent.effective_status || selectedConsent.status}. Medical data disclosure for this transfer is blocked.
                    </div>
                  )}

                </div>

              </div>

            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
              <ShieldCheck className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium">Select a consent request on the left to review details</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};
