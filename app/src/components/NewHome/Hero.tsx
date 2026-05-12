import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { MagneticButton } from "@/components/motion/MagneticButton";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Original assets
import heroFront from "@/assets/homepage/hero-front.jpg";
import heroBack from "@/assets/homepage/hero-back.jpg";
import heroSide from "@/assets/homepage/hero-side.jpg";
import heroOutdoor from "@/assets/homepage/hero-outdoor.jpg";
import galleryFashion1 from "@/assets/homepage/gallery-fashion-1.jpg";
import galleryFashion2 from "@/assets/homepage/gallery-fashion-2.jpg";
import galleryFashion3 from "@/assets/homepage/gallery-fashion-3.jpg";
import galleryDecor1 from "@/assets/homepage/gallery-decor-1.jpg";
import galleryDecor2 from "@/assets/homepage/gallery-decor-2.jpg";

// New uploaded assets
import newDenimFront from "@/assets/gallery/fashion-denim-front.png";
import newPinkSide from "@/assets/gallery/fashion-pink-side.png";
import newPinkBack from "@/assets/gallery/fashion-pink-back.png";
import newWhiteBack from "@/assets/gallery/fashion-white-back.png";
import newBlackDress from "@/assets/gallery/fashion-black-dress.png";
import newBlackTee from "@/assets/gallery/fashion-black-tee.png";
import newCreamTee from "@/assets/gallery/fashion-cream-tee.png";
import newHoodieCloseup from "@/assets/gallery/fashion-hoodie-closeup.png";
import newYellowFront from "@/assets/gallery/fashion-yellow-front.png";
import newCrystalLamp from "@/assets/gallery/decor-crystal-lamp.png";

gsap.registerPlugin(ScrollTrigger);

interface GalleryImage {
  src: string;
  alt: string;
}

const staticGalleryImages: GalleryImage[][] = [
  [
    { src: newDenimFront, alt: "Denim shirt – front view" },
    { src: heroFront, alt: "Fashion – front view" },
    { src: newBlackDress, alt: "Black dress – front view" },
    { src: galleryDecor1, alt: "Home decor product photo" },
    { src: newCreamTee, alt: "Cream tee – model shot" },
  ],
  [
    { src: newPinkSide, alt: "Pink shirt – side view" },
    { src: galleryFashion1, alt: "Fashion lifestyle photo" },
    { src: newBlackTee, alt: "Black tee – model shot" },
    { src: newCrystalLamp, alt: "Crystal lamp – lifestyle" },
    { src: heroOutdoor, alt: "Fashion – outdoor shot" },
  ],
  [
    { src: newPinkBack, alt: "Pink shirt – back view" },
    { src: galleryFashion2, alt: "Fashion product photo" },
    { src: newWhiteBack, alt: "White shirt – back view" },
    { src: galleryDecor2, alt: "Home decor scene" },
    { src: newYellowFront, alt: "Yellow shirt – front view" },
  ],
];

/** Infinite-scrolling image column gallery used as a hero background */
const ScrollingGallery = ({
  heroRef,
  images,
}: {
  heroRef: React.RefObject<HTMLElement>;
  images: GalleryImage[][];
}) => {
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const gallery = galleryRef.current;
    const hero = heroRef.current;
    if (!gallery || !hero) return;

    const tracks = gallery.querySelectorAll<HTMLElement>(".col-track");
    const tweens: gsap.core.Tween[] = [];
    let trigger: ScrollTrigger | null = null;
    let lastVelocityUpdate = 0;

    const directions = [-1, 1, -1];

    tracks.forEach((track, i) => {
      const direction = directions[i] ?? (i % 2 === 0 ? -1 : 1);

      const tween = gsap.fromTo(
        track,
        { yPercent: direction === -1 ? 0 : -50 },
        {
          yPercent: direction === -1 ? -50 : 0,
          duration: 36,
          repeat: -1,
          ease: "none",
        }
      );
      tweens.push(tween);
    });

    trigger = ScrollTrigger.create({
      trigger: hero,
      start: "top top",
      end: "bottom bottom",
      onUpdate: (self) => {
        const now = performance.now();
        if (now - lastVelocityUpdate < 50) return;
        lastVelocityUpdate = now;

        const v = Math.abs(self.getVelocity());
        const scale = gsap.utils.clamp(0.8, 1.4, 1 + v / 9000);
        tweens.forEach((t) => {
          gsap.to(t, { timeScale: scale, duration: 0.3, overwrite: true });
        });
      },
      onScrubComplete: () => {
        tweens.forEach((t) => {
          gsap.to(t, { timeScale: 1, duration: 0.35, overwrite: true });
        });
      },
    });

    return () => {
      tweens.forEach((t) => t.kill());
      if (trigger) trigger.kill();
    };
  }, [heroRef, images]);

  return (
    <div
      ref={galleryRef}
      className="absolute inset-0 z-0 pointer-events-auto flex overflow-hidden h-screen"
    >
      {images.map((column, colIdx) => (
        <div
          key={colIdx}
          className={`col flex-1 flex-col h-screen overflow-hidden ${
              colIdx === 0 ? "hidden lg:flex" : colIdx === 1 ? "flex" : "hidden sm:flex"
            } ${colIdx % 2 !== 0 ? "self-end" : "self-start"}`}
        >
          <div className="col-track flex flex-col">
            {[...column, ...column].map((img, imgIdx) => (
              <div key={imgIdx} className="image h-screen shrink-0 p-2 sm:p-3 md:p-4">
                <div className="h-full w-full rounded-lg overflow-hidden shadow-[0_2.8px_2.2px_rgba(0,0,0,0.034),0_6.7px_5.3px_rgba(0,0,0,0.048),0_12.5px_10px_rgba(0,0,0,0.06),0_22.3px_17.9px_rgba(0,0,0,0.072),0_41.8px_33.4px_rgba(0,0,0,0.086),0_100px_80px_rgba(0,0,0,0.12)]">
                  <img
                    src={img.src}
                    alt={img.alt}
                    loading="lazy"
                    className="w-full h-full object-cover grayscale hover:grayscale-0 transition-[filter] duration-300 will-change-[transform,filter]"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};


const Hero = () => {
  const heroRef = useRef<HTMLElement>(null);

  // Anime.js timeline entrance
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;

    import("animejs").then((anime) => {
      const tl = anime.createTimeline({
        defaults: { ease: "easeOutCubic" },
      });

      tl.add(
        hero.querySelectorAll(".hero-word") as unknown as HTMLElement[],
        {
          opacity: [0, 1],
          translateY: [60, 0],
          filter: ["blur(8px)", "blur(0px)"],
          delay: (_el: HTMLElement, i: number) => i * 80,
          duration: 600,
        },
        "-=200"
      )
        .add(
          hero.querySelector(".hero-subtitle") as HTMLElement,
          {
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 500,
          },
          "-=300"
        )
        .add(
          hero.querySelectorAll(".hero-cta") as unknown as HTMLElement[],
          {
            opacity: [0, 1],
            scale: [0.9, 1],
            delay: (_el: HTMLElement, i: number) => i * 100,
            duration: 400,
          },
          "-=200"
        )
        .add(
          hero.querySelector(".hero-trust") as HTMLElement,
          {
            opacity: [0, 1],
            translateY: [15, 0],
            duration: 400,
          },
          "-=200"
        );
    });
  }, []);

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center py-20 md:py-32 overflow-hidden"
    >
      {/* Scrolling Gallery Background */}
      <ScrollingGallery heroRef={heroRef} images={staticGalleryImages} />


      {/* Title - higher on small screens to avoid overlapping subtitle */}
      <h1 className="absolute top-[26%] sm:top-[32%] md:top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none text-center text-white text-[1.875rem] sm:text-5xl md:text-6xl lg:text-7xl font-prata font-extrabold leading-[1.3] sm:leading-[1.2] md:leading-[1.15] px-4">
        <span className="inline-block overflow-hidden mr-[0.2em]">
          <span className="hero-word inline-block opacity-0">Product</span>
        </span>
        <span className="inline-block overflow-hidden mr-[0.2em]">
          <span className="hero-word inline-block opacity-0">Photos.</span>
        </span>
        <br className="sm:block" />
        <span className="inline-block overflow-hidden">
          <span className="hero-word inline-block opacity-0">Generated</span>
        </span>
        <span className="inline-block overflow-hidden ml-[0.2em]">
          <span className="hero-word inline-block opacity-0 text-primary">Fast.</span>
        </span>
      </h1>



      {/* Hero content - on small screens start lower so title and subtitle don't overlap */}
      <div className="absolute inset-x-0 bottom-0 w-full px-4 sm:px-6 md:px-8 lg:px-10 z-30 pointer-events-none pt-[44%] sm:pt-0 pb-6 sm:pb-10 md:pb-12 lg:pb-14">
        <div className="max-w-3xl mx-auto text-center">
          {/* Subtext */}
          <p className="hero-subtitle font-body text-[15px] sm:text-lg md:text-xl text-white/85 mb-5 sm:mb-8 max-w-2xl mx-auto leading-relaxed opacity-0">
            Fashion and home decor images. Studio and outdoor. Views and
            variants. Professional quality in minutes, not days.
          </p>

          {/* CTAs with magnetic effect */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pointer-events-auto md:gap-5">
            <MagneticButton className="hero-cta opacity-0">
              <Link to="/app">
                <Button variant="hero" size="lg" className="font-body min-h-11 md:min-h-12">
                  Open App
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Button>
              </Link>
            </MagneticButton>
            <MagneticButton className="hero-cta opacity-0">
              <a href="/#examples">
                <Button variant="glass" size="lg" className="font-body min-h-11 md:min-h-12">
                  View Examples
                  <svg className="w-4 h-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </Button>
              </a>
            </MagneticButton>
          </div>

          {/* Trust badges */}
          <div className="hero-trust mt-6 sm:mt-10 flex items-center justify-center opacity-0">
            <div className="text-center">
              <div className="text-sm font-body font-semibold text-white">
                <span className="tabular-nums">10+</span> brands
              </div>
              <div className="text-xs font-body text-white/75">
                already using Snapshot
              </div>
              <div className="mt-1.5 sm:mt-2 flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-4 gap-y-1 text-xs font-body text-muted-foreground/70">
                {["LUXE", "Urban Basics", "Mindful Wear", "NOVA", "Threads Co"].map((brand) => (
                  <span
                    key={brand}
                    className="uppercase tracking-[0.18em] hover:text-foreground/80 transition-colors"
                  >
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
