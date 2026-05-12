import { motion, AnimatePresence, useInView } from "framer-motion";
import { useRef, useState } from "react";
import { ChevronDown, ArrowRight } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqItems: FAQItem[] = [
  {
    question: "How fast are the generated images?",
    answer:
      "Most images are generated within 30-60 seconds. Batch generations with multiple views or variants may take a few minutes depending on the queue.",
  },
  {
    question: "Can I create color variants of my products?",
    answer:
      "Yes! SnapShot supports generating multiple color variants from a single product image. Simply select your desired colors in the configuration step.",
  },
  {
    question: "What niches are supported?",
    answer:
      "Currently, SnapShot specializes in Fashion (clothing, accessories) and Home Decor (furniture, decor items). Each niche has optimized workflows and view options.",
  },
  {
    question: "How do I download my images?",
    answer:
      "After generation, you can download individual images or the entire batch. Images are provided in high-resolution format suitable for e-commerce platforms.",
  },
  {
    question: "What is the Fix Image tool?",
    answer:
      "Fix Image is our post-generation editing tool. If a generated image needs adjustments—like fixing a hand, adjusting colors, or removing artifacts—you can use Fix Image to make targeted corrections.",
  },
  {
    question: "Can I use generated images for commercial purposes?",
    answer:
      "Yes, all images generated with SnapShot are yours to use commercially. You retain full rights to use them on your e-commerce store, marketing materials, and social media.",
  },
];

const FAQAccordionItem = ({
  item,
  isOpen,
  onToggle,
  index,
  isInView,
}: {
  item: FAQItem;
  isOpen: boolean;
  onToggle: () => void;
  index: number;
  isInView: boolean;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: 0.2 + index * 0.06, duration: 0.4, ease: "easeOut" }}
      className={`
        border-b border-white/[0.04] last:border-b-0 transition-all duration-300
        ${isOpen ? "bg-white/[0.02]" : "hover:bg-white/[0.01]"}
      `}
    >
      <button
        onClick={onToggle}
        className="w-full py-4 px-4 flex items-center justify-between text-left group"
      >
        <span className={`
          font-display text-base pr-6 transition-colors duration-300
          ${isOpen ? "text-foreground" : "text-foreground/70 group-hover:text-foreground"}
        `}>
          {item.question}
        </span>

        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={`
            flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300
            ${isOpen
              ? "bg-logo-purple/15 text-logo-purple"
              : "bg-white/[0.03] text-muted-foreground group-hover:bg-white/[0.06]"
            }
          `}
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="overflow-hidden"
          >
            <p className="pb-4 px-4 text-sm text-muted-foreground font-body leading-relaxed">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const FAQ = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "200px" });
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="py-12 md:py-16 relative" ref={ref}>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h2 className="font-prata text-3xl md:text-4xl font-bold text-foreground mb-3 leading-tight">
            Frequently Asked{" "}
            <span className="bg-gradient-to-r from-logo-purple to-electric-blue bg-clip-text text-transparent">
              Questions
            </span>
          </h2>
          <p className="text-foreground/50 font-body text-base max-w-md mx-auto leading-relaxed">
            Everything you need to know about Snapshot
          </p>
        </motion.div>

        {/* Accordion */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.01] overflow-hidden">
          {faqItems.map((item, index) => (
            <FAQAccordionItem
              key={index}
              item={item}
              index={index}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              isInView={isInView}
            />
          ))}
        </div>

        {/* Contact line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="text-center mt-6 text-sm text-foreground/40 font-body"
        >
          Can&apos;t find what you&apos;re looking for?{" "}
          <a
            href="#"
            className="inline-inline items-center gap-1 text-logo-purple hover:text-logo-purple/80 transition-colors duration-300"
          >
            Contact Support
            <ArrowRight className="w-3 h-3 inline ml-1" />
          </a>
        </motion.p>
      </div>
    </section>
  );
};

export default FAQ;
