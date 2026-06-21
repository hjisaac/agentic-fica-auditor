import React, { useState } from 'react';
import { 
  ShieldCheck, 
  UserCheck, 
  Building2, 
  History, 
  Cpu, 
  Lock, 
  Code,
  Layers
} from 'lucide-react';
import { KYCForm } from './components/KYCForm';
import { KYBForm } from './components/KYBForm';
import { BatchForm } from './components/BatchForm';
import { ThinkingConsole, Trace } from './components/ThinkingConsole';
import { AuditList } from './components/AuditList';
import { CaseType } from './types';

type Tab = CaseType | 'batch' | 'cases';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(CaseType.KYC);
  const [currentTraces, setCurrentTraces] = useState<Trace[]>([]);
  const [currentHash, setCurrentHash] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isHistorical, setIsHistorical] = useState<boolean>(false);
  
  // Selected historical case for detailed audit trace
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  const handleStartVerify = () => {
    setIsProcessing(true);
    setCurrentTraces([]);
    setCurrentHash('');
    setSelectedCaseId(null);
    setIsHistorical(false);
  };

  const handleVerificationComplete = (result: any, traces: Trace[]) => {
    setIsProcessing(false);
    setCurrentTraces(traces);
    setCurrentHash(result.sandbox_hash);
    setSelectedCaseId(result.id);
    setIsHistorical(false);
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSelectCase = async (caseId: string) => {
    setSelectedCaseId(caseId);
    setIsProcessing(true);
    setIsHistorical(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/audit`);
      const data = await res.json();
      if (res.ok) {
        // Direct loading of history traces without simulation delay
        setCurrentTraces(data.traces);
        setCurrentHash(data.sandbox_hash);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectSubCase = (subCaseId: string, traces: Trace[], hash: string) => {
    setSelectedCaseId(subCaseId);
    setCurrentTraces(traces);
    setCurrentHash(hash);
    setIsHistorical(true);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Header bar */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm shadow-slate-100/50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-blue-600 to-purple-600 rounded-lg text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 flex items-center gap-2">
                FRAUDCHECK
                <span className="text-[10px] font-semibold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-200">
                  FICA AI COMPLIANCE
                </span>
              </h1>
              <p className="text-[10px] text-slate-500">Automated KYC/KYB Sandbox Engine</p>
            </div>
          </div>

          {/* Quick Architecture Indicators */}
          <div className="hidden md:flex items-center gap-6 text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-mono">
              <Cpu className="w-4 h-4 text-purple-600" />
              AI Synthesis: ACTIVE
            </span>
            <span className="flex items-center gap-1.5 font-mono">
              <Lock className="w-4 h-4 text-emerald-600" />
              SHA-256 Ledger: ACTIVE
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
        
        {/* Left Side: Navigation Tabs and Input Forms */}
        <div className="lg:col-span-6 space-y-6 flex flex-col h-[750px]">
          {/* Tab buttons */}
          <div className="flex p-1 bg-slate-200/60 rounded-xl border border-slate-200 flex-shrink-0">
            <button
              onClick={() => setActiveTab(CaseType.KYC)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === CaseType.KYC ? 'bg-blue-600 text-white shadow-md shadow-blue-200/40' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              Individual KYC
            </button>
            <button
              onClick={() => setActiveTab(CaseType.KYB)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === CaseType.KYB ? 'bg-blue-600 text-white shadow-md shadow-blue-200/40' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-4 h-4" />
              Corporate KYB
            </button>
            <button
              onClick={() => setActiveTab('batch')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'batch' ? 'bg-blue-600 text-white shadow-md shadow-blue-200/40' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              Batch KYC
            </button>
            <button
              onClick={() => setActiveTab('cases')}
              className={`flex-1 py-2 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                activeTab === 'cases' ? 'bg-blue-600 text-white shadow-md shadow-blue-200/40' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-4 h-4" />
              Case Database
            </button>
          </div>

          {/* Form containers */}
          <div className="flex-1 glass-panel rounded-2xl p-6 border border-slate-200 shadow-xl shadow-slate-200/30 overflow-y-auto min-h-0 bg-white">
            {activeTab === CaseType.KYC && (
              <KYCForm 
                onStartVerify={handleStartVerify}
                onVerificationComplete={handleVerificationComplete}
              />
            )}
            {activeTab === CaseType.KYB && (
              <KYBForm 
                onStartVerify={handleStartVerify}
                onVerificationComplete={handleVerificationComplete}
                onSelectSubCase={handleSelectSubCase}
              />
            )}
            {activeTab === 'batch' && (
              <BatchForm
                onStartVerify={handleStartVerify}
                onVerificationComplete={handleVerificationComplete}
              />
            )}
            {activeTab === 'cases' && (
              <div className="space-y-4">
                <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <History className="w-5 h-5 text-blue-500" />
                  FICA Case Management Database
                </h3>
                <AuditList 
                  onSelectAudit={handleSelectCase}
                  selectedTxId={selectedCaseId}
                  refreshTrigger={refreshTrigger}
                  onSelectSubCase={handleSelectSubCase}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Agent Thinking Terminal */}
        <div className="lg:col-span-6 flex flex-col h-[750px] min-h-0">
          <ThinkingConsole 
            traces={currentTraces} 
            sandboxHash={currentHash} 
            isProcessing={isProcessing}
            isHistorical={isHistorical}
            title={selectedCaseId ? `Auditing Case: ${selectedCaseId}` : undefined}
          />
        </div>
      </main>

      {/* Footer bar */}
      <footer className="border-t border-slate-200 bg-slate-100/60 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <span className="font-mono text-[10px]">Zero-Dependency SQLite ORM • ReAct Execution Sandbox</span>
          <span className="flex items-center gap-1.5">
            Built for Fraudcheck FICA Compliance Platform
            <Code className="w-4 h-4 text-blue-600" />
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
