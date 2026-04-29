"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, Menu, Sparkles } from "lucide-react";
import { motion, useScroll, useSpring } from "framer-motion";
import { useEffect, useState } from "react";
import { authAPI } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAnalysisStore } from "@/stores/analysisStore";
import { useAuthStore } from "@/stores/authStore";

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analyze", label: "Analyze" },
  { href: "/documents", label: "Documents" },
];

function initials(name?: string) {
  return (name || "VX").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const status = useAnalysisStore((state) => state.status);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { scrollYProgress } = useScroll();
  const scrollScale = useSpring(scrollYProgress, { stiffness: 140, damping: 28, mass: 0.25 });
  const analyzing = Boolean(status && !["COMPLETE", "FAILED"].includes(status));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.title = analyzing ? "Analyzing... - Veridex" : "Veridex";
  }, [analyzing]);

  async function logout() {
    await authAPI.logout().catch(() => undefined);
    clearAuth();
    router.push("/");
  }

  return (
    <>
      <motion.div
        className="fixed left-0 top-0 z-[60] h-px w-full origin-left bg-gradient-to-r from-glow-blue to-glow-cyan"
        style={{ scaleX: scrollScale }}
      />
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 border-b border-white/[0.04] bg-void/85 backdrop-blur-xl transition-shadow duration-150",
          scrolled && "shadow-[0_1px_0_rgba(255,255,255,0.04)]"
        )}
      >
        <div className="mx-auto flex h-[52px] max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-mono text-[13px] uppercase tracking-[0.15em] text-text-primary">
            <span className="size-1.5 rounded-full bg-glow-emerald animate-pulse-glow" />
            VERIDEX
          </Link>

          <nav className="hidden items-center gap-6 md:flex">
            {user
              ? appLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-active={pathname === link.href}
                    className="nav-link-underline flex items-center gap-1 text-[13px] text-text-secondary transition-colors duration-150 hover:text-text-primary data-[active=true]:text-text-primary"
                  >
                    {link.href === "/analyze" && analyzing ? <Sparkles className="size-3 animate-spin-slow text-glow-cyan" /> : null}
                    {link.label}
                  </Link>
                ))
              : null}
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Link href="/settings" className="hidden items-center gap-2 sm:flex">
                  <span className="flex size-7 items-center justify-center rounded-full bg-gradient-to-br from-glow-blue to-glow-purple font-mono text-[10px] text-text-primary">
                    {initials(user.name)}
                  </span>
                  <span className="text-[13px] text-text-secondary">{user.name}</span>
                  <span className="rounded border border-border-default px-1.5 py-0.5 font-mono text-[10px] uppercase text-text-secondary">
                    {user.plan}
                  </span>
                </Link>
                <button className="hidden text-text-secondary transition-colors hover:text-text-primary sm:block" onClick={logout} aria-label="Log out">
                  <LogOut className="size-4" />
                </button>
                <button className="text-text-secondary md:hidden" onClick={() => setOpen((value) => !value)} aria-label="Open menu">
                  <Menu className="size-5" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="text-[13px] text-text-secondary transition-colors hover:text-text-primary">
                  Login
                </Link>
                <Link href="/register" className="primary-glow rounded-md px-3 py-1.5 text-[13px] font-medium">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
        {open && user ? (
          <div className="border-t border-border-dim bg-void px-4 py-3 md:hidden">
            {appLinks.map((link) => (
              <Link key={link.href} href={link.href} className="block min-h-11 py-2 text-sm text-text-secondary" onClick={() => setOpen(false)}>
                {link.label}
              </Link>
            ))}
          </div>
        ) : null}
      </header>
    </>
  );
}
