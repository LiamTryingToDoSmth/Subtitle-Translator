import { GoogleGenAI, Type, Schema } from "@google/genai";
import { SrtBlock, GlossaryTerm } from "../types";

const BATCH_SIZE = 20;

// Initialize the API client
// CRITICAL: process.env.API_KEY is guaranteed to be available by the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const translationSchema: Schema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      id: { type: Type.INTEGER },
      translatedText: { type: Type.STRING },
    },
    required: ["id", "translatedText"],
  },
};

export const translateBatch = async (
  blocks: SrtBlock[],
  referenceMap: Map<string, string> | null,
  consistencyExamples: { original: string, translated: string }[],
  trainingExamples: { original: string, translated: string }[],
  glossary: GlossaryTerm[],
  onProgress: (current: number, message: string) => void
): Promise<SrtBlock[]> => {
  const resultBlocks = [...blocks];
  
  // 1. Pre-fill from Reference Map (Exact Matches)
  // This handles the user's requirement: "translate that sentence exactly like the previous one"
  if (referenceMap) {
    resultBlocks.forEach(block => {
      const key = block.originalText.trim();
      if (referenceMap.has(key)) {
        block.translatedText = referenceMap.get(key);
        block.isFromReference = true;
      }
    });
  }

  // 2. Filter blocks that still need translation
  const blocksToTranslate = resultBlocks.filter(b => !b.translatedText);
  const totalToTranslate = blocksToTranslate.length;
  
  if (totalToTranslate === 0) {
    onProgress(blocks.length, "All lines matched from reference file.");
    return resultBlocks;
  }

  // Build Sections for System Instruction
  
  // A. Glossary
  const glossarySection = glossary.length > 0 
    ? `
5. **Strict Terminology (Glossary):**
   You MUST use the following specific translations for names and terms. Do not translate them differently.
   ${glossary.map(t => `- "${t.original}" -> "${t.translated}"`).join('\n')}
    `
    : '';

  // B. Consistency (Context from Ep 1)
  // The AI looks at these to learn how names/places were handled previously
  const consistencySection = consistencyExamples.length > 0
    ? `
**Context & Consistency (From Previous Episode):**
The following are examples from the previous episode. Pay close attention to how Proper Nouns (Names, Places) and specific phrases were translated. Mimic this style and terminology.
${consistencyExamples.map(e => `Original: "${e.original}"\nTranslation: "${e.translated}"`).join('\n---\n')}
    `
    : '';

  // C. Training Data (User Corrections)
  // The AI looks at these to learn the User's preferred sentence structure
  const trainingSection = trainingExamples.length > 0
    ? `
**My Personal Style Guide (Learned from Corrections):**
I have corrected you in the past. Below are pairs of [English] -> [My Corrected Myanmar]. 
Observe the tone, particle usage (ending words), and sentence structure. Translate new lines *exactly* in this style.
${trainingExamples.map(e => `English: "${e.original}"\nMy Correction: "${e.translated}"`).join('\n---\n')}
    `
    : '';

  // 3. Process remaining blocks in batches
  for (let i = 0; i < totalToTranslate; i += BATCH_SIZE) {
    const batchEnd = Math.min(i + BATCH_SIZE, totalToTranslate);
    const currentBatch = blocksToTranslate.slice(i, i + BATCH_SIZE);
    
    // Notify start of batch
    onProgress(
      (blocks.length - totalToTranslate) + i, 
      `Translating lines ${i + 1}-${batchEnd} of new content...`
    );
    
    const promptData = currentBatch.map(b => ({
      id: b.id,
      text: b.originalText
    }));

    const systemInstruction = `
You are a professional subtitle localizer for movies and series, aimed at a Myanmar audience.
**Your Goal:** Produce subtitles that sound **100% natural, fluid, and native** (သဘာဝကျသော အပြောစကား).
Do not just translate words; translate the **feeling, context, and intent**.

**Strict Localization Rules (လိုက်နာရန်):**

1. **Absolute Spoken Style (အပြောစကားစစ်စစ်):**
   - **Never** use formal/literary words like 'သည်', 'မည်', '၌', '၏', '၎င်း', 'ကျွန်ုပ်'.
   - Use natural sentence endings: 'တယ်', 'မယ်', 'ပါ', 'နော်', 'ဗျာ', 'ရှင်', 'ပဲ', 'လေ', 'ပေါ့', 'ကွ', 'ကွာ'.
   - *Example:* "I will do it." -> ❌ "ကျွန်ုပ် ပြုလုပ်မည်" | ✅ "ကျွန်တော် လုပ်လိုက်မယ်" or "လုပ်လိုက်မယ်နော်".

2. **Flow & Smoothness (စီးဆင်းမှု):**
   - **Sentence Structure:** Do not copy English grammar. Rearrange words to fit Myanmar SOV (Subject-Object-Verb) structure naturally.
   - **Pronouns:** Native speakers often omit "I" (ကျွန်တော်) and "You" (ခင်ဗျား/မင်း). Drop them unless necessary for clarity or emphasis.
   - **Brevity:** Keep it short and punchy. Use words that convey the meaning quickly.

3. **Tone & Context:**
   - Detect the emotion (Casual, Angry, Sad, Formal) and choose vocabulary accordingly.
   - Translate idioms to their Myanmar equivalent concepts (e.g., "Don't kid me" -> "နောက်မနေပါနဲ့ကွာ").

4. **Technical Formatting:**
   - **No Myanmar Punctuation:** Do not use '။' or '၊'.
   - **Line Splitting:** If the Burmese text is long (> 35-40 chars), split it into two lines using '\\n' at a natural pause.

${glossarySection}

${consistencySection}

${trainingSection}

**Output:**
Return strictly a JSON array of objects with keys: \`id\` and \`translatedText\`.
`.trim();

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: JSON.stringify(promptData),
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: translationSchema,
        },
      });

      const jsonText = response.text;
      if (!jsonText) throw new Error("Empty response from Gemini");
      
      const translations = JSON.parse(jsonText) as { id: number; translatedText: string }[];

      // Update the original blocks (find by ID in the main result array)
      translations.forEach(t => {
        const blockIndex = resultBlocks.findIndex(b => b.id === t.id);
        if (blockIndex !== -1) {
          resultBlocks[blockIndex].translatedText = t.translatedText;
          resultBlocks[blockIndex].isFromReference = false;
        }
      });

    } catch (error) {
      console.error(`Error translating batch:`, error);
    }

    // Notify completion of batch relative to total blocks
    onProgress((blocks.length - totalToTranslate) + batchEnd, `Processed batch...`);
  }

  return resultBlocks;
};

export const generateMovieReview = async (movieName: string) => {
  const prompt = `Write a comprehensive, engaging movie review for "${movieName}" in Myanmar language (Burmese).
  
  Style Guide:
  - Casual, spoken style (အပြောစကား).
  - Include plot summary (without major spoilers), acting, direction, and final verdict.
  - If it's a series, summarize the general premise and why it's worth watching.
  - Use natural sentence endings.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const text = response.text || "No review generated.";
    // Extract grounding chunks for sources
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
      .filter((item: any) => item !== null);

    return { text, sources };
  } catch (error) {
    console.error("Error generating review:", error);
    throw error;
  }
};

export const generateTrainingFeedback = async (
  examples: { original: string; aiDraft: string; humanEdit: string }[],
  userInstructions: string
) => {
  const prompt = `
  I am training you to be a better English-to-Myanmar subtitle translator. 
  I have corrected your previous translations. Please analyze your mistakes and my corrections to improve yourself.

  **User's Additional Instructions:**
  "${userInstructions || "No specific instructions provided, infer from the corrections."}"

  **Comparison Data (Your Mistakes vs. My Corrections):**
  ${JSON.stringify(examples, null, 2)}

  Based on these examples and instructions, provide a structured reflection in Markdown:
  1. **What I Learned:** Analyze 3-4 key patterns where your draft differed from the human edit (e.g., tone, specific vocabulary, sentence structure).
  2. **Improvement Strategy:** What specific rules will you apply to future translations to avoid these mistakes?
  3. **Future Commitment:** A short sentence promising how the next translation will be better.

  Write the response in English, but you can quote Myanmar words for examples. Keep it concise and professional.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Error generating training feedback:", error);
    return "Could not generate feedback at this time.";
  }
};
