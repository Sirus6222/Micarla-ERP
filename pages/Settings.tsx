
import React, { useState, useEffect } from 'react';
import { Cog, Save, Info } from 'lucide-react';
import { SettingsService } from '../services/store';
import { Role } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { PageLoader } from '../components/PageStatus';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const [depositThresholdPct, setDepositThresholdPct] = useState(30);
  const [lastUpdated, setLastUpdated] = useState<{ at: string; by: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const load = async () => {
      const settings = await SettingsService.getAll();
      const depositSetting = settings.find(s => s.key === 'depositThresholdPct');
      if (depositSetting) {
        setDepositThresholdPct(parseFloat(depositSetting.value));
        if (depositSetting.updatedAt && depositSetting.updatedBy) {
          setLastUpdated({ at: depositSetting.updatedAt, by: depositSetting.updatedBy });
        }
      }
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <PageLoader label="Loading settings..." />;

  if (user?.role !== Role.ADMIN) {
    return (
      <div className="p-8 text-center text-stone-500">
        <p className="font-bold text-stone-700 mb-1">Access Denied</p>
        <p className="text-sm">Only Admins can access system settings.</p>
      </div>
    );
  }

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      await SettingsService.set('depositThresholdPct', depositThresholdPct.toString(), user);
      setLastUpdated({ at: new Date().toISOString(), by: user.name });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Cog size={24} className="text-stone-500" />
        <div>
          <h1 className="text-2xl font-bold text-stone-800">System Settings</h1>
          <p className="text-sm text-stone-500">Admin-only configuration</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-6 space-y-6">
        <div>
          <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wider mb-4">Finance Controls</h2>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-stone-700">
              Required Deposit Percentage (%)
            </label>
            <div className="flex items-center gap-4">
              <input
                type="number"
                min={0}
                max={100}
                value={depositThresholdPct}
                onChange={e => setDepositThresholdPct(Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                className="w-32 px-3 py-2 border border-stone-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
              />
              <span className="text-sm text-stone-500">
                Orders require at least <strong>{depositThresholdPct}%</strong> deposit before factory acceptance.
              </span>
            </div>
            <div className="flex items-start gap-2 mt-3 p-3 bg-blue-50 rounded-lg">
              <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-blue-700">
                Setting this to 0% allows orders to be accepted without any deposit payment. Changes take effect immediately for all new transitions.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-stone-100">
          <div className="text-xs text-stone-400">
            {lastUpdated ? (
              <>Last updated {new Date(lastUpdated.at).toLocaleString()} by <strong>{lastUpdated.by}</strong></>
            ) : (
              'No changes recorded'
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-bold rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
