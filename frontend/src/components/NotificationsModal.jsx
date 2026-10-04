import React from 'react';
import api from '../api/axios';
import { 
  X, Bell, CheckCircle2, AlertTriangle, ShieldAlert, 
  ArrowRight, Clock, CheckCheck, RefreshCw 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const NotificationsModal = ({ isOpen, onClose, onSelectNotification }) => {
  const { notifications, unreadCount, refreshNotifications } = useAuth();

  if (!isOpen) return null;

  const handleMarkAllRead = async () => {
    try {
      await api.patch('/notifications/mark-read');
      refreshNotifications();
    } catch (err) {
      console.error('Error marking notifications as read:', err);
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'CONSENT_REQUEST':
        return <div className="p-2 rounded-xl bg-amber-500/20 text-amber-500"><Bell className="h-4 w-4" /></div>;
      case 'CONSENT_UPDATE':
        return <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-500"><CheckCircle2 className="h-4 w-4" /></div>;
      case 'TRANSFER_UPDATE':
        return <div className="p-2 rounded-xl bg-brand-500/20 text-brand-500"><ArrowRight className="h-4 w-4" /></div>;
      case 'EMERGENCY_ALERT':
      case 'SECURITY_ALERT':
        return <div className="p-2 rounded-xl bg-red-500/20 text-red-500"><ShieldAlert className="h-4 w-4" /></div>;
      default:
        return <div className="p-2 rounded-xl bg-slate-500/20 text-slate-400"><Clock className="h-4 w-4" /></div>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh] mt-12 animate-in slide-in-from-top-4">
        
        {/* Header */}
        <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-brand-500/20 text-brand-400 flex items-center justify-center">
              <Bell className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2">
                In-App Notifications
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-extrabold">
                    {unreadCount} new
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-slate-400">Live clinical & consent alerts</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-[11px] font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 cursor-pointer transition-colors"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="p-4 overflow-y-auto space-y-3 divide-y divide-slate-100 flex-1">
          {notifications.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Bell className="h-8 w-8 mx-auto text-slate-300 stroke-1" />
              <p className="text-xs font-medium">No notifications yet</p>
              <p className="text-[11px] text-slate-400">You will receive real-time alerts when transfers or consent requests occur.</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <div 
                key={notif.id}
                onClick={() => {
                  if (onSelectNotification) onSelectNotification(notif);
                }}
                className={`pt-3 first:pt-0 p-3 rounded-xl transition-all cursor-pointer flex items-start gap-3 ${
                  notif.is_read 
                    ? 'bg-white hover:bg-slate-50 text-slate-700' 
                    : 'bg-brand-50/50 hover:bg-brand-50 border border-brand-100 text-slate-900'
                }`}
              >
                {getTypeIcon(notif.type)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-bold truncate">{notif.title}</h3>
                    <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                    {notif.message}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 text-center">
          <p className="text-[10px] text-slate-400">
            Academic prototype inter-hospital notification feed
          </p>
        </div>

      </div>
    </div>
  );
};
