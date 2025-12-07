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
} from "./core";
import { debugLogger } from "./debug";

export interface TranslateConfig extends ProcessingConfig {
  fromLanguage: string;
  toLanguage: string;
}

/**
 * Generate translation prompt
 */
function getTranslationPrompt(fromLanguage: string, toLanguage: string): string {
  return `Translate this manga page from ${fromLanguage} to ${toLanguage}. Maintain all other characters, backgrounds, speech balloon's shape, grids and manga structure. Make image which has EXACTLY SAME ratio and layout with original one. You have to translate speech balloon's text, onomatopoeia handwritten text, and all other texts which are not ${toLanguage}.`;
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
  const prompt = getTranslationPrompt(config.fromLanguage, config.toLanguage);

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
