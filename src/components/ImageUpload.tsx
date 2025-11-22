import { useState, useRef, ChangeEvent } from 'react';
import { Camera, Upload, X, Check } from 'lucide-react';
import { optimizeImage, formatFileSize, calculateSavings } from '../utils/imageOptimization';

interface ImageUploadProps {
  onImageSelect: (dataUrl: string, blob: Blob) => void;
  currentImage?: string | null;
  maxWidth?: number;
  maxHeight?: number;
}

export function ImageUpload({
  onImageSelect,
  currentImage,
  maxWidth = 800,
  maxHeight = 800,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(currentImage || null);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<{
    original: number;
    optimized: number;
    savings: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    setProcessing(true);
    setStats(null);

    try {
      const result = await optimizeImage(file, {
        maxWidth,
        maxHeight,
        quality: 0.85,
        format: 'jpeg',
      });

      setPreview(result.dataUrl);
      setStats({
        original: result.originalSize,
        optimized: result.optimizedSize,
        savings: calculateSavings(result.originalSize, result.optimizedSize),
      });

      onImageSelect(result.dataUrl, result.blob);
    } catch (error) {
      console.error('Image optimization error:', error);
      alert('Failed to process image. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const clearImage = () => {
    setPreview(null);
    setStats(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={processing}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 rounded-lg transition-colors"
        >
          <Upload className="w-4 h-4" />
          <span className="text-sm font-medium">Upload Image</span>
        </button>

        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={processing}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 disabled:bg-slate-50 disabled:text-slate-400 rounded-lg transition-colors"
        >
          <Camera className="w-4 h-4" />
          <span className="text-sm font-medium">Take Photo</span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileSelect}
        className="hidden"
      />

      {processing && (
        <div className="flex items-center justify-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
          <div className="text-center">
            <div className="w-8 h-8 border-3 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm text-slate-600">Processing image...</p>
          </div>
        </div>
      )}

      {preview && !processing && (
        <div className="space-y-3">
          <div className="relative group">
            <img
              src={preview}
              alt="Product preview"
              className="w-full h-48 object-cover rounded-lg border border-slate-200"
            />
            <button
              type="button"
              onClick={clearImage}
              className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {stats && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
              <div className="flex-1 text-xs text-green-800">
                <span className="font-medium">Optimized:</span>{' '}
                {formatFileSize(stats.original)} → {formatFileSize(stats.optimized)}{' '}
                <span className="font-semibold">({stats.savings}% smaller)</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
