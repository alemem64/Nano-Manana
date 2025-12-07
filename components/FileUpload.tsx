"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";
import { useTranslation } from "@/i18n/useTranslation";
import { useAppStore } from "@/store/useAppStore";

export function FileUpload() {
  const t = useTranslation();
  const addFiles = useAppStore((state) => state.addFiles);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      addFiles(acceptedFiles);
    },
    [addFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`h-full w-full flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 cursor-pointer transition-all ${
        isDragActive
          ? "border-[var(--hl-bd)] bg-hl/10"
          : "border-sec hover:border-[var(--hl-bd)] hover:bg-sec"
      }`}
    >
      <input {...getInputProps()} />
      <Upload
        className={`h-16 w-16 mb-4 ${
          isDragActive ? "text-hl" : "text-ter"
        }`}
      />
      <p
        className={`text-lg font-medium mb-2 ${
          isDragActive ? "text-hl" : "text-pri"
        }`}
      >
        {t.upload.title}
      </p>
      <p className="text-sm text-sec">{t.upload.subtitle}</p>
      <p className="text-xs text-ter mt-4">{t.upload.formats}</p>
    </div>
  );
}
