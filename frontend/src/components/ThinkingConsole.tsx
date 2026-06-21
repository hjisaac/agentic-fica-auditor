import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Cpu, Loader2, Key, Download } from 'lucide-react';
import { StepType } from '../types';

export interface Trace {
  step_index: number;
  step_type?: StepType;
  type?: StepType;
  timestamp?: string;
  name?: string;
  content: string;
  is_clean?: boolean;
}

interface ThinkingConsoleProps {
  traces: Trace[];
  sandboxHash: string;
  isProcessing: boolean;
  title?: string;
  isHistorical?: boolean;
}

export const ThinkingConsole: React.FC<ThinkingConsoleProps> = ({ 
  traces, 
  sandboxHash, 
  isProcessing,
  title = "FICA Agent Reasoning Telemetry",
  isHistorical = false
}) => {
  const [visibleTraces, setVisibleTraces] = useState<Trace[]>([]);
  const [viewMode, setViewMode] = useState<'clean' | 'noisy'>('clean');
  const consoleEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on updates
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleTraces, viewMode]);

  // Handle traces load (either instant for history or simulated stream for live)
  useEffect(() => {
    if (traces.length === 0) {
      setVisibleTraces([]);
      return;
    }

    if (isHistorical) {
      setVisibleTraces(traces);
      return;
    }

    let i = 0;
    setVisibleTraces([traces[0]]);
    
    const interval = setInterval(() => {
      i++;
      if (i < traces.length) {
        setVisibleTraces(prev => [...prev, traces[i]]);
      } else {
        clearInterval(interval);
      }
    }, 1200); // 1.2s delay between reasoning steps

    return () => clearInterval(interval);
  }, [traces, isHistorical]);

  const getStepStyle = (type: StepType) => {
    switch (type) {
      case StepType.THOUGHT:
        return {
          header: 'text-purple-700 font-semibold',
          bg: 'bg-purple-50/70 border-purple-100',
          label: 'Thought Process'
        };
      case StepType.ACTION:
        return {
          header: 'text-blue-700 font-semibold',
          bg: 'bg-blue-50/70 border-blue-100',
          label: 'Tool Invocation'
        };
      case StepType.OBSERVATION:
        return {
          header: 'text-emerald-700 font-semibold',
          bg: 'bg-emerald-50/70 border-emerald-100',
          label: 'System Observation'
        };
      case StepType.DECISION:
        return {
          header: 'text-amber-800 font-bold',
          bg: 'bg-amber-50 border-amber-100',
          label: 'Audit Recommendation'
        };
      default:
        return {
          header: 'text-slate-700 font-semibold',
          bg: 'bg-slate-50 border-slate-100',
          label: 'Step'
        };
    }
  };

  const downloadJSONLogs = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(traces, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `fica_telemetry_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const downloadMarkdownReport = () => {
    let mdContent = `# FICA Compliance Agent Audit Report\n`;
    mdContent += `Case Reference: ${title}\n`;
    mdContent += `Report Generated: ${new Date().toLocaleString()}\n`;
    mdContent += `Sandbox Cryptographic Hash: ${sandboxHash || "None"}\n\n`;
    mdContent += `## Compliance Reasoning Timeline\n\n`;
    traces.forEach((t) => {
      const type = t.type || t.step_type || StepType.THOUGHT;
      mdContent += `### Step ${t.step_index}: [${type}] ${t.name || ""}\n`;
      mdContent += `Timestamp: ${t.timestamp ? new Date(t.timestamp).toLocaleTimeString() : "N/A"}\n\n`;
      mdContent += `\`\`\`\n${t.content}\n\`\`\`\n\n`;
    });
    
    const dataStr = "data:text/markdown;charset=utf-8," + encodeURIComponent(mdContent);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `fica_audit_report_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Filter traces based on the toggle viewMode
  const renderedTraces = viewMode === 'clean' 
    ? visibleTraces.filter(t => t.is_clean === true)
    : visibleTraces;

  return (
    <div className="flex flex-col h-full glass-card rounded-xl overflow-hidden border border-slate-200 shadow-lg shadow-slate-100/50 animate-fadeIn">
      {/* Console Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Terminal className="w-5 h-5 text-purple-600 animate-pulse" />
          <span className="text-sm font-semibold tracking-wide text-slate-800">{title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Clean vs Noisy Toggle */}
          {traces.length > 0 && (
            <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={() => setViewMode('clean')}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                  viewMode === 'clean' ? 'bg-blue-600 text-white shadow shadow-blue-200/20' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Clean Audit
              </button>
              <button
                onClick={() => setViewMode('noisy')}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all ${
                  viewMode === 'noisy' ? 'bg-blue-600 text-white shadow shadow-blue-200/20' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Full Telemetry
              </button>
            </div>
          )}
          
          {isProcessing && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-600 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Thinking...</span>
            </div>
          )}
          
          {sandboxHash && (
            <div className="group relative flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[10px] text-slate-650 border border-slate-200 cursor-help transition-all hover:bg-slate-200/60">
              <Key className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-mono">{sandboxHash.slice(0, 8)}...</span>
              
              {/* Informative Tooltip explanation for the user */}
              <div className="absolute right-0 top-7 hidden group-hover:block z-50 bg-slate-850 text-white text-[10px] p-3 rounded-lg border border-slate-700 shadow-xl w-[280px] leading-relaxed font-sans">
                <span className="font-bold text-blue-300 block mb-1">Cryptographic Sandbox Signature</span>
                This is a SHA-256 hash of the execution sandbox environment states and results, serving as a verifiable audit ledger to prove compliance verification was run inside an untampered isolated container.
              </div>
            </div>
          )}

          {/* Download Logs options */}
          {traces.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-250">
              <button
                onClick={downloadJSONLogs}
                className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded text-[9px] font-bold flex items-center gap-1 transition-colors"
                title="Download Raw JSON Logs"
              >
                <Download className="w-3 h-3 text-slate-500" />
                Logs
              </button>
              <button
                onClick={downloadMarkdownReport}
                className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded text-[9px] font-bold flex items-center gap-1 transition-colors"
                title="Download compliance audit report (.md)"
              >
                <Download className="w-3 h-3 text-blue-500" />
                Report
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Output - internal scrolling enabled */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs leading-relaxed bg-white">
        {renderedTraces.length === 0 && !isProcessing && (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
            <Cpu className="w-10 h-10 mb-2 opacity-30 text-slate-400" />
            <p>Idle. Awaiting compliance check launch...</p>
            {viewMode === 'clean' && traces.length > 0 && (
              <p className="text-[10px] text-slate-400 mt-1">Switch to Full Telemetry to see internal steps.</p>
            )}
          </div>
        )}

        {renderedTraces.map((trace, idx) => {
          const type = trace.type || trace.step_type || StepType.THOUGHT;
          const style = getStepStyle(type);
          return (
            <div 
              key={idx} 
              className={`p-3 rounded-lg border transition-all duration-350 transform translate-y-0 opacity-100 ${style.bg} shadow-sm`}
            >
              <div className="flex items-center justify-between mb-1.5 border-b border-slate-200/50 pb-1">
                <span className={style.header}>
                  Step {trace.step_index}: {trace.name ? `${style.label} (${trace.name})` : style.label}
                </span>
                <span className="text-[10px] text-slate-400 flex items-center gap-2">
                  {trace.timestamp && <span className="text-slate-350">{new Date(trace.timestamp).toLocaleTimeString()}</span>}
                  <span className="bg-slate-100 px-1 py-0.5 rounded text-[8px] font-bold">{type}</span>
                </span>
              </div>
              <p className="text-slate-700 whitespace-pre-wrap leading-relaxed overflow-x-auto">{trace.content}</p>
            </div>
          );
        })}

        {isProcessing && visibleTraces.length === traces.length && (
          <div className="flex items-center gap-2 text-slate-400 italic animate-pulse p-2">
            <span>Evaluating next action...</span>
          </div>
        )}

        <div ref={consoleEndRef} />
      </div>

      {/* Cryptographic Ledger Footer */}
      {sandboxHash && (
        <div className="px-4 py-2 bg-emerald-50 border-t border-emerald-100 text-[10px] text-emerald-700 flex items-center justify-between">
          <span className="font-semibold tracking-wider uppercase text-emerald-600">Auditable Sandbox Lock</span>
          <span className="font-mono text-slate-600 select-all overflow-x-auto">{sandboxHash}</span>
        </div>
      )}
    </div>
  );
};
