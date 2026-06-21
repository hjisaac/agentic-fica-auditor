import React, { useState } from 'react';
import { Briefcase, ShieldCheck, Loader2 } from 'lucide-react';
import { Trace } from './ThinkingConsole';
import { ComplianceGraph, GraphNode } from './ComplianceGraph';

interface KYBFormProps {
  onStartVerify: () => void;
  onVerificationComplete: (result: any, traces: Trace[]) => void;
  onSelectSubCase?: (caseId: string, traces: Trace[], hash: string) => void;
}

export const KYBForm: React.FC<KYBFormProps> = ({ onStartVerify, onVerificationComplete, onSelectSubCase }) => {
  const [formData, setFormData] = useState({
    company_name: '',
    registration_number: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kybResult, setKybResult] = useState<any | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_name || !formData.registration_number) {
      setError("Company Name and CIPC Registration Number are required.");
      return;
    }

    setError(null);
    setLoading(true);
    setKybResult(null);
    setActiveNodeId(null);
    onStartVerify();

    try {
      const response = await fetch('/api/kyb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || "Failed to trigger KYB audit.");
      }
      
      // Fetch full audit with traces and child node KYC checks
      const auditRes = await fetch(`/api/cases/${data.id}/audit`);
      const auditData = await auditRes.json();
      
      setKybResult(auditData);
      setActiveNodeId(auditData.id);
      onVerificationComplete(data, auditData.traces);
    } catch (err: any) {
      setError(err.message || "An error occurred during KYB verification.");
    } finally {
      setLoading(false);
    }
  };

  const loadPreset = (preset: 'apex' | 'vanguard' | 'shadow') => {
    const presets = {
      apex: {
        company_name: 'Apex Tech Solutions (Pty) Ltd',
        registration_number: '2021/100200/07'
      },
      vanguard: {
        company_name: 'Vanguard Enterprises (Pty) Ltd',
        registration_number: '2018/345678/07'
      },
      shadow: {
        company_name: 'Shadow Logistics (Pty) Ltd',
        registration_number: '2020/999999/07'
      }
    };
    setFormData(presets[preset]);
  };

  const handleSelectNode = (node: GraphNode) => {
    setActiveNodeId(node.id);
    if (onSelectSubCase) {
      onSelectSubCase(node.id, node.traces, node.sandbox_hash);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-2">
          <Briefcase className="w-5 h-5 text-blue-500" />
          KYB - Corporate Entity Onboarding
        </h2>
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-slate-500">
            Prefill details to quickly test standard FICA audit paths:
          </p>
          <div className="flex flex-wrap gap-2">
            <button 
              type="button" 
              onClick={() => loadPreset('apex')}
              className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors duration-150"
            >
              Apex (2 Directors)
            </button>
            <button 
              type="button" 
              onClick={() => loadPreset('vanguard')}
              className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors duration-150"
            >
              Vanguard (1 Director)
            </button>
            <button 
              type="button" 
              onClick={() => loadPreset('shadow')}
              className="px-2.5 py-1 text-xs rounded-md bg-red-50 hover:bg-red-100/70 text-red-600 border border-red-200 transition-colors duration-150"
            >
              Shadow (Sanctioned)
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

        <div className="space-y-1.5">
          <label className="text-xs text-slate-500 font-medium">Registered Company Name</label>
          <input 
            type="text" 
            value={formData.company_name}
            onChange={e => setFormData({...formData, company_name: e.target.value})}
            className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none transition-all"
            placeholder="e.g. Apex Tech Solutions (Pty) Ltd"
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-slate-500 font-medium">CIPC Registration Number (YYYY/NNNNNN/NN)</label>
          <input 
            type="text" 
            value={formData.registration_number}
            onChange={e => setFormData({...formData, registration_number: e.target.value})}
            className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg px-3.5 py-2 text-sm text-slate-800 outline-none font-mono transition-all"
            placeholder="e.g. 2021/100200/07"
            disabled={loading}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-sm font-semibold tracking-wide text-white transition-colors duration-200 flex items-center justify-center gap-2 shadow-md shadow-blue-200/50"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing Corporate Registration...</span>
            </>
          ) : (
            <>
              <ShieldCheck className="w-5 h-5" />
              <span>Launch KYB Entity Audit</span>
            </>
          )}
        </button>
      </form>

      {/* Interactive Compliance Directed Graph */}
      {kybResult && (
        <ComplianceGraph
          rootNode={kybResult}
          childNodes={kybResult.children || []}
          activeNodeId={activeNodeId}
          onSelectNode={handleSelectNode}
        />
      )}
    </div>
  );
};
