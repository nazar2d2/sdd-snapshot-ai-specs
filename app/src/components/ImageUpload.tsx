import { useRef, useState } from "react";
import { Upload, X, Image as ImageIcon, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  value: string | null;
  onChange: (base64: string | null) => void;
  size?: "default" | "large";
}

export function ImageUpload({ value, onChange, size = "default" }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const compressImageToDataUrl = async (file: File): Promise<string> => {
    const fileToDataUrl = (blob: Blob) =>
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Failed to read image"));
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });

    const dataUrl = await fileToDataUrl(file);

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Invalid image"));
      el.src = dataUrl;
    });

    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return dataUrl;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, 0, 0, w, h);

    const outBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
    );

    return outBlob ? fileToDataUrl(outBlob) : dataUrl;
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) return;

    try {
      const base64 = await compressImageToDataUrl(file);
      onChange(base64);
    } catch {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        onChange(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  if (value) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.02] shadow-[0_4px_24px_hsl(0,0%,0%,0.4)]">
        <img
          src={value}
          alt="Uploaded product"
          className="w-full aspect-square object-contain bg-white/[0.03]"
        />
        {/* Success badge */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[hsl(142,72%,42%)]/90 backdrop-blur-sm text-primary-foreground text-xs font-medium shadow-md">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Uploaded
        </div>
        <Button
          onClick={handleRemove}
          variant="destructive"
          size="icon"
          className="absolute top-3 right-3 h-8 w-8 rounded-full shadow-md"
        >
          <X className="w-4 h-4" />
        </Button>
        <div className="p-3 bg-white/[0.02] border-t border-white/[0.06]">
          <p className="text-sm text-muted-foreground/90 text-center font-body">
            Product image ready
          </p>
        </div>
      </div>
    );
  }

  const isLarge = size === "large";

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative flex flex-col items-center justify-center
        rounded-xl cursor-pointer
        transition-all duration-300
        ${isLarge ? "min-h-[280px] w-full" : "aspect-square"}
        ${isDragging
          ? "border-2 border-primary/60 bg-primary/[0.08] shadow-[0_0_30px_hsl(252,85%,62%,0.15)]"
          : "upload-dropzone-border bg-white/[0.02] hover:bg-white/[0.04]"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleChange}
        className="hidden"
      />
      <div className="flex flex-col items-center space-y-4 p-8">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300 ${
          isDragging
            ? "bg-primary/20 shadow-[0_0_20px_hsl(252,85%,62%,0.2)]"
            : "bg-gradient-to-br from-primary/15 to-accent/10"
        }`}>
          {isDragging ? (
            <ImageIcon className="w-8 h-8 text-primary" />
          ) : (
            <Upload className="w-8 h-8 text-primary/70" />
          )}
        </div>
        <div className="text-center space-y-1">
          <p className="font-body font-medium text-foreground">
            {isDragging ? "Drop your image here" : "Upload product image"}
          </p>
          <p className="text-sm text-muted-foreground/70">
            Drag and drop or click to browse
          </p>
        </div>
      </div>

      <style>{`
        .upload-dropzone-border {
          border: 2px dashed transparent;
          background-image: linear-gradient(hsl(0 0% 4%), hsl(0 0% 4%)),
            linear-gradient(135deg, hsl(252 85% 62% / 0.4), hsl(217 91% 60% / 0.2), hsl(252 85% 62% / 0.1));
          background-origin: border-box;
          background-clip: padding-box, border-box;
        }
        .upload-dropzone-border:hover {
          background-image: linear-gradient(hsl(0 0% 5%), hsl(0 0% 5%)),
            linear-gradient(135deg, hsl(252 85% 62% / 0.6), hsl(217 91% 60% / 0.35), hsl(252 85% 62% / 0.2));
        }
      `}</style>
    </div>
  );
}
