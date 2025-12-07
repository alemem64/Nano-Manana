"use client";

import { create } from "zustand";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { processTranslation, TranslateConfig } from "@/services/translate";
import { processColorization } from "@/services/colorize";
import { processColorizeAndTranslate, ColorizeAndTranslateConfig } from "@/services/colorizeAndTranslate";
import { base64ToBlob, base64ToFile, ProcessedResult, Resolution as ApiResolution, parseApiError, ApiErrorType } from "@/services/core";

export type FileStatus = "pending" | "waiting" | "processing" | "done";

export interface ManagedFile {
  id: string;
  file: File;
  name: string;
  preview: string;
  status: FileStatus;
  order: number;
  // Processing state
  processingStartTime?: number;
  // Processed result
  processedPreview?: string;
  processedFile?: File;
  processedBase64?: string;
}

export type Resolution = "1k" | "2k" | "3k" | "4k";
export type SortOrder = "asc" | "desc";
export type ProcessingMode = "colorize" | "translate" | "colorizeAndTranslate";

interface AppState {
  // Files
  files: ManagedFile[];
  sortOrder: SortOrder;

  // Settings
  apiKey: string;
  batchSize: number;
  resolution: Resolution;
  fromLanguage: string;
  toLanguage: string;
  displayBothLanguages: boolean;

  // Processing state
  isProcessing: boolean;
  processedCount: number;
  currentMode: ProcessingMode | null;
  errorType: ApiErrorType | null;
  errorRetrySeconds?: number;
  processingStartTime?: number;
  currentBatchStartTime?: number;
  currentBatchIndex: number;
  totalBatches: number;

  // Actions
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  clearFiles: () => void;
  setFiles: (files: ManagedFile[]) => void;
  reorderFiles: (activeId: string, overId: string) => void;
  toggleSortOrder: () => void;
  sortFiles: (order: SortOrder) => void;

  // Settings actions
  setApiKey: (key: string) => void;
  setBatchSize: (size: number) => void;
  setResolution: (res: Resolution) => void;
  setFromLanguage: (lang: string) => void;
  setToLanguage: (lang: string) => void;
  setDisplayBothLanguages: (value: boolean) => void;

  // Processing actions
  setFilesWaiting: (indices: number[]) => void;
  setFilesProcessing: (indices: number[]) => void;
  setFileComplete: (result: ProcessedResult) => void;
  startProcessing: (mode: ProcessingMode) => Promise<void>;
  downloadZip: () => Promise<void>;
  resetProcessing: () => void;
  getProcessedImageBase64: (index: number) => Promise<string | null>;
}

const generateId = () => Math.random().toString(36).substring(2, 9);

const getFileExtension = (filename: string): string => {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "png";
};

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  files: [],
  sortOrder: "asc",
  apiKey: "",
  batchSize: 5,
  resolution: "1k",
  fromLanguage: "",
  toLanguage: "",
  displayBothLanguages: false,
  isProcessing: false,
  processedCount: 0,
  currentMode: null,
  errorType: null,
  errorRetrySeconds: undefined,
  processingStartTime: undefined,
  currentBatchStartTime: undefined,
  currentBatchIndex: 0,
  totalBatches: 0,

  // File actions
  addFiles: (newFiles: File[]) => {
    const currentFiles = get().files;
    const startOrder = currentFiles.length;

    const managedFiles: ManagedFile[] = newFiles.map((file, index) => ({
      id: generateId(),
      file,
      name: file.name,
      preview: URL.createObjectURL(file),
      status: "pending" as FileStatus,
      order: startOrder + index,
    }));

    set({ files: [...currentFiles, ...managedFiles] });
  },

  removeFile: (id: string) => {
    const files = get().files;
    const fileToRemove = files.find((f) => f.id === id);
    if (fileToRemove) {
      URL.revokeObjectURL(fileToRemove.preview);
      if (fileToRemove.processedPreview) {
        URL.revokeObjectURL(fileToRemove.processedPreview);
      }
    }

    const updatedFiles = files
      .filter((f) => f.id !== id)
      .map((f, index) => ({ ...f, order: index }));

    set({ files: updatedFiles });
  },

  clearFiles: () => {
    const files = get().files;
    files.forEach((f) => {
      URL.revokeObjectURL(f.preview);
      if (f.processedPreview) {
        URL.revokeObjectURL(f.processedPreview);
      }
    });
    set({
      files: [],
      isProcessing: false,
      processedCount: 0,
      currentMode: null,
      errorType: null,
      errorRetrySeconds: undefined,
      processingStartTime: undefined,
      currentBatchStartTime: undefined,
      currentBatchIndex: 0,
      totalBatches: 0,
    });
  },

  setFiles: (files: ManagedFile[]) => {
    set({ files });
  },

  reorderFiles: (activeId: string, overId: string) => {
    const files = [...get().files];
    const activeIndex = files.findIndex((f) => f.id === activeId);
    const overIndex = files.findIndex((f) => f.id === overId);

    if (activeIndex === -1 || overIndex === -1) return;

    const [removed] = files.splice(activeIndex, 1);
    files.splice(overIndex, 0, removed);

    const reorderedFiles = files.map((f, index) => ({ ...f, order: index }));
    set({ files: reorderedFiles });
  },

  toggleSortOrder: () => {
    const newOrder = get().sortOrder === "asc" ? "desc" : "asc";
    get().sortFiles(newOrder);
  },

  sortFiles: (order: SortOrder) => {
    const files = [...get().files];
    files.sort((a, b) => {
      // Use natural sort with numeric option for proper alphabetical ordering
      const comparison = a.name.localeCompare(b.name, undefined, {
        numeric: true,
        sensitivity: "base",
      });
      return order === "asc" ? comparison : -comparison;
    });

    const sortedFiles = files.map((f, index) => ({ ...f, order: index }));
    set({ files: sortedFiles, sortOrder: order });
  },

  // Settings actions
  setApiKey: (key: string) => set({ apiKey: key }),
  setBatchSize: (size: number) => set({ batchSize: size }),
  setResolution: (res: Resolution) => set({ resolution: res }),
  setFromLanguage: (lang: string) => set({ fromLanguage: lang }),
  setToLanguage: (lang: string) => set({ toLanguage: lang }),
  setDisplayBothLanguages: (value: boolean) => set({ displayBothLanguages: value }),

  // Processing helper actions
  setFilesWaiting: (indices: number[]) => {
    set((state) => ({
      files: state.files.map((f, idx) =>
        indices.includes(idx) ? { ...f, status: "waiting" as FileStatus } : f
      ),
    }));
  },

  setFilesProcessing: (indices: number[]) => {
    const now = Date.now();
    set((state) => ({
      files: state.files.map((f, idx) =>
        indices.includes(idx) 
          ? { ...f, status: "processing" as FileStatus, processingStartTime: now } 
          : f
      ),
      currentBatchStartTime: now,
      currentBatchIndex: state.currentBatchIndex + 1,
    }));
  },

  setFileComplete: (result: ProcessedResult) => {
    const { index, imageData, mimeType } = result;
    const files = get().files;
    
    if (index >= files.length) return;

    const processedPreview = base64ToBlob(imageData, mimeType);
    const extension = mimeType.split("/")[1] || "png";
    const processedFile = base64ToFile(imageData, mimeType, `${index + 1}p.${extension}`);

    set((state) => ({
      files: state.files.map((f, idx) =>
        idx === index
          ? {
              ...f,
              status: "done" as FileStatus,
              processedPreview,
              processedFile,
              processedBase64: imageData,
            }
          : f
      ),
      processedCount: state.processedCount + 1,
    }));
  },

  getProcessedImageBase64: async (index: number): Promise<string | null> => {
    const files = get().files;
    if (index >= files.length) return null;
    return files[index].processedBase64 || null;
  },

  // Processing actions
  startProcessing: async (mode: ProcessingMode) => {
    const { files, apiKey, batchSize, resolution, fromLanguage, toLanguage } = get();
    if (files.length === 0) return;
    if (!apiKey) {
      set({ errorType: "invalidApiKey" });
      return;
    }

    // Calculate total batches based on mode
    // For translate: simple batches of batchSize
    // For colorize/colorizeAndTranslate: progressive batches (1, 1, 2, 4, 4, ...) until batchSize reached
    let totalBatches: number;
    if (mode === "translate") {
      totalBatches = Math.ceil(files.length / batchSize);
    } else {
      // Colorize/ColorizeAndTranslate batch sizes: 1, 1, 2, 3, 4, 4, 4, ... (capped at batchSize)
      // Batch 1: 1 page (no ref)
      // Batch 2: min(2, batchSize, 1) = 1 page
      // Batch 3: min(3, batchSize, 2) = 2 pages
      // Batch 4: min(4, batchSize, 4) = min(4, batchSize) pages
      // Batch 5+: batchSize pages each
      let remaining = files.length;
      let batchNum = 1;
      let completed = 0;
      
      while (remaining > 0) {
        let batchCount: number;
        if (batchNum === 1) {
          batchCount = 1;
        } else {
          batchCount = Math.min(batchNum, batchSize, completed);
        }
        batchCount = Math.min(batchCount, remaining);
        
        remaining -= batchCount;
        completed += batchCount;
        batchNum++;
      }
      
      totalBatches = batchNum - 1;
    }

    const now = Date.now();
    set({ 
      isProcessing: true, 
      processedCount: 0, 
      currentMode: mode,
      errorType: null,
      errorRetrySeconds: undefined,
      processingStartTime: now,
      currentBatchStartTime: undefined,
      currentBatchIndex: 0,
      totalBatches,
    });

    // Reset all files to waiting and clear processed data
    const resetFiles = files.map((f) => ({ 
      ...f, 
      status: "waiting" as FileStatus,
      processingStartTime: undefined,
      processedPreview: undefined,
      processedFile: undefined,
      processedBase64: undefined,
    }));
    set({ files: resetFiles });

    try {
      const originalFiles = get().files.map((f) => f.file);

      if (mode === "translate") {
        const config: TranslateConfig = {
          apiKey,
          batchSize,
          resolution: resolution.toUpperCase() as ApiResolution,
          fromLanguage,
          toLanguage,
          displayBothLanguages: get().displayBothLanguages,
        };

        await processTranslation(
          originalFiles,
          config,
          (indices) => get().setFilesProcessing(indices),
          (result) => get().setFileComplete(result)
        );
      } else if (mode === "colorize") {
        const config = {
          apiKey,
          batchSize,
          resolution: resolution.toUpperCase() as ApiResolution,
        };

        await processColorization(
          originalFiles,
          config,
          (indices) => get().setFilesProcessing(indices),
          (result) => get().setFileComplete(result),
          (index) => get().getProcessedImageBase64(index)
        );
      } else if (mode === "colorizeAndTranslate") {
        const config: ColorizeAndTranslateConfig = {
          apiKey,
          batchSize,
          resolution: resolution.toUpperCase() as ApiResolution,
          fromLanguage,
          toLanguage,
          displayBothLanguages: get().displayBothLanguages,
        };

        await processColorizeAndTranslate(
          originalFiles,
          config,
          (indices) => get().setFilesProcessing(indices),
          (result) => get().setFileComplete(result),
          (index) => get().getProcessedImageBase64(index)
        );
      }
    } catch (error) {
      console.error("Processing error:", error);
      const parsed = parseApiError(error);
      
      // Reset all non-done files to pending on error
      set((state) => ({
        errorType: parsed.type, 
        errorRetrySeconds: parsed.retryAfterSeconds,
        files: state.files.map((f) => 
          f.status === "done" 
            ? f 
            : { ...f, status: "pending" as FileStatus, processingStartTime: undefined }
        ),
        currentBatchStartTime: undefined,
        currentBatchIndex: 0,
      }));
    } finally {
      set({ isProcessing: false });
    }
  },

  downloadZip: async () => {
    const { files } = get();
    if (files.length === 0) return;

    const zip = new JSZip();

    // Add processed files to zip with renamed filenames based on order
    for (let i = 0; i < files.length; i++) {
      const managedFile = files[i];
      
      // Use processed file if available, otherwise original
      const fileToZip = managedFile.processedFile || managedFile.file;
      const extension = getFileExtension(fileToZip.name);
      const newFilename = `${i + 1}p.${extension}`;

      const arrayBuffer = await fileToZip.arrayBuffer();
      zip.file(newFilename, arrayBuffer);
    }

    // Generate and download zip
    const content = await zip.generateAsync({ type: "blob" });
    saveAs(content, "nano-manana-output.zip");
  },

  resetProcessing: () => {
    set((state) => ({
      files: state.files.map((f) => ({ 
        ...f, 
        status: "pending" as FileStatus,
        processingStartTime: undefined,
        processedPreview: undefined,
        processedFile: undefined,
        processedBase64: undefined,
      })),
      isProcessing: false,
      processedCount: 0,
      currentMode: null,
      errorType: null,
      errorRetrySeconds: undefined,
      processingStartTime: undefined,
      currentBatchStartTime: undefined,
      currentBatchIndex: 0,
      totalBatches: 0,
    }));
  },
}));
