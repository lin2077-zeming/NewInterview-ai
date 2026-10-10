"use client";

import { useState } from "react";
import { FileText, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResumeUploaderProps {
  onUpload: (file: File) => void | Promise<void>;
  disabled?: boolean;
  fileName?: string;
}

export function ResumeUploader({ onUpload, disabled = false, fileName }: ResumeUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);

  function handleFile(file?: File) {
    if (!file || disabled) return;
    onUpload(file);
  }

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center transition-colors",
        isDragging ? "border-primary bg-muted" : "border-border",
        disabled ? "pointer-events-none opacity-60" : "cursor-pointer"
      )}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFile(event.dataTransfer.files[0]);
      }}
    >
      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
      <p className="text-sm text-muted-foreground mb-3">拖拽简历文件到此处，或点击选择文件</p>
      <label
        className="inline-flex h-8 items-center justify-center rounded-lg border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
      >
        选择文件
        <input
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
          }}
        />
      </label>
      {fileName ? (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="max-w-full truncate">{fileName}</span>
        </div>
      ) : null}
    </div>
  );
}
