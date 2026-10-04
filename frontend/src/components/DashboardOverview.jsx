import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { 
  Building2, ShieldCheck, Stethoscope, CheckCircle2, Clock, 
  ArrowRight, Activity, PhoneCall, MapPin, Database, Award, 
  Users, AlertTriangle, FlaskConical, ArrowUpRight, Plus, RefreshCw, 
  Lock, ArrowDownToLine, ShieldAlert, FileText, User, Send, CheckCircle,
  XCircle, UserPlus, HeartPulse, History, AlertCircle, Sparkles, Bot
} from 'lucide-react';
import { PatientTable } from './PatientTable';
import { AddPatientModal } from './AddPatientModal';
import { AddMedicalRecordModal } from './AddMedicalRecordModal';
import { PatientDossierModal } from './PatientDossierModal';
import { AddTestModal } from './AddTestModal';
import { TransferModal } from './TransferModal';
import { TransferDossierModal } from './TransferDossierModal';
import { EmergencyAccessModal } from './EmergencyAccessModal';
import { ConsentCenter } from './ConsentCenter';
import { SecurityDashboard } from './SecurityDashboard';
import { AuditTrailView } from './AuditTrailView';
import { ResearchDashboard } from './ResearchDashboard';
import { ClinicalRAGAssistant } from './ClinicalRAGAssistant';

export const DashboardOverview = () => {
  const { user, hospital, patient, refreshNotifications } = useAuth();

  const role = (user?.role || '').toUpperCase();
  const isDoctor = role === 'DOCTOR';
  const isPatient = role === 'PATIENT';
  const isAdmin = role === 'HOSPITAL_ADMIN' || role === 'SYSTEM_ADMIN';

  // Core Data States
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [hospitalsNetwork, setHospitalsNetwork] = useState([]);
  const [outgoingTransfers, setOutgoingTransfers] = useState([]);
  const [incomingTransfers, setIncomingTransfers] = useState([]);
  const [loadingTransfers, setLoadingTransfers] = useState(false);
  const [myPatientRecord, setMyPatientRecord] = useState(null);

  // Patient Association States
  const [patientDoctors, setPatientDoctors] = useState([]);
  const [patientPendingAssocs, setPatientPendingAssocs] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [patientAuditLogs, setPatientAuditLogs] = useState([]);

  // Active Main Tab
  const [activeTab, setActiveTab] = useState(
    isPatient ? 'my_doctors' :
    isAdmin ? 'security' :
    'patients'
  );

  // Modal States
  const [isAddPatientOpen, setIsAddPatientOpen] = useState(false);
  const [selectedPatientIdForDossier, setSelectedPatientIdForDossier] = useState(null);
  const [selectedPatientForRecord, setSelectedPatientForRecord] = useState(null);
  const [selectedPatientForTest, setSelectedPatientForTest] = useState(null);
  const [selectedVisitForTest, setSelectedVisitForTest] = useState(null);
  const [selectedPatientForTransfer, setSelectedPatientForTransfer] = useState(null);
  const [selectedTransferIdForDossier, setSelectedTransferIdForDossier] = useState(null);
  const [emergencyTarget, setEmergencyTarget] = useState(null);
  const [selectedRagPatientId, setSelectedRagPatientId] = useState(null);

  // Notification / Action feedback banner
  const [actionAlert, setActionAlert] = useState(null);

  // Fetch Patients Roster (Doctor gets strictly their associated patients)
  const fetchPatients = async () => {
    if (isPatient) return;
    setLoadingPatients(true);
    try {
      const res = await api.get('/patients');
      if (res.data.success) {
        setPatients(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
    } finally {
      setLoadingPatients(false);
    }
  };

  // Fetch Connected Hospital Nodes
  const fetchHospitals = async () => {
    try {
      const res = await api.get('/hospitals');
      if (res.data.success) {
        setHospitalsNetwork(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching hospitals:', err);
    }
  };

  // Fetch Outgoing & Incoming Transfers
  const fetchTransfers = async () => {
    if (!hospital && !isDoctor) return;
    setLoadingTransfers(true);
    try {
      const outRes = await api.get('/transfers?type=outgoing');
      if (outRes.data.success) setOutgoingTransfers(outRes.data.data);

      const inRes = await api.get('/transfers?type=incoming');
      if (inRes.data.success) setIncomingTransfers(inRes.data.data);
    } catch (err) {
      console.error('Error fetching transfers:', err);
    } finally {
      setLoadingTransfers(false);
    }
  };

  // Fetch Patient Self-Service Record
  const fetchMyRecord = async () => {
    if (!isPatient) return;
    try {
      const res = await api.get('/patients/my-record');
      if (res.data.success) {
        setMyPatientRecord(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching personal record:', err);
    }
  };

  // Fetch Patient's Treating Doctors
  const fetchPatientDoctors = async () => {
    if (!isPatient) return;
    setLoadingDoctors(true);
    try {
      const res = await api.get('/patients/my-doctors');
      if (res.data.success) {
        setPatientDoctors(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching treating doctors:', err);
    } finally {
      setLoadingDoctors(false);
    }
  };

  // Fetch Patient's Pending Doctor Association Requests
  const fetchPatientPendingAssocs = async () => {
    if (!isPatient) return;
    try {
      const res = await api.get('/patients/my-association-requests');
      if (res.data.success) {
        setPatientPendingAssocs(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching pending association requests:', err);
    }
  };

  // Fetch Patient's Data Access History (Audit logs for this patient)
  const fetchPatientAuditHistory = async () => {
    if (!isPatient) return;
    try {
      const res = await api.get('/audit');
      if (res.data.success) {
        setPatientAuditLogs(res.data.data || []);
      }
    } catch (err) {
      console.error('Error fetching patient audit logs:', err);
    }
  };

  useEffect(() => {
    if (user) {
      fetchHospitals();
      if (isDoctor || isAdmin) {
        fetchPatients();
        fetchTransfers();
      }
      if (isPatient) {
        fetchMyRecord();
        fetchPatientDoctors();
        fetchPatientPendingAssocs();
        fetchPatientAuditHistory();
      }
    }
  }, [user, hospital]);

  if (!user) return null;

  // Patient Actions: Accept or Reject Association Request
  const handleRespondAssociation = async (assocId, action) => {
    try {
      const res = await api.post(`/patients/association-requests/${assocId}/respond`, { action });
      if (res.data.success) {
        setActionAlert({
          type: action === 'ACCEPT' ? 'success' : 'info',
          message: res.data.message
        });
        fetchPatientDoctors();
        fetchPatientPendingAssocs();
        refreshNotifications();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to respond to association request.');
    }
  };

  // Patient Action: Revoke Doctor Association
  const handleRevokeAssociation = async (assocId, doctorName) => {
    if (!window.confirm(`Are you sure you want to revoke your treatment association with ${doctorName}? The doctor will no longer have access to your clinical record.`)) {
      return;
    }

    try {
      const res = await api.post(`/patients/my-doctors/${assocId}/revoke`);
      if (res.data.success) {
        setActionAlert({
          type: 'warning',
          message: `Treatment association with ${doctorName} has been revoked.`
        });
        fetchPatientDoctors();
        refreshNotifications();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to revoke doctor association.');
    }
  };

  // Compute live clinical metrics
  const totalPatients = patients.length;
  const criticalCount = patients.filter(p => (p.latest_visit?.status || p.visit_status) === 'critical').length;
  const observationCount = patients.filter(p => (p.latest_visit?.status || p.visit_status) === 'observation').length;

  const handleOpenAddTest = (patientObj, visit) => {
    setSelectedPatientForTest(patientObj);
    setSelectedVisitForTest(visit || patientObj.latest_visit);
  };

  const handleOpenAddRecord = (patientObj) => {
    setSelectedPatientForRecord(patientObj);
  };

  const handleInitiateTransfer = (patientObj) => {
    setSelectedPatientForTransfer(patientObj);
  };

  const handleDispatchPackage = async (transferId) => {
    try {
      const res = await api.post(`/transfers/${transferId}/send`);
      if (res.data.success) {
        alert(`Transfer package cryptographically signed & dispatched!\nSignature: ${res.data.package_signature}`);
        fetchTransfers();
        refreshNotifications();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to dispatch transfer package.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-r from-brand-900 via-slate-900 to-brand-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="relative z-10 max-w-4xl">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="h-3.5 w-3.5" /> FHIR-Oriented Research Gateway
            </span>
            {hospital && (
              <span className="px-2.5 py-0.5 rounded-full bg-brand-500/30 text-brand-200 border border-brand-400/30 text-xs font-mono">
                Hospital: {hospital.name} ({hospital.code})
              </span>
            )}
            {isPatient && (
              <span className="px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30 text-xs font-mono">
                ABHA ID: {user.unique_health_id || 'P-10001'}
              </span>
            )}
          </div>
          
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            {isPatient ? `Welcome, ${user.name}` :
             isDoctor ? `Welcome, Dr. ${user.name.replace(/^Dr\.\s*/i, '')}` :
             isAdmin ? `Hospital Operations & Compliance Console — ${hospital?.name || 'Network Node'}` :
             `Clinical Console — ${hospital?.name || 'Hospital Node'}`}
          </h1>
          
          <p className="mt-2 text-slate-300 text-xs sm:text-sm leading-relaxed max-w-3xl">
            Logged in as <strong className="text-white">{user.name}</strong> ({role}) • {user.specialty || (isPatient ? 'Verified Patient Account' : 'Hospital Operations Lead')}. 
            {isDoctor && ' Your dashboard displays patients currently under active treatment with you. Search registered patients to send treatment association requests.'}
            {isPatient && ' Review pending doctor requests, grant or revoke treatment authorizations, and inspect which hospitals access your data.'}
            {isAdmin && ' Monitor inter-hospital transfers, manage clinical staff associations, and inspect cryptographic audit logs.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3 text-xs">
            {hospital && (
              <>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10">
                  <Building2 className="h-4 w-4 text-brand-300" />
                  <span>{hospital.name}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10">
                  <MapPin className="h-4 w-4 text-brand-300" />
                  <span>{hospital.city}</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 backdrop-blur-md border border-white/10">
                  <PhoneCall className="h-4 w-4 text-brand-300" />
                  <span>Emergency Line: {hospital.emergency_contact || hospital.phone || '+91-11-26588500'}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action Alert Banner */}
      {actionAlert && (
        <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold animate-in fade-in duration-200 ${
          actionAlert.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
          actionAlert.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
          'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            <span>{actionAlert.message}</span>
          </div>
          <button
            onClick={() => setActionAlert(null)}
            className="text-slate-400 hover:text-slate-700 cursor-pointer font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Top Metric Cards for Doctor */}
      {isDoctor && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">My Active Patients</span>
              <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
                <Users className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{totalPatients}</span>
              <span className="text-xs text-brand-600 font-semibold">under active care</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Outgoing Transfers</span>
              <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <ArrowUpRight className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-600">{outgoingTransfers.length}</span>
              <span className="text-xs text-slate-500 font-medium">initiated by you</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Incoming Transfers</span>
              <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <ArrowDownToLine className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-600">{incomingTransfers.length}</span>
              <span className="text-xs text-emerald-600 font-bold">referred to you</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Network Hospitals</span>
              <div className="h-9 w-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Building2 className="h-5 w-5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{hospitalsNetwork.length}</span>
              <span className="text-xs text-purple-600 font-bold">verified transfer nodes</span>
            </div>
          </div>
        </div>
      )}

      {/* 2.5 PATIENT PENDING REQUESTS ALERT CARDS (If any) */}
      {isPatient && patientPendingAssocs.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-extrabold text-slate-900 text-sm">
              Pending Doctor Treatment Association Requests ({patientPendingAssocs.length})
            </h3>
          </div>
          <p className="text-xs text-slate-600">
            A doctor has requested permission to add you to their patient roster and manage your treatment.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {patientPendingAssocs.map((reqItem) => (
              <div key={reqItem.id} className="p-4 bg-white border border-amber-200 rounded-xl shadow-sm space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                      <Stethoscope className="h-4 w-4 text-brand-600" /> {reqItem.doctor_name}
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                      {reqItem.doctor_specialty} • {reqItem.hospital_name}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                    PENDING
                  </span>
                </div>

                <div className="p-2.5 rounded-lg bg-slate-50 text-xs text-slate-700 space-y-1">
                  <div><strong className="text-slate-900">Department:</strong> {reqItem.department || 'General Care'}</div>
                  <div><strong className="text-slate-900">Treatment Reason:</strong> {reqItem.treatment_reason || 'Specialist consultation'}</div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleRespondAssociation(reqItem.id, 'REJECT')}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <XCircle className="h-3.5 w-3.5 text-slate-500" /> Decline
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRespondAssociation(reqItem.id, 'ACCEPT')}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Accept & Authorize
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. Section Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          
          {/* DOCTOR TABS */}
          {isDoctor && (
            <>
              <button
                onClick={() => setActiveTab('patients')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'patients'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>My Associated Patients</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20">{totalPatients}</span>
              </button>

              <button
                onClick={() => setActiveTab('outgoing')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'outgoing'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <ArrowUpRight className="h-4 w-4" />
                <span>Outgoing Transfers</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20">{outgoingTransfers.length}</span>
              </button>

              <button
                onClick={() => setActiveTab('incoming')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'incoming'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <ArrowDownToLine className="h-4 w-4" />
                <span>Incoming Transfers</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500 text-white">{incomingTransfers.length}</span>
              </button>

              <button
                onClick={() => setActiveTab('network')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'network'
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>Hospital Network Nodes</span>
              </button>

              <button
                onClick={() => setActiveTab('audit')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'audit'
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <Lock className="h-4 w-4" />
                <span>Audit Logs</span>
              </button>

              <button
                onClick={() => setActiveTab('rag_assistant')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'rag_assistant'
                    ? 'bg-gradient-to-r from-brand-700 to-indigo-700 text-white shadow-md shadow-brand-700/20'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <Sparkles className="h-4 w-4 text-brand-500" />
                <span>Clinical RAG Assistant</span>
              </button>
            </>
          )}

          {/* PATIENT TABS */}
          {isPatient && (
            <>
              <button
                onClick={() => setActiveTab('my_doctors')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'my_doctors'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <Stethoscope className="h-4 w-4" />
                <span>My Treating Doctors & Hospitals</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20">{patientDoctors.length}</span>
              </button>

              <button
                onClick={() => setActiveTab('my_records')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'my_records'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>My Medical Record</span>
              </button>

              <button
                onClick={() => setActiveTab('consents')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'consents'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Consent & Transfer Requests</span>
              </button>

              <button
                onClick={() => setActiveTab('access_history')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'access_history'
                    ? 'bg-brand-600 text-white shadow-md shadow-brand-600/20'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <History className="h-4 w-4" />
                <span>Data Access History</span>
              </button>

              <button
                onClick={() => setActiveTab('rag_assistant')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'rag_assistant'
                    ? 'bg-gradient-to-r from-brand-700 to-indigo-700 text-white shadow-md shadow-brand-700/20'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <Sparkles className="h-4 w-4 text-brand-500" />
                <span>AI Health Assistant (RAG)</span>
              </button>
            </>
          )}

          {/* ADMIN TABS */}
          {isAdmin && (
            <>
              <button
                onClick={() => setActiveTab('security')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'security'
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <ShieldAlert className="h-4 w-4" />
                <span>Security & Compliance Center</span>
              </button>

              <button
                onClick={() => setActiveTab('research')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'research'
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <FlaskConical className="h-4 w-4" />
                <span>Research & Evaluation</span>
              </button>

              <button
                onClick={() => setActiveTab('patients')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'patients'
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>Hospital Patient Roster</span>
              </button>

              <button
                onClick={() => setActiveTab('network')}
                className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'network'
                    ? 'bg-brand-600 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 bg-white border border-slate-200'
                }`}
              >
                <Building2 className="h-4 w-4" />
                <span>Hospital Network Nodes</span>
              </button>
            </>
          )}

        </div>

        {/* Right Action Button for Doctor */}
        {isDoctor && (
          <button
            onClick={() => setIsAddPatientOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md shadow-brand-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Patient
          </button>
        )}
      </div>

      {/* 4. TAB VIEWS */}

      {/* DOCTOR VIEW: PATIENTS */}
      {(isDoctor || (isAdmin && activeTab === 'patients')) && activeTab === 'patients' && (
        <PatientTable 
          patients={patients}
          loading={loadingPatients}
          onRefresh={fetchPatients}
          onOpenAddPatient={() => setIsAddPatientOpen(true)}
          onViewDossier={(id) => setSelectedPatientIdForDossier(id)}
          onAddTest={handleOpenAddTest}
          onAddRecord={handleOpenAddRecord}
          onInitiateTransfer={handleInitiateTransfer}
        />
      )}

      {/* PATIENT VIEW: MY TREATING DOCTORS & HOSPITALS */}
      {isPatient && activeTab === 'my_doctors' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-brand-600" /> Doctors & Hospitals Associated with Your Treatment
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Doctors who have authorized treatment relationships with you can access your verified records. You can revoke authorization at any time.
              </p>
            </div>
            <button
              onClick={fetchPatientDoctors}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
              title="Refresh Doctors"
            >
              <RefreshCw className={`h-4 w-4 ${loadingDoctors ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {patientDoctors.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Stethoscope className="h-10 w-10 mx-auto text-slate-300 mb-2" />
              <p className="font-semibold text-slate-600">No doctors currently associated with your account.</p>
              <p className="text-xs text-slate-400 mt-1">When a doctor searches your ABHA ID and requests association, it will appear in your pending requests above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {patientDoctors.map((docAssoc) => {
                const isActive = docAssoc.status === 'ACTIVE' || docAssoc.status === 'ACCEPTED';
                const isRevoked = docAssoc.status === 'REVOKED';

                return (
                  <div 
                    key={docAssoc.id}
                    className={`p-5 rounded-2xl border transition-all ${
                      isActive ? 'bg-white border-slate-200 shadow-sm hover:border-brand-300' :
                      isRevoked ? 'bg-slate-50/60 border-slate-200 opacity-75' :
                      'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900 text-base flex items-center gap-2">
                          {docAssoc.doctor_name}
                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              ACTIVE
                            </span>
                          )}
                          {isRevoked && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                              REVOKED
                            </span>
                          )}
                          {docAssoc.status === 'COMPLETED' && (
                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                              COMPLETED
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-brand-600 font-semibold mt-0.5">
                          {docAssoc.doctor_specialty || docAssoc.specialization}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{docAssoc.hospital_name} ({docAssoc.hospital_city || 'Delhi NCR'})</span>
                        </div>
                      </div>

                      {isActive && (
                        <button
                          type="button"
                          onClick={() => handleRevokeAssociation(docAssoc.id, docAssoc.doctor_name)}
                          className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-semibold text-xs transition-colors cursor-pointer"
                        >
                          Revoke
                        </button>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div>
                        <span className="text-slate-400 block font-medium">Department</span>
                        <strong className="text-slate-800">{docAssoc.department || 'General Medicine'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block font-medium">Treatment Started</span>
                        <strong className="text-slate-800">{docAssoc.treatment_start_date ? new Date(docAssoc.treatment_start_date).toLocaleDateString() : 'Active'}</strong>
                      </div>
                      <div className="col-span-2 mt-1">
                        <span className="text-slate-400 block font-medium">Treatment Scope / Reason</span>
                        <span className="text-slate-700">{docAssoc.treatment_reason || docAssoc.purpose || 'Clinical care and treatment'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PATIENT VIEW: CONSENTS */}
      {isPatient && activeTab === 'consents' && (
        <ConsentCenter />
      )}

      {/* PATIENT VIEW: MY CLINICAL RECORDS */}
      {isPatient && activeTab === 'my_records' && myPatientRecord && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <FileText className="h-5 w-5 text-brand-600" /> Personal Medical Record Summary
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Verified clinical data aggregated across treating healthcare facilities under your ABHA identity.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-200 text-xs font-mono font-bold">
              {myPatientRecord.unique_health_id}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-brand-700">Demographics & Identity</h3>
              <div className="space-y-1 text-xs text-slate-700">
                <div><strong>Full Name:</strong> {myPatientRecord.name}</div>
                <div><strong>DOB:</strong> {myPatientRecord.dob}</div>
                <div><strong>Gender:</strong> {myPatientRecord.gender}</div>
                <div><strong>Blood Group:</strong> <span className="font-bold text-red-600">{myPatientRecord.blood_group}</span></div>
                <div><strong>Phone:</strong> {myPatientRecord.phone || 'N/A'}</div>
                <div><strong>Emergency Contact:</strong> {myPatientRecord.emergency_contact_name} ({myPatientRecord.emergency_contact_phone})</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-brand-700">Medical History & Allergies</h3>
              <div className="space-y-2 text-xs text-slate-700">
                <div>
                  <strong className="text-slate-900 block">Chronic Conditions:</strong>
                  <p className="text-slate-600">{myPatientRecord.medical_history || 'None recorded'}</p>
                </div>
                <div>
                  <strong className="text-red-700 block">Known Allergies:</strong>
                  <p className="text-red-600 font-semibold">{myPatientRecord.allergies || 'None documented'}</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider text-brand-700">Active Care Encounters</h3>
              <div className="space-y-1 text-xs text-slate-700">
                <div><strong>Total Documented Encounters:</strong> {myPatientRecord.visits?.length || 1}</div>
                <div><strong>Active Diagnoses:</strong> {myPatientRecord.visits?.[0]?.diagnosis || 'Outpatient management'}</div>
                <div><strong>Attending Physician:</strong> {myPatientRecord.visits?.[0]?.attending_doctor_name || 'Dr. Ramesh Sharma'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PATIENT VIEW: DATA ACCESS HISTORY */}
      {isPatient && activeTab === 'access_history' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                <History className="h-5 w-5 text-brand-600" /> Data Access & Audit Log
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Transparent cryptographic record of doctors and hospitals who accessed your personal health information.
              </p>
            </div>
            <button
              onClick={fetchPatientAuditHistory}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {patientAuditLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <ShieldCheck className="h-8 w-8 mx-auto text-slate-300 mb-2" />
              <span>No access events recorded yet for this session.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {patientAuditLogs.slice(0, 15).map((log) => (
                <div key={log.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded bg-brand-100 text-brand-800 text-[10px] font-mono">
                        {log.action}
                      </span>
                      <span>{log.purpose}</span>
                    </div>
                    <div className="text-slate-500 text-[11px]">
                      By: <strong className="text-slate-700">{log.user_name || 'Authorized Doctor'}</strong> ({log.role}) • IP: {log.ip_address}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400 font-mono">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* OUTGOING TRANSFERS TAB */}
      {(isDoctor || isAdmin) && activeTab === 'outgoing' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Outgoing Transfer Requests</h2>
              <p className="text-xs text-slate-500">Transfers dispatched from this clinical node to receiving destination facilities.</p>
            </div>
            <button
              onClick={fetchTransfers}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loadingTransfers ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {outgoingTransfers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <span>No outgoing transfer requests currently active.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {outgoingTransfers.map((t) => (
                <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{t.transfer_code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.consent_status === 'GRANTED' ? 'bg-emerald-100 text-emerald-800' :
                        t.consent_status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        Consent: {t.consent_status}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-bold">
                        Status: {t.transfer_status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1 max-w-xl">
                      {t.transfer_reason}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedTransferIdForDossier(t.id)}
                      className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-brand-700 border border-brand-200 font-bold text-xs cursor-pointer"
                    >
                      AI Handover & Dossier
                    </button>
                    {t.consent_status === 'GRANTED' && t.transfer_status === 'AUTHORIZED' && (
                      <button
                        onClick={() => handleDispatchPackage(t.id)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm cursor-pointer"
                      >
                        Sign & Dispatch Package
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* INCOMING TRANSFERS TAB */}
      {(isDoctor || isAdmin) && activeTab === 'incoming' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Incoming Transfer Queue</h2>
              <p className="text-xs text-slate-500">Transfers arriving at this hospital node awaiting admission confirmation.</p>
            </div>
            <button
              onClick={fetchTransfers}
              className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loadingTransfers ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {incomingTransfers.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              <span>No incoming transfers pending in queue.</span>
            </div>
          ) : (
            <div className="space-y-3">
              {incomingTransfers.map((t) => (
                <div key={t.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{t.transfer_code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        t.consent_status === 'GRANTED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        Consent: {t.consent_status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 mt-1 max-w-xl">
                      {t.transfer_reason}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedTransferIdForDossier(t.id)}
                      className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-sm cursor-pointer"
                    >
                      Receive & Review Clinical Package
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* NETWORK NODES TAB */}
      {activeTab === 'network' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">Hospital Network Nodes</h2>
              <p className="text-xs text-slate-500">Verified participant facilities in the MedTransfer Inter-Hospital Network.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hospitalsNetwork.map((hosp) => (
              <div key={hosp.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-bold text-slate-900 text-base">{hosp.name}</div>
                    <div className="text-xs text-brand-600 font-mono font-bold mt-0.5">{hosp.code}</div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
                    ONLINE
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-1">
                  <div><strong>Address:</strong> {hosp.address}, {hosp.city}</div>
                  <div><strong>Phone:</strong> {hosp.phone}</div>
                  <div><strong>Emergency Contact:</strong> {hosp.emergency_contact}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AUDIT LOGS TAB */}
      {(isDoctor || isAdmin) && activeTab === 'audit' && (
        <AuditTrailView />
      )}

      {/* ADMIN VIEWS */}
      {isAdmin && activeTab === 'security' && (
        <SecurityDashboard />
      )}

      {isAdmin && activeTab === 'research' && (
        <ResearchDashboard />
      )}

      {/* RAG ASSISTANT TAB VIEW (Doctor & Patient) */}
      {activeTab === 'rag_assistant' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
                  <Bot className="h-5 w-5 text-brand-600" />
                  {isDoctor ? 'Clinical Grounded RAG Record Assistant' : 'Personal Health RAG Assistant'}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isDoctor 
                    ? 'Query authorized EHR records, medications, allergies, diagnostic tests, and encounters with live factual source citations.'
                    : 'Ask questions in plain English about your health records, treatments, and active prescriptions.'}
                </p>
              </div>

              {isDoctor && patients.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">Select Patient:</span>
                  <select
                    value={selectedRagPatientId || (patients[0]?.id || '')}
                    onChange={(e) => setSelectedRagPatientId(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.unique_health_id || `P-${p.id}`}) — {p.blood_group || ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* RAG Assistant Interface */}
            <ClinicalRAGAssistant
              patientId={isPatient ? (user.patient_id || 1) : (selectedRagPatientId || patients[0]?.id || 1)}
              patientName={
                isPatient 
                  ? user.name 
                  : (patients.find(p => p.id === (selectedRagPatientId || patients[0]?.id))?.name || 'Selected Patient')
              }
              compact={false}
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Add / Link Patient Modal */}
      {isAddPatientOpen && (
        <AddPatientModal
          onClose={() => setIsAddPatientOpen(false)}
          onPatientAdded={() => {
            fetchPatients();
            refreshNotifications();
          }}
        />
      )}

      {/* Add Medical Record / Clinical Encounter Modal */}
      {selectedPatientForRecord && (
        <AddMedicalRecordModal
          patient={selectedPatientForRecord}
          onClose={() => setSelectedPatientForRecord(null)}
          onRecordAdded={() => {
            fetchPatients();
            refreshNotifications();
          }}
        />
      )}

      {/* Patient Dossier Modal */}
      {selectedPatientIdForDossier && (
        <PatientDossierModal
          patientId={selectedPatientIdForDossier}
          onClose={() => setSelectedPatientIdForDossier(null)}
          onAddTest={handleOpenAddTest}
          onInitiateTransfer={handleInitiateTransfer}
        />
      )}

      {/* Add Test Modal */}
      {selectedPatientForTest && selectedVisitForTest && (
        <AddTestModal
          patient={selectedPatientForTest}
          visit={selectedVisitForTest}
          onClose={() => {
            setSelectedPatientForTest(null);
            setSelectedVisitForTest(null);
          }}
          onTestAdded={() => {
            fetchPatients();
          }}
        />
      )}

      {/* Transfer Initiation Modal */}
      {selectedPatientForTransfer && (
        <TransferModal
          patient={selectedPatientForTransfer}
          onClose={() => setSelectedPatientForTransfer(null)}
          onTransferCreated={() => {
            fetchTransfers();
            refreshNotifications();
          }}
        />
      )}

      {/* Transfer Dossier Modal (AI Handover, FHIR, Relevance, Complexity) */}
      {selectedTransferIdForDossier && (
        <TransferDossierModal
          transferId={selectedTransferIdForDossier}
          onClose={() => setSelectedTransferIdForDossier(null)}
          onTransferUpdated={() => {
            fetchTransfers();
            refreshNotifications();
          }}
        />
      )}

      {/* Emergency Access Modal */}
      {emergencyTarget && (
        <EmergencyAccessModal
          target={emergencyTarget}
          onClose={() => setEmergencyTarget(null)}
          onAccessGranted={() => {
            fetchPatients();
          }}
        />
      )}

    </div>
  );
};
