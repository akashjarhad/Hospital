import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { 
  Stethoscope, Shield, Lock, Mail, Building2, AlertCircle, 
  ArrowRight, Activity, Zap, CheckCircle2, User, Phone, 
  Calendar, Award, UserPlus, Sparkles, ArrowLeft, HeartPulse
} from 'lucide-react';

export const Login = () => {
  const { login, error, setError } = useAuth();
  
  // Navigation mode: 'login' | 'register_patient' | 'register_doctor'
  const [viewMode, setViewMode] = useState('login');
  
  // Login form state
  const [identifier, setIdentifier] = useState('dr.ramesh@aiims.edu.in');
  const [password, setPassword] = useState('doctor123');
  const [loading, setLoading] = useState(false);
  const [activePortalTab, setActivePortalTab] = useState('doctor'); // 'doctor' | 'patient' | 'admin'
  const [successMessage, setSuccessMessage] = useState(null);

  // Patient Registration state
  const [patForm, setPatForm] = useState({
    first_name: '',
    last_name: '',
    dob: '',
    gender: 'Male',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirm_password: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    blood_group: 'O+'
  });

  // Doctor Registration state
  const [docForm, setDocForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirm_password: '',
    specialization: 'Emergency Medicine & Trauma',
    medical_license_number: '',
    hospital_id: '1',
    experience_years: '5',
    qualification: 'MBBS, MD'
  });

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    if (!identifier || !password) {
      setError('Please enter both Email/Username and Password.');
      return;
    }
    setLoading(true);
    setSuccessMessage(null);
    await login(identifier, password);
    setLoading(false);
  };

  const handleQuickLogin = async (demoIdent, demoPass) => {
    setIdentifier(demoIdent);
    setPassword(demoPass);
    setLoading(true);
    setSuccessMessage(null);
    await login(demoIdent, demoPass);
    setLoading(false);
  };

  const handlePatientRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (patForm.password !== patForm.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register/patient', patForm);
      if (res.data.success) {
        setSuccessMessage(`Patient account registered successfully! Health ID: ${res.data.user?.unique_health_id}. Logging you in...`);
        setTimeout(async () => {
          await login(patForm.username || patForm.email, patForm.password);
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Patient registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (docForm.password !== docForm.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register/doctor', docForm);
      if (res.data.success) {
        setSuccessMessage(`Doctor account created successfully! Hospital verification approved. Logging in...`);
        setTimeout(async () => {
          await login(docForm.username || docForm.email, docForm.password);
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Doctor registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 text-white">
      
      {/* Top Academic Context Banner */}
      <div className="max-w-4xl mx-auto w-full mb-6 text-center animate-in fade-in duration-300">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-3">
          <Activity className="h-4 w-4" /> B.Tech Academic Project: AI-Assisted Inter-Hospital Patient Transfer System
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
          Med<span className="text-brand-400">Transfer</span> Healthcare Portal
        </h1>
        <p className="text-slate-300 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
          Cryptographically guarded patient data exchange system with doctor–patient treatment associations, patient-mediated consent, and clinical AI handovers.
        </p>
      </div>

      <div className="max-w-4xl mx-auto w-full">
        
        {/* ========================================================================= */}
        {/* VIEW 1: SIGN IN MODE */}
        {/* ========================================================================= */}
        {viewMode === 'login' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Box: Login Form */}
            <div className="lg:col-span-6 bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 sm:p-7 shadow-2xl space-y-4">
              
              {/* Portal Selector Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-900/60 rounded-xl border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => {
                    setActivePortalTab('doctor');
                    setIdentifier('dr.ramesh@aiims.edu.in');
                    setPassword('doctor123');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activePortalTab === 'doctor'
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Stethoscope className="h-3.5 w-3.5" /> Doctor
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActivePortalTab('patient');
                    setIdentifier('patient@demo.local');
                    setPassword('patient123');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activePortalTab === 'patient'
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <User className="h-3.5 w-3.5" /> Patient
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActivePortalTab('admin');
                    setIdentifier('admin@aiims.edu.in');
                    setPassword('admin123');
                  }}
                  className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    activePortalTab === 'admin'
                      ? 'bg-brand-500 text-white shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Shield className="h-3.5 w-3.5" /> Admin
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {activePortalTab === 'doctor' ? 'Doctor Sign In' :
                     activePortalTab === 'patient' ? 'Patient Portal Sign In' :
                     'Hospital Operations & Security'}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {activePortalTab === 'doctor' ? 'Access your associated patient list and transfer requests' :
                     activePortalTab === 'patient' ? 'Manage doctor treatment associations & transfer consents' :
                     'Hospital node audit logs and security monitoring'}
                  </p>
                </div>
                <div className="h-9 w-9 rounded-xl bg-brand-500/30 border border-brand-400/40 flex items-center justify-center text-brand-300">
                  <Lock className="h-4 w-4" />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                  <span>{error}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                  <span>{successMessage}</span>
                </div>
              )}

              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Email or Username
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Mail className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="Username or email"
                      className="w-full pl-10 pr-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <Lock className="h-4 w-4" />
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-4 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 px-4 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  {loading ? (
                    <span>Authenticating...</span>
                  ) : (
                    <>
                      <span>Sign In</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Registration Options Footer */}
              <div className="pt-3 border-t border-slate-700/60 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Don't have an account?</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('register_patient');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-brand-300 hover:text-brand-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Patient Register
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('register_doctor');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="py-1.5 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Stethoscope className="h-3.5 w-3.5" /> Doctor Register
                  </button>
                </div>
              </div>
            </div>

            {/* Right Box: Demo Credentials & Quick Switch */}
            <div className="lg:col-span-6 space-y-3">
              <div className="bg-white/5 border border-white/15 rounded-2xl p-5 backdrop-blur-md space-y-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400 fill-amber-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                    Quick Demo Credentials
                  </h3>
                </div>

                <div className="space-y-2 text-xs">
                  <div 
                    onClick={() => handleQuickLogin('dr.ramesh@aiims.edu.in', 'doctor123')}
                    className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-700/80 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-brand-400" /> Dr. Ramesh Sharma
                      </div>
                      <div className="text-[11px] text-slate-400">AIIMS Trauma Lead • Username: <code className="text-brand-300">dr.ramesh</code></div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 text-[10px] font-bold">1-Click</span>
                  </div>

                  <div 
                    onClick={() => handleQuickLogin('dr.priya@apollo.com', 'doctor123')}
                    className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-700/80 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-brand-400" /> Dr. Priya Patel
                      </div>
                      <div className="text-[11px] text-slate-400">Apollo Cardiology • Username: <code className="text-brand-300">dr.priya</code></div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-brand-500/20 text-brand-300 text-[10px] font-bold">1-Click</span>
                  </div>

                  <div 
                    onClick={() => handleQuickLogin('patient@demo.local', 'patient123')}
                    className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-700/80 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-emerald-400" /> Rajesh Kumar (Patient)
                      </div>
                      <div className="text-[11px] text-slate-400">ABHA: P-10001 • Username: <code className="text-emerald-300">patient.rajesh</code></div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">1-Click</span>
                  </div>

                  <div 
                    onClick={() => handleQuickLogin('admin@aiims.edu.in', 'admin123')}
                    className="p-2.5 rounded-xl bg-slate-900/60 hover:bg-slate-800 border border-slate-700/80 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5 text-purple-400" /> Rajesh Verma (AIIMS Admin)
                      </div>
                      <div className="text-[11px] text-slate-400">Hospital Admin • Username: <code className="text-purple-300">admin.aiims</code></div>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">1-Click</span>
                  </div>
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-brand-950/40 border border-brand-500/20 text-xs text-slate-300">
                <span className="font-bold text-brand-300">RBAC Security:</span> Strict server-side authorization pipeline: Authentication ➔ Role Authorization ➔ Doctor-Patient Relationship ➔ Consent Scope ➔ AI/ML Processing ➔ Audit Log.
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 2: PATIENT REGISTRATION MODE */}
        {/* ========================================================================= */}
        {viewMode === 'register_patient' && (
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4 max-w-2xl mx-auto animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login');
                    setError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                </button>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-brand-400" /> Patient Self-Registration
                </h2>
                <p className="text-xs text-slate-300">
                  Create your personal patient portal account to receive treatment and control data transfers.
                </p>
              </div>
              <div className="px-3 py-1 rounded-full bg-brand-500/20 border border-brand-400/40 text-brand-300 text-xs font-bold">
                Auto-ABHA ID
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handlePatientRegister} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={patForm.first_name}
                    onChange={(e) => setPatForm({ ...patForm, first_name: e.target.value })}
                    placeholder="Rahul"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={patForm.last_name}
                    onChange={(e) => setPatForm({ ...patForm, last_name: e.target.value })}
                    placeholder="Patil"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Date of Birth *</label>
                  <input
                    type="date"
                    required
                    value={patForm.dob}
                    onChange={(e) => setPatForm({ ...patForm, dob: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Gender *</label>
                  <select
                    value={patForm.gender}
                    onChange={(e) => setPatForm({ ...patForm, gender: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Blood Group</label>
                  <select
                    value={patForm.blood_group}
                    onChange={(e) => setPatForm({ ...patForm, blood_group: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
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
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={patForm.email}
                    onChange={(e) => setPatForm({ ...patForm, email: e.target.value })}
                    placeholder="rahul.patil@example.com"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={patForm.phone}
                    onChange={(e) => setPatForm({ ...patForm, phone: e.target.value })}
                    placeholder="+91-9876543210"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">Username *</label>
                <input
                  type="text"
                  required
                  value={patForm.username}
                  onChange={(e) => setPatForm({ ...patForm, username: e.target.value })}
                  placeholder="rahul.patil"
                  className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={patForm.password}
                    onChange={(e) => setPatForm({ ...patForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={patForm.confirm_password}
                    onChange={(e) => setPatForm({ ...patForm, confirm_password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Emergency Contact Name</label>
                  <input
                    type="text"
                    value={patForm.emergency_contact_name}
                    onChange={(e) => setPatForm({ ...patForm, emergency_contact_name: e.target.value })}
                    placeholder="Pooja Patil (Spouse)"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Emergency Contact Phone</label>
                  <input
                    type="tel"
                    value={patForm.emergency_contact_phone}
                    onChange={(e) => setPatForm({ ...patForm, emergency_contact_phone: e.target.value })}
                    placeholder="+91-9876543211"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-brand-500 hover:bg-brand-400 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-brand-500/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Creating Account & ABHA Health ID...' : 'Complete Patient Registration'}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 3: DOCTOR REGISTRATION MODE */}
        {/* ========================================================================= */}
        {viewMode === 'register_doctor' && (
          <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4 max-w-2xl mx-auto animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('login');
                    setError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 mb-1 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
                </button>
                <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-emerald-400" /> Doctor Self-Registration
                </h2>
                <p className="text-xs text-slate-300">
                  Register your medical practitioner credentials with an affiliated hospital.
                </p>
              </div>
              <div className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                Hospital Affiliated
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {successMessage && (
              <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-400" />
                <span>{successMessage}</span>
              </div>
            )}

            <form onSubmit={handleDoctorRegister} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">First Name *</label>
                  <input
                    type="text"
                    required
                    value={docForm.first_name}
                    onChange={(e) => setDocForm({ ...docForm, first_name: e.target.value })}
                    placeholder="Amit"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Last Name *</label>
                  <input
                    type="text"
                    required
                    value={docForm.last_name}
                    onChange={(e) => setDocForm({ ...docForm, last_name: e.target.value })}
                    placeholder="Sharma"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={docForm.email}
                    onChange={(e) => setDocForm({ ...docForm, email: e.target.value })}
                    placeholder="dr.amit@hospital.edu.in"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={docForm.phone}
                    onChange={(e) => setDocForm({ ...docForm, phone: e.target.value })}
                    placeholder="+91-9811009988"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Username *</label>
                  <input
                    type="text"
                    required
                    value={docForm.username}
                    onChange={(e) => setDocForm({ ...docForm, username: e.target.value })}
                    placeholder="dr.amitsharma"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Affiliated Hospital *</label>
                  <select
                    value={docForm.hospital_id}
                    onChange={(e) => setDocForm({ ...docForm, hospital_id: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  >
                    <option value="1">AIIMS Trauma Center (New Delhi)</option>
                    <option value="2">Apollo Multi-Speciality Hospital (New Delhi)</option>
                    <option value="3">Fortis Memorial Research Institute (Gurugram)</option>
                    <option value="4">Max Super Speciality Hospital (Saket)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Medical Specialization *</label>
                  <input
                    type="text"
                    required
                    value={docForm.specialization}
                    onChange={(e) => setDocForm({ ...docForm, specialization: e.target.value })}
                    placeholder="Cardiology / Trauma / Pulmonology"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Medical Registration / License Number *</label>
                  <input
                    type="text"
                    required
                    value={docForm.medical_license_number}
                    onChange={(e) => setDocForm({ ...docForm, medical_license_number: e.target.value })}
                    placeholder="MCI-2016-1011"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Years of Experience</label>
                  <input
                    type="number"
                    value={docForm.experience_years}
                    onChange={(e) => setDocForm({ ...docForm, experience_years: e.target.value })}
                    placeholder="8"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Qualification</label>
                  <input
                    type="text"
                    value={docForm.qualification}
                    onChange={(e) => setDocForm({ ...docForm, qualification: e.target.value })}
                    placeholder="MBBS, MD, DM (Cardiology)"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={docForm.password}
                    onChange={(e) => setDocForm({ ...docForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={docForm.confirm_password}
                    onChange={(e) => setDocForm({ ...docForm, confirm_password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Registering Doctor Account...' : 'Register Doctor Account'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
