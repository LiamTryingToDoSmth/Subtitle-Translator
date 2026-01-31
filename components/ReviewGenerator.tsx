import React, { useState } from 'react';
import { Search, Sparkles, AlertCircle, ExternalLink } from 'lucide-react';
import { generateMovieReview } from '../services/geminiService';

export const ReviewGenerator: React.FC = () => {
  const [movieName, setMovieName] = useState('');
  const [reviewData, setReviewData] = useState<{ text: string; sources: { title: string; uri: string }[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!movieName.trim()) return;
    setLoading(true);
    setReviewData(null);
    setError('');
    try {
      const result = await generateMovieReview(movieName);
      setReviewData(result);
    } catch (e) {
      setError("Error generating review. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-3xl mx-auto">
      <div className="p-6 border-b border-slate-200 bg-slate-50">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-indigo-600" />
          AI Movie Review Generator
        </h2>
        <p className="text-slate-600 text-sm mt-1">
          Search for a movie title, and the AI will research it online to write a natural, engaging Myanmar review.
        </p>
      </div>

      <div className="p-6 space-y-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={movieName}
            onChange={(e) => setMovieName(e.target.value)}
            placeholder="Enter movie name (e.g., Inception, Breaking Bad)..."
            className="flex-1 rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-slate-900"
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
          <button
            onClick={handleGenerate}
            disabled={loading || !movieName}
            className={`px-6 py-2.5 rounded-lg font-semibold text-white flex items-center gap-2 transition-all ${
              loading || !movieName ? 'bg-slate-400' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {loading ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"/> : <Search className="w-4 h-4" />}
            Generate
          </button>
        </div>

        {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
            </div>
        )}

        {reviewData && (
          <div className="bg-indigo-50/50 rounded-xl p-6 border border-indigo-100">
             <div className="prose prose-indigo max-w-none text-slate-800 mm-text whitespace-pre-wrap leading-loose">
               {reviewData.text}
             </div>
             
             {reviewData.sources.length > 0 && (
                <div className="mt-6 pt-4 border-t border-indigo-200/60">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sources</h4>
                    <div className="grid gap-2">
                        {reviewData.sources.map((source, idx) => (
                            <a 
                                key={idx} 
                                href={source.uri} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-800 transition-colors bg-white/50 p-2 rounded hover:bg-white"
                            >
                                <ExternalLink className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{source.title}</span>
                            </a>
                        ))}
                    </div>
                </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};
