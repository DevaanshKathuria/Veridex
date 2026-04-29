"use client";

import { HTMLMotionProps, motion, useMotionValue, useSpring } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MagneticButton({
  children,
  className,
  disabled,
  ...props
}: HTMLMotionProps<"button"> & { children: ReactNode }) {
  const x = useSpring(useMotionValue(0), { stiffness: 180, damping: 14 });
  const y = useSpring(useMotionValue(0), { stiffness: 180, damping: 14 });

  return (
    <motion.button
      className={cn(
        "primary-glow inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40",
        className
      )}
      disabled={disabled}
      onMouseMove={(event) => {
        if (disabled) return;
        const rect = event.currentTarget.getBoundingClientRect();
        x.set(((event.clientX - rect.left) / rect.width - 0.5) * 8);
        y.set(((event.clientY - rect.top) / rect.height - 0.5) * 8);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      style={{ x, y }}
      {...props}
    >
      {children}
    </motion.button>
  );
}
