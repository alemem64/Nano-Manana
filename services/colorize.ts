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
  getImageDimensions,
  formatAspectRatioForPrompt,
} from "./core";
import { debugLogger } from "./debug";

/**
 * Generate colorization prompt
 */
function getColorizationPrompt(refPageCount: number, aspectRatioStr: string): string {
  const refPages = refPageCount > 0 
    ? `the ${refPageCount} reference image(s) attached above` 
    : "no reference images";
  
  return `Colorize the manga page below. Refer to ${refPages} to maintain consistency in character eye color, skin color, hair color, and clothing color.

COLORING STYLE REQUIREMENTS:
- Apply vibrant, rich, and diverse colors throughout the entire image.
- Do NOT leave any area uncolored - fill every part with appropriate colors including backgrounds, objects, and small details.
- Use a colorful and visually appealing palette that brings the manga to life.
- Add depth and dimension with shading and highlights where appropriate.
- Make the coloring look professional and polished like a published color manga.

CONSISTENCY REQUIREMENTS:
- Maintain consistency for the same character, but if the character is wearing new clothing, draw them with appropriate different clothing.
- Maintain cosmetic features (eye color, hair color, skin tone) consistently for each character across all pages.
- Maintain consistency in background colors and object colors when they reappear.
- Color different characters with distinct colors, but the same character must be colored consistently.

IMAGE REQUIREMENTS:
- The original image size is ${aspectRatioStr}. Make image which has EXACTLY SAME ratio and layout with original one.
- Preserve speech balloons, onomatopoeia, backgrounds, grids, and all structural elements.
- Do not modify or delete any text - keep all text exactly as is.
- Do not change character expressions or gestures - only apply colors.
- Color each panel's scene exactly as shown - do not add different scenes, modify scenes, or remove scenes.

Colorize the following image:`;
}

/**
 * Build a single colorization request for one page
 */
async function buildSinglePageRequest(
  pageIndex: number,
  file: File,
  refIndices: number[],
  getProcessedImageBase64: (index: number) => Promise<string | null>
): Promise<ContentPart[]> {
  const contents: ContentPart[] = [];

  // Add reference images
  for (const refIdx of refIndices) {
    const refBase64 = await getProcessedImageBase64(refIdx);
    if (refBase64) {
      contents.push(createTextPart(`This is reference page ${refIdx + 1} (already colorized):`));
      contents.push(createImagePart(refBase64, "image/png"));
    }
  }

  // Add the page to colorize
  const base64 = await fileToBase64(file);
  const mimeType = getMimeType(file);
  contents.push(createTextPart(`Colorize page ${pageIndex + 1}:`));
  contents.push(createImagePart(base64, mimeType));

  // Calculate aspect ratio for the image
  const { width, height } = await getImageDimensions(file);
  const aspectRatioStr = formatAspectRatioForPrompt(width, height);

  // Add prompt
  contents.push(createTextPart(getColorizationPrompt(refIndices.length, aspectRatioStr)));

  return contents;
}

/**
 * Build the colorization batch request with reference images
 * 
 * Batch logic:
 * - Each API request outputs exactly 1 page
 * - Multiple requests are sent in parallel (batch)
 * - Each batch uses the same reference images from the last completed batch
 * - Batch size determines: max parallel requests AND max reference images
 * 
 * Example with batchSize=4 and 12 pages:
 * Batch 1: ref=none, output=[1] (1 request, first page special case)
 * Batch 2: ref=[1], output=[2] (1 request, min(2,4,1)=1)
 * Batch 3: ref=[1,2], output=[3,4] (2 parallel requests, min(3,4,2)=2)
 * Batch 4: ref=[1,2,3,4], output=[5,6,7,8] (4 parallel requests, min(4,4,4)=4)
 * Batch 5: ref=[5,6,7,8], output=[9,10,11,12] (4 parallel requests)
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
    // Each request calls onPageComplete immediately when it finishes (not waiting for others)
    const batchCompletedIndices: number[] = [];
    
    const requestPromises = batchIndices.map(async (pageIndex) => {
      const contents = await buildSinglePageRequest(
        pageIndex,
        files[pageIndex],
        refIndices,
        getProcessedImageBase64
      );

      const requestId = `colorize_batch${batchNumber}_page${pageIndex + 1}_${Date.now()}`;
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
