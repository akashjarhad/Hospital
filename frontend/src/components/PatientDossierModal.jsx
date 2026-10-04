import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  X, User, Heart, Activity, AlertTriangle, Calendar, FileText, 
  Stethoscope, Clock, CheckCircle2, Shield, Plus, ArrowUpRight,
  FlaskConical, Phone, MapPin, AlertCircle, Sparkles, Bot
} from 'lucide-react';
import { ClinicalRAGAssistant } from './ClinicalRAGAssistant';

export const PatientDossierModal = ({ patientId, onClose, onAddTest, onInitiateTransfer }) => {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'tests' | 'vitals'

  useEffect(() => {
    const fetchPatientDossier = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.get(`/patients/${patientId}`);
        if (res.data.success) {
          setPatient(res.data.data);
        } else {
          setError('Failed to load patient record.');
        }
      } catch (err) {
        setError(err.response?.data?.message || 'Error fetching patient dossier.');
      } finally {
        setLoading(false);
      }
    };

    if (patientId) {
      fetchPatientDossier();
    }
  }, [patientId]);

  if (!patientId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-brand-900 via-slate-900 to-brand-950 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-wrap items-center justify-between gap-4 pr-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full bg-brand-500/30 border border-brand-400/40 text-brand-300 text-xs font-mono font-bold tracking-wider">
                  {patient?.unique_health_id || 'ABHA-ID'}
                </span>
                <span className="text-xs text-slate-400">• Raw Clinical Dossier (Stage 1 Core)</span>
              </div>
              <h2 className="text-2xl font-extrabold text-white flex items-center gap-3">
                {patient?.name || 'Loading Patient...'}
                {patient?.blood_group && (
                  <span className="px-2 py-0.5 rounded-md bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold font-mono">
                    {patient.blood_group}
                  </span>
                )}
              </h2>
            </div>

            {/* Quick Actions in Header */}
            {patient && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const activeVisit = patient.visits?.[0];
                    if (activeVisit) onAddTest(patient, activeVisit);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer border border-white/10"
                >
                  <Plus className="h-3.5 w-3.5" /> Add Lab Test
                </button>
                <button
                  onClick={() => onInitiateTransfer(patient)}
                  className="px-3.5 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-brand-500/30 transition-all cursor-pointer"
                >
                  <ArrowUpRight className="h-4 w-4" /> Transfer Patient
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Loading / Error States */}
        {loading && (
          <div className="p-12 text-center text-slate-500">
            <Activity className="h-8 w-8 animate-spin mx-auto text-brand-600 mb-3" />
            <p className="text-sm font-medium">Retrieving verified clinical timeline from hospital database...</p>
          </div>
        )}

        {error && (
          <div className="p-6 m-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {patient && !loading && (
          <div className="p-6 space-y-6">
            
            {/* Patient Demographic & Allergy Alert Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Demographic Card */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-brand-600" /> Demographics
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">DOB / Age:</span>
                    <span className="font-semibold text-slate-800">{patient.dob} ({patient.gender})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Contact Phone:</span>
                    <span className="font-mono text-slate-800">{patient.phone || 'Not recorded'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Registered:</span>
                    <span className="text-slate-700">{new Date(patient.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-brand-600" /> Emergency Kin
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="text-slate-800 font-bold">
                    {patient.emergency_contact_name || 'No kin recorded'}
                  </div>
                  <div className="font-mono text-slate-600">
                    {patient.emergency_contact_phone || 'N/A'}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Contacted on hospital transfer dispatch
                  </div>
                </div>
              </div>

              {/* Allergies & Medical History (Critical Warning Box) */}
              <div className={`p-4 rounded-xl border ${
                patient.allergies && !patient.allergies.toLowerCase().includes('none')
                  ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                  : 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
              }`}>
                <div className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" /> Allergies & Warnings
                </div>
                <div className="text-xs font-bold mb-1">
                  {patient.allergies || 'None Known'}
                </div>
                <div className="text-[11px] text-slate-600 line-clamp-2">
                  <span className="font-semibold">History:</span> {patient.medical_history || 'No prior chronic conditions recorded.'}
                </div>
              </div>

            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'timeline'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" /> Clinical Visits Timeline ({patient.visits?.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('tests')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'tests'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <FlaskConical className="h-3.5 w-3.5" /> Diagnostic Lab Tests
              </button>
              <button
                onClick={() => setActiveTab('vitals')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'vitals'
                    ? 'bg-brand-600 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Heart className="h-3.5 w-3.5" /> Vitals History
              </button>
              <button
                onClick={() => setActiveTab('rag')}
                className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'rag'
                    ? 'bg-gradient-to-r from-brand-700 to-indigo-700 text-white shadow-md shadow-brand-700/30'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-brand-300" /> AI Grounded RAG Assistant
              </button>
            </div>

            {/* Tab 1: Clinical Visits Timeline */}
            {activeTab === 'timeline' && (
              <div className="space-y-4">
                {patient.visits?.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No visits recorded for this patient.</p>
                ) : (
                  patient.visits?.map((visit, index) => (
                    <div key={visit.id || index} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                      
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                            visit.status === 'critical' ? 'bg-red-100 text-red-800 border border-red-300 animate-pulse' :
                            visit.status === 'admitted' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            visit.status === 'observation' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            'bg-slate-200 text-slate-800'
                          }`}>
                            {visit.status}
                          </span>
                          <span className="font-bold text-sm text-slate-900">
                            {visit.diagnosis}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>Admitted: {new Date(visit.admission_date).toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Hospital & Attending Physician */}
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600 bg-white p-3 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-1.5 font-medium">
                          <MapPin className="h-3.5 w-3.5 text-brand-600" />
                          <span>Hospital: <strong>{visit.hospital_name || 'Hospital Node'}</strong> ({visit.hospital_code || 'HOSP'})</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-medium">
                          <Stethoscope className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Attending: <strong>{visit.attending_doctor_name || 'Dr. On Duty'}</strong></span>
                        </div>
                      </div>

                      {/* Chief Complaint & Notes */}
                      {visit.chief_complaint && (
                        <div className="text-xs text-slate-700 bg-amber-50/50 border border-amber-200 p-3 rounded-xl">
                          <strong className="text-amber-900">Chief Complaint:</strong> {visit.chief_complaint}
                        </div>
                      )}

                      {visit.clinical_notes && (
                        <div className="text-xs text-slate-700 bg-white border border-slate-200 p-3 rounded-xl leading-relaxed">
                          <strong className="text-slate-900 block mb-1">Physician Clinical Notes:</strong>
                          {visit.clinical_notes}
                        </div>
                      )}

                      {/* Embedded Vitals for Visit */}
                      {visit.vitals && Object.keys(visit.vitals).length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                          <div className="p-2 rounded-lg bg-white border border-slate-200 text-center">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Heart Rate</div>
                            <div className="text-sm font-bold text-slate-900">{visit.vitals.heart_rate || '--'} <span className="text-[10px] font-normal text-slate-500">bpm</span></div>
                          </div>
                          <div className="p-2 rounded-lg bg-white border border-slate-200 text-center">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Blood Pressure</div>
                            <div className="text-sm font-bold text-slate-900">{visit.vitals.blood_pressure || '--'} <span className="text-[10px] font-normal text-slate-500">mmHg</span></div>
                          </div>
                          <div className="p-2 rounded-lg bg-white border border-slate-200 text-center">
                            <div className="text-[10px] uppercase font-bold text-slate-400">SpO2 Oxygen</div>
                            <div className="text-sm font-bold text-brand-600">{visit.vitals.spo2 || '--'} <span className="text-[10px] font-normal text-slate-500">%</span></div>
                          </div>
                          <div className="p-2 rounded-lg bg-white border border-slate-200 text-center">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Temp</div>
                            <div className="text-sm font-bold text-slate-900">{visit.vitals.temperature || '--'} <span className="text-[10px] font-normal text-slate-500">°F</span></div>
                          </div>
                          <div className="p-2 rounded-lg bg-white border border-slate-200 text-center">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Resp Rate</div>
                            <div className="text-sm font-bold text-slate-900">{visit.vitals.respiratory_rate || '--'} <span className="text-[10px] font-normal text-slate-500">/min</span></div>
                          </div>
                        </div>
                      )}

                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Diagnostic Lab Tests */}
            {activeTab === 'tests' && (
              <div className="space-y-3">
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-left text-xs text-slate-700">
                    <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold border-b border-slate-200">
                      <tr>
                        <th className="px-4 py-3">Diagnostic Test</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3">Result</th>
                        <th className="px-4 py-3">Reference Range</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Timestamp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {patient.visits?.flatMap(v => v.tests || []).length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-4 py-6 text-center text-slate-400">
                            No diagnostic lab tests recorded for this patient.
                          </td>
                        </tr>
                      ) : (
                        patient.visits?.flatMap(v => v.tests || []).map((test, tIdx) => (
                          <tr key={test.id || tIdx} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-bold text-slate-900">
                              {test.test_name}
                              {test.notes && <div className="text-[10px] font-normal text-slate-500">{test.notes}</div>}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{test.category || 'Laboratory'}</td>
                            <td className="px-4 py-3 font-mono font-bold text-slate-900">
                              {test.result} {test.units || ''}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">{test.reference_range || 'N/A'}</td>
                            <td className="px-4 py-3">
                              {test.abnormal ? (
                                <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-bold border border-red-200 text-[10px]">
                                  Abnormal
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold border border-emerald-200 text-[10px]">
                                  Normal
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                              {new Date(test.timestamp).toLocaleString()}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Tab 3: Historical Vitals Trend */}
            {activeTab === 'vitals' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {patient.visits?.map((v, idx) => (
                    <div key={v.id || idx} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                      <div className="flex justify-between items-center text-xs pb-2 border-b border-slate-100">
                        <span className="font-bold text-slate-800">{v.diagnosis}</span>
                        <span className="text-slate-400 font-mono">{new Date(v.admission_date).toLocaleDateString()}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="p-2 rounded bg-slate-50 border border-slate-100">
                          <div className="text-[10px] text-slate-400">Heart Rate</div>
                          <div className="font-bold text-slate-900">{v.vitals?.heart_rate || '--'} bpm</div>
                        </div>
                        <div className="p-2 rounded bg-slate-50 border border-slate-100">
                          <div className="text-[10px] text-slate-400">Blood Pressure</div>
                          <div className="font-bold text-slate-900">{v.vitals?.blood_pressure || '--'} mmHg</div>
                        </div>
                        <div className="p-2 rounded bg-slate-50 border border-slate-100">
                          <div className="text-[10px] text-slate-400">SpO2</div>
                          <div className="font-bold text-brand-600">{v.vitals?.spo2 || '--'}%</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 4: Grounded Clinical RAG Assistant */}
            {activeTab === 'rag' && (
              <div className="space-y-3">
                <ClinicalRAGAssistant
                  patientId={patient.id}
                  patientName={patient.name}
                  compact={false}
                />
              </div>
            )}

            {/* Stage 1 Compliance Footer Banner */}
            <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-brand-600 shrink-0" />
                <span>
                  <strong>Stage 1 Zero-AI Compliance:</strong> Full uncompressed clinical dataset shown directly without AI summary.
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-400 uppercase">ABDM-H2H-V1</span>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
