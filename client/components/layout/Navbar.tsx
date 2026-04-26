"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authAPI } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/analyze", label: "Analyze" },
  { href: "/documents", label: "Documents" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  async function logout() {
    await authAPI.logout().catch(() => undefined);
    clearAuth();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-text-primary">
          <ShieldCheck className="size-5 text-[#79c0ff]" />
          Veridex
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {user
            ? appLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm text-text-secondary hover:bg-surface-2 hover:text-text-primary",
                    pathname === link.href && "bg-surface-2 text-text-primary"
                  )}
                >
                  {link.label}
                </Link>
              ))
            : null}
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link href="/settings" className="hidden text-sm text-text-secondary hover:text-text-primary sm:block">
                {user.name}
              </Link>
              <Button variant="ghost" size="sm" onClick={logout} aria-label="Log out">
                <LogOut className="size-4" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" render={<Link href="/login" />}>
                Login
              </Button>
              <Button size="sm" render={<Link href="/register" />}>
                Sign up
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
