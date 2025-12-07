/**
 * Colorize and Translate service for manga pages
 * Handles reference-based batch colorization with translation using Gemini API
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

export interface ColorizeAndTranslateConfig extends ProcessingConfig {
  fromLanguage: string;
  toLanguage: string;
  displayBothLanguages: boolean;
}

/**
 * Generate colorize and translate prompt
 */
function getColorizeAndTranslatePrompt(
  refPageCount: number, 
  aspectRatioStr: string,
  fromLanguage: string,
  toLanguage: string,
  displayBothLanguages: boolean
): string {
  const refPages = refPageCount > 0 
    ? `the ${refPageCount} reference image(s) attached above` 
    : "no reference images";

  const bilingualInstruction = displayBothLanguages
    ? `\n- BILINGUAL MODE: Display BOTH languages - show original ${fromLanguage} text at the TOP and translated ${toLanguage} text at the BOTTOM of each speech balloon. Adjust font sizes if necessary to fit both languages clearly.`
    : "";
  
  return `Colorize AND translate this manga page from ${fromLanguage} to ${toLanguage}. Refer to ${refPages} to maintain color consistency.

COLORING REQUIREMENTS:
- Apply vibrant, rich, and diverse colors throughout the entire image.
- Use a colorful and visually appealing palette that brings the manga to life.
- Add depth and dimension with shading and highlights where appropriate.
- Make the coloring look professional and polished like a published color manga.

COLOR CONSISTENCY REQUIREMENTS:
- Maintain cosmetic features (eye color, hair color, skin tone) consistently for each character across all pages.
- Maintain consistency in background colors and object colors when they reappear.
- Color different characters with distinct colors, but the same character must be colored consistently.
- If a character is wearing new clothing, draw them with appropriate different clothing colors.

TRANSLATION REQUIREMENTS:
- Do NOT translate literally word-by-word. Think about context, character emotions, and scene atmosphere.
- Adapt the translation to sound natural in ${toLanguage} while preserving the original meaning and tone.
- Consider manga-specific expressions, onomatopoeia, and cultural nuances when translating.
- Make the dialogue flow naturally as if it was originally written in ${toLanguage}.
- Translate speech balloon text, onomatopoeia, handwritten text, and all other texts.${bilingualInstruction}

IMAGE REQUIREMENTS:
- The original image size is ${aspectRatioStr}. Make image which has EXACTLY SAME ratio and layout with original one.
- Preserve speech balloon shapes, panel grids, and all structural elements.
- Do NOT add completely new characters or objects that are not present in the original image. JUST COLORIZE EXISTING ELEMENTS.
- Color each panel's scene EXACTLY as shown - DO NOT ADD, MODIFY, OR REMOVE SCENES.

Colorize and translate the following image:`;
}

/**
 * Build a single colorize and translate request for one page
 */
async function buildSinglePageRequest(
  pageIndex: number,
  file: File,
  refIndices: number[],
  config: ColorizeAndTranslateConfig,
  getProcessedImageBase64: (index: number) => Promise<string | null>
): Promise<ContentPart[]> {
  const contents: ContentPart[] = [];

  // Add reference images
  for (const refIdx of refIndices) {
    const refBase64 = await getProcessedImageBase64(refIdx);
    if (refBase64) {
      contents.push(createTextPart(`This is reference page ${refIdx + 1} (already colorized and translated):`));
      contents.push(createImagePart(refBase64, "image/png"));
    }
  }

  // Add the page to process
  const base64 = await fileToBase64(file);
  const mimeType = getMimeType(file);
  contents.push(createTextPart(`Colorize and translate page ${pageIndex + 1}:`));
  contents.push(createImagePart(base64, mimeType));

  // Calculate aspect ratio for the image
  const { width, height } = await getImageDimensions(file);
  const aspectRatioStr = formatAspectRatioForPrompt(width, height);

  // Add prompt
  contents.push(createTextPart(getColorizeAndTranslatePrompt(
    refIndices.length, 
    aspectRatioStr,
    config.fromLanguage,
    config.toLanguage,
    config.displayBothLanguages
  )));

  return contents;
}

/**
 * Process colorization and translation for all pages
 * Uses the same batch logic as colorize: min(batchNumber, batchSize, completedCount)
 */
export async function processColorizeAndTranslate(
  files: File[],
  config: ColorizeAndTranslateConfig,
  onPageProcessing: (indices: number[]) => void,
  onPageComplete: (result: ProcessedResult) => void,
  getProcessedImageBase64: (index: number) => Promise<string | null>
): Promise<void> {
  debugLogger.startSession();

  const totalPages = files.length;
  const batchSize = config.batchSize;
  const completedIndices: number[] = [];
  
  let currentIndex = 0;
  let batchNumber = 1;

  while (currentIndex < totalPages) {
    // Calculate how many pages to process in this batch
    // For first batch, process 1 page (no references available)
    // For subsequent batches, limited by: batchNumber, batchSize, completedCount, remaining pages
    const completedCount = completedIndices.length;
    const targetBatchCount = batchNumber === 1 
      ? 1 
      : Math.min(batchNumber, batchSize, completedCount);
    const batchCount = Math.min(targetBatchCount, totalPages - currentIndex);
    
    const batchIndices = Array.from(
      { length: batchCount },
      (_, i) => currentIndex + i
    );

    onPageProcessing(batchIndices);

    // Determine reference indices (last N completed pages, where N = min(batchSize, completedCount))
    const refCount = Math.min(batchSize, completedCount);
    const refStartIndex = Math.max(0, completedIndices.length - refCount);
    const refIndices = completedIndices.slice(refStartIndex);

    // Build parallel requests - one request per page, all using the same references
    const batchCompletedIndices: number[] = [];
    
    const requestPromises = batchIndices.map(async (pageIndex) => {
      const contents = await buildSinglePageRequest(
        pageIndex,
        files[pageIndex],
        refIndices,
        config,
        getProcessedImageBase64
      );

      const requestId = `colorize_translate_batch${batchNumber}_page${pageIndex + 1}_${Date.now()}`;
      const results = await callGeminiImageAPI(
        config.apiKey,
        contents,
        formatResolution(config.resolution),
        requestId
      );

      // Immediately notify completion when this request finishes
      if (results.length > 0) {
        onPageComplete({ ...results[0], index: pageIndex });
        batchCompletedIndices.push(pageIndex);
      }

      return { pageIndex, results };
    });

    // Wait for all requests in this batch to complete before moving to next batch
    await Promise.all(requestPromises);

    // Add completed indices in order for reference tracking
    batchCompletedIndices.sort((a, b) => a - b);
    completedIndices.push(...batchCompletedIndices);

    currentIndex += batchCount;
    batchNumber++;
  }
}

/**
 * Rerun a single page for colorization and translation
 * Uses up to (batchSize - 1) previous completed pages as references
 */
export async function rerunColorizeAndTranslatePage(
  file: File,
  config: ColorizeAndTranslateConfig,
  pageIndex: number,
  getProcessedImageBase64: (index: number) => Promise<string | null>
): Promise<ProcessedResult> {
  // Calculate reference indices: up to (batchSize - 1) previous pages that have results
  const refIndices: number[] = [];
  const maxRefs = config.batchSize - 1;
  
  for (let i = pageIndex - 1; i >= 0 && refIndices.length < maxRefs; i--) {
    const refBase64 = await getProcessedImageBase64(i);
    if (refBase64) {
      refIndices.unshift(i); // Add to front to maintain order
    }
  }

  const contents = await buildSinglePageRequest(
    pageIndex,
    file,
    refIndices,
    config,
    getProcessedImageBase64
  );

  const requestId = `colorize_translate_rerun_page${pageIndex + 1}_${Date.now()}`;
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
