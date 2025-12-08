// frontend/app/upload/page.tsx
"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFiles = async (files: FileList) => {
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("file", file);
    });

    try {
      const res = await fetch(`${BACKEND_URL}/api/receipts/upload/`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(
          `Upload failed (${res.status}): ${text || res.statusText}`
        );
      }

      // success → go back to dashboard to see results
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Upload error:", err);
      setError(err.message || "Unexpected error while uploading receipts.");
    } finally {
      setIsUploading(false);
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    void handleFiles(e.target.files);
    // reset so the same file can be chosen again if needed
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isUploading) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void handleFiles(e.dataTransfer.files);
    }
  };

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <main className="layout-main">
      <section className="panel upload-panel">
        <p className="panel-subtitle" style={{ marginBottom: 12 }}>
          Upload receipts to track your expenses
        </p>

        <div
          className={
            "upload-dropzone-page" +
            (isDragging ? " dragging" : "") +
            (isUploading ? " disabled" : "")
          }
          onClick={handleClick}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
        >
          {/* Loading overlay when uploading */}
          {isUploading && (
            <div className="upload-overlay">
              <div className="spinner" />
              <div className="upload-overlay-text">
                Processing receipts…
              </div>
            </div>
          )}

          <div className="upload-icon-page">⬆️</div>
          <div className="upload-title-page">Upload Receipt</div>
          <div className="upload-subtitle-page">
            Click to upload or drag and drop
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={onInputChange}
          />
        </div>

        {error && (
          <p
            style={{
              color: "#b91c1c",
              fontSize: 13,
              marginTop: 12,
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
