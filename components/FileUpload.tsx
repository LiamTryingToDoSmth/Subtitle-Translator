import React, { useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileSelect, disabled }) => {
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (disabled) return;
      
      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith('.srt')) {
        onFileSelect(file);
      } else {
        alert('Please upload a valid .srt file');
      }
    },
    [onFileSelect, disabled]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className={`
        w-full p-10 border-2 border-dashed rounded-xl transition-all duration-200 ease-in-out
        flex flex-col items-center justify-center text-center cursor-pointer
        ${disabled 
          ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed' 
          : 'bg-white border-indigo-200 hover:border-indigo-400 hover:bg-indigo-50/30'
        }
      `}
    >
      <input
        type="file"
        accept=".srt"
        onChange={handleChange}
        disabled={disabled}
        className="hidden"
        id="file-upload"
      />
      <label htmlFor="file-upload" className={`cursor-pointer w-full h-full flex flex-col items-center ${disabled ? 'cursor-not-allowed' : ''}`}>
        <div className="bg-indigo-100 p-4 rounded-full mb-4">
          {disabled ? <FileText className="w-8 h-8 text-slate-400" /> : <Upload className="w-8 h-8 text-indigo-600" />}
        </div>
        <h3 className="text-lg font-semibold text-slate-700 mb-1">
          {disabled ? 'Processing file...' : 'Upload your SRT file'}
        </h3>
        <p className="text-sm text-slate-500 max-w-xs mx-auto">
          Drag and drop or click to select a subtitle file to start translating to Myanmar.
        </p>
      </label>
    </div>
  );
};
