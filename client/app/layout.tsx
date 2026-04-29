import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { PageTransition } from "@/components/layout/PageTransition";
import { Providers } from "@/components/layout/Providers";
import { Toaster } from "@/components/layout/Toaster";

export const metadata: Metadata = {
  title: "Veridex",
  description: "Forensic claim verification and credibility scoring.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-void font-sans text-text-primary antialiased">
        <Providers>
          <Navbar />
          <main className="pt-[52px]">
            <PageTransition>{children}</PageTransition>
          </main>
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
