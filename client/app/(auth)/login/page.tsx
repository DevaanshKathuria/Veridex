"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { Input } from "@/components/ui/input";
import { authAPI } from "@/lib/api";
import { fadeUp } from "@/lib/animations";
import { useAuthStore } from "@/stores/authStore";

const schema = z.object({ email: z.string().email(), password: z.string().min(8) });
type FormValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setError("");
    try {
      const { data } = await authAPI.login(values);
      setAuth(data.user, data.accessToken);
      router.push(new URLSearchParams(window.location.search).get("next") || "/dashboard");
    } catch {
      setError("Invalid email or password.");
    }
  }

  return (
    <div className="mesh-bg relative flex min-h-[calc(100vh-52px)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="ambient-field absolute inset-0" />
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="glass-card glow-border-blue relative z-10 w-full max-w-[400px] rounded-2xl p-10">
        <div className="mb-8 flex items-center gap-2 font-mono text-sm uppercase tracking-[0.18em] text-text-primary">
          <span className="size-1.5 rounded-full bg-glow-emerald animate-pulse-glow" />
          VERIDEX
        </div>
        <h1 className="text-2xl text-text-primary">Sign in</h1>
        <p className="mt-2 text-sm text-text-secondary">Return to the forensic command center.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs text-text-secondary">Email</span>
            <Input type="email" {...register("email")} className={formState.errors.email ? "animate-[shake_0.35s] border-verdict-false" : ""} />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs text-text-secondary">Password</span>
            <div className="relative">
              <Input type={showPassword ? "text" : "password"} {...register("password")} className={formState.errors.password ? "animate-[shake_0.35s] border-verdict-false" : ""} />
              <button type="button" className="absolute right-3 top-3 text-text-tertiary" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>
          {(error || Object.keys(formState.errors).length) ? <p className="text-sm text-verdict-false">{error || "Enter valid credentials."}</p> : null}
          <MagneticButton className="w-full" disabled={formState.isSubmitting}>{formState.isSubmitting ? <span className="shimmer h-4 w-24 rounded" /> : "Sign in"}</MagneticButton>
        </form>
        <p className="mt-6 text-center text-sm text-text-secondary">
          New here? <Link href="/register" className="text-text-accent hover:text-glow-cyan">Create an account</Link>
        </p>
      </motion.div>
    </div>
  );
}
