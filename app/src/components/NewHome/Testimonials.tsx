import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { Star } from "lucide-react";

interface Testimonial {
  quote: string;
  author: string;
  company: string;
  rating: number;
}

const testimonialRow1: Testimonial[] = [
  { quote: "Cut our photo costs by 80%.", author: "Sarah Chen", company: "LUXE Fashion", rating: 5 },
  { quote: "Color variants are finally consistent.", author: "Marcus Thompson", company: "Urban Basics", rating: 5 },
  { quote: "Scaled from 50 to 500 SKUs in one quarter.", author: "Priya Patel", company: "Mindful Wear", rating: 5 },
  { quote: "Setup took under 5 minutes.", author: "James Rivera", company: "Threads Co", rating: 5 },
  { quote: "Our conversion rate jumped 35%.", author: "Anika Sharma", company: "Elara Studio", rating: 5 },
  { quote: "Best tool for product imagery, period.", author: "David Kim", company: "NOVA", rating: 5 },
  { quote: "Replaced our entire photo studio.", author: "Emma Larsson", company: "FORM", rating: 5 },
  { quote: "The AI quality blew us away.", author: "Liam O'Brien", company: "Sage & Stone", rating: 5 },
];

const testimonialRow2: Testimonial[] = [
  { quote: "Incredibly fast turnaround.", author: "Sofia Martinez", company: "Mindful Wear", rating: 5 },
  { quote: "Our customers love the new imagery.", author: "Noah Williams", company: "LUXE Fashion", rating: 5 },
  { quote: "Made our catalog look premium.", author: "Chloe Dupont", company: "Urban Basics", rating: 5 },
  { quote: "So easy our intern runs it.", author: "Raj Mehta", company: "Threads Co", rating: 5 },
  { quote: "Perfect for seasonal launches.", author: "Olivia Park", company: "Elara Studio", rating: 5 },
  { quote: "10x faster than manual editing.", author: "Ethan Brooks", company: "NOVA", rating: 5 },
  { quote: "Worth every penny.", author: "Mia Tanaka", company: "FORM", rating: 5 },
  { quote: "Game changer for our e-commerce.", author: "Lucas Fernandez", company: "Sage & Stone", rating: 5 },
];

const TestimonialPill = ({ testimonial }: { testimonial: Testimonial }) => (
  <div className="flex-shrink-0 w-[260px] rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.10] transition-all duration-300 p-4 cursor-default">
    <div className="flex gap-0.5 mb-2">
      {Array.from({ length: testimonial.rating }).map((_, i) => (
        <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
      ))}
    </div>
    <p className="text-sm text-foreground/70 font-body leading-relaxed mb-2">
      &ldquo;{testimonial.quote}&rdquo;
    </p>
    <p className="text-xs text-foreground/40 font-body">
      — {testimonial.author}, {testimonial.company}
    </p>
  </div>
);

const brandRow1 = ["LUXE", "Urban Basics", "Mindful Wear", "NOVA", "Threads Co", "Elara Studio", "FORM", "Sage & Stone"];
const brandRow2 = ["Threads Co", "NOVA", "FORM", "LUXE", "Sage & Stone", "Urban Basics", "Elara Studio", "Mindful Wear"];

const BrandPill = ({ name }: { name: string }) => (
  <div className="flex-shrink-0 px-5 py-2.5 rounded-full border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/[0.14] transition-all duration-300 cursor-default">
    <span className="text-sm font-display font-semibold text-foreground/40 whitespace-nowrap tracking-wide">
      {name}
    </span>
  </div>
);

const Testimonials = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section className="py-16 md:py-24 relative" ref={ref}>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-logo-purple/[0.02] to-transparent pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative mb-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          <h2 className="font-prata text-3xl md:text-5xl lg:text-[3.5rem] font-bold text-foreground mb-5 leading-tight">
            Loved by Brands{" "}
            <span className="bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent">
              Worldwide
            </span>
          </h2>
          <p className="text-foreground/50 font-body text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            See why over 10+ brands trust Snapshot for their product imagery
          </p>
        </motion.div>
      </div>

      {/* Testimonials marquee */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="space-y-3 overflow-hidden mb-14"
      >
        <div className="marquee-left">
          <div className="marquee-track-testimonials">
            {[...testimonialRow1, ...testimonialRow2, ...testimonialRow1, ...testimonialRow2].map((t, i) => (
              <TestimonialPill key={`t1-${i}`} testimonial={t} />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Brand pills marquee */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, delay: 0.4 }}
        className="pt-10 border-t border-white/[0.04]"
      >
        <p className="text-center text-sm text-muted-foreground/60 font-body mb-6">
          Trusted by innovative brands
        </p>

        <div className="space-y-3 overflow-hidden">
          <div className="marquee-left">
            <div className="marquee-track">
              {[...brandRow1, ...brandRow1, ...brandRow1, ...brandRow1].map((name, i) => (
                <BrandPill key={`r1-${i}`} name={name} />
              ))}
            </div>
          </div>

          <div className="marquee-right">
            <div className="marquee-track">
              {[...brandRow2, ...brandRow2, ...brandRow2, ...brandRow2].map((name, i) => (
                <BrandPill key={`r2-${i}`} name={name} />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default Testimonials;
