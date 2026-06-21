import React, { useEffect, useState } from 'react';
import { Shield, ShieldAlert, Clock, Search, Key, ChevronRight, RefreshCw, Cpu } from 'lucide-react';
import { ComplianceGraph, GraphNode } from './ComplianceGraph';
import { AuditStatus, CaseType } from '../types';

interface Case {
  id: string;
  timestamp: string;
  type: CaseType;
  target_name: string;
  status: AuditStatus;
  risk_score: number;
  sandbox_hash: string;
  summary: string;
}

interface AuditListProps {
  onSelectAudit: (caseId: string) => void;
  selectedTxId: string | null;
  refreshTrigger: number;
  onSelectSubCase?: (caseId: string, traces: any[], hash: string) => void;
}

export const AuditList: React.FC<AuditListProps> = ({ onSelectAudit, selectedTxId, refreshTrigger, onSelectSubCase }) => {
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCaseDetail, setSelectedCaseDetail] = useState<any | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  const fetchCases = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/cases');
      const data = await response.json();
      if (response.ok) {
        setCases(data);
      }
    } catch (err) {
      console.error("Failed to load cases:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
  }, [refreshTrigger]);

  // Fetch detailed case (and its children) when a case in the list is selected
  useEffect(() => {
    if (selectedTxId) {
      // If we clicked a node in the graph, we don't want to clear case details
      if (selectedCaseDetail && (selectedCaseDetail.id === selectedTxId || (selectedCaseDetail.children && selectedCaseDetail.children.some((c: any) => c.id === selectedTxId)))) {
        return;
      }
      
      const fetchDetail = async () => {
        try {
          const res = await fetch(`/api/cases/${selectedTxId}/audit`);
          const data = await res.json();
          if (res.ok) {
            setSelectedCaseDetail(data);
            setActiveNodeId(data.id);
          }
        } catch (err) {
          console.error(err);
        }
      };
      fetchDetail();
    } else {
      setSelectedCaseDetail(null);
      setActiveNodeId(null);
    }
  }, [selectedTxId]);

  const getStatusBadge = (status: Case['status']) => {
    switch (status) {
      case AuditStatus.ACCEPT:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-250 text-emerald-700 text-xs">
            <Shield className="w-3.5 h-3.5 text-emerald-600" />
            ACCEPT
          </span>
        );
      case AuditStatus.REVIEW:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-250 text-amber-700 text-xs">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            REVIEW
          </span>
        );
      case AuditStatus.REJECT:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-250 text-red-700 text-xs">
            <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
            REJECT
          </span>
        );
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score < 30) return 'text-emerald-600';
    if (score < 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const handleSelectNode = (node: GraphNode) => {
    setActiveNodeId(node.id);
    if (onSelectSubCase) {
      onSelectSubCase(node.id, node.traces, node.sandbox_hash);
    }
  };

  const filtered = cases.filter(c => 
    c.target_name.toLowerCase().includes(search.toLowerCase()) ||
    c.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder="Search cases by name or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-800 outline-none transition-all"
          />
        </div>
        <button 
          onClick={fetchCases}
          disabled={loading}
          className="p-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 flex items-center justify-center transition-colors duration-200"
          title="Refresh Case Logs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Cases List */}
      <div className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
        <div className="max-h-[380px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center">
              <Cpu className="w-8 h-8 mb-2 opacity-30 text-slate-400" />
              <p className="text-sm">No FICA cases found.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const isSelected = selectedTxId === c.id || (selectedCaseDetail && selectedCaseDetail.id === c.id);
                return (
                  <div
                    key={c.id}
                    className={`w-full p-4 flex flex-col hover:bg-slate-50/50 transition-colors duration-150 ${
                      isSelected ? 'bg-blue-50/20 border-l-2 border-blue-500 pl-3.5' : ''
                    }`}
                  >
                    <button
                      onClick={() => onSelectAudit(c.id)}
                      className="w-full text-left flex items-center justify-between animate-fadeIn"
                    >
                      <div className="space-y-1.5 pr-4 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-semibold text-slate-400">{c.id}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono font-semibold">
                            {c.type}
                          </span>
                        </div>
                        <h4 className="text-sm font-semibold text-slate-800">{c.target_name}</h4>
                        <div className="flex items-center gap-4 text-[10px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {new Date(c.timestamp).toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1 font-mono">
                            <Key className="w-3.5 h-3.5 text-slate-400" />
                            Hash: {c.sandbox_hash ? `${c.sandbox_hash.slice(0, 10)}...` : 'None'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-slate-400 mb-1 text-[9px] font-medium uppercase tracking-wider">Risk Score</div>
                          <div className={`text-base font-bold font-mono ${getRiskScoreColor(c.risk_score)}`}>
                            {c.risk_score}/100
                          </div>
                        </div>
                        <div>
                          {getStatusBadge(c.status)}
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400" />
                      </div>
                    </button>
                    
                    {/* Visual tree compliance graph for corporate KYB checks */}
                    {isSelected && selectedCaseDetail && selectedCaseDetail.id === c.id && selectedCaseDetail.type === CaseType.KYB && (
                      <div className="mt-4 pt-4 border-t border-slate-100">
                        <ComplianceGraph
                          rootNode={selectedCaseDetail}
                          childNodes={selectedCaseDetail.children || []}
                          activeNodeId={activeNodeId}
                          onSelectNode={handleSelectNode}
                        />
                      </div>
                    )}
                    
                    {/* AI Compliance Recap Summary Display */}
                    {isSelected && c.summary && (
                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                        <div className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">AI Compliance Recap Memo</div>
                        <div className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-3 rounded-lg border border-slate-200 leading-relaxed font-sans max-h-[180px] overflow-y-auto shadow-inner shadow-slate-100/50">
                          {c.summary}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
