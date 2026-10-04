import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, ShieldCheck, LogOut, Stethoscope, 
  Activity, Bell, User, Zap, ChevronDown, ShieldAlert, UserCheck 
} from 'lucide-react';
import { NotificationsModal } from './NotificationsModal';

export const Navbar = ({ onOpenConsentCenter, onOpenSecurityDashboard }) => {
  const { user, hospital, patient, logout, switchAccount, unreadCount } = useAuth();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [isAccountDropdownOpen, setIsAccountDropdownOpen] = useState(false);

  if (!user) return null;

  const role = (user.role || '').toUpperCase();
  const isDoctor = role === 'DOCTOR';
  const isPatient = role === 'PATIENT';
  const isAdmin = role === 'HOSPITAL_ADMIN' || role === 'SYSTEM_ADMIN';

  const demoAccounts = [
    { label: 'Dr. Ramesh Sharma (AIIMS Trauma Center)', email: 'dr.ramesh@aiims.edu.in', pass: 'doctor123', role: 'DOCTOR', icon: <Stethoscope className="h-3.5 w-3.5 text-emerald-500" /> },
    { label: 'Dr. Priya Patel (Apollo Hospital)', email: 'dr.priya@apollo.com', pass: 'doctor123', role: 'DOCTOR', icon: <Stethoscope className="h-3.5 w-3.5 text-emerald-500" /> },
    { label: 'Dr. Amit Sengupta (Fortis Hospital)', email: 'dr.amit@fortis.in', pass: 'doctor123', role: 'DOCTOR', icon: <ShieldAlert className="h-3.5 w-3.5 text-red-500" /> },
    { label: 'AIIMS Hospital Admin', email: 'admin@aiims.edu.in', pass: 'admin123', role: 'HOSPITAL_ADMIN', icon: <ShieldCheck className="h-3.5 w-3.5 text-purple-500" /> },
    { label: 'System Security Admin', email: 'sysadmin@medtransfer.demo', pass: 'sysadmin123', role: 'SYSTEM_ADMIN', icon: <ShieldCheck className="h-3.5 w-3.5 text-amber-500" /> }
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Brand Logo & Platform Title */}
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
                <Activity className="h-6 w-6 stroke-[2.5]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg tracking-tight text-slate-900">
                    Med<span className="text-brand-600">Transfer</span>
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Consent-Guarded Exchange
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                  Secure Inter-Hospital Patient Data Exchange & Transfer System
                </p>
              </div>
            </div>

            {/* Middle / Right Actions */}
            <div className="flex items-center gap-2 sm:gap-3">
              
              {/* Scoped Hospital Node Indicator (for clinical staff) */}
              {hospital && (
                <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <Building2 className="h-4 w-4 text-brand-600 shrink-0" />
                  <div className="text-left">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-none">
                      Hospital Node Scope
                    </div>
                    <div className="font-bold text-slate-800 flex items-center gap-1.5 mt-0.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                      {hospital.name} ({hospital.code})
                    </div>
                  </div>
                </div>
              )}

              {/* Patient Health ID Badge (for patient role) */}
              {isPatient && (
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-brand-50 border border-brand-200 text-xs">
                  <User className="h-4 w-4 text-brand-600" />
                  <div className="text-left">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-brand-600 leading-none">
                      Patient Identity
                    </div>
                    <div className="font-mono font-bold text-brand-900 mt-0.5">
                      {user.unique_health_id || 'P-10001'}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Viva Role Switcher Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsAccountDropdownOpen(!isAccountDropdownOpen)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Switch demo account for evaluation"
                >
                  <Zap className="h-3.5 w-3.5 text-amber-600 fill-amber-500" />
                  <span className="hidden lg:inline">Viva Switcher</span>
                  <ChevronDown className="h-3.5 w-3.5 text-amber-700" />
                </button>

                {isAccountDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2 z-50 animate-in fade-in slide-in-from-top-2">
                    <div className="px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1">
                      Quick Demo Role Switcher
                    </div>
                    <div className="space-y-1">
                      {demoAccounts.map((acc, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            switchAccount(acc.email, acc.pass);
                            setIsAccountDropdownOpen(false);
                          }}
                          className={`w-full text-left p-2 rounded-xl text-xs flex items-center gap-2.5 transition-all cursor-pointer ${
                            user.email === acc.email
                              ? 'bg-brand-50 text-brand-900 font-bold border border-brand-200'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          {acc.icon}
                          <div className="truncate flex-1">
                            <div className="truncate">{acc.label}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{acc.email}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Notifications Bell */}
              <button
                onClick={() => setIsNotifOpen(true)}
                className="relative p-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors cursor-pointer"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* User Identity & Role Badge */}
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs ${
                  isDoctor ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                  isPatient ? 'bg-blue-100 text-blue-800 border border-blue-300' :
                  'bg-purple-100 text-purple-800 border border-purple-300'
                }`}>
                  {isDoctor ? <Stethoscope className="h-4 w-4" /> :
                   isPatient ? <User className="h-4 w-4" /> :
                   <ShieldCheck className="h-4 w-4" />}
                </div>

                <div className="text-left hidden xl:block">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold uppercase">
                    {user.role}
                  </div>
                </div>

                {/* Sign Out */}
                <button
                  onClick={logout}
                  className="p-2 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>

            </div>

          </div>
        </div>
      </header>

      {/* Notifications Drawer Modal */}
      <NotificationsModal
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
      />
    </>
  );
};
