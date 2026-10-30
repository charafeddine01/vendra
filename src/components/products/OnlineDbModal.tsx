import React, { useState, useEffect } from 'react';
import { ApiService } from '../../services/api';
import {
  X,
  Database,
  Cloud,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Server,
  Zap,
  Globe
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onSyncComplete?: () => void;
}

export const OnlineDbModal: React.FC<Props> = ({ onClose, onSyncComplete }) => {
  const [enabled, setEnabled] = useState(false);
  const [host, setHost] = useState('127.0.0.1');
  const [port, setPort] = useState(3306);
  const [database, setDatabase] = useState('vendra_online_shop');
  const [username, setUsername] = useState('vendra_online_user');
  const [password, setPassword] = useState('');
  const [hasSavedPassword, setHasSavedPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const res = await ApiService.request('sync.onlineDb.getConfig');
    setLoading(false);
    if (res.success && res.data) {
      setEnabled(Boolean(res.data.enabled));
      if (res.data.host) setHost(res.data.host);
      if (res.data.port) setPort(Number(res.data.port));
      if (res.data.database) setDatabase(res.data.database);
      if (res.data.username) setUsername(res.data.username);
      setHasSavedPassword(Boolean(res.data.has_password));
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await ApiService.request('sync.onlineDb.testConnection', {
      host,
      port,
      database,
      username,
      password: password || undefined,
    });
    setTesting(false);
    if (res.success) {
      setTestResult({
        success: true,
        message: res.data?.message || 'Connected successfully to MySQL server!',
      });
    } else {
      setTestResult({
        success: false,
        message: res.error?.message || 'Could not connect to MySQL server. Please verify credentials.',
      });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSaveSuccess(false);
    setSyncResult(null);

    const payload: any = {
      enabled,
      host,
      port,
      database,
      username,
    };
    if (password) {
      payload.password = password;
    }

    const res = await ApiService.request('sync.onlineDb.saveConfig', payload);
    setLoading(false);

    if (res.success) {
      setSaveSuccess(true);
      setHasSavedPassword(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } else {
      alert(res.error?.message || 'Failed to save configuration');
    }
  };

  const handlePushAll = async () => {
    setSyncing(true);
    setSyncResult(null);
    const res = await ApiService.request('sync.onlineDb.pushAll');
    setSyncing(false);
    if (res.success) {
      setSyncResult({
        success: true,
        message: res.data?.message || 'All categories & products replicated successfully!',
      });
      if (onSyncComplete) onSyncComplete();
    } else {
      setSyncResult({
        success: false,
        message: res.error?.message || 'Replication failed. Check online database connection.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-6 shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Dual-DB & Online Shop Replication</h3>
              <p className="text-[11px] text-slate-400">
                Local SQLite cache for fast POS + Online MySQL replication for Web Store
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Status Banner */}
          <div className="bg-slate-850 border border-slate-800 rounded-2xl p-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-bold text-white">Local Database (Primary Cache)</div>
                <div className="text-[10px] text-slate-400 font-mono">SQLite (Active, 100% offline capable)</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Active & Cached
            </span>
          </div>

          {/* Enable Toggle */}
          <div className="bg-slate-850 border border-slate-700/80 rounded-2xl p-3.5 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-blue-400" />
                <span>Replicate to Online Database (MySQL)</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Automatically pushes products, images, and prices to your online shop database
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* MySQL Connection Form */}
          <div className={`space-y-3 transition-opacity ${enabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  MySQL Host / IP *
                </label>
                <input
                  type="text"
                  required={enabled}
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="e.g. vendra.charafeddine.xyz or 127.0.0.1"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(parseInt(e.target.value) || 3306)}
                  placeholder="3306"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 mb-1">
                Database Name *
              </label>
              <input
                type="text"
                required={enabled}
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                placeholder="e.g. vendra_online_shop"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Database Username *
                </label>
                <input
                  type="text"
                  required={enabled}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. vendra_user"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1">
                  Password {hasSavedPassword && <span className="text-emerald-400 font-normal">(Saved)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={hasSavedPassword ? '•••••••• (leave blank to keep)' : 'Enter password'}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3 pr-8 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Test Connection Button */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="w-full bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 font-bold py-2 rounded-xl text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Server className={`w-3.5 h-3.5 text-blue-400 ${testing ? 'animate-spin' : ''}`} />
                <span>{testing ? 'Testing MySQL Connection...' : 'Test Online DB Connection'}</span>
              </button>
            </div>

            {/* Test Result Message */}
            {testResult && (
              <div
                className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}
          </div>

          {/* Sync Result Message */}
          {syncResult && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 ${
                syncResult.success
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {syncResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{syncResult.message}</span>
            </div>
          )}

          {/* Save Success Alert */}
          {saveSuccess && (
            <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs text-blue-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>Settings saved! Real-time replication is now active.</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={handlePushAll}
              disabled={syncing || !enabled}
              className={`flex-1 font-bold py-2.5 rounded-xl text-xs transition border flex items-center justify-center gap-1.5 ${
                enabled
                  ? 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border-emerald-500/40 shadow-sm'
                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Replicating...' : 'Sync All Data Now'}</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-md shadow-blue-600/30"
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
