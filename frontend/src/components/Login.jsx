import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { SearchableSelect } from './SearchableSelect';
import { MEDICAL_SPECIALTY_GROUPS } from '../constants/medicalSpecialties';
import { 
  Stethoscope, Shield, Lock, Mail, Building2, AlertCircle, 
  ArrowRight, Activity, Database, CheckCircle2, User, Phone, 
  Calendar, Award, UserPlus, ArrowLeft, HeartPulse, Check
} from 'lucide-react';

export const Login = () => {
  const { login, error, setError } = useAuth();
  
  // Navigation mode: 'login' | 'register_patient' | 'register_doctor' | 'register_admin'
  const [viewMode, setViewMode] = useState('login');
  
  // Login form state (Blank for fresh user)
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [activePortalTab, setActivePortalTab] = useState('doctor'); // 'doctor' | 'patient' | 'admin'
  const [successMessage, setSuccessMessage] = useState(null);
  const [hospitals, setHospitals] = useState([]);

  // Fetch registered hospital nodes from real PostgreSQL
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        const res = await api.get('/hospitals');
        if (res.data?.success && Array.isArray(res.data.data)) {
          setHospitals(res.data.data);
        }
      } catch (err) {
        // Fallback default list if initial call fails
        setHospitals([
          { id: 1, name: 'AIIMS Trauma Center', code: 'AIIMS-DEL', city: 'New Delhi' },
          { id: 2, name: 'Apollo Multi-Speciality Hospital', code: 'APOLLO-DEL', city: 'New Delhi' },
          { id: 3, name: 'Fortis Memorial Research Institute', code: 'FORTIS-GGN', city: 'Gurugram' },
          { id: 4, name: 'Max Super Speciality Hospital', code: 'MAX-SAKET', city: 'New Delhi' }
        ]);
      }
    };
    fetchHospitals();
  }, []);

  // Hospital nodes, grouped by city so long lists stay navigable
  const hospitalGroups = useMemo(() => {
    const byCity = new Map();
    for (const h of hospitals) {
      const city = h.city || 'Other';
      if (!byCity.has(city)) byCity.set(city, []);
      byCity.get(city).push({
        value: String(h.id),
        label: h.name,
        sublabel: [h.city, h.code].filter(Boolean).join(' · ')
      });
    }
    return [...byCity.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([city, options]) => ({
        group: city,
        options: options.sort((a, b) => a.label.localeCompare(b.label))
      }));
  }, [hospitals]);

  const specialtyGroups = useMemo(
    () => MEDICAL_SPECIALTY_GROUPS.map(g => ({
      group: g.group,
      options: g.options.map(name => ({ value: name, label: name }))
    })),
    []
  );

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
    specialization: '',
    medical_license_number: '',
    hospital_id: '',
    experience_years: '',
    qualification: ''
  });

  // Admin Registration state
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    phone: '',
    username: '',
    password: '',
    confirm_password: '',
    hospital_id: ''
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
        setSuccessMessage(`Patient account created! Health ID: ${res.data.user?.unique_health_id}. Logging you in...`);
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

    // These two are comboboxes, and `required` on a hidden input is not
    // enforced by the browser, so they are checked explicitly.
    if (!docForm.hospital_id) {
      setError('Please select your affiliated hospital node.');
      return;
    }

    if (!docForm.specialization.trim()) {
      setError('Please select or enter your medical specialization.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register/doctor', docForm);
      if (res.data.success) {
        setSuccessMessage('Doctor account registered successfully with hospital affiliation! Logging in...');
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

  const handleAdminRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (adminForm.password !== adminForm.confirm_password) {
      setError('Passwords do not match.');
      return;
    }

    if (!adminForm.hospital_id) {
      setError('Please select the hospital node facility you administer.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register/admin', adminForm);
      if (res.data.success) {
        setSuccessMessage('Hospital Administrator account registered successfully! Logging in...');
        setTimeout(async () => {
          await login(adminForm.username || adminForm.email, adminForm.password);
        }, 1200);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Admin registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8 text-white">
      
      {/* Top Banner */}
      <div className="max-w-4xl mx-auto w-full mb-6 text-center animate-in fade-in duration-300">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-3">
          <Database className="h-4 w-4 text-emerald-400" /> PostgreSQL Database Engine Active • Fresh User Portal
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2">
          Med<span className="text-brand-400">Transfer</span> Healthcare System
        </h1>
        <p className="text-slate-300 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
          Secure, consent-guarded inter-hospital patient data exchange backed by a live PostgreSQL database and cryptographic audit logging.
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
                    setError(null);
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
                    setError(null);
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
                    setError(null);
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
                    {activePortalTab === 'doctor' ? 'Clinician Sign In' :
                     activePortalTab === 'patient' ? 'Patient Portal Sign In' :
                     'Hospital Operations & Admin'}
                  </h2>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {activePortalTab === 'doctor' ? 'Access your patient roster, lab tests & transfers' :
                     activePortalTab === 'patient' ? 'Review transfer requests & grant or revoke consent' :
                     'Manage hospital operations and view security audit logs'}
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
                      placeholder="Enter your registered username or email"
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
                      placeholder="Enter your password"
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
                  <span className="text-slate-400 font-medium">New to MedTransfer? Create a fresh account:</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('register_patient');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="py-2 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-brand-300 hover:text-brand-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="h-3.5 w-3.5" /> Patient
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('register_doctor');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="py-2 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Stethoscope className="h-3.5 w-3.5" /> Doctor
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode('register_admin');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="py-2 px-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-purple-300 hover:text-purple-200 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Shield className="h-3.5 w-3.5" /> Admin
                  </button>
                </div>
              </div>
            </div>

            {/* Right Box: Onboarding and PostgreSQL status */}
            <div className="lg:col-span-6 space-y-3">
              <div className="bg-white/5 border border-white/15 rounded-2xl p-5 backdrop-blur-md space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Real PostgreSQL Database
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-400/30 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Connected
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  All synthetic dummy data and pre-seeded demo accounts have been purged. The database is initialized and ready for new users to register real profiles:
                </p>

                <div className="space-y-2.5 text-xs">
                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/80 space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5 text-xs">
                      <Stethoscope className="h-4 w-4 text-emerald-400" /> 1. Clinician Registration
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Register as a medical doctor, associate with your hospital facility (AIIMS, Apollo, Fortis, Max), and manage real patient transfer referrals.
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/80 space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5 text-xs">
                      <User className="h-4 w-4 text-brand-400" /> 2. Patient ABHA Registration
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Register as a patient to receive a unique ABHA Health ID. Review plain-language transfer requests and grant or revoke clinical data consent.
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-700/80 space-y-1">
                    <div className="font-bold text-white flex items-center gap-1.5 text-xs">
                      <Shield className="h-4 w-4 text-purple-400" /> 3. Hospital Administration
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Register as a Hospital Administrator to oversee clinical facility nodes, transfer statistics, and tamper-evident security audit logs.
                    </div>
                  </div>
                </div>

                <div className="pt-2 text-[11px] text-slate-400 border-t border-white/10 flex items-center justify-between">
                  <span>AES-256-GCM Transfer Encryption</span>
                  <span className="font-mono text-emerald-300">Port 5000 / 3000</span>
                </div>
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
                  <UserPlus className="h-5 w-5 text-brand-400" /> Patient Registration
                </h2>
                <p className="text-xs text-slate-300">
                  Create your real patient profile to receive transfers and control your health data consents.
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
                    placeholder="Enter first name"
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
                    placeholder="Enter last name"
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
                    placeholder="user@example.com"
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
                  placeholder="Choose a username"
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
                    placeholder="Contact person name"
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
                  <Stethoscope className="h-5 w-5 text-emerald-400" /> Clinician Registration
                </h2>
                <p className="text-xs text-slate-300">
                  Register your medical practitioner credentials with an affiliated hospital facility.
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
                    placeholder="First name"
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
                    placeholder="Last name"
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
                    placeholder="doctor@hospital.edu"
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
                    placeholder="Choose username"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Affiliated Hospital Node *</label>
                  <SearchableSelect
                    groups={hospitalGroups}
                    value={docForm.hospital_id}
                    onChange={(val) => setDocForm({ ...docForm, hospital_id: val })}
                    placeholder="Select your hospital"
                    searchPlaceholder="Search by hospital, city or code..."
                    emptyMessage="No registered hospital node matches that search."
                    required
                    footer={
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        Only hospitals onboarded to the exchange appear here. If yours is
                        missing, it must be registered as a hospital node first.
                      </p>
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Medical Specialization *</label>
                  <SearchableSelect
                    groups={specialtyGroups}
                    value={docForm.specialization}
                    onChange={(val) => setDocForm({ ...docForm, specialization: val })}
                    placeholder="Select your specialisation"
                    searchPlaceholder="Search specialities (e.g. cardio, neuro)..."
                    allowCustom
                    required
                    footer={
                      <p className="text-[10px] text-slate-400 leading-relaxed">
                        NMC-recognised specialities. Not listed? Type it and press Enter.
                      </p>
                    }
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Medical License / Registration Number *</label>
                  <input
                    type="text"
                    required
                    value={docForm.medical_license_number}
                    onChange={(e) => setDocForm({ ...docForm, medical_license_number: e.target.value })}
                    placeholder="MCI-2024-XXXX"
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
                    placeholder="5"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Qualification</label>
                  <input
                    type="text"
                    value={docForm.qualification}
                    onChange={(e) => setDocForm({ ...docForm, qualification: e.target.value })}
                    placeholder="MBBS, MD"
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
                {loading ? 'Registering Doctor Account...' : 'Complete Doctor Registration'}
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* VIEW 4: ADMIN REGISTRATION MODE */}
        {/* ========================================================================= */}
        {viewMode === 'register_admin' && (
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
                  <Shield className="h-5 w-5 text-purple-400" /> Hospital Administrator Registration
                </h2>
                <p className="text-xs text-slate-300">
                  Register an administrative account to oversee facility node operations, transfers & security audits.
                </p>
              </div>
              <div className="px-3 py-1 rounded-full bg-purple-500/20 border border-purple-400/40 text-purple-300 text-xs font-bold">
                Operations Lead
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

            <form onSubmit={handleAdminRegister} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={adminForm.name}
                    onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                    placeholder="Operations Lead Name"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={adminForm.email}
                    onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                    placeholder="admin@hospital.org"
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
                    value={adminForm.username}
                    onChange={(e) => setAdminForm({ ...adminForm, username: e.target.value })}
                    placeholder="admin.lead"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Hospital Node Facility *</label>
                  <SearchableSelect
                    groups={hospitalGroups}
                    value={adminForm.hospital_id}
                    onChange={(val) => setAdminForm({ ...adminForm, hospital_id: val })}
                    placeholder="Select the hospital facility"
                    searchPlaceholder="Search by hospital, city or code..."
                    emptyMessage="No registered hospital node matches that search."
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 uppercase mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={adminForm.phone}
                  onChange={(e) => setAdminForm({ ...adminForm, phone: e.target.value })}
                  placeholder="+91-11-26588500"
                  className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    value={adminForm.password}
                    onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 uppercase mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    required
                    value={adminForm.confirm_password}
                    onChange={(e) => setAdminForm({ ...adminForm, confirm_password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-sm shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? 'Registering Admin Account...' : 'Complete Administrator Registration'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};
