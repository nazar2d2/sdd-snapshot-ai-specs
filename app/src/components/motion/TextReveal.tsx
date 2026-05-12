import { useRef, useEffect, type ElementType } from "react";
import { cn } from "@/lib/utils";

interface TextRevealProps {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  staggerMs?: number;
  gradient?: boolean;
}

export const TextReveal = ({
  text,
  as: Tag = "h2",
  className,
  delay = 0,
  staggerMs = 80,
  gradient = false,
}: TextRevealProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || hasAnimated.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !hasAnimated.current) {
            hasAnimated.current = true;
            const words = container.querySelectorAll(".word-inner");

            import("animejs").then((anime) => {
              anime.animate(words as unknown as HTMLElement[], {
                translateY: [60, 0],
                opacity: [0, 1],
                filter: ["blur(8px)", "blur(0px)"],
                delay: (_el: HTMLElement, i: number) => delay + i * staggerMs,
                duration: 700,
                ease: "easeOutCubic",
              });
            });
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, [delay, staggerMs]);

  const words = text.split(" ");

  return (
    <Tag ref={containerRef} className={cn(className)}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden mr-[0.3em]">
          <span
            className={cn(
              "word-inner inline-block opacity-0",
              gradient && "gradient-text"
            )}
          >
            {word}
          </span>
        </span>
      ))}
    </Tag>
  );
};

export default TextReveal;
