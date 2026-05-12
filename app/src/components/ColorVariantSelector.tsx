import { useState } from "react";
import { Plus, X, Trash2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCustomColors } from "@/hooks/useCustomColors";

export interface ColorVariant {
  id: string;
  color: string;
  name: string;
  isBase?: boolean;
}

interface ColorVariantSelectorProps {
  variants: ColorVariant[];
  onVariantsChange: (variants: ColorVariant[]) => void;
  baseColor?: string;
}

const PRESET_COLORS = [
  { color: "#000000", name: "Black" },
  { color: "#FFFFFF", name: "White" },
  { color: "#1E3A5F", name: "Navy Blue" },
  { color: "#722F37", name: "Bordeaux Red" },
  { color: "#013220", name: "Dark Green" },
  { color: "#87CEEB", name: "Light Blue" },
  { color: "#808080", name: "Grey" },
  { color: "#8B4513", name: "Brown" },
  { color: "#FFC0CB", name: "Pink" },
  { color: "#FFD700", name: "Gold" },
  { color: "#FF6B35", name: "Orange" },
  { color: "#9370DB", name: "Purple" },
];

export function ColorVariantSelector({
  variants,
  onVariantsChange,
  baseColor,
}: ColorVariantSelectorProps) {
  const { customColors, addColor, deleteColor } = useCustomColors();
  const [isOpen, setIsOpen] = useState(false);
  const [customColor, setCustomColor] = useState("#000000");
  const [customName, setCustomName] = useState("");

  const addVariant = (color: string, name: string) => {
    const newVariant: ColorVariant = {
      id: `variant-${Date.now()}`,
      color,
      name,
      isBase: false,
    };
    onVariantsChange([...variants, newVariant]);
    setIsOpen(false);
    setCustomName("");
  };

  const removeVariant = (id: string) => {
    onVariantsChange(variants.filter((v) => v.id !== id && !v.isBase));
  };

  const addCustomVariant = async () => {
    if (customName.trim()) {
      // Save to database for future use
      await addColor(customColor, customName.trim());
      // Add to current variants
      addVariant(customColor, customName.trim());
    }
  };

  // Count non-base variants
  const variantCount = variants.filter((v) => !v.isBase).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Product Variants</Label>
        <span className="text-sm text-muted-foreground">
          {variantCount + 1} color{variantCount + 1 !== 1 ? "s" : ""} selected
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Add color variants to generate images for each color. Your uploaded product counts as the base variant.
      </p>

      <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-card border border-border">
        {/* Base color (from uploaded image) */}
        <div className="relative group">
          <div
            className="w-12 h-12 rounded-full border-2 border-primary flex items-center justify-center shadow-sm"
            style={{ backgroundColor: baseColor || "#E5E5E5" }}
            title="Base color (uploaded product)"
          >
            <span className="text-[10px] font-bold text-primary-foreground drop-shadow-sm">
              BASE
            </span>
          </div>
        </div>

        {/* Added variants */}
        {variants
          .filter((v) => !v.isBase)
          .map((variant) => (
            <div key={variant.id} className="relative group">
              <div
                className="w-12 h-12 rounded-full border-2 border-border shadow-sm transition-all hover:border-primary"
                style={{ backgroundColor: variant.color }}
                title={variant.name}
              />
              <button
                onClick={() => removeVariant(variant.id)}
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove variant"
              >
                <X className="w-3 h-3" />
              </button>
              <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap max-w-[60px] truncate">
                {variant.name}
              </span>
            </div>
          ))}

        {/* Add variant button */}
        <Popover open={isOpen} onOpenChange={setIsOpen}>
          <PopoverTrigger asChild>
            <button
              className="w-12 h-12 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center hover:border-primary hover:bg-primary/5 transition-all"
              title="Add color variant"
            >
              <Plus className="w-5 h-5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-72" align="start">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Add Color Variant</h4>
              
              {/* Preset colors */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Preset Colors</Label>
                <div className="grid grid-cols-6 gap-2">
                  {PRESET_COLORS.map((preset) => (
                    <button
                      key={preset.color}
                      onClick={() => addVariant(preset.color, preset.name)}
                      className="w-8 h-8 rounded-full border border-border hover:scale-110 transition-transform"
                      style={{ backgroundColor: preset.color }}
                      title={preset.name}
                    />
                  ))}
                </div>
              </div>

              {/* User's saved custom colors */}
              {customColors.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <Label className="text-xs text-muted-foreground">Your Saved Colors</Label>
                  <div className="grid grid-cols-6 gap-2">
                    {customColors.map((saved) => (
                      <div key={saved.id} className="relative group">
                        <button
                          onClick={() => addVariant(saved.color, saved.name)}
                          className="w-8 h-8 rounded-full border border-border hover:scale-110 transition-transform"
                          style={{ backgroundColor: saved.color }}
                          title={saved.name}
                        />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteColor(saved.id);
                          }}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete saved color"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Custom color */}
              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs text-muted-foreground">Custom Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(e) => setCustomColor(e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                  />
                  <Input
                    placeholder="Color name..."
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="flex-1 h-10"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        addCustomVariant();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={addCustomVariant}
                  disabled={!customName.trim()}
                  size="sm"
                  className="w-full"
                >
                  Add Custom Color
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
