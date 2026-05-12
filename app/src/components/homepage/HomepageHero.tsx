import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

// Import hero images
import heroFront from "@/assets/homepage/hero-front.jpg";
import heroSide from "@/assets/homepage/hero-side.jpg";
import heroBack from "@/assets/homepage/hero-back.jpg";
import heroOutdoor from "@/assets/homepage/hero-outdoor.jpg";

const sampleImages = [
  { label: "Front View", image: heroFront },
  { label: "Side View", image: heroSide },
  { label: "Back View", image: heroBack },
  { label: "Outdoor", image: heroOutdoor },
];

export const HomepageHero = () => {
  return (
    <section className="pt-32 pb-20 lg:pt-40 lg:pb-32 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 gradient-glow opacity-50" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Content */}
          <div className="text-center lg:text-left animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              AI-Powered Photography
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground leading-tight mb-6">
              Product Photos.{" "}
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-primary via-brand-pink to-accent bg-clip-text text-transparent">
                Generated Fast.
              </span>
            </h1>
            
            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 mb-8">
              Fashion and home decor images. Studio and outdoor. Views and
              variants. Professional quality in minutes, not days.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link to="/app">
                <Button size="lg" className="gradient-brand border-0 shadow-medium hover:shadow-glow transition-smooth text-base px-8 w-full sm:w-auto">
                  Open App
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
              <a href="#gallery">
                <Button size="lg" variant="outline" className="text-base px-8 w-full sm:w-auto">
                  View Examples
                </Button>
              </a>
            </div>
          </div>

          {/* Right: Mock browser with grid */}
          <div className="animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="bg-card rounded-2xl border border-border shadow-card overflow-hidden">
              {/* Browser header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-destructive/60" />
                  <div className="w-3 h-3 rounded-full bg-accent/60" />
                  <div className="w-3 h-3 rounded-full bg-primary/60" />
                </div>
                <div className="flex-1 mx-4">
                  <div className="bg-muted rounded-md px-3 py-1.5 text-xs text-muted-foreground text-center">
                    snapshot.app/generator
                  </div>
                </div>
              </div>
              
              {/* 2x2 Grid of sample outputs */}
              <div className="p-4 grid grid-cols-2 gap-3">
                {sampleImages.map((image, index) => (
                  <div
                    key={index}
                    className="aspect-[3/4] rounded-xl border border-border overflow-hidden relative group"
                  >
                    <img 
                      src={image.image} 
                      alt={image.label}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/90 to-transparent p-3">
                      <span className="text-xs font-medium text-foreground">
                        {image.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
