import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Login } from './components/Login';
import { DashboardOverview } from './components/DashboardOverview';
import { Activity } from 'lucide-react';

const MainLayout = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white">
        <div className="h-12 w-12 rounded-xl bg-brand-500/20 text-brand-400 flex items-center justify-center animate-pulse mb-3">
          <Activity className="h-6 w-6" />
        </div>
        <p className="text-xs font-semibold tracking-wider uppercase text-slate-400">
          Loading MedTransfer Security Layer...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar />
      <main className="flex-1">
        <DashboardOverview />
      </main>
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        MedTransfer • AI-Assisted Inter-Hospital Patient Data Transfer System • B.Tech AI/ML Final Year Project
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainLayout />
    </AuthProvider>
  );
}
