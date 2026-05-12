import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles } from "lucide-react";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";


// Original assets
import fashionSuit from "@/assets/gallery/fashion-suit-front.jpg";
import fashionDressSide from "@/assets/gallery/fashion-dress-side.jpg";
import fashionSweater from "@/assets/gallery/fashion-sweater.jpg";
import decorLamp from "@/assets/gallery/decor-lamp.jpg";
import decorLivingRoom from "@/assets/gallery/decor-living-room.jpg";
import decorVase from "@/assets/gallery/decor-vase.jpg";

// New uploaded assets
import newDenimFront from "@/assets/gallery/fashion-denim-front.png";
import newPinkSide from "@/assets/gallery/fashion-pink-side.png";
import newPinkBack from "@/assets/gallery/fashion-pink-back.png";
import newBlackDress from "@/assets/gallery/fashion-black-dress.png";
import newBlackTee from "@/assets/gallery/fashion-black-tee.png";
import newHoodieCloseup from "@/assets/gallery/fashion-hoodie-closeup.png";
import newYellowFront from "@/assets/gallery/fashion-yellow-front.png";
import newCrystalLamp from "@/assets/gallery/decor-crystal-lamp.png";

type Category = "all" | "fashion" | "decor";

interface GalleryItem {
  id: string;
  image: string;
  title: string;
  category: "fashion" | "decor";
  viewType: string;
}

const galleryItems: GalleryItem[] = [
  { id: "new-1", image: newDenimFront, title: "Denim Shirt", category: "fashion", viewType: "Front View" },
  { id: "new-2", image: newPinkSide, title: "Pink Shirt", category: "fashion", viewType: "Side View" },
  { id: "new-3", image: newPinkBack, title: "Pink Shirt", category: "fashion", viewType: "Back View" },
  { id: "new-4", image: newBlackDress, title: "Black Dress", category: "fashion", viewType: "Front View" },
  { id: "new-5", image: newBlackTee, title: "Black Tee", category: "fashion", viewType: "Model Shot" },
  { id: "new-6", image: newHoodieCloseup, title: "Grey Hoodie", category: "fashion", viewType: "Model Shot" },
  { id: "new-7", image: newYellowFront, title: "Yellow Shirt", category: "fashion", viewType: "Front View" },
  { id: "new-8", image: newCrystalLamp, title: "Crystal Lamp", category: "decor", viewType: "Lifestyle" },
  { id: "old-1", image: fashionSuit, title: "Navy Suit", category: "fashion", viewType: "Front View" },
  { id: "old-2", image: fashionDressSide, title: "Floral Dress", category: "fashion", viewType: "Side View" },
  { id: "old-3", image: fashionSweater, title: "Knit Sweater", category: "fashion", viewType: "Outdoor" },
  { id: "old-4", image: decorLamp, title: "Modern Lamp", category: "decor", viewType: "Product Shot" },
  { id: "old-5", image: decorLivingRoom, title: "Living Room", category: "decor", viewType: "Lifestyle" },
  { id: "old-6", image: decorVase, title: "Ceramic Vase", category: "decor", viewType: "Studio" },
];

const categories: { value: Category; label: string }[] = [
  { value: "all", label: "All Results" },
  { value: "fashion", label: "Fashion" },
  { value: "decor", label: "Home Decor" },
];

const FLIP_DURATION = {
  tilt: 50,
  toNinety: 100,
  overshoot: 100,
  settle: 150,
};

const GalleryCard = ({ item, index }: { item: GalleryItem; index: number }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flipStage, setFlipStage] = useState<
    "idle" | "tilt" | "ninety" | "overshoot" | "done" | "back-overshoot" | "back-ninety" | "back-tilt"
  >("idle");
  const [showBack, setShowBack] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const rotateForStage = (): string => {
    switch (flipStage) {
      case "tilt": return "rotateY(-10deg)";
      case "ninety": return "rotateY(90deg)";
      case "overshoot": return "rotateY(190deg)";
      case "done": return "rotateY(180deg)";
      case "back-overshoot": return "rotateY(190deg)";
      case "back-ninety": return "rotateY(90deg)";
      case "back-tilt": return "rotateY(-10deg)";
      default: return "rotateY(0deg)";
    }
  };

  const transitionForStage = (): string => {
    switch (flipStage) {
      case "tilt": return `transform ${FLIP_DURATION.tilt}ms ease-out`;
      case "ninety": return `transform ${FLIP_DURATION.toNinety}ms ease-in`;
      case "overshoot": return `transform ${FLIP_DURATION.overshoot}ms ease-out`;
      case "done": return `transform ${FLIP_DURATION.settle}ms ease-out`;
      case "back-overshoot": return `transform ${FLIP_DURATION.tilt}ms ease-out`;
      case "back-ninety": return `transform ${FLIP_DURATION.toNinety}ms ease-in`;
      case "back-tilt": return `transform ${FLIP_DURATION.overshoot}ms ease-out`;
      default: return "transform 100ms ease-out";
    }
  };

  const flipToBack = useCallback(() => {
    setIsHovered(false);
    setFlipStage("tilt");

    setTimeout(() => {
      setFlipStage("ninety");
      setTimeout(() => {
        setShowBack(true);
        setFlipStage("overshoot");
        setTimeout(() => {
          setFlipStage("done");
          setIsFlipped(true);
        }, FLIP_DURATION.overshoot);
      }, FLIP_DURATION.toNinety);
    }, FLIP_DURATION.tilt);
  }, []);

  const flipToFront = useCallback(() => {
    setFlipStage("back-overshoot");

    setTimeout(() => {
      setFlipStage("back-ninety");
      setTimeout(() => {
        setShowBack(false);
        setFlipStage("back-tilt");
        setTimeout(() => {
          setFlipStage("idle");
          setIsFlipped(false);
        }, FLIP_DURATION.overshoot);
      }, FLIP_DURATION.toNinety);
    }, FLIP_DURATION.tilt);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (isFlipped && cardRef.current && !cardRef.current.contains(e.target as Node)) {
        flipToFront();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isFlipped, flipToFront]);

  const animating = flipStage !== "idle" && flipStage !== "done";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="relative"
      style={{ perspective: "800px" }}
    >
      <div
        ref={cardRef}
        className="relative aspect-[3/4] cursor-pointer"
        style={{
          transformStyle: "preserve-3d",
          transform: rotateForStage(),
          transition: transitionForStage(),
          boxShadow:
            isHovered || isFlipped
              ? "0 13px 21px -5px rgba(0,0,0,0.3)"
              : "0 4px 12px -2px rgba(0,0,0,0.15)",
        }}
        onMouseEnter={() => { if (!isFlipped && !animating) setIsHovered(true); }}
        onMouseLeave={() => { if (!isFlipped && !animating) setIsHovered(false); }}
      >
        {/* ─── FRONT FACE ─── */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            display: showBack ? "none" : "block",
          }}
        >
          <img
            src={item.image}
            alt={`${item.title} – ${item.viewType.toLowerCase()}`}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-500"
            style={{ transform: isHovered ? "scale(1.05)" : "scale(1)" }}
          />

          {/* Colour overlay on hover */}
          <div
            className="absolute inset-0 bg-logo-purple/60 transition-opacity duration-200 pointer-events-none"
            style={{ opacity: isHovered ? 0.7 : 0 }}
          />

          {/* "View Details" button */}
          <button
            onClick={(e) => { e.stopPropagation(); flipToBack(); }}
            className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 z-10
                       border-2 border-white text-white text-sm sm:text-base uppercase font-bold
                       tracking-wider px-5 py-2.5 transition-all duration-200
                       hover:bg-white hover:text-logo-purple"
            style={{
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? "auto" : "none",
            }}
          >
            View details
          </button>

          {/* Stats container */}
          <div
            className="absolute left-0 right-0 bg-[#111] px-5 pb-5 pt-4 transition-all duration-200"
            style={{
              bottom: 0,
              transform: isHovered ? "translateY(0)" : "translateY(0)",
            }}
          >
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-display text-lg font-semibold text-white">{item.title}</h4>
              <span className="text-sm font-semibold text-logo-purple">{item.viewType}</span>
            </div>
            <span className="text-xs text-white/60 capitalize">
              {item.category === "decor" ? "Home Decor" : "Fashion"}
            </span>

            {/* Extra info revealed on hover */}
            <div
              className="overflow-hidden transition-all duration-300"
              style={{
                maxHeight: isHovered ? "80px" : "0px",
                opacity: isHovered ? 1 : 0,
                marginTop: isHovered ? "10px" : "0px",
              }}
            >
              <span className="text-xs font-bold text-white/80 uppercase tracking-wide">Category</span>
              <span className="block text-xs text-white/50 mb-1">
                {item.category === "decor" ? "Home Decor" : "Fashion"}
              </span>
              <span className="text-xs font-bold text-white/80 uppercase tracking-wide">View</span>
              <span className="block text-xs text-white/50">{item.viewType}</span>
            </div>
          </div>
        </div>

        {/* ─── BACK FACE ─── */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            display: showBack ? "block" : "none",
          }}
        >
          <img
            src={item.image}
            alt={`${item.title} – full view`}
            className="w-full h-full object-cover"
          />

          {/* Gradient shadow on left edge (simulates depth) */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0.2), rgba(0,0,0,0.05) 30%, transparent)",
            }}
          />

          {/* Close (X) button */}
          <button
            onClick={(e) => { e.stopPropagation(); flipToFront(); }}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center z-20 group/close cursor-pointer"
          >
            <span className="absolute w-5 h-0.5 bg-white/70 group-hover/close:bg-white rounded rotate-45 transition-colors" />
            <span className="absolute w-5 h-0.5 bg-white/70 group-hover/close:bg-white rounded -rotate-45 transition-colors" />
          </button>

          {/* Bottom info bar on back */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-5">
            <h4 className="font-display text-lg font-semibold text-white">{item.title}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-medium text-logo-purple">{item.viewType}</span>
              <span className="w-1 h-1 rounded-full bg-white/40" />
              <span className="text-xs text-white/60 capitalize">
                {item.category === "decor" ? "Home Decor" : "Fashion"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const GallerySection = () => {
  const [activeCategory, setActiveCategory] = useState<Category>("all");
  const gridRef = useRef<HTMLDivElement>(null);

  const filteredItems = galleryItems.filter(
    (item) => activeCategory === "all" || item.category === activeCategory
  );

  // Anime.js stagger on filter change
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const cards = grid.querySelectorAll(".gallery-card-wrapper > div");
    if (cards.length === 0) return;

    import("animejs").then((anime) => {
      anime.animate(cards as unknown as HTMLElement[], {
        opacity: [0.5, 1],
        scale: [0.95, 1],
        delay: (_el: HTMLElement, i: number) => i * 60,
        duration: 400,
        ease: "easeOutCubic",
      });
    });
  }, [activeCategory]);

  return (
    <section id="examples" className="py-16 md:py-24 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-logo-purple/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-electric-blue/[0.03] rounded-full blur-[120px]" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div className="text-center mb-10 md:mb-14">

          <h2 className="font-prata text-3xl md:text-5xl lg:text-[3.5rem] font-bold mb-5 leading-tight text-foreground">
            Results{" "}
            <span className="bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent">
              Gallery
            </span>
          </h2>
          <p className="text-foreground/50 font-body text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Explore stunning AI-generated product images across different niches and styles
          </p>
        </div>

        {/* Category Filters */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1.5 rounded-full bg-white/[0.02] border border-white/[0.06] backdrop-blur-xl">
            {categories.map((category) => (
              <button
                key={category.value}
                onClick={() => setActiveCategory(category.value)}
                className={`relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                  activeCategory === category.value
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {activeCategory === category.value && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 rounded-full bg-gradient-to-r from-logo-purple/20 to-electric-blue/20 border border-logo-purple/30"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <span className="relative z-10">{category.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Gallery Grid */}
        <motion.div
          ref={gridRef}
          layout
          className="gallery-card-wrapper grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <AnimatePresence mode="popLayout">
            {filteredItems.map((item, index) => (
              <GalleryCard key={item.id} item={item} index={index} />
            ))}
          </AnimatePresence>
        </motion.div>

        {/* Bottom CTA */}
        <div className="text-center mt-8 md:mt-10">
          <p className="text-muted-foreground font-body mb-4">
            Ready to create your own stunning product images?
          </p>
          <MagneticButton>
            <Link to="/app">
              <Button variant="hero" size="lg" className="font-body">
                <Sparkles className="w-4 h-4" />
                Start Creating Now
              </Button>
            </Link>
          </MagneticButton>
        </div>
      </div>
    </section>
  );
};

export default GallerySection;
