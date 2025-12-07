"use client";

import { ManagedFile } from "@/store/useAppStore";
import { X, ArrowRight } from "lucide-react";
import Image from "next/image";
import { useEffect, useCallback } from "react";

interface ImageModalProps {
  file: ManagedFile;
  onClose: () => void;
}

export function ImageModal({ file, onClose }: ImageModalProps) {
  const hasProcessedImage = file.status === "done" && file.processedPreview;

  // Close on escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    // Prevent body scroll when modal is open
    document.body.style.overflow = "hidden";
    
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [handleKeyDown]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-sec hover:bg-ter transition-colors z-10"
      >
        <X className="h-6 w-6 text-pri" />
      </button>

      {/* File name */}
      <div className="absolute top-4 left-4 px-4 py-2 rounded-lg bg-sec">
        <p className="text-pri font-medium">{file.name}</p>
      </div>

      {/* Content */}
      <div className="max-w-[95vw] max-h-[85vh] flex items-center justify-center gap-4">
        {hasProcessedImage ? (
          // Before/After comparison view
          <div className="flex items-center gap-4 md:gap-8">
            {/* Original image */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm text-white/70 font-medium">Original</span>
              <div className="relative max-w-[40vw] max-h-[75vh] rounded-lg overflow-hidden shadow-2xl">
                <Image
                  src={file.preview}
                  alt={`${file.name} - Original`}
                  width={800}
                  height={1200}
                  className="object-contain max-h-[75vh] w-auto"
                  style={{ maxWidth: "40vw" }}
                />
              </div>
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 p-3 rounded-full bg-hl shadow-lg">
              <ArrowRight className="h-6 w-6 md:h-8 md:w-8 text-hl" />
            </div>

            {/* Processed image */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm text-white/70 font-medium">Processed</span>
              <div className="relative max-w-[40vw] max-h-[75vh] rounded-lg overflow-hidden shadow-2xl">
                <Image
                  src={file.processedPreview!}
                  alt={`${file.name} - Processed`}
                  width={800}
                  height={1200}
                  className="object-contain max-h-[75vh] w-auto"
                  style={{ maxWidth: "40vw" }}
                />
              </div>
            </div>
          </div>
        ) : (
          // Single image view
          <div className="flex flex-col items-center gap-2">
            <div className="relative max-w-[90vw] max-h-[80vh] rounded-lg overflow-hidden shadow-2xl">
              <Image
                src={file.preview}
                alt={file.name}
                width={800}
                height={1200}
                className="object-contain max-h-[80vh] w-auto"
                style={{ maxWidth: "90vw" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
