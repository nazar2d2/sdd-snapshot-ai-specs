import { useState, useMemo, useCallback } from "react";
import { useUserImages, useSignedUrls, extractPathFromUrl, UserImage } from "@/integrations/supabase/hooks/useUserImages";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Download,
  ImageIcon,
  Loader2,
  LayoutGrid,
  Shirt,
  Lamp,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CheckSquare,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const NICHE_FILTERS = [
  { value: "all", label: "All", icon: LayoutGrid },
  { value: "fashion", label: "Fashion", icon: Shirt },
  { value: "homeDecor", label: "Home Decor", icon: Lamp },
];

const IMAGES_PER_PAGE = 20;

function formatNiche(niche: string): string {
  const n = niche?.toLowerCase() ?? "";
  if (n.includes("decor") || n.includes("home")) return "Home Decor";
  if (n.includes("fashion")) return "Fashion";
  return niche || "Product";
}

function nicheKey(niche: string): "fashion" | "decor" | "other" {
  const n = niche?.toLowerCase() ?? "";
  if (n.includes("fashion")) return "fashion";
  if (n.includes("decor") || n.includes("home")) return "decor";
  return "other";
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function extractStoragePath(url: string): string | null {
  try {
    const marker = "generated-images/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    let path = url.substring(idx + marker.length);
    const qIdx = path.indexOf("?");
    if (qIdx !== -1) path = path.substring(0, qIdx);
    return path || null;
  } catch {
    return null;
  }
}

/* ---------- Image Group (root + fixed versions) ---------- */
interface ImageGroup {
  root: UserImage;
  versions: UserImage[]; // root first, then children sorted by created_at
}

function groupImages(images: UserImage[]): ImageGroup[] {
  const childrenByParent = new Map<string, UserImage[]>();
  const roots: UserImage[] = [];

  for (const img of images) {
    if (img.parent_task_id) {
      const arr = childrenByParent.get(img.parent_task_id) || [];
      arr.push(img);
      childrenByParent.set(img.parent_task_id, arr);
    } else {
      roots.push(img);
    }
  }

  return roots.map((root) => {
    const children = (childrenByParent.get(root.id) || []).sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
    return { root, versions: [root, ...children] };
  });
}

/* ---------- Image Card ---------- */
function ImageCard({
  group,
  selectedVersionIndex,
  onSelectVersion,
  onClick,
  index,
  isSelecting,
  isSelected,
  onToggleSelect,
  onDelete,
  resolveUrl,
}: {
  group: ImageGroup;
  selectedVersionIndex: number;
  onSelectVersion: (vIndex: number) => void;
  onClick: () => void;
  index: number;
  isSelecting: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  resolveUrl: (url: string) => string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const currentImage = group.versions[selectedVersionIndex] || group.root;

  const viewLabel =
    currentImage.variant_name && currentImage.variant_name !== "Original"
      ? `${currentImage.view_name} · ${currentImage.variant_name}`
      : currentImage.view_name;

  const nk = nicheKey(currentImage.niche);
  const hasMultipleVersions = group.versions.length > 1;

  return (
    <div
      style={{ animationDelay: `${Math.min(index * 40, 400)}ms` }}
      className="group relative aspect-square w-full overflow-hidden rounded-xl border border-border/60 bg-card transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:scale-[1.03] animate-fade-in opacity-0 [animation-fill-mode:forwards]"
    >
      {/* Selection checkbox */}
      {isSelecting && (
        <div
          className="absolute top-2 left-2 z-20 cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onToggleSelect(); }}
        >
          <div className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md border-2 transition-all duration-200",
            isSelected
              ? "bg-primary border-primary shadow-[0_0_8px_hsl(252,85%,62%,0.4)]"
              : "bg-background/80 border-white/30 backdrop-blur-sm hover:border-primary/60"
          )}>
            {isSelected && <Check className="h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />}
          </div>
        </div>
      )}

      {/* Click area */}
      <button
        type="button"
        onClick={isSelecting ? onToggleSelect : onClick}
        className="absolute inset-0 z-10 focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-xl"
      />

      {/* Loading shimmer */}
      {!loaded && !error && (
        <div className="absolute inset-0 bg-muted loading-shimmer" />
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-card">
          <ImageIcon className="h-10 w-10 text-muted-foreground/30" />
        </div>
      )}
      <img
        src={resolveUrl(currentImage.result_url)}
        alt={viewLabel}
        className={cn(
          "h-full w-full object-cover transition-all duration-500",
          loaded ? "opacity-100 scale-100" : "opacity-0 scale-105",
          isSelected && isSelecting && "brightness-75"
        )}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
      />

      {/* Version dots */}
      {hasMultipleVersions && (
        <div className="absolute bottom-2 left-2 right-2 z-20 flex gap-1 justify-center">
          {group.versions.map((_, vIdx) => (
            <button
              key={vIdx}
              onClick={(e) => { e.stopPropagation(); onSelectVersion(vIdx); }}
              className={cn(
                "w-2.5 h-2.5 rounded-full transition-all",
                vIdx === selectedVersionIndex
                  ? "bg-primary scale-125"
                  : "bg-background/70 hover:bg-background"
              )}
              title={vIdx === 0 ? "Original" : `Version ${vIdx + 1}`}
            />
          ))}
        </div>
      )}

      {/* Niche badge */}
      <div className="absolute top-2 right-2 z-10">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium backdrop-blur-md border",
            nk === "fashion"
              ? "bg-primary/20 text-primary-foreground border-primary/30"
              : nk === "decor"
              ? "bg-accent/20 text-accent-foreground border-accent/30"
              : "bg-muted/60 text-muted-foreground border-border"
          )}
        >
          {formatNiche(currentImage.niche)}
        </span>
      </div>

      {/* Hover overlay with delete */}
      {!isSelecting && (
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3 pt-10 opacity-0 translate-y-1 transition-all duration-300 group-hover:opacity-100 group-hover:translate-y-0">
          <div className="flex items-end justify-between">
            <div>
              <p className="truncate text-left text-xs font-medium text-white">
                {viewLabel}
                {hasMultipleVersions && (
                  <span className="ml-1 text-white/60">
                    ({selectedVersionIndex === 0 ? "Original" : `v${selectedVersionIndex + 1}`})
                  </span>
                )}
              </p>
              <p className="text-left text-[10px] text-white/60 mt-0.5">
                {formatDate(currentImage.created_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="relative z-20 flex h-7 w-7 items-center justify-center rounded-full bg-destructive/80 hover:bg-destructive text-destructive-foreground transition-colors"
              title="Delete image"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Need Check icon for the checkbox
import { Check } from "lucide-react";

/* ---------- Stats Row ---------- */
function StatsBar({ images }: { images: UserImage[] }) {
  const fashionCount = images.filter((i) => nicheKey(i.niche) === "fashion").length;
  const decorCount = images.filter((i) => nicheKey(i.niche) === "decor").length;

  return (
    <div className="flex items-center gap-6 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary" />
        <span className="font-medium text-foreground">{images.length}</span> total
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary/60" />
        <span className="font-medium text-foreground">{fashionCount}</span> fashion
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-accent/60" />
        <span className="font-medium text-foreground">{decorCount}</span> home decor
      </span>
    </div>
  );
}

/* ---------- Pagination ---------- */
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | "...")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div className="flex items-center justify-center gap-1.5 pt-8">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`dots-${i}`} className="px-2 text-muted-foreground text-sm">…</span>
        ) : (
          <Button
            key={p}
            variant={p === currentPage ? "default" : "ghost"}
            size="icon"
            className={cn(
              "h-9 w-9 text-sm",
              p === currentPage && "bg-primary text-primary-foreground shadow-[0_0_12px_hsl(252,85%,62%,0.3)]"
            )}
            onClick={() => onPageChange(p)}
          >
            {p}
          </Button>
        )
      )}
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/* ---------- Main Page ---------- */
export default function MyImages() {
  const { images, isLoading, error, refetch } = useUserImages();
  const { toast } = useToast();
  const [selectedImage, setSelectedImage] = useState<UserImage | null>(null);
  const [nicheFilter, setNicheFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Bulk select
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Version selection per group (keyed by root id)
  const [versionSelections, setVersionSelections] = useState<Record<string, number>>({});

  // Delete confirmations
  const [deleteTarget, setDeleteTarget] = useState<UserImage | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Group images and filter
  const imageGroups = useMemo(() => groupImages(images), [images]);

  const filteredGroups = useMemo(() => {
    if (nicheFilter === "all") return imageGroups;
    const n = nicheFilter.toLowerCase();
    return imageGroups.filter((g) => {
      const niche = (g.root.niche ?? "").toLowerCase();
      if (n === "fashion") return niche.includes("fashion");
      if (n === "homedecor") return niche.includes("decor") || niche.includes("home");
      return true;
    });
  }, [imageGroups, nicheFilter]);

  // Reset page when filter changes
  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / IMAGES_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedGroups = useMemo(() => {
    const start = (safePage - 1) * IMAGES_PER_PAGE;
    return filteredGroups.slice(start, start + IMAGES_PER_PAGE);
  }, [filteredGroups, safePage]);

  // Phase 2: Sign only the visible page's URLs
  const visiblePaths = useMemo(() => {
    const paths: string[] = [];
    for (const group of paginatedGroups) {
      for (const v of group.versions) {
        const p = extractPathFromUrl(v.result_url);
        if (p) paths.push(p);
      }
    }
    return [...new Set(paths)];
  }, [paginatedGroups]);

  const { signedMap } = useSignedUrls(visiblePaths);

  // Helper to resolve a result_url to a signed URL
  const resolveUrl = useCallback((url: string): string => {
    const p = extractPathFromUrl(url);
    return (p && signedMap[p]) || url;
  }, [signedMap]);

  // Lightbox navigation within paginated view
  const selectedIdx = selectedImage
    ? paginatedGroups.findIndex((g) => g.versions.some((v) => v.id === selectedImage.id))
    : -1;
  const canPrev = selectedIdx > 0;
  const canNext = selectedIdx >= 0 && selectedIdx < paginatedGroups.length - 1;
  const goNav = (dir: -1 | 1) => {
    const nextGroup = paginatedGroups[selectedIdx + dir];
    if (nextGroup) {
      const vIdx = versionSelections[nextGroup.root.id] || 0;
      setSelectedImage(nextGroup.versions[vIdx] || nextGroup.root);
    }
  };

  const handleDownload = (image: UserImage) => {
    const link = document.createElement("a");
    link.href = resolveUrl(image.result_url);
    link.download = `snapshot-${image.id}.png`;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(paginatedGroups.map((g) => g.root.id)));
  }, [paginatedGroups]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelecting = useCallback(() => {
    setIsSelecting(false);
    setSelectedIds(new Set());
  }, []);

  // Delete helpers
  const deleteImages = async (ids: string[]) => {
    setIsDeleting(true);
    try {
      // Expand ids to include children of any root being deleted
      const allIds = new Set(ids);
      for (const g of imageGroups) {
        if (allIds.has(g.root.id)) {
          for (const v of g.versions) allIds.add(v.id);
        }
      }
      const expandedIds = Array.from(allIds);

      // Get storage paths for cleanup
      const toDelete = images.filter((img) => expandedIds.includes(img.id));
      const storagePaths = toDelete
        .map((img) => extractStoragePath(img.result_url))
        .filter(Boolean) as string[];

      // Delete from storage (best-effort)
      if (storagePaths.length > 0) {
        await supabase.storage.from("generated-images").remove(storagePaths);
      }

      // Delete child tasks first (FK constraint), then parents
      const childIds = expandedIds.filter((id) => images.find((img) => img.id === id)?.parent_task_id);
      const parentIds = expandedIds.filter((id) => !images.find((img) => img.id === id)?.parent_task_id);

      if (childIds.length > 0) {
        await supabase.from("generation_tasks").delete().in("id", childIds);
      }
      if (parentIds.length > 0) {
        const { error: dbError } = await supabase.from("generation_tasks").delete().in("id", parentIds);
        if (dbError) throw dbError;
      }

      toast({
        title: "Deleted",
        description: `${ids.length} image${ids.length !== 1 ? "s" : ""} removed.`,
      });

      exitSelecting();
      await refetch();
    } catch (err: any) {
      console.error("Delete error:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to delete images.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
      setShowBulkDelete(false);
    }
  };

  if (error) {
    return (
      <div className="container max-w-4xl mx-auto px-6 py-8">
        <p className="text-destructive">Failed to load your images. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl mx-auto px-6 py-8">
      {/* ── Header ── */}
      <div className="mb-8 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/10">
          <ImageIcon className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-foreground tracking-tight font-display">
              My Images
            </h1>
            {!isLoading && images.length > 0 && (
              <Badge variant="secondary" className="text-xs tabular-nums">
                {images.length}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            All images you&apos;ve generated. Click to view full size or download.
          </p>
        </div>
        {/* Bulk select toggle */}
        {!isLoading && images.length > 0 && (
          <div className="flex items-center gap-2">
            {isSelecting ? (
              <>
                <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">
                  Select All
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={selectedIds.size === 0}
                  onClick={() => setShowBulkDelete(true)}
                  className="gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete ({selectedIds.size})
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={exitSelecting}>
                  <X className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSelecting(true)}
                className="gap-1.5 border-white/[0.08] hover:bg-white/[0.04]"
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Select
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Gradient accent line */}
      <div className="h-px w-full bg-gradient-to-r from-primary/40 via-accent/20 to-transparent mb-6" />

      {/* ── Stats ── */}
      {!isLoading && images.length > 0 && (
        <div className="mb-5">
          <StatsBar images={images} />
        </div>
      )}

      {/* ── Tabs ── */}
      <Tabs
        value={nicheFilter}
        onValueChange={(v) => { setNicheFilter(v); setCurrentPage(1); }}
        className="w-full"
      >
        <TabsList className="mb-6 bg-card border border-border/60 h-11 p-1">
          {NICHE_FILTERS.map((f) => {
            const Icon = f.icon;
            return (
              <TabsTrigger
                key={f.value}
                value={f.value}
                className="gap-1.5 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-primary/20 data-[state=active]:border transition-colors"
              >
                <Icon className="h-3.5 w-3.5" />
                {f.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {NICHE_FILTERS.map((f) => (
          <TabsContent key={f.value} value={f.value} className="mt-0">
            {isLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-xl bg-muted loading-shimmer border border-border/40"
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/10 mb-5">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <p className="text-base font-medium text-foreground">
                  No images yet
                </p>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                  Head to the Generator to create stunning product photos with AI — they'll appear here automatically.
                </p>
                <Button asChild className="mt-6 gap-2" variant="default" size="sm">
                  <Link to="/app">
                    <Sparkles className="h-4 w-4" />
                    Start Generating
                  </Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {paginatedGroups.map((group, idx) => {
                    const vIdx = versionSelections[group.root.id] || 0;
                    const currentImage = group.versions[vIdx] || group.root;
                    return (
                      <ImageCard
                        key={group.root.id}
                        group={group}
                        selectedVersionIndex={vIdx}
                        onSelectVersion={(vi) => {
                          setVersionSelections((prev) => ({ ...prev, [group.root.id]: vi }));
                        }}
                        index={idx}
                        onClick={() => setSelectedImage(currentImage)}
                        isSelecting={isSelecting}
                        isSelected={selectedIds.has(group.root.id)}
                        onToggleSelect={() => toggleSelect(group.root.id)}
                        onDelete={() => setDeleteTarget(currentImage)}
                        resolveUrl={resolveUrl}
                      />
                    );
                  })}
                </div>
                <Pagination
                  currentPage={safePage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
                {filteredGroups.length > IMAGES_PER_PAGE && (
                  <p className="text-center text-xs text-muted-foreground mt-2">
                    Showing {(safePage - 1) * IMAGES_PER_PAGE + 1}–{Math.min(safePage * IMAGES_PER_PAGE, filteredGroups.length)} of {filteredGroups.length}
                  </p>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* ── Lightbox Dialog ── */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background border-border/60 rounded-2xl">
          <div className="h-1 w-full bg-gradient-to-r from-primary via-accent to-primary/40" />

          <DialogHeader className="px-5 pt-4 pb-0">
            <DialogTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              {selectedImage && (
                <>
                  {selectedImage.variant_name && selectedImage.variant_name !== "Original"
                    ? `${selectedImage.view_name} · ${selectedImage.variant_name}`
                    : selectedImage.view_name}
                  <Badge
                    variant="outline"
                    className="text-[10px] font-normal ml-auto"
                  >
                    {selectedImage && formatNiche(selectedImage.niche)}
                  </Badge>
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedImage && (() => {
            const lightboxGroup = imageGroups.find(g => g.versions.some(v => v.id === selectedImage.id));
            const lightboxVersionIndex = lightboxGroup ? lightboxGroup.versions.findIndex(v => v.id === selectedImage.id) : 0;
            const hasMultipleVersions = lightboxGroup && lightboxGroup.versions.length > 1;

            return (
            <>
              <div className="relative w-full max-h-[70vh] overflow-hidden rounded-lg bg-card/50 group">
                <img
                  src={resolveUrl(selectedImage.result_url)}
                  alt=""
                  className="h-full w-full object-cover"
                />

                {canPrev && (
                  <button
                    onClick={() => goNav(-1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 border border-border/60 text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                {canNext && (
                  <button
                    onClick={() => goNav(1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-background/80 border border-border/60 text-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}

                {paginatedGroups.length > 1 && (
                  <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-white/70 bg-black/50 rounded-full px-3 py-1 backdrop-blur-sm tabular-nums">
                    {selectedIdx + 1} / {paginatedGroups.length}
                  </span>
                )}
              </div>

              {/* Version dots in lightbox */}
              {hasMultipleVersions && lightboxGroup && (
                <div className="flex gap-1.5 justify-center py-2">
                  {lightboxGroup.versions.map((v, vIdx) => (
                    <button
                      key={v.id}
                      onClick={() => {
                        setSelectedImage(v);
                        setVersionSelections((prev) => ({ ...prev, [lightboxGroup.root.id]: vIdx }));
                      }}
                      className={cn(
                        "w-2.5 h-2.5 rounded-full transition-all",
                        vIdx === lightboxVersionIndex
                          ? "bg-primary scale-125"
                          : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
                      )}
                      title={vIdx === 0 ? "Original" : `Version ${vIdx + 1}`}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between gap-4 px-5 py-4 border-t border-border/40">
                <span className="text-xs text-muted-foreground">
                  {formatDate(selectedImage.created_at)}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDeleteTarget(selectedImage);
                      setSelectedImage(null);
                    }}
                    className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleDownload(selectedImage)}
                    className="gap-2 bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                </div>
              </div>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ── Single Delete Confirmation ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this image?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the image. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteImages([deleteTarget.id])}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Bulk Delete Confirmation ── */}
      <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} images?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove {selectedIds.size} selected image{selectedIds.size !== 1 ? "s" : ""}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteImages(Array.from(selectedIds))}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete {selectedIds.size} images
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
