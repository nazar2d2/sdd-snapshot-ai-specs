import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

const COLORS = [
  { name: "White", hex: "#FFFFFF" },
  { name: "Black", hex: "#1A1A1A" },
  { name: "Navy", hex: "#1E3A5F" },
  { name: "Red", hex: "#DC2626" },
  { name: "Forest", hex: "#166534" },
  { name: "Lavender", hex: "#A78BFA" },
  { name: "Coral", hex: "#FB7185" },
  { name: "Sky", hex: "#38BDF8" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Rose", hex: "#F43F5E" },
];

const TShirtIcon = ({ color, delay = 0 }: { color: string; delay?: number }) => (
  <motion.div
    initial={{ scale: 0, opacity: 0, y: 20 }}
    animate={{ scale: 1, opacity: 1, y: 0 }}
    exit={{ scale: 0, opacity: 0 }}
    transition={{ duration: 0.4, delay, type: "spring", stiffness: 260, damping: 20 }}
    className="relative group"
  >
    <div
      className="w-16 h-16 md:w-20 md:h-20 rounded-xl flex items-center justify-center border border-white/[0.06] backdrop-blur-sm transition-transform duration-300 hover:scale-105"
      style={{ backgroundColor: `${color}15` }}
    >
      <svg viewBox="0 0 24 24" className="w-10 h-10 md:w-12 md:h-12" fill={color}>
        <path d="M20.38 5.24L16 3H8L3.62 5.24C3.24 5.42 3 5.8 3 6.21V8.5C3 9.05 3.45 9.5 4 9.5H6V19.5C6 20.05 6.45 20.5 7 20.5H17C17.55 20.5 18 20.05 18 19.5V9.5H20C20.55 9.5 21 9.05 21 8.5V6.21C21 5.8 20.76 5.42 20.38 5.24Z" />
      </svg>
    </div>
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay + 0.2, type: "spring", stiffness: 400 }}
      className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center"
    >
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
      </svg>
    </motion.div>
  </motion.div>
);

const ProcessingCard = () => {
  const [isProcessing, setIsProcessing] = useState(true);
  const [showResults, setShowResults] = useState(false);
  const [progress, setProgress] = useState(0);

  const cycle = useCallback(() => {
    setIsProcessing(true);
    setShowResults(false);
    setProgress(0);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    setTimeout(() => {
      clearInterval(progressInterval);
      setProgress(100);
      setIsProcessing(false);
      setShowResults(true);
    }, 2000);
  }, []);

  useEffect(() => {
    cycle();
    const interval = setInterval(cycle, 6000);
    return () => clearInterval(interval);
  }, [cycle]);

  return (
    <div className="relative">
      {/* Animated border glow */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-r from-logo-purple via-electric-blue to-logo-purple bg-[length:300%_100%] animate-gradient-shift opacity-40" />
      {/* Glow effect */}
      <div className="absolute -inset-4 bg-gradient-to-r from-logo-purple/15 to-electric-blue/15 rounded-3xl blur-2xl opacity-50" />

      <motion.div
        className="relative rounded-2xl p-6 md:p-8 min-h-[340px] w-full max-w-lg bg-[#080808]/90 backdrop-blur-xl border border-white/[0.06] animate-float"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-logo-purple animate-pulse" />
            <span className="text-sm font-body text-muted-foreground">
              {isProcessing ? "Processing batch..." : "Batch complete"}
            </span>
          </div>
          <span className="text-xs font-body text-muted-foreground tabular-nums">
            {showResults ? "10/10" : `${Math.floor(progress / 10)}/10`}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-white/[0.04] rounded-full mb-8 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-logo-purple to-electric-blue"
            initial={{ width: "0%" }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        <AnimatePresence mode="wait">
          {isProcessing ? (
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center justify-center py-8"
            >
              <motion.div
                animate={{
                  scale: [1, 1.08, 1],
                  rotate: [0, 3, -3, 0],
                }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-logo-purple to-electric-blue rounded-2xl blur-xl opacity-30" />
                <div className="relative w-24 h-24 rounded-2xl bg-white/[0.03] flex items-center justify-center border border-white/[0.06]">
                  <svg viewBox="0 0 24 24" className="w-14 h-14 text-foreground" fill="currentColor">
                    <path d="M20.38 5.24L16 3H8L3.62 5.24C3.24 5.42 3 5.8 3 6.21V8.5C3 9.05 3.45 9.5 4 9.5H6V19.5C6 20.05 6.45 20.5 7 20.5H17C17.55 20.5 18 20.05 18 19.5V9.5H20C20.55 9.5 21 9.05 21 8.5V6.21C21 5.8 20.76 5.42 20.38 5.24Z" />
                  </svg>
                </div>
              </motion.div>
              <p className="mt-6 text-sm text-muted-foreground font-body">
                Generating color variants...
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-5 gap-3"
            >
              {COLORS.map((color, index) => (
                <TShirtIcon key={color.name} color={color.hex} delay={index * 0.06} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Status footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showResults ? 1 : 0 }}
          className="mt-8 flex items-center justify-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm text-green-500 font-body">Ready for export</span>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default ProcessingCard;
