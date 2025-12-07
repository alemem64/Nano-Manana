/**
 * Colorization service for manga pages
 * Handles reference-based batch colorization with Gemini API
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

/**
 * Generate colorization prompt
 */
function getColorizationPrompt(refPageCount: number): string {
  const refPages = refPageCount > 0 
    ? `the ${refPageCount} reference image(s) attached above` 
    : "no reference images";
  
  return `Colorize the manga page below. Refer to ${refPages} to maintain consistency in character eye color, skin color, hair color, and clothing color. Maintain consistency for the same character, but if the character is wearing new clothing in the image below, draw them with appropriate different clothing. Color different characters with distinct colors, but the same character must be colored consistently. Preserve speech balloons, onomatopoeia, backgrounds, grids, and all structural elements. Do not modify or delete any text - keep all text exactly as is. Do not change character expressions or gestures - only apply colors. Color each panel's scene exactly as shown - do not add different scenes, modify scenes, or remove scenes. Colorize the following image:`;
}

/**
 * Build the colorization batch request with reference images
 * 
 * Batch logic:
 * - Request 1: Process page 1 only (no references)
 * - Request 2: Process pages 2-3 with page 1 as reference
 * - Request 3+: Process batchSize pages with min(requestIndex, batchSize) references from completed pages
 * 
 * Example with batchSize=4 and 12 pages:
 * Request 1: ref=[1], output=[1]
 * Request 2: ref=[1], output=[2,3]
 * Request 3: ref=[1,2,3], output=[4,5,6]
 * Request 4: ref=[3,4,5,6], output=[7,8,9,10]
 * Request 5: ref=[7,8,9,10], output=[11,12]
 */
export async function processColorization(
  files: File[],
  config: ProcessingConfig,
  onPageProcessing: (indices: number[]) => void,
  onPageComplete: (result: ProcessedResult) => void,
  getProcessedImageBase64: (index: number) => Promise<string | null>
): Promise<void> {
  debugLogger.startSession();

  const totalPages = files.length;
  const batchSize = config.batchSize;
  const completedIndices: number[] = [];

  // Request 1: Process first page only (no reference)
  {
    const pageIndex = 0;
    onPageProcessing([pageIndex]);

    const base64 = await fileToBase64(files[pageIndex]);
    const mimeType = getMimeType(files[pageIndex]);
    const prompt = getColorizationPrompt(0);

    const contents: ContentPart[] = [
      createTextPart(prompt),
      createImagePart(base64, mimeType),
    ];

    const requestId = `colorize_req1_page_${pageIndex}_${Date.now()}`;
    const results = await callGeminiImageAPI(
      config.apiKey,
      contents,
      formatResolution(config.resolution),
      requestId
    );

    if (results.length > 0) {
      onPageComplete({ ...results[0], index: pageIndex });
      completedIndices.push(pageIndex);
    }
  }

  // If only 1 page, we're done
  if (totalPages === 1) return;

  // Request 2: Process pages 2-3 (or remaining) with page 1 as reference
  {
    const startIndex = 1;
    const endIndex = Math.min(startIndex + batchSize - 1, totalPages); // -1 because request 2 processes batchSize-1 pages
    const batchIndices = Array.from(
      { length: endIndex - startIndex },
      (_, i) => startIndex + i
    );

    if (batchIndices.length > 0) {
      onPageProcessing(batchIndices);

      // Build contents: reference image first, then pages to colorize
      const contents: ContentPart[] = [];

      // Add reference (completed page 1)
      const refBase64 = await getProcessedImageBase64(0);
      if (refBase64) {
        contents.push(createTextPart(`This is reference page 1 (already colorized):`));
        contents.push(createImagePart(refBase64, "image/png"));
      }

      // Add pages to colorize
      for (const idx of batchIndices) {
        const base64 = await fileToBase64(files[idx]);
        const mimeType = getMimeType(files[idx]);
        contents.push(createTextPart(`Colorize page ${idx + 1}:`));
        contents.push(createImagePart(base64, mimeType));
      }

      // Add prompt at the end
      contents.push(createTextPart(getColorizationPrompt(1)));

      const requestId = `colorize_req2_pages_${batchIndices.join("_")}_${Date.now()}`;
      const results = await callGeminiImageAPI(
        config.apiKey,
        contents,
        formatResolution(config.resolution),
        requestId
      );

      // Map results to page indices
      for (let i = 0; i < results.length && i < batchIndices.length; i++) {
        onPageComplete({ ...results[i], index: batchIndices[i] });
        completedIndices.push(batchIndices[i]);
      }
    }
  }

  // Subsequent requests: Process remaining pages
  let currentIndex = Math.min(1 + batchSize - 1, totalPages);
  let requestIndex = 3;

  while (currentIndex < totalPages) {
    // Calculate how many references to use (min of requestIndex and batchSize)
    const refCount = Math.min(requestIndex, batchSize);
    
    // Calculate how many pages to process in this batch
    const outputCount = Math.min(batchSize, totalPages - currentIndex);
    const batchIndices = Array.from(
      { length: outputCount },
      (_, i) => currentIndex + i
    );

    onPageProcessing(batchIndices);

    // Build contents
    const contents: ContentPart[] = [];

    // Add reference images (last refCount completed pages)
    const refStartIndex = Math.max(0, completedIndices.length - refCount);
    const refIndices = completedIndices.slice(refStartIndex);

    for (const refIdx of refIndices) {
      const refBase64 = await getProcessedImageBase64(refIdx);
      if (refBase64) {
        contents.push(createTextPart(`This is reference page ${refIdx + 1} (already colorized):`));
        contents.push(createImagePart(refBase64, "image/png"));
      }
    }

    // Add pages to colorize
    for (const idx of batchIndices) {
      const base64 = await fileToBase64(files[idx]);
      const mimeType = getMimeType(files[idx]);
      contents.push(createTextPart(`Colorize page ${idx + 1}:`));
      contents.push(createImagePart(base64, mimeType));
    }

    // Add prompt at the end
    contents.push(createTextPart(getColorizationPrompt(refIndices.length)));

    const requestId = `colorize_req${requestIndex}_pages_${batchIndices.join("_")}_${Date.now()}`;
    const results = await callGeminiImageAPI(
      config.apiKey,
      contents,
      formatResolution(config.resolution),
      requestId
    );

    // Map results to page indices
    for (let i = 0; i < results.length && i < batchIndices.length; i++) {
      onPageComplete({ ...results[i], index: batchIndices[i] });
      completedIndices.push(batchIndices[i]);
    }

    currentIndex += outputCount;
    requestIndex++;
  }
}
