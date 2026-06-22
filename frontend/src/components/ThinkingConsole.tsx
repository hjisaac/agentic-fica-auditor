import React, { useEffect, useRef, useState } from 'react';
import { Terminal, Cpu, Loader2, Key, Download } from 'lucide-react';
import { StepType } from '../types';
import { jsPDF } from 'jspdf';

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
    }, 800); // 1.2s delay between reasoning steps

    return () => clearInterval(interval);
  }, [traces, isHistorical]);

  const getStepStyle = (type: StepType, content?: string) => {
    if (content && content.startsWith('[API WARNING]')) {
      return {
        header: 'text-amber-800 font-bold',
        bg: 'bg-amber-50/80 border-amber-300 border-2',
        label: 'System Warning'
      };
    }
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

  const downloadPDFReport = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let y = 20;

    const addPageIfNeeded = (neededHeight: number) => {
      if (y + neededHeight > 275) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    };

    // --- Header ---
    doc.setFillColor(30, 41, 59); // Slate 800
    doc.rect(0, 0, 210, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('FICA Compliance Audit Report', 15, 18);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(203, 213, 225); // Slate 300
    doc.text(`Generated: ${new Date().toLocaleString()}`, 15, 25);
    doc.text(`Case Reference: ${title}`, 15, 30);

    y = 50;

    // --- Sandbox Hash Section ---
    if (sandboxHash) {
      doc.setFillColor(240, 253, 250); // Emerald 50
      doc.setDrawColor(204, 251, 241); // Emerald 100
      doc.rect(15, y, 180, 18, 'FD');

      doc.setTextColor(4, 120, 87); // Emerald 700
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('VERIFIABLE SANDBOX CRYPTOGRAPHIC SIGNATURE', 20, y + 6);

      doc.setTextColor(51, 65, 85); // Slate 700
      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);
      doc.text(sandboxHash, 20, y + 12);
      
      y += 28;
    }

    // --- Title ---
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('Compliance Reasoning Timeline', 15, y);
    y += 8;

    doc.setDrawColor(226, 232, 240); // Slate 200
    doc.line(15, y, 195, y);
    y += 10;

    // --- Traces ---
    traces.forEach((t) => {
      const type = t.type || t.step_type || StepType.THOUGHT;
      
      // Determine step color and label
      let color = [100, 116, 139]; // Slate
      let label = 'Step';
      switch (type) {
        case StepType.THOUGHT:
          color = [126, 34, 206]; // Purple
          label = 'Thought Process';
          break;
        case StepType.ACTION:
          color = [29, 78, 216]; // Blue
          label = 'Tool Invocation';
          break;
        case StepType.OBSERVATION:
          color = [4, 120, 87]; // Emerald
          label = 'System Observation';
          break;
        case StepType.DECISION:
          color = [180, 83, 9]; // Amber
          label = 'Audit Recommendation';
          break;
      }

      // Check if we need a new page for the step header + meta + a bit of content
      addPageIfNeeded(30);

      // Draw left vertical accent bar
      doc.setFillColor(color[0], color[1], color[2]);
      doc.rect(15, y - 4, 1.5, 12, 'F');

      // Draw step label
      doc.setTextColor(color[0], color[1], color[2]);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      const stepTitle = `Step ${t.step_index}: ${label}${t.name ? ` (${t.name})` : ''}`;
      doc.text(stepTitle, 19, y);
      y += 5;

      // Draw timestamp
      if (t.timestamp) {
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(8);
        doc.text(new Date(t.timestamp).toLocaleTimeString(), 19, y);
        y += 5;
      }

      // Draw content
      doc.setTextColor(51, 65, 85); // Slate 700
      doc.setFont('courier', 'normal');
      doc.setFontSize(8.5);

      const contentLines = doc.splitTextToSize(t.content, 175);
      contentLines.forEach((line: string) => {
        addPageIfNeeded(6);
        doc.text(line, 19, y);
        y += 4.5;
      });

      y += 8; // spacing between steps
    });

    doc.save(`fica_audit_report_${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
  };

  // Filter traces based on the toggle viewMode
  const renderedTraces = viewMode === 'clean' 
    ? visibleTraces.filter(t => t.is_clean === true)
    : visibleTraces;

  return (
    <div className="flex flex-col h-full glass-card rounded-xl overflow-hidden border border-slate-200 shadow-lg shadow-slate-100/50 animate-fadeIn">
      {/* Console Header */}
      <div className="relative z-10 flex flex-col gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2 w-full">
          <Terminal className="w-5 h-5 text-purple-600 animate-pulse flex-shrink-0" />
          <span className="text-sm font-semibold tracking-wide text-slate-800 break-all">{title}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full">
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
            <div className="group relative flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 border border-slate-200 cursor-help transition-all hover:bg-slate-200/60">
              <Key className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-mono">{sandboxHash.slice(0, 8)}...</span>
              
              {/* Informative Tooltip explanation for the user */}
              <div className="absolute right-0 top-7 hidden group-hover:block z-50 bg-slate-900 text-white text-[10px] p-3 rounded-lg border border-slate-700 shadow-xl w-[280px] leading-relaxed font-sans">
                <span className="font-bold text-blue-300 block mb-1">Cryptographic Sandbox Signature</span>
                This is a SHA-256 hash of the execution sandbox environment states and results, serving as a verifiable audit ledger to prove compliance verification was run inside an untampered isolated container.
              </div>
            </div>
          )}

          {/* Download Logs options */}
          {traces.length > 0 && (
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                onClick={downloadJSONLogs}
                className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded text-[9px] font-bold flex items-center gap-1 transition-colors"
                title="Download Raw JSON Logs"
              >
                <Download className="w-3 h-3 text-slate-500" />
                Logs
              </button>
              <button
                onClick={downloadPDFReport}
                className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 rounded text-[9px] font-bold flex items-center gap-1 transition-colors"
                title="Download compliance audit report (.pdf)"
              >
                <Download className="w-3 h-3 text-red-500" />
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
            <p>Idle. Awaiting compliance check...</p>
            {viewMode === 'clean' && traces.length > 0 && (
              <p className="text-[10px] text-slate-400 mt-1">Switch to Full Telemetry to see internal steps.</p>
            )}
          </div>
        )}

        {renderedTraces.map((trace, idx) => {
          const type = trace.type || trace.step_type || StepType.THOUGHT;
          const style = getStepStyle(type, trace.content);
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
