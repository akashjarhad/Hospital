import React, { useState } from 'react';
import api from '../api/axios';
import { 
  X, UserPlus, Heart, Activity, AlertCircle, CheckCircle2, 
  FlaskConical, Plus, Trash2, Shield, Sparkles, Loader2, Stethoscope,
  Search, UserCheck, Send, ArrowRight
} from 'lucide-react';

export const AddPatientModal = ({ onClose, onPatientAdded }) => {
  // Modal Mode: 'search_link' (Doctor searching & linking registered patient) vs 'admit_inpatient' (Direct Admission)
  const [modalTab, setModalTab] = useState('search_link');

  // Search & Link State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [department, setDepartment] = useState('Cardiology');
  const [treatmentReason, setTreatmentReason] = useState('Clinical Consultation & Treatment');
  const [requestSending, setRequestSending] = useState(false);
  const [searchMessage, setSearchMessage] = useState(null);

  // Direct Admission Step Navigation
  const [currentStep, setCurrentStep] = useState(1); // 1: Patient, 2: Visit & Vitals, 3: Tests

  // Patient Info State
  const [uniqueHealthId, setUniqueHealthId] = useState('');
  const [name, setName] = useState('');
  const [dob, setDob] = useState('1985-06-15');
  const [gender, setGender] = useState('Male');
  const [bloodGroup, setBloodGroup] = useState('B+');
  const [phone, setPhone] = useState('+91-');
  const [emergencyContactName, setEmergencyContactName] = useState('');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('+91-');
  const [medicalHistory, setMedicalHistory] = useState('');
  const [allergies, setAllergies] = useState('None known');

  // Visit & Vitals State
  const [diagnosis, setDiagnosis] = useState('');
  const [status, setStatus] = useState('admitted');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [vitals, setVitals] = useState({
    heart_rate: 88,
    blood_pressure: '120/80',
    spo2: 98,
    temperature: 98.6,
    respiratory_rate: 18
  });

  // Dynamic Initial Tests Array
  const [tests, setTests] = useState([
    {
      test_name: 'Complete Blood Count (CBC)',
      category: 'Hematology',
      result: 'Hb 13.5 g/dL, TLC 8,200/mcL',
      units: 'Multi',
      reference_range: 'Hb 12-16',
      abnormal: false,
      notes: 'Initial admission baseline'
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Search Registered Patients
  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery || searchQuery.trim().length < 2) {
      setError('Please enter at least 2 characters to search.');
      return;
    }

    setSearching(true);
    setError(null);
    setSearchMessage(null);
    try {
      const res = await api.get(`/patients/doctor/search?q=${encodeURIComponent(searchQuery.trim())}`);
      if (res.data.success) {
        setSearchResults(res.data.data);
        if (res.data.data.length === 0) {
          setSearchMessage('No registered patients found matching your search term.');
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to search registered patients.');
    } finally {
      setSearching(false);
    }
  };

  // Send Association Request to Selected Registered Patient
  const handleSendAssociationRequest = async (patientItem) => {
    setRequestSending(true);
    setError(null);
    setSearchMessage(null);

    try {
      const res = await api.post('/patients/doctor/request-association', {
        patient_id: patientItem.id,
        department: department.trim() || 'General Medicine',
        treatment_reason: treatmentReason.trim() || 'Clinical Consultation'
      });

      if (res.data.success) {
        setSearchMessage(`Association request sent to ${patientItem.name}! The patient has been notified to accept.`);
        // Refresh search results to show PENDING
        handleSearch();
        if (onPatientAdded) onPatientAdded(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send association request.');
    } finally {
      setRequestSending(false);
    }
  };

  // Auto-generate ABHA Unique Health ID for direct intake
  const handleGenerateAbhaId = () => {
    const p1 = Math.floor(1000 + Math.random() * 9000);
    const p2 = Math.floor(1000 + Math.random() * 9000);
    const p3 = Math.floor(1000 + Math.random() * 9000);
    setUniqueHealthId(`ABHA-${p1}-${p2}-${p3}`);
  };

  const handleAddTestRow = () => {
    setTests([
      ...tests,
      {
        test_name: '',
        category: 'Laboratory',
        result: '',
        units: '',
        reference_range: '',
        abnormal: false,
        notes: ''
      }
    ]);
  };

  const handleRemoveTestRow = (index) => {
    setTests(tests.filter((_, i) => i !== index));
  };

  const handleTestFieldChange = (index, field, value) => {
    const updated = [...tests];
    updated[index][field] = value;
    setTests(updated);
  };

  // Direct Admission Submit
  const handleDirectAdmissionSubmit = async (e) => {
    e.preventDefault();
    if (!name || !dob || !gender || !diagnosis) {
      setError('Please complete all mandatory clinical fields (Name, DOB, Gender, Diagnosis).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        unique_health_id: uniqueHealthId,
        name: name.trim(),
        dob,
        gender,
        blood_group: bloodGroup,
        phone: phone.trim(),
        emergency_contact_name: emergencyContactName.trim(),
        emergency_contact_phone: emergencyContactPhone.trim(),
        medical_history: medicalHistory.trim(),
        allergies: allergies.trim(),
        diagnosis: diagnosis.trim(),
        status,
        chief_complaint: chiefComplaint.trim(),
        clinical_notes: clinicalNotes.trim(),
        vitals,
        tests: tests.filter(t => t.test_name && t.result)
      };

      const res = await api.post('/patients', payload);
      if (res.data.success) {
        onPatientAdded(res.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to admit patient.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-900 via-slate-900 to-brand-950 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-brand-500/30 border border-brand-400/40 text-brand-200 text-xs font-bold uppercase tracking-wider">
              Doctor Treatment Management
            </span>
          </div>
          <h2 className="text-2xl font-extrabold text-white flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-brand-400" /> Add Patient to My Care
          </h2>
          <p className="text-slate-300 text-xs mt-1">
            Search registered patients to send treatment association requests, or register a direct emergency inpatient.
          </p>

          {/* Mode Switcher Tabs */}
          <div className="mt-4 flex rounded-xl bg-slate-900/60 p-1 border border-white/10 max-w-md">
            <button
              type="button"
              onClick={() => {
                setModalTab('search_link');
                setError(null);
                setSearchMessage(null);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                modalTab === 'search_link'
                  ? 'bg-brand-500 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Search className="h-3.5 w-3.5" /> Search Registered Patient
            </button>
            <button
              type="button"
              onClick={() => {
                setModalTab('admit_inpatient');
                setError(null);
                setSearchMessage(null);
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                modalTab === 'admit_inpatient'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Stethoscope className="h-3.5 w-3.5" /> Direct Inpatient Admission
            </button>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Success Message Banner */}
        {searchMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 text-xs flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{searchMessage}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 1: SEARCH & LINK REGISTERED PATIENT */}
        {/* ========================================================================= */}
        {modalTab === 'search_link' && (
          <div className="p-6 space-y-5">
            {/* Search Input Box */}
            <form onSubmit={handleSearch} className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase">
                Search Patient (By Name, ABHA ID, Phone, Email, Username)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Search className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. Rahul Patil, P-10001, or +91-9811..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searching}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md shadow-brand-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>
            </form>

            {/* Department & Purpose Input for New Association */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase flex items-center gap-1.5">
                <Stethoscope className="h-4 w-4 text-brand-600" /> Treatment Association Scope
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Clinical Department</label>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Cardiology, Pulmonology, Trauma"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-600 mb-1">Treatment Reason / Purpose</label>
                  <input
                    type="text"
                    value={treatmentReason}
                    onChange={(e) => setTreatmentReason(e.target.value)}
                    placeholder="e.g. Cardiology consultation and treatment"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Search Results List */}
            {searchResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase">
                  <span>Search Results ({searchResults.length})</span>
                  <span className="text-[11px] text-slate-400 font-normal">Demographics masked for privacy</span>
                </div>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-brand-300 shadow-sm flex flex-wrap items-center justify-between gap-3 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-sm">{item.name}</span>
                          <span className="px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-xs font-mono font-bold">
                            {item.unique_health_id}
                          </span>
                          {item.blood_group && (
                            <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 text-[10px] font-bold">
                              {item.blood_group}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 flex items-center gap-3">
                          <span>DOB: <code className="text-slate-600">{item.dob_masked}</code></span>
                          <span>Gender: {item.gender}</span>
                          <span>Status: <strong className="text-slate-700">{item.association_status}</strong></span>
                        </div>
                      </div>

                      <div>
                        {item.is_already_associated ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Active Patient
                          </span>
                        ) : item.is_pending_request ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">
                            Request Pending
                          </span>
                        ) : (
                          <button
                            type="button"
                            disabled={requestSending}
                            onClick={() => handleSendAssociationRequest(item)}
                            className="px-3.5 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-sm flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                          >
                            <Send className="h-3.5 w-3.5" /> Add to My Patients
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* MODE 2: DIRECT INPATIENT ADMISSION (3-STEP FORM) */}
        {/* ========================================================================= */}
        {modalTab === 'admit_inpatient' && (
          <form onSubmit={handleDirectAdmissionSubmit}>
            {/* Step Wizard Header */}
            <div className="px-6 pt-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className={`py-2 px-3 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                    currentStep === 1
                      ? 'border-brand-600 text-brand-600 bg-brand-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  1. Patient Demographics
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className={`py-2 px-3 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                    currentStep === 2
                      ? 'border-brand-600 text-brand-600 bg-brand-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  2. Encounter & Vitals
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className={`py-2 px-3 text-xs font-bold rounded-t-lg border-b-2 transition-all cursor-pointer ${
                    currentStep === 3
                      ? 'border-brand-600 text-brand-600 bg-brand-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  3. Diagnostic Tests
                </button>
              </div>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4 text-xs">
              {/* STEP 1: PATIENT DEMOGRAPHICS */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">ABHA Health Identifier</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={uniqueHealthId}
                          onChange={(e) => setUniqueHealthId(e.target.value)}
                          placeholder="e.g. ABHA-1001-2002-3003"
                          className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono w-64"
                        />
                        <button
                          type="button"
                          onClick={handleGenerateAbhaId}
                          className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Generate
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Patient Full Name *</label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Rajesh Kumar"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        required
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Gender *</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Blood Group</label>
                      <select
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      >
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91-9811..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Emergency Contact Name</label>
                      <input
                        type="text"
                        value={emergencyContactName}
                        onChange={(e) => setEmergencyContactName(e.target.value)}
                        placeholder="Sunita Kumar (Spouse)"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Emergency Contact Phone</label>
                      <input
                        type="tel"
                        value={emergencyContactPhone}
                        onChange={(e) => setEmergencyContactPhone(e.target.value)}
                        placeholder="+91-9811..."
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Medical History</label>
                    <textarea
                      rows={2}
                      value={medicalHistory}
                      onChange={(e) => setMedicalHistory(e.target.value)}
                      placeholder="Hypertension, Diabetes, prior surgeries..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm resize-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Known Allergies</label>
                    <input
                      type="text"
                      value={allergies}
                      onChange={(e) => setAllergies(e.target.value)}
                      placeholder="Penicillin, Aspirin..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: ENCOUNTER & VITALS */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Admission Diagnosis *</label>
                      <input
                        type="text"
                        required
                        value={diagnosis}
                        onChange={(e) => setDiagnosis(e.target.value)}
                        placeholder="Acute Coronary Syndrome / NSTEMI"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Acuity Status</label>
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                      >
                        <option value="admitted">Admitted</option>
                        <option value="critical">Critical Care</option>
                        <option value="observation">Observation</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Chief Complaint</label>
                    <input
                      type="text"
                      value={chiefComplaint}
                      onChange={(e) => setChiefComplaint(e.target.value)}
                      placeholder="Severe retrosternal chest pain with diaphoresis..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase mb-1">Initial Clinical Notes</label>
                    <textarea
                      rows={3}
                      value={clinicalNotes}
                      onChange={(e) => setClinicalNotes(e.target.value)}
                      placeholder="Physician initial evaluation, hemodynamics, initial orders..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm resize-none"
                    />
                  </div>

                  {/* Vitals Grid */}
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <h4 className="font-bold text-slate-800 text-xs">Vital Signs at Triage</h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase font-semibold">Blood Pressure</label>
                        <input
                          type="text"
                          value={vitals.blood_pressure}
                          onChange={(e) => setVitals({ ...vitals, blood_pressure: e.target.value })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase font-semibold">Heart Rate (bpm)</label>
                        <input
                          type="number"
                          value={vitals.heart_rate}
                          onChange={(e) => setVitals({ ...vitals, heart_rate: parseInt(e.target.value, 10) || 80 })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase font-semibold">SpO2 (%)</label>
                        <input
                          type="number"
                          value={vitals.spo2}
                          onChange={(e) => setVitals({ ...vitals, spo2: parseInt(e.target.value, 10) || 98 })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 uppercase font-semibold">Temp (°F)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={vitals.temperature}
                          onChange={(e) => setVitals({ ...vitals, temperature: parseFloat(e.target.value) || 98.6 })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: INITIAL TESTS */}
              {currentStep === 3 && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-700 uppercase">Initial Diagnostic Tests</span>
                    <button
                      type="button"
                      onClick={handleAddTestRow}
                      className="px-2.5 py-1 bg-brand-50 text-brand-600 hover:bg-brand-100 rounded-lg font-bold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Test
                    </button>
                  </div>

                  {tests.map((test, index) => (
                    <div key={index} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-500 uppercase font-semibold">Test Name</label>
                          <input
                            type="text"
                            value={test.test_name}
                            onChange={(e) => handleTestFieldChange(index, 'test_name', e.target.value)}
                            placeholder="Complete Blood Count"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 uppercase font-semibold">Category</label>
                          <select
                            value={test.category}
                            onChange={(e) => handleTestFieldChange(index, 'category', e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          >
                            <option value="Laboratory">Laboratory</option>
                            <option value="Cardiology">Cardiology</option>
                            <option value="Hematology">Hematology</option>
                            <option value="Imaging">Imaging</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-500 uppercase font-semibold">Result Value</label>
                          <input
                            type="text"
                            value={test.result}
                            onChange={(e) => handleTestFieldChange(index, 'result', e.target.value)}
                            placeholder="Hb 13.5 g/dL"
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <label className="inline-flex items-center gap-1.5 text-xs text-slate-600">
                          <input
                            type="checkbox"
                            checked={test.abnormal}
                            onChange={(e) => handleTestFieldChange(index, 'abnormal', e.target.checked)}
                            className="rounded text-brand-600"
                          />
                          <span>Abnormal Finding</span>
                        </label>
                        {tests.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTestRow(index)}
                            className="text-red-500 hover:text-red-700 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Step Navigation Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div>
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep - 1)}
                    className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-semibold cursor-pointer"
                  >
                    Back
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-200 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                {currentStep < 3 ? (
                  <button
                    type="button"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-md cursor-pointer flex items-center gap-1"
                  >
                    Next Step <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {loading ? 'Admitting Inpatient...' : 'Complete Inpatient Admission'}
                  </button>
                )}
              </div>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};
