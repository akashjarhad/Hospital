import React, { useState } from 'react';
import api from '../api/axios';
import { 
  X, AlertTriangle, ShieldAlert, Clock, Lock, 
  CheckCircle2, Heart, Activity, ArrowRight, Loader2 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const EmergencyAccessModal = ({ patientId, patientName, transferId, onClose, onAccessGranted }) => {
  const { user } = useAuth();
  const [reason, setReason] = useState(
    'Patient is in acute cardiac shock / unconscious and requires immediate life-saving cath-lab surgical intervention.'
  );
  const [durationHours, setDurationHours] = useState(4);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 10) {
      setError('Please provide a comprehensive medical justification (minimum 10 characters).');
      return;
    }

    if (!confirmed) {
      setError('Please acknowledge the legal and compliance audit disclaimer.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.post('/emergency-access/request', {
        patient_id: patientId,
        transfer_id: transferId || null,
        reason: reason.trim(),
        duration_hours: durationHours
      });

      if (res.data.success) {
        if (onAccessGranted) onAccessGranted(res.data);
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Emergency break-glass authorization failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border-2 border-red-500/40 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header with High-Alert Theme */}
        <div className="bg-gradient-to-r from-red-900 via-slate-900 to-red-950 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/40 animate-pulse">
              <ShieldAlert className="h-6 w-6 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/30 text-red-200 border border-red-400/40 uppercase tracking-wider">
                High-Privilege Security Override
              </span>
              <h2 className="text-xl font-extrabold text-white mt-0.5">
                Break-Glass Emergency Medical Access
              </h2>
            </div>
          </div>

          <p className="text-xs text-red-200 mt-2 leading-relaxed">
            Emergency protocol for unconscious or incapacitated patients requiring immediate life-saving care without standard patient consent latency.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Patient Context */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Target Patient:</span>
              <strong className="text-slate-900 text-sm">{patientName || `Patient #${patientId}`}</strong>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Invoking Physician:</span>
              <span className="font-bold text-slate-800">{user?.name} ({user?.role})</span>
            </div>
          </div>

          {/* Medical Justification */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase tracking-wider">
              Emergency Clinical Justification *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Detail the urgent clinical condition, state of consciousness, and life risk justifying consent override..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              This justification is permanently inscribed into the hospital compliance audit store.
            </p>
          </div>

          {/* Emergency Scope Box */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs space-y-2">
            <span className="font-bold text-amber-900 flex items-center gap-1.5">
              <Lock className="h-4 w-4 text-amber-600" />
              Emergency Data Minimization Scope (Auto-Released):
            </span>
            <div className="grid grid-cols-2 gap-1.5 text-[11px] text-amber-950 font-medium">
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-amber-600" /> Allergies & Drug Reactions</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-amber-600" /> Current Medications</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-amber-600" /> Critical Medical History</div>
              <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-amber-600" /> Recent Lab & Cardiac Biomarkers</div>
            </div>
          </div>

          {/* Duration Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Authorized Emergency Window
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[2, 4, 8].map((hrs) => (
                <button
                  key={hrs}
                  type="button"
                  onClick={() => setDurationHours(hrs)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                    durationHours === hrs
                      ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/30'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {hrs} Hours
                </button>
              ))}
            </div>
          </div>

          {/* Mandatory Compliance Checkbox */}
          <div className="p-3 rounded-xl bg-red-50/50 border border-red-200 flex items-start gap-3">
            <input
              type="checkbox"
              id="confirmBreakGlass"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded text-red-600 focus:ring-red-500 border-slate-300 cursor-pointer"
            />
            <label htmlFor="confirmBreakGlass" className="text-[11px] text-red-900 leading-snug cursor-pointer select-none">
              <strong>Compliance Acknowledgment:</strong> I certify that this emergency access is clinically mandatory for emergency treatment. I understand this action notifies the patient and is reviewed by hospital administration.
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !confirmed}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Authorizing Override...</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="h-4 w-4" />
                  <span>Authorize Break-Glass Access</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
