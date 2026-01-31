import React from 'react';
import { SrtBlock } from '../types';
import { Clock, Repeat, Edit3 } from 'lucide-react';

interface SubtitleListProps {
  blocks: SrtBlock[];
  onTextChange: (id: number, newText: string) => void;
}

export const SubtitleList: React.FC<SubtitleListProps> = ({ blocks, onTextChange }) => {
  if (blocks.length === 0) return null;

  return (
    <div className="w-full bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-2 bg-slate-50/80 border-b border-slate-200 text-slate-500 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm">
        <div className="p-4 border-b md:border-b-0 md:border-r border-slate-200">Original (English)</div>
        <div className="p-4 flex justify-between items-center">
          <span>Translated (Myanmar)</span>
        </div>
      </div>
      
      <div className="max-h-[700px] overflow-y-auto divide-y divide-slate-100">
        {blocks.map((block) => (
          <div key={block.id} className="grid grid-cols-1 md:grid-cols-2 group hover:bg-slate-50/50 transition-colors">
            {/* Original */}
            <div className="p-5 border-b md:border-b-0 md:border-r border-slate-100 relative">
              <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-2 font-mono opacity-60">
                <span className="bg-slate-100 px-1.5 py-0.5 rounded">#{block.id}</span>
                <Clock className="w-3 h-3" />
                <span>{block.startTime}</span>
              </div>
              <p className="text-slate-700 text-[15px] leading-relaxed font-normal">
                {block.originalText}
              </p>
            </div>

            {/* Translated (Editable) */}
            <div className="p-5 relative">
               {block.translatedText !== undefined ? (
                <div className="relative h-full">
                   {block.isFromReference && (
                     <div className="absolute -top-3 right-0 bg-indigo-50 text-indigo-600 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 border border-indigo-100" title="Matched from Episode 1 Reference">
                       <Repeat className="w-3 h-3" />
                       <span>Ep 1 Match</span>
                     </div>
                   )}
                  <textarea
                    value={block.translatedText}
                    onChange={(e) => onTextChange(block.id, e.target.value)}
                    className="w-full h-full bg-transparent border-0 focus:ring-0 p-0 text-slate-900 text-[15px] leading-relaxed whitespace-pre-wrap mm-text resize-none focus:bg-white focus:shadow-sm rounded transition-all min-h-[3rem]"
                    rows={Math.max(2, block.translatedText.split('\n').length)}
                  />
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <Edit3 className="w-3 h-3 text-slate-300" />
                  </div>
                </div>
               ) : (
                 <div className="space-y-2 mt-4 opacity-50">
                    <div className="h-2 w-3/4 bg-slate-100 rounded"></div>
                    <div className="h-2 w-1/2 bg-slate-100 rounded"></div>
                 </div>
               )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
