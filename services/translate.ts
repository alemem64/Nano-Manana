/**
 * Translation service for manga pages
 * Handles batch translation with Gemini API
 */

import {
  ProcessingConfig,
  ContentPart,
  ProcessedResult,
  fileToBase64,
  getMimeType,
  createImagePart,
  createTextPart,
  callGeminiImageAPI,
  formatResolution,
  getImageDimensions,
  formatAspectRatioForPrompt,
} from "./core";
import { debugLogger } from "./debug";

export interface TranslateConfig extends ProcessingConfig {
  fromLanguage: string;
  toLanguage: string;
  displayBothLanguages: boolean;
}

/**
 * Generate translation prompt
 */
function getTranslationPrompt(fromLanguage: string, toLanguage: string, aspectRatioStr: string, displayBothLanguages: boolean): string {
  const bilingualInstruction = displayBothLanguages
    ? `\n\nBILINGUAL DISPLAY MODE:\n- Display BOTH ${fromLanguage} and ${toLanguage} in the output image.\n- Show the original ${fromLanguage} text at the TOP of each speech balloon.\n- Show the translated ${toLanguage} text at the BOTTOM of each speech balloon.\n- Both languages should be clearly visible and readable.\n- Adjust font sizes if necessary to fit both languages in the speech balloons.`
    : "";

  return `Translate this manga page from ${fromLanguage} to ${toLanguage}. 

IMPORTANT TRANSLATION GUIDELINES:
- Do NOT translate literally word-by-word. Instead, think about the context, character emotions, and scene atmosphere.
- Adapt the translation to sound natural in ${toLanguage} while preserving the original meaning and tone.
- Consider manga-specific expressions, onomatopoeia, and cultural nuances when translating.
- Make the dialogue flow naturally as if it was originally written in ${toLanguage}.

IMAGE REQUIREMENTS:
- Maintain all characters, backgrounds, speech balloon shapes, panel grids, and manga structure.
- The original image size is ${aspectRatioStr}. Make image which has EXACTLY SAME ratio and layout with original one.
- Translate speech balloon text, onomatopoeia, handwritten text, and all other texts that are not in ${toLanguage}.
- Keep all visual elements unchanged except for the translated text.${bilingualInstruction}`;
}

/**
 * Process a single page for translation
 */
async function translateSinglePage(
  file: File,
  config: TranslateConfig,
  pageIndex: number
): Promise<ProcessedResult> {
  const base64 = await fileToBase64(file);
  const mimeType = getMimeType(file);
  
  // Calculate aspect ratio for the image
  const { width, height } = await getImageDimensions(file);
  const aspectRatioStr = formatAspectRatioForPrompt(width, height);
  
  const prompt = getTranslationPrompt(config.fromLanguage, config.toLanguage, aspectRatioStr, config.displayBothLanguages);

  const contents: ContentPart[] = [
    createTextPart(prompt),
    createImagePart(base64, mimeType),
  ];

  const requestId = `translate_page_${pageIndex}_${Date.now()}`;
  const results = await callGeminiImageAPI(
    config.apiKey,
    contents,
    formatResolution(config.resolution),
    requestId
  );

  if (results.length === 0) {
    throw new Error(`No image result for page ${pageIndex + 1}`);
  }

  return {
    ...results[0],
    index: pageIndex,
  };
}

/**
 * Process translation for all pages in batches
 * Sends batchSize pages simultaneously, calls onPageComplete as each page completes
 */
export async function processTranslation(
  files: File[],
  config: TranslateConfig,
  onPageProcessing: (indices: number[]) => void,
  onPageComplete: (result: ProcessedResult) => void
): Promise<void> {
  debugLogger.startSession();

  const totalPages = files.length;
  const batchSize = config.batchSize;

  for (let batchStart = 0; batchStart < totalPages; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, totalPages);
    const batchIndices = Array.from(
      { length: batchEnd - batchStart },
      (_, i) => batchStart + i
    );

    // Mark pages as processing
    onPageProcessing(batchIndices);

    // Process all pages in this batch simultaneously
    // Each promise calls onPageComplete immediately when done
    const batchPromises = batchIndices.map((index) =>
      translateSinglePage(files[index], config, index).then((result) => {
        // Call onPageComplete immediately when this page is done
        onPageComplete(result);
        return result;
      })
    );

    try {
      // Wait for all pages in batch to complete before starting next batch
      await Promise.all(batchPromises);
    } catch (error) {
      console.error(`Batch translation error:`, error);
      throw error;
    }
  }
}
