import { useEffect, useState } from "react";

interface PerformanceMetrics {
  fps: number;
  memoryUsage: number;
  paintTime: number;
  layoutShift: number;
}

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}

interface PerformanceWithMemory extends Performance {
  memory?: MemoryInfo;
}

const PerformanceMonitor = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    memoryUsage: 0,
    paintTime: 0,
    layoutShift: 0,
  });

  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();
    let frameCount = 0;

    const measurePerformance = (currentTime: number) => {
      frameCount++;

      // Calculate FPS
      if (currentTime - lastTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));

        // Get memory usage (if available)
        const perfWithMemory = performance as PerformanceWithMemory;
        const memoryUsage = perfWithMemory.memory
          ? Math.round(perfWithMemory.memory.usedJSHeapSize / 1048576) // MB
          : 0;

        // Get paint timing
        const paintTime =
          performance
            .getEntriesByType("paint")
            .find((entry) => entry.name === "first-contentful-paint")
            ?.startTime || 0;

        setMetrics({
          fps,
          memoryUsage,
          paintTime,
          layoutShift: 0, // Would need Layout Instability API
        });

        frameCount = 0;
        lastTime = currentTime;
      }

      animationFrameId = requestAnimationFrame(measurePerformance);
    };

    animationFrameId = requestAnimationFrame(measurePerformance);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // Only show in development or when performance issues are detected
  if (import.meta.env.PROD && metrics.fps > 55) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 bg-black/50 backdrop-blur-md border border-gray-600 rounded-lg p-3 text-xs font-mono text-white z-50">
      <div className="grid grid-cols-2 gap-2">
        <div>
          FPS:{" "}
          <span
            className={`font-bold ${
              metrics.fps < 30
                ? "text-red-400"
                : metrics.fps < 50
                ? "text-yellow-400"
                : "text-green-400"
            }`}
          >
            {metrics.fps}
          </span>
        </div>
        <div>
          Memory: <span className="font-bold">{metrics.memoryUsage}MB</span>
        </div>
        <div>
          Paint:{" "}
          <span className="font-bold">{Math.round(metrics.paintTime)}ms</span>
        </div>
        <div>
          Status:{" "}
          <span
            className={`font-bold ${
              metrics.fps < 30 ? "text-red-400" : "text-green-400"
            }`}
          >
            {metrics.fps < 30 ? "Poor" : metrics.fps < 50 ? "Fair" : "Good"}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;
