import { TranslationProject } from '../types';

const DB_NAME = 'MmSubTranslatorDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const saveProject = async (project: TranslationProject): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(project);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getAllProjects = async (): Promise<TranslationProject[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Sort by newest first
      const projects = request.result as TranslationProject[];
      projects.sort((a, b) => b.createdAt - a.createdAt);
      resolve(projects);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteProject = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

/**
 * Retrieves a set of high-quality translation pairs from projects marked as training data (isExternalImport).
 * Used to feed the AI "few-shot" examples of the user's preferred style.
 */
export const getTrainingExamples = async (limit: number = 30): Promise<{original: string, translated: string}[]> => {
  const projects = await getAllProjects();
  // Filter for training data or completed projects
  const trainingProjects = projects.filter(p => p.isExternalImport || p.blocks.some(b => b.translatedText));
  
  const examples: {original: string, translated: string}[] = [];
  
  // Iterate from newest to oldest
  for (const project of trainingProjects) {
    // Get valid blocks
    const validBlocks = project.blocks.filter(b => 
      b.originalText && 
      b.translatedText && 
      b.originalText.length > 10 && // Skip very short utterances like "Yes"
      !b.originalText.match(/^\d+$/) // Skip lines that are just numbers
    );

    // Take a random sample or first N from this project to diversify
    // Taking the first few lines often captures character introductions/style
    for (const block of validBlocks.slice(0, 10)) {
       examples.push({
         original: block.originalText.replace(/\n/g, ' '),
         translated: block.translatedText!.replace(/\n/g, ' ')
       });
       if (examples.length >= limit) return examples;
    }
  }
  
  return examples;
};
