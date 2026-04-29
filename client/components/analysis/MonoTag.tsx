import { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function MonoTag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("rounded border border-border-dim bg-void px-2 py-1 font-mono text-[11px] text-text-secondary", className)}>
      {children}
    </span>
  );
}
