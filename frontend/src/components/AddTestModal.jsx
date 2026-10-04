import React, { useState } from 'react';
import api from '../api/axios';
import { 
  X, FlaskConical, AlertTriangle, CheckCircle2, ShieldAlert, 
  HelpCircle, ArrowRight, Loader2, Sparkles, Database
} from 'lucide-react';

const COMMON_TESTS = [
  'Troponin-I (High Sensitivity)',
  'Complete Blood Count (CBC)',
  'Arterial Blood Gas (ABG)',
  '12-Lead Electrocardiogram (ECG)',
  'Serum Creatinine & Urea',
  'Serum Electrolytes (Na+, K+, Cl-)',
  'Liver Function Test (LFT)',
  'Prothrombin Time / INR',
  'Blood Culture & Sensitivity',
  'Chest X-Ray (AP View)',
  'FAST Ultrasonography (Abdomen)',
  'CT Brain (Plain)',
  'NT-proBNP (Cardiac Biomarker)',
  'Serum Lactate'
];

export const AddTestModal = ({ patient, visit, onClose, onTestAdded }) => {
  const [testName, setTestName] = useState('');
  const [category, setCategory] = useState('Laboratory');
  const [result, setResult] = useState('');
  const [units, setUnits] = useState('');
  const [referenceRange, setReferenceRange] = useState('');
  const [abnormal, setAbnormal] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Duplicate Check State
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);

  // Run Rule-Based 24-Hour Duplicate Check
  const handleTestNameChange = async (name) => {
    setTestName(name);
    setDuplicateWarning(null);
    setDuplicateAcknowledged(false);

    if (name.trim().length >= 3 && patient?.id) {
      setCheckingDuplicate(true);
      try {
        const res = await api.post('/tests/check-duplicate', {
          patient_id: patient.id,
          test_name: name.trim()
        });
        if (res.data.success && res.data.isDuplicate) {
          setDuplicateWarning({
            message: res.data.message,
            matches: res.data.matches
          });
        }
      } catch (err) {
        console.warn('Duplicate check error:', err);
      } finally {
        setCheckingDuplicate(false);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!testName || !result) {
      setError('Test name and result are required.');
      return;
    }

    // If duplicate detected and not yet acknowledged by doctor
    if (duplicateWarning && !duplicateAcknowledged) {
      setError('Please acknowledge the 24-hour duplicate test warning before submitting.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/tests', {
        visit_id: visit.id,
        test_name: testName.trim(),
        category,
        result: result.trim(),
        units: units.trim(),
        reference_range: referenceRange.trim(),
        abnormal,
        notes: notes.trim()
      });

      if (res.data.success) {
        onTestAdded(res.data.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to record diagnostic test.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 to-brand-900 p-5 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-brand-500/20 text-brand-300 flex items-center justify-center border border-brand-400/30">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Record Diagnostic Test</h3>
              <p className="text-xs text-slate-300">
                Patient: <span className="font-bold text-white">{patient?.name}</span> ({patient?.unique_health_id})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {error && (
            <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Test Name & Quick Suggestions */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Test / Investigation Name *
              </label>
              {checkingDuplicate && (
                <span className="text-[10px] text-brand-600 font-semibold flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Checking 24h history...
                </span>
              )}
            </div>
            <input
              type="text"
              value={testName}
              onChange={(e) => handleTestNameChange(e.target.value)}
              placeholder="e.g. Troponin-I (High Sensitivity)"
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              required
            />
            
            {/* Quick Picker */}
            <div className="mt-2 flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {COMMON_TESTS.slice(0, 6).map((item) => (
                <button
                  type="button"
                  key={item}
                  onClick={() => handleTestNameChange(item)}
                  className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-brand-50 text-[10px] font-medium text-slate-600 hover:text-brand-700 border border-slate-200 transition-colors cursor-pointer"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {/* RULE-BASED 24-HOUR DUPLICATE WARNING MODAL / BANNER */}
          {duplicateWarning && (
            <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 text-amber-900 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                    Duplicate Diagnostic Test Detected (Past 24 Hours)
                  </div>
                  <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                    {duplicateWarning.message}
                  </p>
                </div>
              </div>

              {/* Exact Details of Past Test */}
              {duplicateWarning.matches && duplicateWarning.matches.length > 0 && (
                <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-[11px] space-y-1">
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-600">Previous Test:</span>
                    <strong className="text-slate-900">{duplicateWarning.matches[0].test_name}</strong>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-600">Previous Result:</span>
                    <strong className="text-slate-900">{duplicateWarning.matches[0].result} {duplicateWarning.matches[0].units}</strong>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-600">Recorded At:</span>
                    <span>{new Date(duplicateWarning.matches[0].timestamp).toLocaleString()} ({duplicateWarning.matches[0].hospital_name})</span>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-amber-200 flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={duplicateAcknowledged}
                    onChange={(e) => setDuplicateAcknowledged(e.target.checked)}
                    className="h-4 w-4 rounded border-amber-400 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-[11px] font-bold text-amber-950">
                    Clinical justification: Re-order repeated test anyway
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Category & Units Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white"
              >
                <option value="Laboratory">Laboratory</option>
                <option value="Cardiac Markers">Cardiac Markers</option>
                <option value="Radiology & Imaging">Radiology & Imaging</option>
                <option value="Hematology">Hematology</option>
                <option value="Microbiology">Microbiology</option>
                <option value="Critical Care / ABG">Critical Care / ABG</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Units of Measurement
              </label>
              <input
                type="text"
                value={units}
                onChange={(e) => setUnits(e.target.value)}
                placeholder="e.g. ng/mL, mg/dL, mmol/L"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
              />
            </div>
          </div>

          {/* Test Result & Reference Range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Diagnostic Result *
              </label>
              <input
                type="text"
                value={result}
                onChange={(e) => setResult(e.target.value)}
                placeholder="e.g. 4.82 or Normal Sinus"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 font-bold font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Reference Range
              </label>
              <input
                type="text"
                value={referenceRange}
                onChange={(e) => setReferenceRange(e.target.value)}
                placeholder="e.g. < 0.04 ng/mL"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 font-mono"
              />
            </div>
          </div>

          {/* Abnormal Flag & Notes */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
            <input
              type="checkbox"
              id="abnormalFlag"
              checked={abnormal}
              onChange={(e) => setAbnormal(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
            />
            <label htmlFor="abnormalFlag" className="text-xs font-bold text-slate-800 cursor-pointer">
              Mark as Clinically Abnormal / Critical Alert Result
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Physician / Pathologist Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Sample hemolysis noted, cross-check with 6h troponin series..."
              rows={2}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900"
            />
          </div>

          {/* Submit Actions */}
          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || (duplicateWarning && !duplicateAcknowledged)}
              className="px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-brand-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Recording...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" /> Save Lab Result
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
