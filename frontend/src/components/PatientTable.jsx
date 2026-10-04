import React, { useState } from 'react';
import { 
  Search, Filter, Plus, ArrowUpRight, FileText, FlaskConical, 
  Heart, AlertTriangle, Stethoscope, Clock, ShieldAlert, CheckCircle2,
  RefreshCw, User, Activity
} from 'lucide-react';

export const PatientTable = ({ 
  patients = [], 
  loading = false, 
  onRefresh, 
  onOpenAddPatient, 
  onViewDossier, 
  onAddTest, 
  onAddRecord,
  onInitiateTransfer 
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Filter patients based on search and status
  const filteredPatients = patients.filter(patient => {
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery = 
      !query ||
      patient.name?.toLowerCase().includes(query) ||
      patient.unique_health_id?.toLowerCase().includes(query) ||
      patient.latest_visit?.diagnosis?.toLowerCase().includes(query) ||
      patient.diagnosis?.toLowerCase().includes(query);

    const visitStatus = patient.latest_visit?.status || patient.visit_status || 'admitted';
    const matchesStatus = statusFilter === 'all' || visitStatus === statusFilter;

    return matchesQuery && matchesStatus;
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      
      {/* Table Action Bar */}
      <div className="p-5 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        
        {/* Search & Filter Inputs */}
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Patient Name, ABHA ID, or Diagnosis..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all shadow-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-brand-500 shadow-sm"
            >
              <option value="all">All Patient Statuses</option>
              <option value="critical">Critical / ICU Only</option>
              <option value="admitted">Admitted In-Patients</option>
              <option value="observation">Under Observation</option>
              <option value="discharged">Discharged</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={onRefresh}
            title="Refresh clinical roster"
            className="p-2 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 transition-colors shadow-sm cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
          </button>

          <button
            onClick={onOpenAddPatient}
            className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md shadow-brand-600/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Admit New Patient
          </button>
        </div>

      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-extrabold tracking-wider border-b border-slate-200">
            <tr>
              <th className="px-5 py-3.5">Patient Details & Health ID</th>
              <th className="px-4 py-3.5">Current Diagnosis</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Admission Vitals</th>
              <th className="px-4 py-3.5">Attending Physician</th>
              <th className="px-5 py-3.5 text-right">Clinical Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {loading && patients.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                  <Activity className="h-6 w-6 animate-spin mx-auto text-brand-600 mb-2" />
                  <span>Loading admitted patients dataset...</span>
                </td>
              </tr>
            ) : filteredPatients.length === 0 ? (
              <tr>
                <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                  <User className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                  <p className="font-semibold text-slate-600">No matching patient records found.</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Try adjusting search criteria or click "Admit New Patient" above.</p>
                </td>
              </tr>
            ) : (
              filteredPatients.map((p) => {
                const visit = p.latest_visit || {
                  diagnosis: p.diagnosis || 'Clinical evaluation',
                  status: p.visit_status || 'admitted',
                  vitals: p.vitals || {},
                  admission_date: p.admission_date,
                  attending_doctor_name: p.attending_doctor_name
                };

                const isCritical = visit.status === 'critical';

                return (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Patient Column */}
                    <td className="px-5 py-4">
                      <div className="flex items-start gap-3">
                        <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0 border border-brand-200">
                          {p.blood_group || 'O+'}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                            {p.name}
                            {p.allergies && !p.allergies.toLowerCase().includes('none') && (
                              <span 
                                title={`Allergy alert: ${p.allergies}`}
                                className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold border border-red-200"
                              >
                                Allergy: {p.allergies.split(',')[0]}
                              </span>
                            )}
                          </div>
                          <div className="font-mono text-[11px] text-brand-600 font-semibold mt-0.5">
                            {p.unique_health_id}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {p.gender} • DOB: {p.dob}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Diagnosis Column */}
                    <td className="px-4 py-4 max-w-[220px]">
                      <div className="font-semibold text-slate-900 leading-snug">
                        {visit.diagnosis}
                      </div>
                      {visit.chief_complaint && (
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {visit.chief_complaint}
                        </div>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                        isCritical 
                          ? 'bg-red-100 text-red-800 border border-red-300 animate-pulse' 
                          : visit.status === 'observation'
                          ? 'bg-amber-100 text-amber-800 border border-amber-300'
                          : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          isCritical ? 'bg-red-600' : visit.status === 'observation' ? 'bg-amber-600' : 'bg-emerald-600'
                        }`}></span>
                        {visit.status}
                      </span>
                    </td>

                    {/* Admission Vitals */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {visit.vitals && (visit.vitals.heart_rate || visit.vitals.blood_pressure) ? (
                        <div className="space-y-0.5 font-mono text-[11px]">
                          <div className="text-slate-800">
                            <span className="text-slate-400">HR:</span> <strong>{visit.vitals.heart_rate || '--'}</strong> bpm | <span className="text-slate-400">BP:</span> <strong>{visit.vitals.blood_pressure || '--'}</strong>
                          </div>
                          <div className="text-brand-700">
                            <span className="text-slate-400">SpO2:</span> <strong>{visit.vitals.spo2 || '--'}%</strong> | <span className="text-slate-400">Temp:</span> {visit.vitals.temperature || '--'}°F
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px]">No vitals logged</span>
                      )}
                    </td>

                    {/* Attending Doctor */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-800 font-medium">
                        <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                        <span>{visit.attending_doctor_name || 'Dr. Attending'}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {visit.admission_date ? new Date(visit.admission_date).toLocaleDateString() : 'Active'}
                      </div>
                    </td>

                    {/* Action Buttons */}
                    <td className="px-5 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        
                        {/* View Dossier */}
                        <button
                          onClick={() => onViewDossier(p.id)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer"
                          title="View complete raw medical record"
                        >
                          <FileText className="h-3.5 w-3.5 text-slate-500" />
                          <span>Record</span>
                        </button>

                        {/* Add Medical Record */}
                        {onAddRecord && (
                          <button
                            onClick={() => onAddRecord(p)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer border border-emerald-200"
                            title="Add clinical encounter and treatment note"
                          >
                            <Stethoscope className="h-3.5 w-3.5" />
                            <span>+ Note</span>
                          </button>
                        )}

                        {/* Add Lab Test */}
                        <button
                          onClick={() => onAddTest(p, visit)}
                          className="px-2.5 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-xs flex items-center gap-1 transition-colors cursor-pointer border border-brand-200"
                          title="Add lab test result"
                        >
                          <FlaskConical className="h-3.5 w-3.5" />
                          <span>+ Test</span>
                        </button>

                        {/* Initiate Inter-Hospital Transfer */}
                        <button
                          onClick={() => onInitiateTransfer(p)}
                          className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm shadow-brand-600/30 transition-all cursor-pointer"
                          title="Transfer patient to another hospital"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          <span>Transfer</span>
                        </button>

                      </div>
                    </td>

                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer */}
      <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-wrap items-center justify-between text-xs text-slate-500">
        <div>
          Showing <strong>{filteredPatients.length}</strong> of <strong>{patients.length}</strong> total patients scoped to current hospital
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
          <span>Live Clinical Database Scoped • Zero Patient-OTP Dependency</span>
        </div>
      </div>

    </div>
  );
};
