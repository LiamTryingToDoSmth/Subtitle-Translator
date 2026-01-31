import { SrtBlock } from '../types';

export const parseSRT = (content: string): SrtBlock[] => {
  // Normalize line endings
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split by double newlines to get blocks (handling potential multiple newlines between blocks)
  const blocks = normalizedContent.split(/\n\n+/);
  
  const parsedBlocks: SrtBlock[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 3) continue; // Invalid block

    // ID is usually the first line
    const id = parseInt(lines[0], 10);
    if (isNaN(id)) continue;

    // Timestamp is the second line
    const timeLine = lines[1];
    if (!timeLine.includes('-->')) continue;
    
    const [startTime, endTime] = timeLine.split('-->').map(t => t.trim());

    // Text is the rest
    const text = lines.slice(2).join('\n');

    parsedBlocks.push({
      id,
      startTime,
      endTime,
      originalText: text
    });
  }

  return parsedBlocks;
};

export const stringifySRT = (blocks: SrtBlock[]): string => {
  return blocks.map(block => {
    // Prefer translated text, fallback to original if missing (shouldn't happen in happy path)
    const textContent = block.translatedText || block.originalText;
    return `${block.id}\n${block.startTime} --> ${block.endTime}\n${textContent}`;
  }).join('\n\n');
};

/**
 * Creates a mapping of Original Text -> Translated Text from reference files.
 * Used for consistency (e.g., Intro/Outro songs).
 */
export const createReferenceMap = (originalSrt: string, translatedSrt: string): Map<string, string> => {
  const originals = parseSRT(originalSrt);
  const translations = parseSRT(translatedSrt);
  const map = new Map<string, string>();

  // Using a permissive approach: Map by Index.
  const count = Math.min(originals.length, translations.length);
  
  for (let i = 0; i < count; i++) {
    const key = originals[i].originalText.trim();
    const value = translations[i].originalText.trim(); // "originalText" of the translated file holds the translation
    
    if (key && value) {
      map.set(key, value);
    }
  }

  return map;
};

/**
 * Extracts "Style Examples" from a reference pair.
 * Identifies sentences with Proper Nouns (Capitalized words in middle) or distinct phrases
 * to help the AI learn names and terminology in context.
 */
export const extractStyleExamples = (originalSrt: string, translatedSrt: string): { original: string, translated: string }[] => {
  const blocks = alignSrts(originalSrt, translatedSrt);
  const examples: { original: string, translated: string }[] = [];
  
  for (const block of blocks) {
    if (!block.translatedText) continue;
    const text = block.originalText.trim();
    
    // Heuristic:
    // 1. Contains a capitalized word that is NOT the start of the sentence (likely a Name or Place).
    // 2. OR is longer than 20 chars (likely a full sentence with context).
    // 3. Limit total examples to avoid token overflow, but prioritize those with Proper Nouns.
    
    const hasProperNoun = /[a-z] [A-Z]/.test(text);
    
    if (hasProperNoun || (examples.length < 20 && text.length > 20)) {
        examples.push({
           original: text.replace(/\n/g, ' '),
           translated: block.translatedText.replace(/\n/g, ' ')
        });
    }
    
    // Hard limit of 40 examples
    if (examples.length >= 40) break;
  }
  return examples;
};

/**
 * Aligns an Original English SRT with a Translated Myanmar SRT to create a training dataset.
 * Aligns primarily by ID, falls back to Index if IDs mismatch.
 */
export const alignSrts = (originalContent: string, translatedContent: string): SrtBlock[] => {
  const originalBlocks = parseSRT(originalContent);
  const translatedBlocks = parseSRT(translatedContent);
  const aligned: SrtBlock[] = [];

  // Create a map of translated blocks by ID for O(1) lookup
  const translatedMap = new Map<number, SrtBlock>();
  translatedBlocks.forEach(b => translatedMap.set(b.id, b));

  originalBlocks.forEach((orig, index) => {
    let trans = translatedMap.get(orig.id);

    // Fallback: If ID mismatch, try matching by index if the array lengths are similar
    if (!trans && index < translatedBlocks.length) {
       // Only use index fallback if the IDs are totally off, but usually simple alignment by index is risky.
       // However, for training data generation, we assume the user uploads matching files.
       const candidate = translatedBlocks[index];
       if (candidate.startTime === orig.startTime) { // Basic sanity check on timestamp
          trans = candidate;
       }
    }

    if (trans) {
      aligned.push({
        ...orig,
        translatedText: trans.originalText // In the parsed object, the content is in 'originalText'
      });
    }
  });

  return aligned;
};
