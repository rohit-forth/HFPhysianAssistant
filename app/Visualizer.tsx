import React, { useEffect, useRef } from "react";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

const Visualizer = ({ microphone }: { microphone: MediaRecorder }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();

  // Optimize for better frequency resolution
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  useEffect(() => {
    const source = audioContext.createMediaStreamSource(microphone.stream);
    source.connect(analyser);
    draw();

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      source.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getGradientColor = (ctx: CanvasRenderingContext2D, height: number) => {
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(255, 82, 82, 0.7)"); // Red at top
    gradient.addColorStop(0.5, "rgba(255, 193, 7, 0.7)"); // Yellow in middle
    gradient.addColorStop(1, "rgba(0, 230, 118, 0.7)"); // Green at bottom
    return gradient;
  };

  const draw = (): void => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Make canvas responsive
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const context = canvas.getContext("2d");
    if (!context) return;

    // Scale context for retina displays
    context.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas with a slight fade effect
    context.fillStyle = "rgba(0, 0, 0, 0.2)";
    context.fillRect(0, 0, width, height);

    // Get frequency data
    analyser.getByteFrequencyData(dataArray);

    // Calculate bar properties
    const barCount = Math.min(dataArray.length, Math.floor(width / 3));
    const barWidth = width / barCount;
    const barSpacing = 1;

    // Create gradient
    const gradient = getGradientColor(context, height);
    context.fillStyle = gradient;

    // Draw bars
    for (let i = 0; i < barCount; i++) {
      const percent = dataArray[i] / 255;
      const barHeight = percent * height * 0.8; // 80% of canvas height max

      // Calculate x position with spacing
      const x = i * (barWidth + barSpacing);

      // Draw main bar with rounded corners
      context.beginPath();
      context.roundRect(
        x,
        height - barHeight,
        barWidth - barSpacing,
        barHeight,
        [4, 4, 0, 0] // rounded top corners
      );
      context.fill();

      // Add reflection effect
      const reflectionHeight = barHeight * 0.3;
      context.fillStyle = `rgba(255, 255, 255, ${percent * 0.1})`;
      context.fillRect(
        x,
        height - barHeight,
        barWidth - barSpacing,
        reflectionHeight
      );

      // Reset to gradient for next bar
      context.fillStyle = gradient;
    }

    // Add glow effect
    context.shadowBlur = 15;
    context.shadowColor = "rgba(255, 255, 255, 0.5)";

    rafRef.current = requestAnimationFrame(draw);
  };

  return (
    <div className="w-full h-24 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{
          filter: "contrast(1.2) brightness(1.1)",
        }}
      />
    </div>
  );
};

export default Visualizer;
