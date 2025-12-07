/**
 * Core service for Gemini API interactions
 * Contains shared utilities for both colorize and translate features
 */

import { GoogleGenAI } from "@google/genai";
import { debugLogger } from "./debug";

export type Resolution = "1K" | "2K" | "3K" | "4K";

export interface ProcessingConfig {
  apiKey: string;
  batchSize: number;
  resolution: Resolution;
}

export interface ImagePart {
  inlineData: {
    mimeType: string;
    data: string; // base64
  };
}

export interface TextPart {
  text: string;
}

export type ContentPart = ImagePart | TextPart;

export interface ProcessedResult {
  index: number;
  imageData: string; // base64
  mimeType: string;
}

/**
 * Convert a File to base64 string
 */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove the data:image/xxx;base64, prefix
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Get MIME type from file
 */
export function getMimeType(file: File): string {
  return file.type || "image/png";
}

/**
 * Create an inline data part for Gemini API
 */
export function createImagePart(base64Data: string, mimeType: string): ImagePart {
  return {
    inlineData: {
      mimeType,
      data: base64Data,
    },
  };
}

/**
 * Create a text part for Gemini API
 */
export function createTextPart(text: string): TextPart {
  return { text };
}

/**
 * Convert resolution string to API format
 */
export function formatResolution(resolution: string): Resolution {
  return resolution.toUpperCase() as Resolution;
}

/**
 * Call Gemini API with image generation capability
 */
export async function callGeminiImageAPI(
  apiKey: string,
  contents: ContentPart[],
  resolution: Resolution,
  requestId: string
): Promise<ProcessedResult[]> {
  const ai = new GoogleGenAI({ apiKey });

  const requestPayload = {
    model: "gemini-3-pro-image-preview",
    contents,
    config: {
      responseModalities: ["TEXT", "IMAGE"] as const,
      imageConfig: {
        imageSize: resolution,
      },
    },
  };

  // Log request
  debugLogger.logRequest(requestId, requestPayload);

  try {
    const response = await ai.models.generateContent({
      model: requestPayload.model,
      contents: requestPayload.contents,
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    });

    // Log response
    debugLogger.logResponse(requestId, response as unknown as Record<string, unknown>);

    const results: ProcessedResult[] = [];
    let imageIndex = 0;

    if (response.candidates && response.candidates[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          results.push({
            index: imageIndex,
            imageData: part.inlineData.data || "",
            mimeType: part.inlineData.mimeType || "image/png",
          });
          imageIndex++;
        }
      }
    }

    return results;
  } catch (error) {
    debugLogger.logResponse(requestId, { error: String(error) });
    throw error;
  }
}

/**
 * Convert base64 to Blob URL for display
 */
export function base64ToBlob(base64: string, mimeType: string): string {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: mimeType });
  return URL.createObjectURL(blob);
}

/**
 * Convert base64 to File object
 */
export function base64ToFile(base64: string, mimeType: string, filename: string): File {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new File([byteArray], filename, { type: mimeType });
}

/**
 * Calculate Greatest Common Divisor (GCD) using Euclidean algorithm
 */
export function gcd(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

/**
 * Calculate aspect ratio from image dimensions
 * Returns simplified ratio using GCD
 */
export function calculateAspectRatio(width: number, height: number): { width: number; height: number; ratioX: number; ratioY: number } {
  const divisor = gcd(width, height);
  return {
    width,
    height,
    ratioX: width / divisor,
    ratioY: height / divisor,
  };
}

/**
 * Get image dimensions from a File
 */
export function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Format aspect ratio string for prompt
 * Returns: "{width}x{height} which is about {ratioX}:{ratioY}"
 */
export function formatAspectRatioForPrompt(width: number, height: number): string {
  const { ratioX, ratioY } = calculateAspectRatio(width, height);
  return `${width}x${height} which is about ${ratioX}:${ratioY}`;
}

/**
 * Error types for localization
 */
export type ApiErrorType = 
  | "quotaExceeded"
  | "rateLimited"
  | "invalidApiKey"
  | "networkError"
  | "serverError"
  | "noImageGenerated"
  | "unknownError";

export interface ParsedApiError {
  type: ApiErrorType;
  retryAfterSeconds?: number;
}

/**
 * Parse API error and return localized error type
 */
export function parseApiError(error: unknown): ParsedApiError {
  const errorStr = String(error);
  const errorObj = error as { message?: string; status?: string; code?: number };
  
  // Check for quota/rate limit errors
  if (
    errorStr.includes("RESOURCE_EXHAUSTED") ||
    errorStr.includes("quota") ||
    errorStr.includes("429") ||
    errorObj.code === 429
  ) {
    // Try to extract retry time
    const retryMatch = errorStr.match(/retry in (\d+(?:\.\d+)?)/i);
    const retrySeconds = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : undefined;
    
    if (retrySeconds) {
      return { type: "rateLimited", retryAfterSeconds: retrySeconds };
    }
    return { type: "quotaExceeded" };
  }
  
  // Check for invalid API key
  if (
    errorStr.includes("INVALID_API_KEY") ||
    errorStr.includes("API_KEY_INVALID") ||
    errorStr.includes("401") ||
    errorStr.includes("UNAUTHENTICATED")
  ) {
    return { type: "invalidApiKey" };
  }
  
  // Check for network errors
  if (
    errorStr.includes("NetworkError") ||
    errorStr.includes("Failed to fetch") ||
    errorStr.includes("ENOTFOUND") ||
    errorStr.includes("ETIMEDOUT")
  ) {
    return { type: "networkError" };
  }
  
  // Check for server errors
  if (
    errorStr.includes("500") ||
    errorStr.includes("502") ||
    errorStr.includes("503") ||
    errorStr.includes("INTERNAL")
  ) {
    return { type: "serverError" };
  }
  
  return { type: "unknownError" };
}
