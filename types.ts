export interface SrtBlock {
  id: number;
  startTime: string;
  endTime: string;
  originalText: string;
  translatedText?: string;
  isFromReference?: boolean; // True if matched from Ep 1
}

export type TranslationStatus = 'idle' | 'parsing' | 'translating' | 'completed' | 'error';

export interface TranslationProgress {
  current: number;
  total: number;
  message?: string;
}

export interface TranslationProject {
  id: string;
  fileName: string;
  createdAt: number;
  blocks: SrtBlock[];
  isExternalImport?: boolean;
}

export type AppMode = 'translate' | 'train' | 'history';

export interface GlossaryTerm {
  id: string;
  original: string;
  translated: string;
}