import React, { useState } from 'react';
import { Upload, ArrowRight, Save, FileCheck, BrainCircuit, X, MessageSquarePlus, Bot } from 'lucide-react';
import { alignSrts, parseSRT } from '../services/srtParser';
import { saveProject } from '../services/db';
import { generateTrainingFeedback } from '../services/geminiService';
import { TranslationProject } from '../types';

interface TrainingUploadProps {
  onSuccess: () => void;
}

export const TrainingUpload: React.FC<TrainingUploadProps> = ({ onSuccess }) => {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);
  const [humanFile, setHumanFile] = useState<File | null>(null);
  const [instructions, setInstructions] = useState('');
  
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleProcess = async () => {
    if (!originalFile || !aiFile || !humanFile) return;

    setProcessing(true);
    try {
      const originalText = await originalFile.text();
      const aiText = await aiFile.text();
      const humanText = await humanFile.text();

      // 1. Prepare Data for DB (Original + Human only)
      const alignedForDb = alignSrts(originalText, humanText);
      if (alignedForDb.length === 0) {
        throw new Error("Could not align Original and Human files.");
      }

      // 2. Prepare Data for Feedback (Original + AI + Human)
      const originalBlocks = parseSRT(originalText);
      const aiBlocks = parseSRT(aiText);
      const humanBlocks = parseSRT(humanText);

      // Map by ID for easy lookup
      const aiMap = new Map(aiBlocks.map(b => [b.id, b.originalText]));
      const humanMap = new Map(humanBlocks.map(b => [b.id, b.originalText]));

      // Find differences to send to AI
      const diffExamples = [];
      for (const orig of originalBlocks) {
        const aiTxt = aiMap.get(orig.id);
        const humanTxt = humanMap.get(orig.id);

        if (aiTxt && humanTxt && aiTxt.trim() !== humanTxt.trim()) {
           diffExamples.push({
             original: orig.originalText.replace(/\n/g, ' '),
             aiDraft: aiTxt.replace(/\n/g, ' '),
             humanEdit: humanTxt.replace(/\n/g, ' ')
           });
        }
        // Limit to 20 significant examples to save tokens/time
        if (diffExamples.length >= 20) break;
      }

      // 3. Save to DB
      const project: TranslationProject = {
        id: crypto.randomUUID(),
        fileName: `${humanFile.name} (Training Data)`,
        createdAt: Date.now(),
        blocks: alignedForDb,
        isExternalImport: true
      };
      await saveProject(project);

      // 4. Generate Feedback
      if (diffExamples.length > 0) {
        const feedbackText = await generateTrainingFeedback(diffExamples, instructions);
        setFeedback(feedbackText);
      } else {
        setFeedback("No significant differences found between AI Draft and Human Edit. Great job!");
      }

      // Reset inputs (but keep feedback open)
      setOriginalFile(null);
      setAiFile(null);
      setHumanFile(null);
      setInstructions('');
      onSuccess();

    } catch (e) {
      console.error(e);
      alert("Failed to process files. Please check format.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-5xl mx-auto">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-indigo-600" />
            Train & Improve AI
          </h2>
          <p className="text-slate-600 text-sm mt-1">
            Upload the 3 versions of your subtitles. The AI will compare its draft against your corrections to learn and improve.
          </p>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mb-8">
            
            {/* Step 1: Original */}
            <div className="relative">
              <span className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Step 1</span>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors relative h-32">
                <input 
                  type="file" 
                  accept=".srt" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={(e) => e.target.files?.[0] && setOriginalFile(e.target.files[0])}
                />
                {originalFile ? (
                  <div className="text-center animate-in fade-in zoom-in duration-300">
                    <FileCheck className="w-8 h-8 text-green-500 mb-2 mx-auto" />
                    <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{originalFile.name}</p>
                    <p className="text-[10px] text-slate-400">Original English</p>
                  </div>
                ) : (
                  <div className="text-center text-slate-400">
                    <Upload className="w-6 h-6 mb-2 mx-auto" />
                    <p className="text-xs font-bold">Original File</p>
                    <p className="text-[10px] opacity-70">(English)</p>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: AI Draft */}
            <div className="relative">
               <span className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Step 2</span>
               <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors relative h-32">
                  <input 
                    type="file" 
                    accept=".srt" 
                    className="absolute inset-0 opacity-0 cursor-pointer" 
                    onChange={(e) => e.target.files?.[0] && setAiFile(e.target.files[0])}
                  />
                  {aiFile ? (
                    <div className="text-center animate-in fade-in zoom-in duration-300">
                      <FileCheck className="w-8 h-8 text-amber-500 mb-2 mx-auto" />
                      <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{aiFile.name}</p>
                      <p className="text-[10px] text-slate-400">AI Draft</p>
                    </div>
                  ) : (
                    <div className="text-center text-slate-400">
                      <Bot className="w-6 h-6 mb-2 mx-auto" />
                      <p className="text-xs font-bold">AI Draft File</p>
                      <p className="text-[10px] opacity-70">(Before Edit)</p>
                    </div>
                  )}
               </div>
            </div>

            {/* Step 3: Human Edit */}
            <div className="relative">
              <span className="absolute -top-3 left-4 bg-white px-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Step 3</span>
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors relative h-32">
                 <input 
                  type="file" 
                  accept=".srt" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={(e) => e.target.files?.[0] && setHumanFile(e.target.files[0])}
                />
                 {humanFile ? (
                   <div className="text-center animate-in fade-in zoom-in duration-300">
                     <FileCheck className="w-8 h-8 text-indigo-500 mb-2 mx-auto" />
                     <p className="text-xs font-bold text-slate-700 truncate max-w-[120px]">{humanFile.name}</p>
                     <p className="text-[10px] text-slate-400">Human Edited</p>
                   </div>
                ) : (
                   <div className="text-center text-slate-400">
                     <Save className="w-6 h-6 mb-2 mx-auto" />
                     <p className="text-xs font-bold">Final Edited File</p>
                     <p className="text-[10px] opacity-70">(Your Correction)</p>
                   </div>
                )}
              </div>
            </div>

          </div>

          {/* User Instructions */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
               <MessageSquarePlus className="w-4 h-4 text-indigo-600" />
               <label className="text-sm font-bold text-slate-700">Suggestions & Instructions (Optional)</label>
            </div>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Tell the AI what specifically to focus on (e.g., 'Don't use formal pronouns', 'Use more slang for this character')..."
              className="w-full h-24 p-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm text-slate-800 placeholder:text-slate-400 resize-none shadow-sm"
            />
          </div>

          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              onClick={handleProcess}
              disabled={!originalFile || !aiFile || !humanFile || processing}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white transition-all transform active:scale-95
                ${!originalFile || !aiFile || !humanFile || processing 
                  ? 'bg-slate-300 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40'
                }`}
            >
              {processing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Comparing & Learning...</span>
                </>
              ) : (
                <>
                  <BrainCircuit className="w-5 h-5" />
                  Analyze & Train
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Feedback Modal */}
      {feedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-300 flex flex-col max-h-[90vh]">
            <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-3">
                 <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
                   <Bot className="w-6 h-6 text-white" />
                 </div>
                 <h3 className="text-xl font-bold text-white">Training Feedback</h3>
               </div>
               <button onClick={() => setFeedback(null)} className="text-white/70 hover:text-white transition-colors bg-white/10 hover:bg-white/20 p-2 rounded-lg">
                 <X className="w-5 h-5" />
               </button>
            </div>
            
            <div className="p-8 overflow-y-auto">
               <div className="prose prose-indigo max-w-none text-slate-700 leading-relaxed">
                 <div className="flex items-start gap-4 mb-6 bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <span className="text-2xl">💡</span>
                    <p className="text-sm font-medium text-indigo-900 m-0">
                      I have analyzed your corrections and updated my internal understanding for future translations. Here is what I learned:
                    </p>
                 </div>
                 {/* Render Feedback with markdown-like styling */}
                 <div className="whitespace-pre-wrap font-medium">{feedback}</div>
               </div>
            </div>
            
            <div className="p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex justify-end">
              <button 
                onClick={() => setFeedback(null)}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-indigo-500/20"
              >
                Awesome, Keep it up!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
