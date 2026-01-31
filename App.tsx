import React, { useState, useEffect } from 'react';
import { FileText, Download, RefreshCw, Languages, CheckCircle2, Save, Upload, Plus, Trash2, X, Settings2, History } from 'lucide-react';
import { FileUpload } from './components/FileUpload';
import { SubtitleList } from './components/SubtitleList';
import { TrainingUpload } from './components/TrainingUpload';
import { ProjectHistory } from './components/ProjectHistory';
import { parseSRT, stringifySRT, createReferenceMap, extractStyleExamples } from './services/srtParser';
import { translateBatch } from './services/geminiService';
import { saveProject, getTrainingExamples } from './services/db';
import { SrtBlock, TranslationStatus, TranslationProgress, TranslationProject, AppMode, GlossaryTerm } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('translate');

  // Translation State
  const [file, setFile] = useState<File | null>(null);
  const [srtBlocks, setSrtBlocks] = useState<SrtBlock[]>([]);
  const [status, setStatus] = useState<TranslationStatus>('idle');
  const [progress, setProgress] = useState<TranslationProgress>({ current: 0, total: 0 });
  
  // Consistency Mode State
  const [showConsistency, setShowConsistency] = useState(false);
  const [refOriginalFile, setRefOriginalFile] = useState<File | null>(null);
  const [refTranslatedFile, setRefTranslatedFile] = useState<File | null>(null);
  
  // Glossary State
  const [glossary, setGlossary] = useState<GlossaryTerm[]>([]);
  const [newOriginal, setNewOriginal] = useState('');
  const [newTranslated, setNewTranslated] = useState('');

  const handleFileSelect = async (selectedFile: File) => {
    setFile(selectedFile);
    setStatus('parsing');
    
    const text = await selectedFile.text();
    try {
      const parsed = parseSRT(text);
      if (parsed.length === 0) {
        alert("No valid subtitles found in this file.");
        setStatus('idle');
        return;
      }
      setSrtBlocks(parsed);
      setStatus('idle');
    } catch (e) {
      console.error(e);
      alert("Failed to parse SRT file.");
      setStatus('error');
    }
  };

  const handleRefOriginalSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setRefOriginalFile(e.target.files[0]);
  };

  const handleRefTranslatedSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setRefTranslatedFile(e.target.files[0]);
  };

  const addGlossaryTerm = () => {
    if (!newOriginal.trim() || !newTranslated.trim()) return;
    const newTerm: GlossaryTerm = {
      id: crypto.randomUUID(),
      original: newOriginal.trim(),
      translated: newTranslated.trim()
    };
    setGlossary([...glossary, newTerm]);
    setNewOriginal('');
    setNewTranslated('');
  };

  const removeGlossaryTerm = (id: string) => {
    setGlossary(glossary.filter(g => g.id !== id));
  };

  const startTranslation = async () => {
    if (srtBlocks.length === 0) return;
    
    setStatus('translating');
    setProgress({ current: 0, total: srtBlocks.length, message: "Initializing translation..." });

    try {
      let referenceMap: Map<string, string> | null = null;
      let consistencyExamples: { original: string, translated: string }[] = [];
      let trainingExamples: { original: string, translated: string }[] = [];

      // 1. Fetch persistent training data (The "Brain")
      try {
        setProgress({ current: 0, total: srtBlocks.length, message: "Loading training memory..." });
        trainingExamples = await getTrainingExamples(30);
      } catch (e) {
        console.warn("Failed to load training data", e);
      }

      // 2. Generate Map and Style Examples if consistency mode is active
      if (refOriginalFile && refTranslatedFile) {
        setProgress({ current: 0, total: srtBlocks.length, message: "Parsing previous episode..." });
        const orgText = await refOriginalFile.text();
        const transText = await refTranslatedFile.text();
        
        // Exact matches for recurring lines
        referenceMap = createReferenceMap(orgText, transText);
        
        // Context examples for similar lines (Names, Places)
        consistencyExamples = extractStyleExamples(orgText, transText);
      }

      const translated = await translateBatch(
        srtBlocks, 
        referenceMap,
        consistencyExamples,
        trainingExamples,
        glossary,
        (currentCount, message) => {
          setProgress({ 
            current: currentCount, 
            total: srtBlocks.length,
            message: message 
          });
        }
      );
      
      setSrtBlocks(translated);
      setStatus('completed');
    } catch (e) {
      console.error(e);
      alert("Translation failed. Check console for details.");
      setStatus('error');
    }
  };

  const handleTextChange = (id: number, newText: string) => {
    setSrtBlocks(prev => prev.map(block => 
      block.id === id ? { ...block, translatedText: newText } : block
    ));
  };

  const saveToDatabase = async () => {
    if (!file || srtBlocks.length === 0) return;
    const project: TranslationProject = {
      id: crypto.randomUUID(),
      fileName: file.name,
      createdAt: Date.now(),
      blocks: srtBlocks,
      isExternalImport: false
    };
    await saveProject(project);
    alert("Project saved to database for training!");
  };

  const handleDownload = async () => {
    if (srtBlocks.length === 0) return;
    await saveToDatabase(); // Auto-save
    const content = stringifySRT(srtBlocks);
    const blob = new Blob([content], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mm_${file?.name || 'translated.srt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleReset = () => {
    setFile(null);
    setSrtBlocks([]);
    setStatus('idle');
    setProgress({ current: 0, total: 0 });
    setRefOriginalFile(null);
    setRefTranslatedFile(null);
    setShowConsistency(false);
  };

  const NavButton = ({ active, onClick, label, icon: Icon }: { active: boolean, onClick: () => void, label: string, icon: any }) => (
    <button 
      onClick={onClick}
      className={`
        relative px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 flex items-center gap-2
        ${active 
          ? 'text-white bg-gradient-to-r from-indigo-600 to-violet-600 shadow-lg shadow-indigo-500/30 ring-2 ring-white/20' 
          : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
        }
      `}
    >
      <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-slate-400'}`} />
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 font-sans text-slate-900 pb-20 selection:bg-indigo-100 selection:text-indigo-800">
      
      {/* Navbar */}
      <nav className="sticky top-0 z-30 backdrop-blur-xl bg-white/70 border-b border-white/20 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setMode('translate')}>
            <div className="bg-gradient-to-br from-indigo-600 to-violet-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-300">
              <Languages className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-slate-800">Subtitle</span>
              <span className="font-extrabold text-xl tracking-tight text-indigo-600">Translator</span>
            </div>
          </div>
          
          <div className="hidden md:flex gap-2 bg-slate-100/50 p-1.5 rounded-2xl border border-white/50 backdrop-blur-md">
            <NavButton active={mode === 'translate'} onClick={() => setMode('translate')} label="Translate" icon={RefreshCw} />
            <NavButton active={mode === 'history'} onClick={() => setMode('history')} label="History" icon={History} />
            <NavButton active={mode === 'train'} onClick={() => setMode('train')} label="Import Data" icon={Upload} />
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 mt-10">
        
        {/* MODE: TRANSLATOR */}
        {mode === 'translate' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            
            {/* Step 1: Upload */}
            {status === 'idle' && !file && (
              <div className="max-w-2xl mx-auto mt-20 text-center">
                <div className="mb-10 relative">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl"></div>
                  <h1 className="relative text-4xl font-extrabold text-slate-900 mb-4 tracking-tight">
                    English to <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Myanmar</span>
                  </h1>
                  <p className="text-lg text-slate-500 font-medium">Upload your .srt file for natural, AI-powered translations.</p>
                </div>
                <FileUpload onFileSelect={handleFileSelect} />
              </div>
            )}

            {file && (
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl shadow-indigo-500/5 border border-white/50 overflow-hidden ring-1 ring-slate-900/5">
                
                {/* Header & Controls */}
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white/50">
                  <div className="flex items-center gap-5">
                     <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100">
                        <FileText className="w-8 h-8 text-indigo-600" />
                     </div>
                     <div>
                        <h2 className="font-bold text-slate-900 text-xl leading-tight">{file.name}</h2>
                        <div className="flex items-center gap-3 mt-1.5 text-sm font-medium text-slate-500">
                           <span className="bg-slate-100 px-2 py-0.5 rounded-md">{srtBlocks.length} lines</span>
                           <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                           <span className={`${status === 'completed' ? "text-green-600 bg-green-50 px-2 py-0.5 rounded-md border border-green-100" : "text-slate-500 capitalize"}`}>{status}</span>
                        </div>
                     </div>
                  </div>

                  <div className="flex gap-3">
                    {status === 'idle' && (
                      <button onClick={handleReset} className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors">
                        Cancel
                      </button>
                    )}
                    
                    {status === 'idle' && (
                      <button 
                        onClick={() => setShowConsistency(!showConsistency)}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl border transition-all ${
                          showConsistency || glossary.length > 0 
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm' 
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 shadow-sm'
                        }`}
                      >
                        <Settings2 className="w-4 h-4" />
                        Consistency
                        {(glossary.length > 0 || (refOriginalFile && refTranslatedFile)) && (
                          <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                        )}
                      </button>
                    )}

                    {status === 'idle' && (
                       <button 
                        onClick={startTranslation}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all"
                       >
                         <RefreshCw className="w-4 h-4" />
                         Start Translating
                       </button>
                    )}

                    {status === 'completed' && (
                      <button 
                        onClick={handleDownload}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-xl shadow-lg shadow-emerald-500/30 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all"
                      >
                        <Download className="w-4 h-4" />
                        Download .srt
                      </button>
                    )}
                  </div>
                </div>

                {/* Consistency Settings Panel */}
                {(showConsistency && status === 'idle') && (
                  <div className="bg-slate-50/80 border-b border-slate-200 p-8 animate-in slide-in-from-top-2 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      
                      {/* 1. Episode Match */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                           <div className="bg-white p-1.5 rounded-lg shadow-sm">
                             <Upload className="w-4 h-4 text-indigo-600" />
                           </div>
                           <h3 className="text-sm font-bold text-slate-900">Previous Episode Reference</h3>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Upload Episode 1 files (Original & Translated) to automatically match recurring lines like intros, songs, or recaps.
                        </p>
                        <div className="space-y-3">
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-indigo-300 transition-colors">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Original (English)</label>
                            <input type="file" accept=".srt" onChange={handleRefOriginalSelect} className="text-xs w-full text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer" />
                          </div>
                          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-indigo-300 transition-colors">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">Translated (Myanmar)</label>
                            <input type="file" accept=".srt" onChange={handleRefTranslatedSelect} className="text-xs w-full text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer" />
                          </div>
                        </div>
                      </div>

                      {/* 2. Glossary */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                           <div className="bg-white p-1.5 rounded-lg shadow-sm">
                             <FileText className="w-4 h-4 text-indigo-600" />
                           </div>
                           <h3 className="text-sm font-bold text-slate-900">Name & Term Glossary</h3>
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          Force specific translations for character names, places, or technical terms to maintain consistency.
                        </p>
                        
                        <div className="bg-white border border-slate-200 rounded-xl p-2 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                           <div className="flex items-center gap-2">
                             <input 
                               type="text" 
                               placeholder="Name (e.g. John)" 
                               value={newOriginal}
                               onChange={(e) => setNewOriginal(e.target.value)}
                               className="flex-1 text-sm border-none bg-transparent focus:ring-0 placeholder:text-slate-400 font-medium"
                             />
                             <span className="text-slate-300">→</span>
                             <input 
                               type="text" 
                               placeholder="Translation (e.g. ဂျွန်)" 
                               value={newTranslated}
                               onChange={(e) => setNewTranslated(e.target.value)}
                               className="flex-1 text-sm border-none bg-transparent focus:ring-0 placeholder:text-slate-400 mm-text"
                             />
                             <button onClick={addGlossaryTerm} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors">
                               <Plus className="w-4 h-4" />
                             </button>
                           </div>
                        </div>

                        {glossary.length > 0 && (
                          <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100 max-h-[160px] overflow-y-auto shadow-sm">
                            {glossary.map(term => (
                              <div key={term.id} className="flex items-center justify-between p-3 text-sm group hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-3">
                                  <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">{term.original}</span>
                                  <span className="text-slate-300">→</span>
                                  <span className="text-indigo-700 font-medium mm-text">{term.translated}</span>
                                </div>
                                <button onClick={() => removeGlossaryTerm(term.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-all">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                {status === 'translating' && (
                  <div className="border-b border-slate-100 bg-slate-50">
                    <div className="h-1.5 w-full bg-slate-200 overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 w-[200%] animate-gradient-x" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
                    </div>
                    <div className="px-6 py-2.5 flex justify-between text-xs font-bold text-slate-600 bg-indigo-50/50">
                      <span className="flex items-center gap-2">
                        <RefreshCw className="w-3 h-3 animate-spin text-indigo-500" />
                        {progress.message}
                      </span>
                      <span className="bg-white px-2 py-0.5 rounded shadow-sm border border-indigo-100 text-indigo-700">{Math.round((progress.current / progress.total) * 100)}%</span>
                    </div>
                  </div>
                )}
                
                {/* Editor Area */}
                <div className="bg-slate-50/50 min-h-[600px]">
                  <SubtitleList blocks={srtBlocks} onTextChange={handleTextChange} />
                </div>

              </div>
            )}
          </div>
        )}

        {/* MODE: HISTORY */}
        {mode === 'history' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="mb-8 flex items-end justify-between">
                <div>
                   <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Project History</h2>
                   <p className="text-slate-500 mt-1 font-medium">Manage your previous translations and training data.</p>
                </div>
             </div>
             <ProjectHistory />
          </div>
        )}

        {/* MODE: TRAIN */}
        {mode === 'train' && (
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <TrainingUpload onSuccess={() => alert("Training data imported successfully.")} />
          </div>
        )}

      </div>
    </div>
  );
};

export default App;
