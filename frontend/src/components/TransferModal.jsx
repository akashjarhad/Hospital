import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { 
  X, ArrowUpRight, ShieldCheck, AlertCircle, Building2, 
  Stethoscope, CheckCircle2, Lock, FileText, Check, AlertTriangle, Loader2 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AVAILABLE_CATEGORIES = [
  { id: 'Patient Demographics', label: 'Patient Demographics', desc: 'Age, Gender, Blood Group, Phone', default: true },
  { id: 'Emergency Contact', label: 'Emergency Contact', desc: 'Next of kin & contact details', default: true },
  { id: 'Medical History', label: 'Medical History', desc: 'Past chronic conditions & clinical background', default: true },
  { id: 'Current Diagnosis', label: 'Current Diagnosis', desc: 'Primary admission diagnosis & chief complaints', default: true },
  { id: 'Allergies', label: 'Allergies & Adverse Reactions', desc: 'Drug, food, and environmental hypersensitivities', default: true },
  { id: 'Current Medications', label: 'Current In-Patient Medications', desc: 'Active intravenous and oral regimens', default: true },
  { id: 'Previous Medications', label: 'Previous Chronic Medications', desc: 'Home maintenance drugs prior to admission', default: false },
  { id: 'Laboratory Reports', label: 'Laboratory Reports', desc: 'Hematology, Cardiac Biomarkers, ABG, Biochemistry', default: true },
  { id: 'Diagnostic Reports', label: 'Diagnostic Reports', desc: 'ECG, Echocardiography, Pathological findings', default: true },
  { id: 'Imaging Reports', label: 'Imaging & Radiology Reports', desc: 'Chest X-Ray, FAST Ultrasound, CT scans', default: true },
  { id: 'Clinical Notes', label: 'Attending Clinical Notes', desc: 'Physician daily progress notes and vitals', default: false },
  { id: 'Doctor Transfer Summary', label: 'Doctor Transfer Evaluation', desc: 'Referral narrative and transportation stability', default: true },
];

export const TransferModal = ({ patient, onClose, onTransferCreated }) => {
  const { hospital, user } = useAuth();
  const [networkHospitals, setNetworkHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState('');
  const [receivingDoctors, setReceivingDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  
  const [clinicalPriority, setClinicalPriority] = useState('URGENT');
  const [transferReason, setTransferReason] = useState('Emergency referral for urgent primary Percutaneous Coronary Intervention (PCI) and dedicated cardiac cath lab intervention.');
  const [transferSummary, setTransferSummary] = useState(
    patient ? `Patient presented with acute clinical distress. Hemodynamically stabilized on inotropic support for inter-hospital transit.` : ''
  );

  const [selectedCategories, setSelectedCategories] = useState(
    AVAILABLE_CATEGORIES.filter(c => c.default).map(c => c.id)
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Fetch destination hospitals (excluding self)
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const res = await api.get('/hospitals');
        if (res.data.success) {
          const others = res.data.data.filter(h => h.id !== hospital?.id);
          setNetworkHospitals(others);
          if (others.length > 0) {
            setSelectedHospitalId(String(others[0].id));
          }
        }
      } catch (err) {
        console.error('Error fetching hospitals:', err);
      }
    };

    fetchHospitals();
  }, [hospital]);

  const toggleCategory = (catId) => {
    if (selectedCategories.includes(catId)) {
      setSelectedCategories(selectedCategories.filter(c => c !== catId));
    } else {
      setSelectedCategories([...selectedCategories, catId]);
    }
  };

  const handleSelectAllCategories = () => {
    setSelectedCategories(AVAILABLE_CATEGORIES.map(c => c.id));
  };

  const handleClearCategories = () => {
    setSelectedCategories(['Patient Demographics', 'Current Diagnosis']);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedHospitalId || !transferReason) {
      setError('Please select a destination hospital and enter the transfer reason.');
      return;
    }

    if (selectedCategories.length === 0) {
      setError('Please select at least one clinical data category to share (Data Minimization).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const payload = {
        patient_id: patient.id,
        destination_hospital_id: parseInt(selectedHospitalId, 10),
        receiving_doctor_id: selectedDoctorId ? parseInt(selectedDoctorId, 10) : null,
        transfer_reason: transferReason,
        clinical_priority: clinicalPriority,
        requested_data: selectedCategories,
        doctor_transfer_summary: transferSummary,
        visit_id: patient.latest_visit?.id || patient.visit_id || null
      };

      const res = await api.post('/transfers', payload);
      if (res.data.success) {
        if (onTransferCreated) {
          onTransferCreated(res.data.data.transfer);
        }
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to initiate transfer request.');
    } finally {
      setLoading(false);
    }
  };

  if (!patient) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-900 via-slate-900 to-brand-950 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-brand-500/20 text-brand-300 flex items-center justify-center border border-brand-400/30">
              <ArrowUpRight className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-500/30 text-brand-200 border border-brand-400/30 uppercase tracking-wider">
                Step 1: Transfer Request Dispatch
              </span>
              <h2 className="text-xl font-extrabold text-white mt-0.5">
                Initiate Inter-Hospital Patient Transfer
              </h2>
            </div>
          </div>

          <div className="mt-3 p-3 rounded-xl bg-white/10 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="text-slate-400">Patient:</span>{' '}
              <strong className="text-white">{patient.name}</strong> ({patient.gender}, {patient.dob})
            </div>
            <div>
              <span className="text-slate-400">ABHA Health ID:</span>{' '}
              <span className="font-mono font-bold text-brand-300">{patient.unique_health_id}</span>
            </div>
            <div>
              <span className="text-slate-400">Blood Group:</span>{' '}
              <span className="font-bold text-red-300">{patient.blood_group || 'O+'}</span>
            </div>
          </div>
        </div>

        {/* Body Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Transfer Destination & Priority */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-brand-600" />
              1. Receiving Hospital & Clinical Priority
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Destination Hospital Node *
                </label>
                <select
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                  required
                >
                  {networkHospitals.map(h => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.code}) — {h.city}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-400 mt-1">Verified ABDM partner facility in network</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Clinical Priority *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['ROUTINE', 'URGENT', 'EMERGENCY'].map((pri) => (
                    <button
                      key={pri}
                      type="button"
                      onClick={() => setClinicalPriority(pri)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        clinicalPriority === pri
                          ? pri === 'EMERGENCY'
                            ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/30'
                            : pri === 'URGENT'
                            ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/30'
                            : 'bg-brand-600 text-white border-brand-600 shadow-md shadow-brand-600/30'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {pri}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  {clinicalPriority === 'EMERGENCY' ? 'Requires rapid dispatch' : 'Standard scheduled transfer'}
                </p>
              </div>

            </div>
          </div>

          {/* Section 2: Clinical Justification */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Stethoscope className="h-4 w-4 text-brand-600" />
              2. Clinical Reason & Physician Referral Summary
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Transfer Clinical Reason *
              </label>
              <input
                type="text"
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="e.g. Specialized cardiac catheterization and primary PCI cath-lab intervention."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Doctor Transfer Summary (Physician Evaluation Notes)
              </label>
              <textarea
                value={transferSummary}
                onChange={(e) => setTransferSummary(e.target.value)}
                rows={3}
                placeholder="Enter clinical summary of patient condition, medications running during transit, and precautions..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 focus:bg-white"
              />
            </div>
          </div>

          {/* Section 3: Data Minimization & Category Selector */}
          <div className="space-y-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-brand-600" />
                  3. Data Minimization — Select Medical Categories to Share
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Strictly select only categories needed for receiving physician's care. Billing & unrelated data are excluded.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllCategories}
                  className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 cursor-pointer"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleClearCategories}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-700 cursor-pointer"
                >
                  Minimal Scope
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {AVAILABLE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat.id);
                return (
                  <div
                    key={cat.id}
                    onClick={() => toggleCategory(cat.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 select-none ${
                      isSelected
                        ? 'bg-brand-50/70 border-brand-300 text-slate-900 shadow-sm'
                        : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-100/60'
                    }`}
                  >
                    <div className={`mt-0.5 h-4 w-4 rounded flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'bg-brand-600 text-white' : 'border border-slate-300 bg-white'
                    }`}>
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div>
                      <div className="text-xs font-bold leading-tight">{cat.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-normal">{cat.desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Privacy Guarantee Box */}
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2.5">
              <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div>
                <strong className="font-bold">Consent-Guarded Exchange:</strong>{' '}
                This request will be routed to the patient for digital consent approval before any clinical data is decrypted or made visible to Hospital B.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Submitting Transfer Request...</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="h-4 w-4" />
                  <span>Submit Request & Await Patient Consent</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
