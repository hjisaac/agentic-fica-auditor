import React from 'react';
import { Building2, User, Shield, ShieldAlert, Clock } from 'lucide-react';
import { Trace } from './ThinkingConsole';
import { AuditStatus, CaseType, StepType } from '../types';

export interface GraphNode {
  id: string;
  type: CaseType;
  target_name: string;
  status: AuditStatus;
  risk_score: number;
  sandbox_hash: string;
  traces: Trace[];
}

interface ComplianceGraphProps {
  rootNode: GraphNode;
  childNodes: GraphNode[];
  activeNodeId: string | null;
  onSelectNode: (node: GraphNode) => void;
}

interface CheckStatus {
  name: string;
  status: 'SUCCESS' | 'WARNING' | 'FAILED' | 'PENDING' | 'NA';
  message: string;
}

export const ComplianceGraph: React.FC<ComplianceGraphProps> = ({
  rootNode,
  childNodes,
  activeNodeId,
  onSelectNode,
}) => {
  const getStatusColor = (status: GraphNode['status']) => {
    switch (status) {
      case AuditStatus.ACCEPT:
        return 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-emerald-100/50';
      case AuditStatus.REVIEW:
        return 'border-amber-200 bg-amber-50 text-amber-700 shadow-amber-100/50';
      case AuditStatus.REJECT:
        return 'border-red-200 bg-red-50 text-red-700 shadow-red-100/50';
    }
  };

  const getStatusBadge = (status: GraphNode['status']) => {
    switch (status) {
      case AuditStatus.ACCEPT:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-100/70 text-[9px] font-bold text-emerald-800">
            <Shield className="w-2.5 h-2.5" />
            ACCEPT
          </span>
        );
      case AuditStatus.REVIEW:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100/70 text-[9px] font-bold text-amber-800">
            <Clock className="w-2.5 h-2.5" />
            REVIEW
          </span>
        );
      case AuditStatus.REJECT:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100/70 text-[9px] font-bold text-red-800">
            <ShieldAlert className="w-2.5 h-2.5" />
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

  const isActive = (node: GraphNode) => activeNodeId === node.id;

  const parseInternalChecks = (node: GraphNode): CheckStatus[] => {
    const checks: CheckStatus[] = [
      { name: 'Identity (DHA)', status: 'PENDING', message: 'Awaiting execution' },
      { name: 'PEP & Sanctions', status: 'PENDING', message: 'Awaiting execution' },
      { name: 'Adverse Media', status: 'PENDING', message: 'Awaiting execution' },
      { name: 'Bank AVS Match', status: 'PENDING', message: 'Awaiting execution' }
    ];

    if (node.type === CaseType.KYB) {
      // Bank AVS is not run on corporate level
      checks[3] = { name: 'Bank AVS Match', status: 'NA', message: 'Not applicable for corporate' };
    }

    if (!node.traces) return checks;

    node.traces.forEach(trace => {
      const isObs = trace.type === StepType.OBSERVATION || trace.step_type === StepType.OBSERVATION;
      if (isObs) {
        const content = trace.content;
        try {
          const parsed = JSON.parse(content);
          
          // 1. DHA Check
          if (trace.name === 'dha_identity_check' || content.includes('dha_identity_check') || parsed.alive_status) {
            if (parsed.status === 'ACCEPT') {
              checks[0] = { name: 'Identity (DHA)', status: 'SUCCESS', message: 'Identity confirmed active' };
            } else if (parsed.status === 'REJECT') {
              checks[0] = { name: 'Identity (DHA)', status: 'FAILED', message: parsed.message || 'ID not found in registry' };
            } else {
              checks[0] = { name: 'Identity (DHA)', status: 'WARNING', message: parsed.message || 'Verification alert' };
            }
          }
          
          // 2. PEP Check
          if (trace.name === 'pep_sanctions_screen' || content.includes('pep_sanctions_screen') || 'max_risk_level' in parsed) {
            if (parsed.status === 'ACCEPT') {
              checks[1] = { name: 'PEP & Sanctions', status: 'SUCCESS', message: 'No sanctions or PEP matches' };
            } else if (parsed.status === 'REJECT') {
              checks[1] = { name: 'PEP & Sanctions', status: 'FAILED', message: `Critical match: ${parsed.max_risk_level} PEP` };
            } else {
              checks[1] = { name: 'PEP & Sanctions', status: 'WARNING', message: `Potential PEP alert: ${parsed.max_risk_level}` };
            }
          }
          
          // 3. Adverse Media
          if (trace.name === 'adverse_media_check' || content.includes('adverse_media_check') || 'max_severity' in parsed) {
            if (parsed.status === 'ACCEPT' && !parsed.match_found) {
              checks[2] = { name: 'Adverse Media', status: 'SUCCESS', message: 'No adverse press matched' };
            } else if (parsed.status === 'REVIEW' || parsed.match_found) {
              checks[2] = { name: 'Adverse Media', status: 'WARNING', message: `Media hits: ${parsed.max_severity || 'Low'} severity` };
            } else {
              checks[2] = { name: 'Adverse Media', status: 'SUCCESS', message: 'Screening cleared' };
            }
          }
          
          // 4. Bank AVS
          if (trace.name === 'bank_account_verify' || content.includes('bank_account_verify') || parsed.owner_match) {
            if (parsed.status === 'ACCEPT') {
              checks[3] = { name: 'Bank AVS Match', status: 'SUCCESS', message: 'Account matched ID details' };
            } else if (parsed.status === 'REJECT') {
              checks[3] = { name: 'Bank AVS Match', status: 'FAILED', message: parsed.message || 'Verification failed' };
            } else {
              checks[3] = { name: 'Bank AVS Match', status: 'WARNING', message: parsed.message || 'Ownership mismatch' };
            }
          }
        } catch (e) {
          const lower = content.toLowerCase();
          if (lower.includes('dha_identity_check')) {
            checks[0] = { name: 'Identity (DHA)', status: lower.includes('reject') ? 'FAILED' : 'SUCCESS', message: 'DHA check completed' };
          }
          if (lower.includes('pep_sanctions')) {
            checks[1] = { name: 'PEP & Sanctions', status: lower.includes('reject') || lower.includes('match') ? 'FAILED' : 'SUCCESS', message: 'PEP screen completed' };
          }
          if (lower.includes('adverse_media')) {
            checks[2] = { name: 'Adverse Media', status: lower.includes('review') ? 'WARNING' : 'SUCCESS', message: 'Media scan completed' };
          }
          if (lower.includes('bank_account_verify')) {
            checks[3] = { name: 'Bank AVS Match', status: lower.includes('reject') ? 'FAILED' : (lower.includes('review') ? 'WARNING' : 'SUCCESS'), message: 'AVS Match run' };
          }
        }
      }
    });

    return checks;
  };

  const selectedNode = isActive(rootNode) ? rootNode : (childNodes.find(c => c.id === activeNodeId) || rootNode);
  const internalChecks = parseInternalChecks(selectedNode);

  return (
    <div className="relative w-full p-4 bg-slate-50/50 border border-slate-200 rounded-xl shadow-inner space-y-8 overflow-hidden select-none">
      <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center justify-between">
        <span>Interactive Compliance Hierarchy Map</span>
        <span className="text-slate-500 font-normal">Click node to inspect logs</span>
      </div>

      {/* SVG Connections Container */}
      {childNodes.length > 0 && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ minHeight: '260px' }}>
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="6"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 2 L 8 5 L 0 8 z" fill="#cbd5e1" />
            </marker>
          </defs>
          {childNodes.map((_, idx) => {
            const childCount = childNodes.length;
            const stepPercent = 100 / (childCount + 1);
            const childPercentX = (idx + 1) * stepPercent;
            
            return (
              <g key={idx}>
                <path
                  d={`M 50% 50 C 50% 100, ${childPercentX}% 100, ${childPercentX}% 160`}
                  fill="none"
                  stroke="#cbd5e1"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                  markerEnd="url(#arrow)"
                  className="transition-all duration-300"
                />
              </g>
            );
          })}
        </svg>
      )}

      {/* Node Layout */}
      <div className="flex flex-col items-center justify-center gap-16 relative z-10">
        
        {/* ROOT NODE (Corporate KYB) */}
        <div className="flex justify-center w-full">
          <button
            type="button"
            onClick={() => onSelectNode(rootNode)}
            className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all duration-200 max-w-sm w-full bg-white shadow-md ${
              isActive(rootNode)
                ? 'ring-2 ring-blue-500 ring-offset-2 scale-[1.03] border-blue-300'
                : 'hover:border-slate-300 hover:scale-[1.01]'
            }`}
          >
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 flex-shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1 justify-between">
                <span className="font-mono text-[9px] font-semibold text-slate-400 truncate">{rootNode.id}</span>
                {getStatusBadge(rootNode.status)}
              </div>
              <h4 className="text-xs font-bold text-slate-800 truncate">{rootNode.target_name}</h4>
              <p className="text-[9px] text-slate-500 mt-0.5">Corporate Entity Root</p>
            </div>
            <div className="text-right flex-shrink-0 pl-2 border-l border-slate-100">
              <div className="text-[8px] text-slate-400">Risk</div>
              <div className={`text-xs font-bold font-mono ${getRiskScoreColor(rootNode.risk_score)}`}>
                {rootNode.risk_score}/100
              </div>
            </div>
          </button>
        </div>

        {/* CHILD NODES (Directors) */}
        {childNodes.length > 0 ? (
          <div className="flex flex-wrap justify-center gap-6 w-full max-w-5xl">
            {childNodes.map((child) => (
              <button
                key={child.id}
                type="button"
                onClick={() => onSelectNode(child)}
                className={`flex items-center gap-2.5 p-3 rounded-lg border text-left transition-all duration-200 bg-white shadow-sm flex-1 min-w-[200px] max-w-[240px] ${
                  isActive(child)
                    ? 'ring-2 ring-blue-500 ring-offset-2 scale-[1.03] border-blue-300'
                    : 'hover:border-slate-300 hover:scale-[1.01]'
                }`}
              >
                <div className="p-2 rounded-md bg-purple-50 text-purple-600 border border-purple-100 flex-shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 justify-between mb-0.5">
                    <span className="font-mono text-[8px] font-medium text-slate-400 truncate">{child.id}</span>
                    {getStatusBadge(child.status)}
                  </div>
                  <h5 className="text-[11px] font-bold text-slate-800 truncate">{child.target_name}</h5>
                  <p className="text-[8px] text-slate-500">Director / UBO</p>
                </div>
                <div className="text-right flex-shrink-0 pl-1.5 border-l border-slate-100">
                  <div className="text-[7px] text-slate-400">Risk</div>
                  <div className={`text-[10px] font-bold font-mono ${getRiskScoreColor(child.risk_score)}`}>
                    {child.risk_score}/100
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          rootNode.type === CaseType.KYB && (
            <div className="text-xs text-slate-400 italic">No beneficial owners (directors) registered.</div>
          )
        )}
      </div>

      {/* Component Checks Status Flow Grid */}
      <div className="pt-4 border-t border-slate-200 relative z-20">
        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
          Sub-Check Compliance Statuses: {selectedNode.target_name}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {internalChecks.map((check, idx) => {
            const getStatusColor = (chkStatus: CheckStatus['status']) => {
              switch (chkStatus) {
                case 'SUCCESS':
                  return 'border-emerald-250 bg-emerald-50/70 text-emerald-700';
                case 'WARNING':
                  return 'border-amber-250 bg-amber-50/70 text-amber-700';
                case 'FAILED':
                  return 'border-red-250 bg-red-50/70 text-red-700';
                case 'NA':
                  return 'border-slate-200 bg-slate-100/50 text-slate-400';
                default:
                  return 'border-slate-250 bg-slate-50 text-slate-500 animate-pulse';
              }
            };
            
            return (
              <div 
                key={idx} 
                className={`p-2.5 rounded-lg border text-left flex flex-col justify-between h-[80px] shadow-sm transition-all ${getStatusColor(check.status)}`}
              >
                <div className="flex items-center justify-between border-b border-current/10 pb-1">
                  <span className="text-[10px] font-bold truncate pr-1">{check.name}</span>
                  <span className="text-[8px] uppercase font-mono font-bold px-1 rounded bg-white/80 border border-current flex-shrink-0 scale-90">
                    {check.status}
                  </span>
                </div>
                <p className="text-[9px] mt-1.5 opacity-90 leading-snug line-clamp-2">{check.message}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
