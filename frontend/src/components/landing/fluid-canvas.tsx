import { useEffect, useRef } from "react";

type FluidSim = {
  start: () => void;
  stop: () => void;
  setConfig: (c: Record<string, unknown>) => void;
  splatAtLocation: (x: number, y: number, dx: number, dy: number, hex?: string) => void;
};

export function FluidCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<FluidSim | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current || !containerRef.current) return;
    initialized.current = true;

    let cancelled = false;
    const container = containerRef.current;

    const isTouchOnly =
      typeof window !== "undefined" &&
      window.matchMedia?.("(hover: none) and (pointer: coarse)").matches;

    const isMobileViewport =
      typeof window !== "undefined" && window.innerWidth < 768;

    import("webgl-fluid-enhanced").then((mod) => {
      if (cancelled || !container) return;
      const FluidClass = mod.default as unknown as new (el: HTMLElement) => FluidSim;
      const sim = new FluidClass(container);
      sim.setConfig({
        simResolution: 128,
        dyeResolution: isMobileViewport ? 512 : 1024,
        captureResolution: 512,
        densityDissipation: 1.2,
        velocityDissipation: 1.6,
        pressure: 0.8,
        pressureIterations: 20,
        curl: 18,
        splatRadius: isMobileViewport ? 0.25 : 0.2,
        splatForce: 3500,
        shading: true,
        colorful: true,
        colorUpdateSpeed: 6,
        backgroundColor: "#ffffff",
        transparent: false,
        brightness: 0.5,
        bloom: false,
        sunrays: false,
        hover: true,
        colorPalette: ["#5433c2", "#BF499B", "#A5DDEC", "#484848"],
      });
      sim.start();
      simRef.current = sim;
    });

    let raf = 0;
    let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0;
    let heroTop = 0;
    let heroBottom = 0;

    const measure = () => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      heroTop = rect.top + window.scrollY;
      heroBottom = heroTop + rect.height;
    };
    measure();

    const onScroll = () => {
      if (!isTouchOnly || !simRef.current) return;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const delta = y - lastScrollY;
        lastScrollY = y;
        if (Math.abs(delta) < 2) return;
        if (y + window.innerHeight < heroTop + 40) return;
        if (y > heroBottom - 40) return;

        const canvasEl = container.querySelector("canvas");
        if (!canvasEl) return;
        const cw = canvasEl.width;
        const ch = canvasEl.clientHeight;
        if (!cw || !ch) return;

        const progress = Math.min(
          1,
          Math.max(0, (y - heroTop) / Math.max(1, heroBottom - heroTop))
        );
        const xNorm = 0.2 + 0.6 * (0.5 + 0.4 * Math.sin(y / 120));
        const yNorm = 1 - progress;
        const vx = Math.sin(y / 90) * 600;
        const vy = -Math.sign(delta) * (400 + Math.min(1200, Math.abs(delta) * 25));
        simRef.current!.splatAtLocation(xNorm * cw, yNorm * ch, vx, vy);
      });
    };

    const onResize = () => measure();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      simRef.current?.stop();
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 1,
      }}
    >
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%", touchAction: "pan-y" }}
      />
    </div>
  );
}
