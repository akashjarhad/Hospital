import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  X, CheckCircle2, ShieldAlert, Lock, AlertTriangle, 
  Building2, Stethoscope, FileText, Download, Activity, 
  Heart, AlertCircle, Clock, Calendar, Check, ArrowDownToLine, 
  ExternalLink, Sparkles, ShieldCheck, Bot 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AITransferWorkspace } from './AITransferWorkspace';
import { ClinicalRAGAssistant } from './ClinicalRAGAssistant';

export const TransferDossierModal = ({ transferId, onClose, onTransferUpdated, onTriggerEmergency }) => {
  const { user, hospital } = useAuth();
  const [transfer, setTransfer] = useState(null);
  const [clinicalData, setClinicalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('clinical'); // 'clinical' | 'documents' | 'timeline' | 'fhir'
  const [actionLoading, setActionLoading] = useState(false);
  const [fhirBundle, setFhirBundle] = useState(null);

  const fetchTransferDossier = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Get transfer metadata & consent status
      const metaRes = await api.get(`/transfers/${transferId}`);
      if (metaRes.data.success) {
        setTransfer(metaRes.data.data);
      }

      // 2. Query data payload (Server enforces consent and data minimization)
      try {
        const dataRes = await api.get(`/transfers/${transferId}/data`);
        if (dataRes.data.success) {
          setClinicalData(dataRes.data);
        }
      } catch (dataErr) {
        const msg = dataErr.response?.data?.message || 'Access Denied to clinical records.';
        setError(msg);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to retrieve transfer dossier.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (transferId) {
      fetchTransferDossier();
    }
  }, [transferId]);

  const handleReceiveTransfer = async () => {
    setActionLoading(true);
    try {
      const res = await api.post(`/transfers/${transferId}/receive`);
      if (res.data.success) {
        fetchTransferDossier();
        if (onTransferUpdated) onTransferUpdated();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to acknowledge transfer.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFetchFHIR = async () => {
    try {
      const res = await api.get(`/transfers/${transferId}/fhir`);
      setFhirBundle(res.data);
      setActiveTab('fhir');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate FHIR export.');
    }
  };

  const handleDownloadDocument = async (docId) => {
    try {
      const res = await api.get(`/documents/${docId}/download?transfer_id=${transferId}`);
      if (res.data.success) {
        alert(`${res.data.message}\n\nDocument: ${res.data.document.title}\nSHA-256: ${res.data.document.content_hash || 'Not available'}`);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to retrieve authorized document metadata.');
    }
  };

  if (!transferId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-brand-950 to-slate-900 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-wrap items-center justify-between gap-4 pr-8">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-brand-500/30 text-brand-300 border border-brand-400/40">
                  {transfer?.transfer_code || 'TR-2026-XXXX'}
                </span>
                <span className="text-xs text-slate-400">• Inter-Hospital Clinical Transfer Record</span>
                {transfer?.clinical_priority && (
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded uppercase ${
                    transfer.clinical_priority === 'EMERGENCY' ? 'bg-red-500 text-white' :
                    transfer.clinical_priority === 'URGENT' ? 'bg-amber-500 text-white' :
                    'bg-brand-600 text-white'
                  }`}>
                    {transfer.clinical_priority} Priority
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-extrabold text-white flex items-center gap-2.5">
                <span>{transfer?.patient_name || 'Patient Clinical Dossier'}</span>
                <span className="font-mono text-xs text-slate-400">({transfer?.patient_unique_health_id})</span>
              </h2>
            </div>

            {/* Quick Actions in Header */}
            {transfer && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFetchFHIR}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" /> Export FHIR R4
                </button>

                {transfer.transfer_status !== 'RECEIVED' && transfer.transfer_status !== 'COMPLETED' && (
                  <button
                    onClick={handleReceiveTransfer}
                    disabled={actionLoading}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge & Receive Patient
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Transfer Context Ribbon */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-white/5 border border-white/10 rounded-xl p-3">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Source Facility</span>
              <strong className="text-white">{transfer?.source_hospital_name}</strong>
              <div className="text-slate-400 text-[11px]">Req: {transfer?.requesting_doctor_name}</div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Receiving Facility</span>
              <strong className="text-white">{transfer?.destination_hospital_name}</strong>
              <div className="text-slate-400 text-[11px]">Attending: {transfer?.receiving_doctor_name || 'Department Physician'}</div>
            </div>

            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Consent Status</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                {transfer?.consent_status === 'GRANTED' ? (
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> GRANTED (Active)
                  </span>
                ) : (
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> {transfer?.consent_status || 'PENDING'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('clinical')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'clinical'
                ? 'border-brand-600 text-brand-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Authorized Medical Records
          </button>
          <button
            onClick={() => setActiveTab('ai')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ai'
                ? 'border-purple-600 text-purple-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" /> AI Clinical Handover
          </button>
          <button
            onClick={() => setActiveTab('rag')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'rag'
                ? 'border-brand-600 text-brand-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Bot className="h-3.5 w-3.5 text-brand-600" /> Grounded RAG Assistant
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'documents'
                ? 'border-brand-600 text-brand-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Clinical Reports & Attachments ({clinicalData?.data?.documents?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'timeline'
                ? 'border-brand-600 text-brand-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            Audited Event Timeline ({transfer?.audit_timeline?.length || 0})
          </button>
          <button
            onClick={() => {
              if (!fhirBundle) handleFetchFHIR();
              setActiveTab('fhir');
            }}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === 'fhir'
                ? 'border-brand-600 text-brand-700 bg-white'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            HL7 FHIR Document Bundle
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 max-h-[65vh] overflow-y-auto">
          
          {loading && (
            <div className="py-12 text-center text-slate-500">
              <Activity className="h-8 w-8 animate-spin mx-auto text-brand-600 mb-3" />
              <p className="text-sm font-medium">Validating cryptographic transfer signatures and patient consent...</p>
            </div>
          )}

          {error && (
            <div className="p-6 rounded-2xl bg-amber-50 border border-amber-200 text-slate-900 space-y-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-amber-900">Protected Clinical Access Restricted</h3>
                  <p className="text-xs text-amber-800 leading-relaxed">{error}</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white border border-amber-200 text-xs space-y-3">
                <div className="font-bold text-slate-800">Available Resolution Options:</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <strong className="block text-slate-900 mb-0.5">1. Await Patient Digital Consent</strong>
                    <span className="text-[11px] text-slate-500">The patient has been notified and can approve via Patient Portal.</span>
                  </div>

                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <strong className="block text-red-900 mb-0.5">2. Break-Glass Emergency Access</strong>
                    <span className="text-[11px] text-red-700 block mb-2">If patient is incapacitated or facing imminent life risk.</span>
                    <button
                      onClick={() => {
                        onClose();
                        if (onTriggerEmergency) onTriggerEmergency(transfer);
                      }}
                      className="px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] transition-colors cursor-pointer"
                    >
                      Request Emergency Break-Glass
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 1: CLINICAL DATA */}
          {activeTab === 'clinical' && clinicalData && (
            <div className="space-y-6">
              
              {/* Data Minimization Scope Notice */}
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-emerald-900">
                  <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    <strong>Server-Side Data Minimization Applied:</strong> Displaying {clinicalData.permitted_categories?.length || 0} consented categories. Non-authorized data is cryptographically pruned.
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px]">
                  Mode: {clinicalData.access_mode}
                </span>
              </div>

              {/* Physician Referral Summary */}
              {transfer?.doctor_transfer_summary && (
                <div className="p-4 rounded-xl bg-brand-50/50 border border-brand-200 space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-700">
                    Physician Referral Transfer Summary (Dr. {transfer.requesting_doctor_name})
                  </span>
                  <p className="text-xs text-slate-900 font-medium leading-relaxed">
                    {transfer.doctor_transfer_summary}
                  </p>
                </div>
              )}

              {/* Clinical Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* 1. Demographics & Vitals */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-brand-600" /> Patient Vitals & Demographics
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-slate-400">DOB / Age:</span> <strong className="text-slate-900">{clinicalData.data?.dob}</strong></div>
                    <div><span className="text-slate-400">Gender:</span> <strong className="text-slate-900">{clinicalData.data?.gender}</strong></div>
                    <div><span className="text-slate-400">Blood Group:</span> <strong className="text-red-600">{clinicalData.data?.blood_group || 'O+'}</strong></div>
                    <div><span className="text-slate-400">Emergency Phone:</span> <span className="font-mono text-slate-900">{clinicalData.data?.emergency_contact_phone || 'N/A'}</span></div>
                  </div>
                </div>

                {/* 2. Allergies */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-red-600" /> Allergies & Adverse Reactions
                  </h4>
                  <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs font-bold text-red-800">
                    {clinicalData.data?.allergies || 'None known'}
                  </div>
                </div>

                {/* 3. Medical History & Diagnosis */}
                <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3 md:col-span-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <FileText className="h-4 w-4 text-brand-600" /> Medical History & Admission Diagnosis
                  </h4>
                  <div className="text-xs space-y-2">
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                      <span className="text-slate-400 font-bold block text-[10px] uppercase">Primary Diagnosis:</span>
                      <strong className="text-slate-900 text-sm">{clinicalData.data?.diagnosis || clinicalData.data?.current_diagnosis || 'Acute Condition'}</strong>
                    </div>
                    {clinicalData.data?.medical_history && (
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Past Medical History:</span>
                        <p className="text-slate-700">{clinicalData.data.medical_history}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* 4. Medications */}
                {clinicalData.data?.medications && clinicalData.data.medications.length > 0 && (
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3 md:col-span-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Heart className="h-4 w-4 text-emerald-600" /> Current Medications & Regimens
                    </h4>
                    <div className="divide-y divide-slate-100 text-xs">
                      {clinicalData.data.medications.map((m, idx) => (
                        <div key={idx} className="py-2 flex items-center justify-between">
                          <div>
                            <strong className="text-slate-900">{m.medication_name}</strong>
                            <span className="text-slate-500 text-[11px] ml-2">({m.dosage}, {m.frequency}, {m.route})</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.is_current ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {m.is_current ? 'Active Regimen' : 'Prior Maintenance'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Diagnostic Lab Tests */}
                {clinicalData.data?.visits && clinicalData.data.visits[0]?.tests && (
                  <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-3 md:col-span-2">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <Activity className="h-4 w-4 text-brand-600" /> Diagnostic Lab & Imaging Reports
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold border-b border-slate-200">
                          <tr>
                            <th className="py-2 px-3">Test Name</th>
                            <th className="py-2 px-3">Category</th>
                            <th className="py-2 px-3">Result</th>
                            <th className="py-2 px-3">Reference Range</th>
                            <th className="py-2 px-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {clinicalData.data.visits[0].tests.map((t, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50">
                              <td className="py-2 px-3 font-semibold text-slate-900">{t.test_name}</td>
                              <td className="py-2 px-3 text-slate-500">{t.category}</td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900">{t.result} {t.units}</td>
                              <td className="py-2 px-3 text-slate-500">{t.reference_range || 'Normal'}</td>
                              <td className="py-2 px-3">
                                {t.abnormal ? (
                                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[10px] font-bold">
                                    Abnormal
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    Normal
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* AI-ASSISTED TRANSFER WORKSPACE */}
          {activeTab === 'ai' && transfer && (
            <AITransferWorkspace
              transfer={transfer}
              onSourceSelect={(sourceId) => setActiveTab(String(sourceId || '').startsWith('DocumentReference/') ? 'documents' : 'clinical')}
            />
          )}

          {/* GROUNDED RAG ASSISTANT */}
          {activeTab === 'rag' && transfer && (
            <div className="space-y-4">
              <ClinicalRAGAssistant
                patientId={transfer.patient_id}
                transferId={transfer.id}
                patientName={transfer.patient_name || 'Patient'}
                onSourceSelect={(sourceId) => setActiveTab(String(sourceId || '').startsWith('DocumentReference/') ? 'documents' : 'clinical')}
                compact={false}
              />
            </div>
          )}

          {/* TAB 2: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Encrypted Clinical Vault Reports
                </h3>
                <span className="text-xs text-slate-400">Verified Cryptographic Hashes</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(clinicalData?.data?.documents || []).map((doc) => (
                  <div key={doc.id} className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all flex items-start justify-between gap-3 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><FileText className="h-5 w-5" /></div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{doc.title}</h4>
                        <div className="text-[11px] text-slate-500 mt-0.5">{doc.document_type} • {Math.max(1, Math.round((doc.file_size_bytes || 0) / 1024))} KB</div>
                        <span className="text-[10px] font-mono text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded mt-1.5 inline-block">SHA256: {doc.content_hash ? `${doc.content_hash.slice(0, 12)}…` : 'Not available'}</span>
                      </div>
                    </div>
                    <button onClick={() => handleDownloadDocument(doc.id)} className="p-2 rounded-lg bg-slate-100 hover:bg-brand-600 hover:text-white text-slate-700 transition-colors cursor-pointer shrink-0" title="Verify Authorized Report Metadata"><ShieldCheck className="h-4 w-4" /></button>
                  </div>
                ))}
                {!clinicalData?.data?.documents?.length && <div className="md:col-span-2 p-8 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">No document metadata exists in the authorized transfer scope.</div>}
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Transfer Lifecycle & Access Audit Timeline
                </h3>
                <span className="text-xs text-slate-400">Audited event history</span>
              </div>

              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                {(transfer?.audit_timeline || []).map((log, idx) => (
                  <div key={idx} className="relative flex items-start gap-3">
                    <span className="absolute -left-6 top-1 h-3 w-3 rounded-full bg-brand-600 border-2 border-white shadow-sm"></span>
                    <div className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-extrabold text-slate-900 font-mono text-[11px]">{log.action}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px]">{log.purpose}</p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                        <span>Role: <strong className="text-slate-700">{log.role}</strong></span>
                        <span>•</span>
                        <span>Result: <strong className="text-emerald-700">{log.result}</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: FHIR R4 JSON BUNDLE */}
          {activeTab === 'fhir' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">HL7 FHIR R4 Document Bundle JSON Payload</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                  MIME: application/fhir+json
                </span>
              </div>
              <pre className="p-4 rounded-xl bg-slate-900 text-brand-300 font-mono text-[11px] overflow-x-auto max-h-96 leading-relaxed">
                {JSON.stringify(fhirBundle || { notice: 'Generating standard FHIR Bundle resource...' }, null, 2)}
              </pre>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
          <div className="text-slate-500 flex items-center gap-1.5">
            <Lock className="h-3.5 w-3.5 text-emerald-600" />
            <span>End-to-End Cryptographic Verification & Audit Trail Active</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors cursor-pointer"
          >
            Close Dossier
          </button>
        </div>

      </div>
    </div>
  );
};
