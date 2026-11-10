import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Building2, ShieldCheck, LogOut, Stethoscope, 
  Activity, Bell, User, Database
} from 'lucide-react';
import { NotificationsModal } from './NotificationsModal';

export const Navbar = ({ onOpenConsentCenter, onOpenSecurityDashboard }) => {
  const { user, hospital, patient, logout, unreadCount } = useAuth();
  const [isNotifOpen, setIsNotifOpen] = useState(false);

  if (!user) return null;

  const role = (user.role || '').toUpperCase();
  const isDoctor = role === 'DOCTOR';
  const isPatient = role === 'PATIENT';

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
              
              {/* PostgreSQL Engine Active Status Badge */}
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                <Database className="h-3.5 w-3.5 text-emerald-600" />
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>PostgreSQL Live</span>
              </div>

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
                      {user.unique_health_id || (patient && patient.unique_health_id) || 'ABHA-VERIFIED'}
                    </div>
                  </div>
                </div>
              )}

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
