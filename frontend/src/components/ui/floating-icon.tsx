import * as React from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

interface FloatingIconProps {
  children?: React.ReactNode;
  className?: string;
  innerClassName?: string;
  index?: number;
  repelRadius?: number;
  repelStrength?: number;
  float?: boolean;
}

export function FloatingIcon({
  children,
  className,
  innerClassName,
  index = 0,
  repelRadius = 150,
  repelStrength = 50,
  float = true,
}: FloatingIconProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20 });
  const springY = useSpring(y, { stiffness: 300, damping: 20 });

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < repelRadius) {
        const angle = Math.atan2(dy, dx);
        const force = (1 - distance / repelRadius) * repelStrength;
        x.set(-Math.cos(angle) * force);
        y.set(-Math.sin(angle) * force);
      } else {
        x.set(0);
        y.set(0);
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [x, y, repelRadius, repelStrength]);

  const floatDuration = 5 + ((index * 1.3) % 5);

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY }}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: index * 0.08,
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      className={cn("absolute", className)}
    >
      <motion.div
        animate={
          float
            ? { y: [0, -8, 0, 8, 0], x: [0, 6, 0, -6, 0], rotate: [0, 5, 0, -5, 0] }
            : undefined
        }
        transition={
          float
            ? { duration: floatDuration, repeat: Infinity, repeatType: "mirror", ease: "easeInOut" }
            : undefined
        }
        className={cn("flex items-center justify-center", innerClassName)}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
