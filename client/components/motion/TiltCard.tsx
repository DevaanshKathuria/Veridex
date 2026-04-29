"use client";

import { CSSProperties, ReactNode, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export function TiltCard({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [shine, setShine] = useState({ x: 50, y: 50, active: false });

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden transition-all duration-150", className)}
      onMouseMove={(event) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        setTilt({ x: y * 3, y: -x * 3 });
        setShine({ x: event.clientX - rect.left, y: event.clientY - rect.top, active: true });
      }}
      onMouseLeave={() => {
        setTilt({ x: 0, y: 0 });
        setShine((value) => ({ ...value, active: false }));
      }}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        ...style,
      }}
    >
      <span
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-150"
        style={{
          opacity: shine.active ? 1 : 0,
          background: `radial-gradient(160px circle at ${shine.x}px ${shine.y}px, rgba(255,255,255,0.08), transparent 45%)`,
        }}
      />
      {children}
    </div>
  );
}
