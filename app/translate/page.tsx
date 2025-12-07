"use client";

import { useEffect } from "react";
import { useAppStore } from "@/store/useAppStore";
import { FileUpload } from "@/components/FileUpload";
import { FileGrid } from "@/components/FileGrid";
import { Sidebar } from "@/components/layout/Sidebar";

export default function TranslatePage() {
  const files = useAppStore((state) => state.files);
  const clearFiles = useAppStore((state) => state.clearFiles);

  // Clear files when navigating to this page
  useEffect(() => {
    clearFiles();
  }, [clearFiles]);

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Main content area */}
      <div className="flex-1 flex flex-col p-6 overflow-hidden">
        {files.length === 0 ? <FileUpload /> : <FileGrid />}
      </div>

      {/* Sidebar */}
      <Sidebar mode="translate" />
    </div>
  );
}
