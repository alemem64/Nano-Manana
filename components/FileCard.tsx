"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ManagedFile } from "@/store/useAppStore";
import { Check, GripVertical, ZoomIn } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ImageModal } from "./ImageModal";

interface FileCardProps {
  file: ManagedFile;
  index: number;
}

export function FileCard({ file, index }: FileCardProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: file.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? undefined : transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  // Timer for processing state - update every 100ms for smooth decimal display
  useEffect(() => {
    if (file.status === "processing" && file.processingStartTime) {
      const interval = setInterval(() => {
        const elapsed = (Date.now() - file.processingStartTime!) / 1000;
        setElapsedSeconds(elapsed);
      }, 100);
      return () => clearInterval(interval);
    } else {
      setElapsedSeconds(0);
    }
  }, [file.status, file.processingStartTime]);

  // Use processed image if available and done, otherwise original
  const displayImage = file.status === "done" && file.processedPreview 
    ? file.processedPreview 
    : file.preview;

  // Calculate fill percentage (50 seconds = 100%) - smooth transition
  const fillPercent = Math.min((elapsedSeconds / 50) * 100, 100);

  // Can open modal when not processing or waiting
  const canOpenModal = file.status === "pending" || file.status === "done";

  const handleCardClick = (e: React.MouseEvent) => {
    // Only open modal if not dragging and can open
    if (!isDragging && canOpenModal) {
      e.preventDefault();
      e.stopPropagation();
      setIsModalOpen(true);
    }
  };

  return (
    <>
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        onClick={handleCardClick}
        className={`relative group rounded-lg overflow-hidden border-2 ${
          canOpenModal ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
        } ${
          isDragging
            ? "border-[var(--hl-bd)] shadow-lg scale-105"
            : "border-sec hover:border-[var(--hl-bd)]"
        }`}
      >
        {/* Image container */}
        <div className="relative aspect-[3/4] bg-ter">
          <Image
            src={displayImage}
            alt={file.name}
            fill
            className="object-cover pointer-events-none"
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            draggable={false}
          />

          {/* Zoom indicator on hover - only when can open modal */}
          {canOpenModal && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none">
              <div className="p-3 rounded-full bg-sec/90 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                <ZoomIn className="h-6 w-6 text-pri" />
              </div>
            </div>
          )}

          {/* Waiting overlay - shimmer effect over image with dark background */}
          {file.status === "waiting" && (
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-0 bg-black/30" />
              <div className="absolute inset-0 shimmer-overlay" />
            </div>
          )}

          {/* Processing overlay - fill animation with timer badge */}
          {file.status === "processing" && (
            <>
              {/* Fill from left to right - smooth transition */}
              <div 
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: `linear-gradient(to right, var(--hl-bd) ${fillPercent}%, transparent ${fillPercent}%)`,
                  opacity: 0.5,
                }}
              />
              {/* Timer badge in top-right */}
              <div className="absolute top-2 right-2 min-w-[48px] px-2 py-1 rounded-md bg-sec text-pri text-sm font-mono font-bold text-center shadow-md pointer-events-none">
                {elapsedSeconds.toFixed(1)}s
              </div>
            </>
          )}

          {/* Done overlay - only show check icon */}
          {file.status === "done" && (
            <div className="absolute top-2 right-2 p-1.5 rounded-full bg-hl shadow-md pointer-events-none">
              <Check className="h-4 w-4 text-hl" />
            </div>
          )}

          {/* Index badge */}
          <div className="absolute top-2 left-2 min-w-[28px] px-2 py-1 rounded-md bg-sec text-pri text-sm font-bold text-center shadow-md pointer-events-none">
            {index + 1}
          </div>

          {/* Drag indicator - only show when pending */}
          {file.status === "pending" && (
            <div className="absolute top-2 right-2 p-1.5 rounded-md bg-sec shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              <GripVertical className="h-4 w-4 text-sec" />
            </div>
          )}
        </div>

        {/* Filename */}
        <div className="px-3 py-2 bg-sec">
          <p className="text-sm text-sec truncate" title={file.name}>
            {file.name}
          </p>
        </div>
      </div>

      {/* Image Modal */}
      {isModalOpen && (
        <ImageModal file={file} onClose={() => setIsModalOpen(false)} />
      )}
    </>
  );
}
