// frontend/components/dashboard/image-upload.tsx
// Purpose: Multi-image upload UI with Cloudinary pipeline, drag-to-reorder,
//          file validation, and Cover badge on the primary image.

'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';
import { Upload, Loader2, X, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import apiClient from '@/lib/api/client';
import { getErrorMessage } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImageUploadProps {
  value: string[];                   // ordered array of Cloudinary URLs
  onChange: (urls: string[]) => void;
  onRemove: (url: string) => void;
  folder: 'smartkiosk/products' | 'smartkiosk/categories';
  maxImages?: number;                // default: 8
  disabled?: boolean;
}

interface UploadResponse {
  success: boolean;
  data: { url: string; publicId: string };
  message: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImageUpload({
  value,
  onChange,
  onRemove,
  folder,
  maxImages = 8,
  disabled = false,
}: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragSourceIndex, setDragSourceIndex] = useState<number | null>(null);

  const atLimit = value.length >= maxImages;

  // ── File → Base64 → Cloudinary Upload ─────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    // Slots remaining
    const slotsLeft = maxImages - value.length;
    const toProcess = files.slice(0, slotsLeft);

    for (const file of toProcess) {
      // ── Type check ──
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        toast.error('Only PNG, JPG, and WebP images are accepted.');
        continue;
      }

      // ── Size check (5MB) ──
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 5MB.');
        continue;
      }

      setIsUploading(true);

      try {
        const base64 = await fileToBase64(file);

        const response = await apiClient.post<UploadResponse>('/upload', {
          base64,
          folder,
        });

        const newUrl = response.data.data.url;
        onChange([...value, newUrl]);
      } catch (error: unknown) {
        toast.error(getErrorMessage(error) || 'Upload failed. Please try again.');
      } finally {
        setIsUploading(false);
      }
    }

    // Reset input so the same file can be re-selected if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // ── Drag-to-Reorder (native HTML5 DnD — no external lib) ──────────────────

  const handleDragStart = (index: number) => {
    setDragSourceIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragSourceIndex === null || dragSourceIndex === targetIndex) {
      setDragOverIndex(null);
      setDragSourceIndex(null);
      return;
    }

    const reordered = [...value];
    const [moved] = reordered.splice(dragSourceIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    onChange(reordered);

    setDragOverIndex(null);
    setDragSourceIndex(null);
  };

  const handleDragEnd = () => {
    setDragOverIndex(null);
    setDragSourceIndex(null);
  };

  return (
    <div className="space-y-3">
      {/* Thumbnail Grid */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {value.map((url, index) => (
            <div
              key={url}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={[
                'relative w-24 h-24 rounded-xl overflow-hidden border-2 transition-all duration-150',
                'bg-muted cursor-grab active:cursor-grabbing',
                dragOverIndex === index && dragSourceIndex !== index
                  ? 'border-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.3)]'
                  : 'border-border',
              ].join(' ')}
            >
              <Image
                src={url}
                alt={`Product image ${index + 1}`}
                fill
                sizes="96px"
                className="object-cover"
              />

              {/* Drag Handle */}
              <span
                className="absolute top-1 left-1 text-white/80 drop-shadow"
                aria-hidden="true"
              >
                <GripVertical className="h-4 w-4" />
              </span>

              {/* Remove Button */}
              <button
                type="button"
                onClick={() => onRemove(url)}
                disabled={disabled || isUploading}
                className={[
                  'absolute top-1 right-1 h-5 w-5 flex items-center justify-center',
                  'rounded-full bg-destructive text-destructive-foreground',
                  'shadow hover:opacity-90 transition-opacity',
                  'disabled:pointer-events-none disabled:opacity-50',
                ].join(' ')}
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>

              {/* Cover Badge — first image only */}
              {index === 0 && (
                <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-500 text-white leading-none">
                  Cover
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Upload Zone — hidden when at limit */}
      {!atLimit && (
        <div
          role="button"
          tabIndex={disabled || isUploading ? -1 : 0}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled && !isUploading) {
              fileInputRef.current?.click();
            }
          }}
          className={[
            'relative flex flex-col items-center justify-center gap-2',
            'w-full rounded-xl border-2 border-dashed p-8 text-center',
            'transition-colors duration-150',
            disabled || isUploading
              ? 'cursor-not-allowed opacity-50 border-border'
              : 'cursor-pointer border-border hover:border-primary hover:bg-accent/30',
          ].join(' ')}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading…</p>
            </>
          ) : (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Click to upload or drag and drop
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  PNG, JPG, WebP · Max 5MB
                  {maxImages > 1 && ` · Up to ${maxImages} images`}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple={maxImages > 1}
        className="sr-only"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Failed to convert file to base64.'));
      }
    };
    reader.onerror = () => reject(new Error('File reading failed.'));
  });
}
