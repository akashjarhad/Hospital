import React, { useState } from 'react';
import api from '../api/axios';
import { 
  X, Stethoscope, Heart, Activity, AlertCircle, CheckCircle2, 
  FlaskConical, Plus, Trash2, FileText, Save
} from 'lucide-react';

export const AddMedicalRecordModal = ({ patient, onClose, onRecordAdded }) => {
  const [diagnosis, setDiagnosis] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [status, setStatus] = useState('ADMITTED');
  const [vitals, setVitals] = useState({
    heart_rate: 76,
    blood_pressure: '120/80',
    spo2: 98,
    temperature: 98.6
  });

  const [testName, setTestName] = useState('');
  const [testCategory, setTestCategory] = useState('Laboratory');
  const [testResult, setTestResult] = useState('');
  const [testUnits, setTestUnits] = useState('');
  const [testAbnormal, setTestAbnormal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!patient) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!diagnosis.trim()) {
      setError('Diagnosis is required.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const tests = testName.trim() && testResult.trim() ? [{
        test_name: testName.trim(),
        category: testCategory,
        result: testResult.trim(),
        units: testUnits.trim(),
        abnormal: testAbnormal
      }] : [];

      const payload = {
        diagnosis: diagnosis.trim(),
        chief_complaint: chiefComplaint.trim(),
        clinical_notes: clinicalNotes.trim(),
        status,
        vitals,
        tests
      };

      const res = await api.post(`/patients/${patient.id || patient.patient_id}/medical-records`, payload);
      if (res.data.success) {
        if (onRecordAdded) onRecordAdded(res.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add clinical medical record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-900 via-slate-900 to-brand-950 p-5 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded-full bg-brand-500/30 text-brand-200 text-xs font-mono font-bold">
              {patient.unique_health_id || 'ABHA-ID'}
            </span>
            <span className="text-xs text-slate-400">• Clinical Treatment Encounter</span>
          </div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-brand-400" /> Add Medical Record: {patient.name}
          </h2>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Current Diagnosis *</label>
              <input
                type="text"
                required
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                placeholder="e.g. Acute Angina Pectoris, Mild Dyslipidemia"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 uppercase mb-1">Encounter Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="ADMITTED">Admitted / Active Treatment</option>
                <option value="OBSERVATION">Under Observation</option>
                <option value="CRITICAL">Critical Care</option>
                <option value="DISCHARGED">Discharged / Outpatient</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Chief Complaint</label>
            <input
              type="text"
              value={chiefComplaint}
              onChange={(e) => setChiefComplaint(e.target.value)}
              placeholder="e.g. Retrosternal chest tightness radiating to left arm for 2 hours"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 uppercase mb-1">Clinical Evaluation & Treatment Plan</label>
            <textarea
              rows={3}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Document physician findings, prescribed medications, dosages, and ongoing treatment directions..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-sm focus:bg-white focus:ring-2 focus:ring-brand-500 focus:outline-none resize-none"
            />
          </div>

          {/* Vitals */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <Activity className="h-4 w-4 text-brand-600" /> Recorded Vital Signs
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Blood Pressure</label>
                <input
                  type="text"
                  value={vitals.blood_pressure}
                  onChange={(e) => setVitals({ ...vitals, blood_pressure: e.target.value })}
                  placeholder="120/80"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Heart Rate (bpm)</label>
                <input
                  type="number"
                  value={vitals.heart_rate}
                  onChange={(e) => setVitals({ ...vitals, heart_rate: parseInt(e.target.value, 10) || 72 })}
                  placeholder="76"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">SpO2 (%)</label>
                <input
                  type="number"
                  value={vitals.spo2}
                  onChange={(e) => setVitals({ ...vitals, spo2: parseInt(e.target.value, 10) || 98 })}
                  placeholder="98"
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
                  placeholder="98.6"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* Optional Lab Test */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
              <FlaskConical className="h-4 w-4 text-brand-600" /> Diagnostic / Lab Investigation (Optional)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Test Name</label>
                <input
                  type="text"
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder="e.g. 12-Lead ECG / Troponin-I"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Category</label>
                <select
                  value={testCategory}
                  onChange={(e) => setTestCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                >
                  <option value="Cardiology">Cardiology</option>
                  <option value="Laboratory">Laboratory</option>
                  <option value="Imaging">Imaging / Radiology</option>
                  <option value="Pathology">Pathology</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase font-semibold">Result Value</label>
                <input
                  type="text"
                  value={testResult}
                  onChange={(e) => setTestResult(e.target.value)}
                  placeholder="e.g. 0.08 ng/mL (Elevated)"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white font-bold rounded-xl shadow-md shadow-brand-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              <span>{loading ? 'Saving Record...' : 'Save Medical Record'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
