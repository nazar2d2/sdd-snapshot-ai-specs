import { useState, useEffect } from "react";
import { Download, RefreshCw, Sparkles, Check, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

interface ImageResult {
  view: string;
  viewId: string;
  variantName: string;
  image: string | null;
  error: string | null;
  taskId?: string;
  jobId?: string;
}

interface ImageVersion {
  id: string;
  image: string;
  fixInstruction?: string;
  isOriginal: boolean;
}

interface ImageWithVersions extends ImageResult {
  versions: ImageVersion[];
  selectedVersionIndex: number;
}

interface GenerationMetadata {
  niche?: string | null;
  aspectRatio?: string;
  productType?: string;
  viewPose?: string;
  season?: string;
  ethnicity?: string;
  skinTone?: string;
  colorVariants?: Array<{ color: string; name: string }>;
  gender?: string;
  modelAge?: number;
  city?: string;
  backgroundColor?: string;
  productImage?: string;
  expectedTotal?: number;
  [key: string]: unknown;
}

interface ImageResultsProps {
  images: ImageResult[];
  onReset: () => void;
  onFixImage?: (imageData: {
    view: string;
    originalImage: string;
    fixInstruction: string;
    metadata?: GenerationMetadata;
  }) => Promise<string | null>;
  generationMetadata?: GenerationMetadata;
  expectedTotal?: number;
  onRetryMissing?: (jobId: string) => Promise<void>;
}

const viewLabels: Record<string, string> = {
  front: "Front View",
  side: "Side View",
  back: "Back View",
  outdoor: "Outdoor View",
  fullProduct: "Full Product Shot",
  lifestylePrimary: "Lifestyle (Primary)",
  lifestyleSecondary: "Lifestyle (Secondary)",
};

export function ImageResults({ images, onReset, onFixImage, generationMetadata, expectedTotal, onRetryMissing }: ImageResultsProps) {
  const aspectRatio = generationMetadata?.aspectRatio || "1:1";
  
  const getAspectRatioClass = (ratio: string): string => {
    switch (ratio) {
      case "4:5": return "aspect-[4/5]";
      case "9:16": return "aspect-[9/16]";
      case "1:1":
      default: return "aspect-square";
    }
  };
  
  const aspectClass = getAspectRatioClass(aspectRatio);

  const [imagesWithVersions, setImagesWithVersions] = useState<ImageWithVersions[]>(() =>
    images.map((img) => ({
      ...img,
      versions: img.image ? [{
        id: crypto.randomUUID(),
        image: img.image,
        isOriginal: true,
      }] : [],
      selectedVersionIndex: 0,
    }))
  );

  // Sync incoming images when signed URLs resolve asynchronously (image goes from null → URL)
  useEffect(() => {
    setImagesWithVersions((prev) =>
      images.map((img, idx) => {
        const existing = prev[idx];
        if (!existing) {
          return {
            ...img,
            versions: img.image
              ? [{ id: crypto.randomUUID(), image: img.image, isOriginal: true }]
              : [],
            selectedVersionIndex: 0,
          };
        }
        // If we now have a URL but previously didn't — fill in the original version
        const hadNoImage = existing.versions.length === 0 || !existing.versions.find((v) => v.isOriginal)?.image;
        if (img.image && hadNoImage) {
          const newOriginal = { id: crypto.randomUUID(), image: img.image, isOriginal: true };
          const nonOriginals = existing.versions.filter((v) => !v.isOriginal);
          return {
            ...existing,
            image: img.image,
            error: null,
            versions: [newOriginal, ...nonOriginals],
            selectedVersionIndex: 0,
          };
        }
        // Update error state without touching versions
        return { ...existing, error: img.error };
      })
    );
  }, [images]);

  const successCount = imagesWithVersions.filter(img => img.versions.length > 0 && img.versions[0]?.image).length;
  const failedCount = imagesWithVersions.filter(img => !img.versions.length || !img.versions[0]?.image).length;
  const totalCount = expectedTotal || images.length;
  const hasRetryableFailures = failedCount > 0 && successCount > 0 && onRetryMissing;
  const retryJobId = images.find(img => img.jobId)?.jobId;
  const [isRetrying, setIsRetrying] = useState(false);

  const getIdentityAnchorImage = (): string | null => {
    const priority = ["front", "outdoor", "side", "back"];
    for (const viewId of priority) {
      const hit = imagesWithVersions.find((i) => i.viewId?.toLowerCase() === viewId);
      if (hit?.versions?.[0]?.image) return hit.versions[0].image;
    }
    return imagesWithVersions[0]?.versions?.[0]?.image ?? null;
  };

  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [fixDialogOpen, setFixDialogOpen] = useState(false);
  const [fixInstruction, setFixInstruction] = useState("");
  const [fixingImageIndex, setFixingImageIndex] = useState<number | null>(null);
  const [isFixing, setIsFixing] = useState(false);

  const getAspectDimensions = (ratio: string): { width: number; height: number } => {
    switch (ratio) {
      case "4:5": return { width: 1024, height: 1280 };
      case "9:16": return { width: 1080, height: 1920 };
      case "1:1":
      default: return { width: 1024, height: 1024 };
    }
  };

  const handleDownload = async (imageUrl: string, viewName: string, imageData?: ImageWithVersions) => {
    try {
      const { width: targetW, height: targetH } = getAspectDimensions(aspectRatio);
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas context unavailable");

      const img = new Image();
      img.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = imageUrl;
      });

      const viewId = imageData?.viewId?.toLowerCase() || viewName.toLowerCase();
      const isOutdoor = viewId.includes("outdoor");

      // Cover-crop: fill canvas edge-to-edge, center the image
      const scale = Math.max(targetW / img.width, targetH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      ctx.drawImage(img, (targetW - drawW) / 2, (targetH - drawH) / 2, drawW, drawH);

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${viewName.toLowerCase().replace(/\s+/g, "-")}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      try {
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${viewName.toLowerCase().replace(/\s+/g, "-")}.png`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch {
        console.error("Fallback download also failed");
      }
    }
  };

  const toggleImageSelection = (index: number) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(index)) newSelected.delete(index);
    else newSelected.add(index);
    setSelectedImages(newSelected);
  };

  const handleFixClick = (index: number) => {
    if (isMultiSelectMode && selectedImages.size > 0) {
      setFixingImageIndex(null);
    } else {
      setFixingImageIndex(index);
    }
    setFixInstruction("");
    setFixDialogOpen(true);
  };

  const handleFixConfirm = async () => {
    if (!fixInstruction.trim() || !onFixImage) return;
    setIsFixing(true);
    try {
      const indicesToFix =
        isMultiSelectMode && selectedImages.size > 0
          ? Array.from(selectedImages)
          : fixingImageIndex !== null ? [fixingImageIndex] : [];

      for (const index of indicesToFix) {
        const imageData = imagesWithVersions[index];
        if (!imageData) continue;
        const currentVersion = imageData.versions[imageData.selectedVersionIndex];
        const identityAnchorImage = getIdentityAnchorImage();
        const newImageUrl = await onFixImage({
          view: imageData.view,
          originalImage: currentVersion.image,
          fixInstruction: fixInstruction.trim(),
          metadata: {
            ...(generationMetadata || {}),
            ...(identityAnchorImage ? { identityAnchorImage } : {}),
            ...(imageData.taskId ? { originalTaskId: imageData.taskId } : {}),
          },
        });
        if (newImageUrl) {
          setImagesWithVersions((prev) => {
            const updated = [...prev];
            const newVersion: ImageVersion = {
              id: crypto.randomUUID(),
              image: newImageUrl,
              fixInstruction: fixInstruction.trim(),
              isOriginal: false,
            };
            updated[index] = {
              ...updated[index],
              versions: [...updated[index].versions, newVersion],
              selectedVersionIndex: updated[index].versions.length,
            };
            return updated;
          });
        }
      }
    } catch (error) {
      console.error("Fix image failed:", error);
    } finally {
      setIsFixing(false);
      setFixDialogOpen(false);
      setFixInstruction("");
      setFixingImageIndex(null);
      setSelectedImages(new Set());
      setIsMultiSelectMode(false);
    }
  };

  const selectVersion = (imageIndex: number, versionIndex: number) => {
    setImagesWithVersions((prev) => {
      const updated = [...prev];
      updated[imageIndex] = { ...updated[imageIndex], selectedVersionIndex: versionIndex };
      return updated;
    });
  };

  return (
    <div className="space-y-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 shadow-lg shadow-primary/5">
            <ImageIcon className="w-6 h-6 text-primary" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl md:text-3xl font-display font-medium text-foreground">
                Generated Images
              </h2>
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs">
                {successCount}/{totalCount}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-body">
              {successCount} of {totalCount} images generated successfully
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onFixImage && imagesWithVersions.length > 1 && (
            <Button
              onClick={() => {
                setIsMultiSelectMode(!isMultiSelectMode);
                if (isMultiSelectMode) setSelectedImages(new Set());
              }}
              variant={isMultiSelectMode ? "secondary" : "outline"}
              className="flex items-center space-x-2 border-border"
            >
              {isMultiSelectMode ? (
                <><X className="w-4 h-4" /><span>Cancel Select</span></>
              ) : (
                <><Check className="w-4 h-4" /><span>Multi Select</span></>
              )}
            </Button>
          )}
          {isMultiSelectMode && selectedImages.size > 0 && onFixImage && (
            <Button
              onClick={() => handleFixClick(-1)}
              variant="outline"
              className="flex items-center space-x-2 border-primary/30 text-primary hover:bg-primary/5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Fix {selectedImages.size} Images</span>
            </Button>
          )}
          {hasRetryableFailures && retryJobId && (
            <Button
              onClick={async () => {
                setIsRetrying(true);
                try { await onRetryMissing!(retryJobId); } finally { setIsRetrying(false); }
              }}
              disabled={isRetrying}
              variant="outline"
              className="flex items-center space-x-2 border-primary/30 text-primary hover:bg-primary/5"
            >
              <RefreshCw className={cn("w-4 h-4", isRetrying && "animate-spin")} />
              <span>{isRetrying ? "Retrying..." : `Retry ${failedCount} Missing`}</span>
            </Button>
          )}
          <Button
            onClick={onReset}
            variant="outline"
            className="flex items-center space-x-2 border-border hover:bg-secondary"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Start Over</span>
          </Button>
        </div>
      </div>

      {/* Image Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 w-full min-w-0">
        {imagesWithVersions.map((result, index) => {
          const hasImage = result.versions.length > 0 && result.versions[0]?.image;
          const currentVersion = hasImage ? result.versions[result.selectedVersionIndex] : null;
          const isSelected = selectedImages.has(index);

          if (!hasImage) {
            return (
              <div
                key={`${result.view}-${index}`}
                className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-white/[0.01] overflow-hidden animate-fade-in"
                style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
              >
                <div
                  className={`${aspectClass} relative overflow-hidden flex items-center justify-center`}
                  style={{ backgroundColor: generationMetadata?.backgroundColor || 'hsl(var(--secondary))', opacity: 0.5 }}
                >
                  <div className="text-center p-4">
                    <X className="w-12 h-12 mx-auto text-destructive/60 mb-2" />
                    <p className="text-sm text-destructive font-medium">{result.error || "Generation failed"}</p>
                    <p className="text-xs text-muted-foreground mt-1">Use "Start Over" to retry</p>
                  </div>
                </div>
                <div className="p-4">
                  <span className="font-body font-medium text-foreground truncate block">{viewLabels[result.view] || result.view}</span>
                  <span className="text-xs text-destructive">Failed — please retry</span>
                </div>
              </div>
            );
          }

          return (
            <div
              key={`${result.view}-${index}`}
              className={cn(
                "rounded-xl overflow-hidden transition-all duration-200 animate-fade-in",
                "hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.02]",
                isMultiSelectMode && "cursor-pointer",
                isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background"
              )}
              style={{ animationDelay: `${index * 80}ms`, animationFillMode: "both" }}
              onClick={isMultiSelectMode ? () => toggleImageSelection(index) : undefined}
            >
              {isMultiSelectMode && (
                <div className="absolute top-3 left-3 z-10">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleImageSelection(index)}
                    className="h-6 w-6 bg-background/80 backdrop-blur-sm"
                  />
                </div>
              )}

              <div
                className={`${aspectClass} relative overflow-hidden flex items-center justify-center`}
                style={{
                  backgroundColor: (result.viewId?.toLowerCase() || '').includes('outdoor')
                    ? undefined
                    : generationMetadata?.backgroundColor || 'hsl(var(--secondary))'
                }}
              >
                <img
                  src={currentVersion!.image}
                  alt={viewLabels[result.view] || result.view}
                  className="w-full h-full object-cover object-center"
                  loading="lazy"
                  decoding="async"
                />
                {result.versions.length > 1 && (
                  <div className="absolute bottom-2 left-2 right-2 flex gap-1 justify-center">
                    {result.versions.map((version, vIndex) => (
                      <button
                        key={version.id}
                        onClick={(e) => { e.stopPropagation(); selectVersion(index, vIndex); }}
                        className={cn(
                          "w-2.5 h-2.5 rounded-full transition-all",
                          vIndex === result.selectedVersionIndex
                            ? "bg-primary scale-125"
                            : "bg-background/70 hover:bg-background"
                        )}
                        title={version.isOriginal ? "Original" : `Fix: ${version.fixInstruction}`}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col gap-3 min-w-0">
                <div className="flex flex-col min-w-0">
                  <span className="font-body font-medium text-foreground truncate">
                    {viewLabels[result.view] || result.view}
                  </span>
                  {result.versions.length > 1 && (
                    <span className="text-xs text-muted-foreground">
                      {currentVersion!.isOriginal ? "Original" : `Version ${result.selectedVersionIndex + 1}`}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {onFixImage && !isMultiSelectMode && (
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleFixClick(index); }}
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-2 border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 shrink-0"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Fix</span>
                    </Button>
                  )}
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(currentVersion!.image, viewLabels[result.view] || result.view, result);
                    }}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2 border-border hover:bg-secondary shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {successCount === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground font-body">No images were generated successfully.</p>
          <Button onClick={onReset} className="mt-4">Try Again</Button>
        </div>
      )}

      {/* Fix Image Dialog */}
      <Dialog open={fixDialogOpen} onOpenChange={setFixDialogOpen}>
        <DialogContent className="sm:max-w-md overflow-hidden">
          <div className="h-1 w-full bg-gradient-to-r from-primary to-accent -mt-6 mb-4" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              Fix Image
            </DialogTitle>
            <DialogDescription>
              {isMultiSelectMode && selectedImages.size > 1
                ? `Describe what needs to be fixed. This will apply to ${selectedImages.size} selected images.`
                : "Describe what needs to be fixed in this image. The same model, view, and styling will be preserved."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Input
              placeholder="e.g., Make the lighting brighter, adjust the pose, fix the collar..."
              value={fixInstruction}
              onChange={(e) => setFixInstruction(e.target.value)}
              disabled={isFixing}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !isFixing && fixInstruction.trim()) handleFixConfirm();
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFixDialogOpen(false)} disabled={isFixing}>
              Cancel
            </Button>
            <Button
              onClick={handleFixConfirm}
              disabled={!fixInstruction.trim() || isFixing}
              className="flex items-center gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
            >
              {isFixing ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /><span>Fixing...</span></>
              ) : (
                <><Sparkles className="w-4 h-4" /><span>Apply Fix</span></>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
