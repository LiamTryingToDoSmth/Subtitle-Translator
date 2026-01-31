import React, { useState, useEffect } from 'react';
import { Trash2, FileText, Calendar, Download, Clock } from 'lucide-react';
import { getAllProjects, deleteProject } from '../services/db';
import { TranslationProject } from '../types';
import { stringifySRT } from '../services/srtParser';

export const ProjectHistory: React.FC = () => {
  const [projects, setProjects] = useState<TranslationProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await getAllProjects();
      setProjects(data);
    } catch (error) {
      console.error('Failed to load projects', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this project?')) {
      await deleteProject(id);
      loadProjects();
    }
  };

  const handleDownload = (project: TranslationProject) => {
    const content = stringifySRT(project.blocks);
    const blob = new Blob([content], { type: 'text/srt' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mm_${project.fileName}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) return (
    <div className="flex justify-center items-center py-20 text-indigo-400">
      <div className="animate-pulse flex items-center gap-2">
        <Clock className="w-5 h-5" />
        <span className="font-medium">Loading history...</span>
      </div>
    </div>
  );

  if (projects.length === 0) {
    return (
      <div className="text-center py-24 bg-white/60 backdrop-blur-sm rounded-3xl border-2 border-dashed border-indigo-100 mx-auto max-w-2xl">
        <div className="bg-indigo-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-indigo-400" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">No history yet</h3>
        <p className="text-slate-500">Your translation projects and imported data will appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20">
      {projects.map((project) => (
        <div 
          key={project.id} 
          className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 border border-slate-100 hover:border-indigo-100 transition-all duration-300 group relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-indigo-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          
          <div className="flex justify-between items-start mb-4 pl-2">
            <div className="flex items-center gap-4">
              <div className={`p-3.5 rounded-xl shadow-inner ${
                project.isExternalImport 
                  ? 'bg-amber-100 text-amber-600 ring-1 ring-amber-200' 
                  : 'bg-indigo-100 text-indigo-600 ring-1 ring-indigo-200'
              }`}>
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-lg leading-tight line-clamp-1 mb-1" title={project.fileName}>
                  {project.fileName}
                </h3>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                  {project.isExternalImport && (
                    <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border border-amber-200">
                      Training Data
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <button 
              onClick={(e) => handleDelete(project.id, e)}
              className="p-2.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 transform translate-x-2 group-hover:translate-x-0"
              title="Delete Project"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-slate-50 pl-2">
            <div className="flex items-center gap-1.5 text-slate-500 text-sm font-medium">
               <span className="text-slate-900 font-bold">{project.blocks.length}</span> subtitles
            </div>
            <button 
              onClick={() => handleDownload(project)}
              className="px-4 py-2 bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg text-sm font-bold transition-all flex items-center gap-2 group/btn"
            >
              <Download className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
              Download
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
