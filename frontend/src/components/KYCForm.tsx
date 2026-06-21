import React, { useState } from 'react';
import { User, CreditCard, ShieldCheck, HelpCircle, Loader2 } from 'lucide-react';
import { Trace } from './ThinkingConsole';

interface KYCFormProps {
  onStartVerify: () => void;
  onVerificationComplete: (result: any, traces: Trace[]) => void;
}

export const KYCForm: React.FC<KYCFormProps> = ({ onStartVerify, onVerificationComplete }) => {
  const [formData, setFormData] = useState({
    first_names: '',
    last_name: '',
    id_number: '',
    account_number: '',
    bank_name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_names || !formData.last_name || !formData.id_number) {
      setError("First Name, Last Name and ID Number are mandatory.");
      return;
    }
    
    setError(null);
    setLoading(true);
    onStartVerify();

    try {
      const response = await fetch('/api/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to trigger KYC audit.");
      }
      
      // Since backend returns the full audit, we fetch it
      const auditRes = await fetch(`/api/cases/${data.id}/audit`);
      const auditData = await auditRes.json();
      
      onVerificationComplete(data, auditData.traces);
    } catch (err: any) {
      setError(err.message || "An error occurred during verification.");
    } finally {
      setLoading(false);
    }
  };

  const loadMockUser = (preset: 'sipho' | 'shereen' | 'victor') => {
    const mocks = {
      sipho: {
        first_names: 'Sipho',
        last_name: 'Maseko',
        id_number: '9001015000081',
        account_number: '1012345678',
        bank_name: 'Standard Bank'
      },
      shereen: {
        first_names: 'Shereen',
        last_name: 'Naidoo',
        id_number: '8507155123084',
        account_number: '9087654321',
        bank_name: 'First National Bank'
      },
      victor: {
        first_names: 'Victor',
        last_name: 'Sanctioned',
        id_number: '6001015000080',
        account_number: '5566778899',
        bank_name: 'Nedbank'
      }
    };
    setFormData(mocks[preset]);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-2">
          <User className="w-5 h-5 text-blue-500" />
          KYC - Natural Person Onboarding
        </h2>
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-slate-500">
            Prefill details to quickly test standard FICA audit paths:
          </p>
          <div className="flex flex-wrap gap-2">
            <button 
              type="button" 
              onClick={() => loadMockUser('sipho')}
              className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors duration-150"
            >
              Sipho (PEP Alert)
            </button>
            <button 
              type="button" 
              onClick={() => loadMockUser('shereen')}
              className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors duration-150"
            >
              Shereen (Passed)
            </button>
            <button 
              type="button" 
              onClick={() => loadMockUser('victor')}
              className="px-2.5 py-1 text-xs rounded-md bg-red-50 hover:bg-red-100/70 text-red-600 border border-red-200 transition-colors duration-150"
            >
              Victor (Sanctioned)
            </button>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500 font-medium">First Names</label>
            <input 
              type="text" 
              value={formData.first_names}
              onChange={e => setFormData({...formData, first_names: e.target.value})}
              className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none transition-all"
              placeholder="e.g. Sipho"
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-slate-500 font-medium">Surname</label>
            <input 
              type="text" 
              value={formData.last_name}
              onChange={e => setFormData({...formData, last_name: e.target.value})}
              className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none transition-all"
              placeholder="e.g. Maseko"
              disabled={loading}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-500 font-medium">South African ID Number (13 Digits)</label>
          <input 
            type="text" 
            maxLength={13}
            value={formData.id_number}
            onChange={e => setFormData({...formData, id_number: e.target.value.replace(/\D/g, '')})}
            className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none font-mono transition-all"
            placeholder="e.g. 9001015000081"
            disabled={loading}
          />
        </div>

        {/* Optional Financial AVS check */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 shadow-sm shadow-slate-100/50">
          <h3 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
            <CreditCard className="w-4 h-4 text-purple-600" />
            Financial AVS Verification (Optional)
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 font-medium">Bank Name</label>
              <select 
                value={formData.bank_name}
                onChange={e => setFormData({...formData, bank_name: e.target.value})}
                className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none transition-all"
                disabled={loading}
              >
                <option value="">-- Select Bank --</option>
                <option value="Standard Bank">Standard Bank</option>
                <option value="First National Bank">First National Bank</option>
                <option value="Nedbank">Nedbank</option>
                <option value="Absa">Absa</option>
                <option value="Capitec">Capitec</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500 font-medium">Account Number</label>
              <input 
                type="text" 
                value={formData.account_number}
                onChange={e => setFormData({...formData, account_number: e.target.value.replace(/\D/g, '')})}
                className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none font-mono transition-all"
                placeholder="e.g. 1012345678"
                disabled={loading}
              />
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-sm font-semibold tracking-wide text-white transition-colors duration-200 flex items-center justify-center gap-2 shadow-md shadow-blue-200/50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Running Agent Compliance Audit...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>Verify & Perform FICA Audit</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
