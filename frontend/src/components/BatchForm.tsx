import React, { useState } from 'react';
import { Layers, ShieldCheck, Play, HelpCircle, Loader2, ClipboardCheck, Trash2 } from 'lucide-react';
import { AuditStatus, BatchItem } from '../types';
import { Trace } from './ThinkingConsole';

interface BatchFormProps {
  onStartVerify: () => void;
  onVerificationComplete: (result: any, traces: Trace[]) => void;
}

export const BatchForm: React.FC<BatchFormProps> = ({ onStartVerify, onVerificationComplete }) => {
  const [csvInput, setCsvInput] = useState<string>('');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [activeItemId, setActiveItemId] = useState<string | null>(null);

  const loadPreset = (preset: 'standard' | 'clean' | 'risky') => {
    const presets = {
      standard: 
        "Shereen,Naidoo,8507155123084,First National Bank,9087654321\n" +
        "Sipho,Maseko,9001015000081,Standard Bank,1012345678\n" +
        "Victor,Sanctioned,6001015000080,Nedbank,5566778899",
      clean:
        "Shereen,Naidoo,8507155123084,First National Bank,9087654321\n" +
        "Sipho,Maseko,9001015000081,Standard Bank,1012345678",
      risky:
        "Victor,Sanctioned,6001015000080,Nedbank,5566778899\n" +
        "Unknown,Person,1111111111111"
    };
    setCsvInput(presets[preset]);
    
    // Parse preset directly into preview table
    parseCSV(presets[preset]);
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n');
    const parsedItems: BatchItem[] = [];
    
    lines.forEach(line => {
      if (!line.trim()) return;
      const parts = line.split(',');
      if (parts.length >= 3) {
        parsedItems.push({
          first_names: parts[0]?.trim() || '',
          last_name: parts[1]?.trim() || '',
          id_number: parts[2]?.trim() || '',
          bank_name: parts[3]?.trim() || undefined,
          account_number: parts[4]?.trim() || undefined
        });
      }
    });
    setItems(parsedItems);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCsvInput(val);
    parseCSV(val);
  };

  const handleRunBatch = async () => {
    if (items.length === 0) return;
    
    setIsProcessing(true);
    onStartVerify();
    setProgress({ current: 0, total: items.length });

    const updatedItems = [...items];
    
    // Process items sequentially to prevent rate limits and show orderly progress
    for (let i = 0; i < updatedItems.length; i++) {
      const item = updatedItems[i];
      setProgress(prev => ({ ...prev, current: i }));
      
      try {
        const payload = {
          first_names: item.first_names,
          last_name: item.last_name,
          id_number: item.id_number,
          bank_name: item.bank_name || null,
          account_number: item.account_number || null
        };

        const response = await fetch('/api/kyc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await response.json();
        
        if (response.ok) {
          updatedItems[i] = {
            ...item,
            id: data.id,
            status: data.status as AuditStatus,
            risk_score: data.risk_score
          };
        } else {
          updatedItems[i] = {
            ...item,
            error: data.detail || 'FICA Check Failed'
          };
        }
      } catch (err: any) {
        updatedItems[i] = {
          ...item,
          error: err.message || 'Network error'
        };
      }
      setItems([...updatedItems]);
    }
    
    setProgress(prev => ({ ...prev, current: updatedItems.length }));
    setIsProcessing(false);
  };

  const inspectItem = async (item: BatchItem) => {
    if (!item.id) return;
    setActiveItemId(item.id);
    
    try {
      const res = await fetch(`/api/cases/${item.id}/audit`);
      const data = await res.json();
      if (res.ok) {
        onVerificationComplete(data, data.traces);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const clearBatch = () => {
    setCsvInput('');
    setItems([]);
    setActiveItemId(null);
    setProgress({ current: 0, total: 0 });
  };

  const getStatusBadge = (status?: AuditStatus, error?: string) => {
    if (error) {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-red-100 border border-red-200 text-red-700 rounded-md">
          FAIL
        </span>
      );
    }
    switch (status) {
      case AuditStatus.ACCEPT:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-50 border border-emerald-250 text-emerald-700 rounded-md">
            ACCEPT
          </span>
        );
      case AuditStatus.REVIEW:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 border border-amber-250 text-amber-700 rounded-md">
            REVIEW
          </span>
        );
      case AuditStatus.REJECT:
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-red-55 border border-red-250 text-red-700 rounded-md">
            REJECT
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-[10px] font-medium bg-slate-100 border border-slate-200 text-slate-500 rounded-md">
            Awaiting
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2 mb-2">
          <Layers className="w-5 h-5 text-blue-500" />
          KYC - Batch Onboarding & Auditing
        </h2>
        <div className="space-y-2">
          <p className="text-[11px] font-medium text-slate-500">
            Select a batch preset or input custom CSV lines below to run multi-client checks:
          </p>
          <div className="flex flex-wrap gap-2">
            <button 
              type="button" 
              onClick={() => loadPreset('standard')}
              className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              disabled={isProcessing}
            >
              Standard Batch (3 Clients)
            </button>
            <button 
              type="button" 
              onClick={() => loadPreset('clean')}
              className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
              disabled={isProcessing}
            >
              Clean Batch (2 Clients)
            </button>
            <button 
              type="button" 
              onClick={() => loadPreset('risky')}
              className="px-2.5 py-1 text-xs rounded-md bg-red-50 hover:bg-red-100/70 text-red-600 border border-red-200 transition-colors"
              disabled={isProcessing}
            >
              Alert Batch (2 Clients)
            </button>
            {items.length > 0 && (
              <button 
                type="button" 
                onClick={clearBatch}
                className="px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-250 flex items-center gap-1 transition-colors ml-auto"
                disabled={isProcessing}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* CSV input area */}
        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs text-slate-500 font-medium">CSV Data Format (comma separated values)</label>
            <span className="text-[9px] text-slate-400 font-mono">Format: FirstNames,LastName,IDNumber,BankName,AccountNumber</span>
          </div>
          <textarea
            value={csvInput}
            onChange={handleInputChange}
            placeholder="e.g. Sipho,Maseko,9001015000081,Standard Bank,1012345678"
            className="w-full h-24 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg p-3 text-xs text-slate-800 outline-none font-mono transition-all resize-none leading-relaxed"
            disabled={isProcessing}
          />
        </div>

        {/* Progress indicator */}
        {isProcessing && (
          <div className="space-y-2 p-3 bg-blue-50/60 rounded-xl border border-blue-200 animate-fadeIn">
            <div className="flex justify-between items-center text-xs">
              <span className="text-blue-700 font-semibold flex items-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Processing Batch Audits...
              </span>
              <span className="font-mono text-blue-600 font-semibold">{progress.current} / {progress.total} Done</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
              <div 
                className="bg-blue-600 h-1.5 transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Items Table View */}
        {items.length > 0 && (
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white animate-fadeIn">
            <div className="overflow-x-auto max-h-[220px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Client Name</th>
                    <th className="py-2.5 px-4">ID Number</th>
                    <th className="py-2.5 px-4">Bank Account</th>
                    <th className="py-2.5 px-4 text-center">Status</th>
                    <th className="py-2.5 px-4 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {items.map((item, idx) => {
                    const isInspecting = item.id && activeItemId === item.id;
                    return (
                      <tr 
                        key={idx} 
                        className={`hover:bg-slate-50/40 transition-colors ${isInspecting ? 'bg-blue-50/20' : ''}`}
                      >
                        <td className="py-2 px-4 font-semibold text-slate-800">
                          {item.first_names} {item.last_name}
                        </td>
                        <td className="py-2 px-4 font-mono text-slate-500">{item.id_number}</td>
                        <td className="py-2 px-4 text-slate-500">
                          {item.bank_name ? `${item.bank_name} (${item.account_number?.slice(0, 4)}***)` : 'None'}
                        </td>
                        <td className="py-2 px-4 text-center">
                          {getStatusBadge(item.status, item.error)}
                        </td>
                        <td className="py-2 px-4 text-center">
                          {item.id ? (
                            <button
                              type="button"
                              onClick={() => inspectItem(item)}
                              className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                                isInspecting 
                                  ? 'bg-blue-600 border-blue-600 text-white shadow shadow-blue-200/20' 
                                  : 'bg-white border-slate-250 text-slate-600 hover:bg-slate-100'
                              }`}
                            >
                              Inspect
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono">---</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Action Button */}
        {items.length > 0 && !isProcessing && (
          <button 
            type="button" 
            onClick={handleRunBatch}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:bg-blue-300 text-sm font-semibold tracking-wide text-white transition-colors flex items-center justify-center gap-2 shadow-md shadow-blue-200/50 animate-fadeIn"
          >
            <Play className="w-4 h-4" />
            <span>Execute Batch Verification ({items.length} Audits)</span>
          </button>
        )}
      </div>
    </div>
  );
};
