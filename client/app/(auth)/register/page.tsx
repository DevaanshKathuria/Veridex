"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MagneticButton } from "@/components/motion/MagneticButton";
import { Input } from "@/components/ui/input";
import { authAPI } from "@/lib/api";
import { fadeUp } from "@/lib/animations";
import { useAuthStore } from "@/stores/authStore";

const schema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string().min(8),
}).refine((data) => data.password === data.confirmPassword, { message: "Passwords must match", path: ["confirmPassword"] });
type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const { register, handleSubmit, formState } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    const { data } = await authAPI.register({ name: values.name, email: values.email, password: values.password });
    setAuth(data.user, data.accessToken);
    router.push("/dashboard");
  }

  return (
    <div className="mesh-bg relative flex min-h-[calc(100vh-52px)] items-center justify-center overflow-hidden px-4 py-12">
      <div className="ambient-field absolute inset-0" />
      <motion.div initial="hidden" animate="visible" variants={fadeUp} className="glass-card glow-border-blue relative z-10 w-full max-w-[400px] rounded-2xl p-10">
        <div className="mb-8 flex items-center gap-2 font-mono text-sm uppercase tracking-[0.18em] text-text-primary">
          <span className="size-1.5 rounded-full bg-glow-emerald animate-pulse-glow" />
          VERIDEX
        </div>
        <h1 className="text-2xl text-text-primary">Create account</h1>
        <p className="mt-2 text-sm text-text-secondary">Build a persistent evidence trail.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-8 space-y-4">
          {[
            ["Name", "name", "text"],
            ["Email", "email", "email"],
            ["Password", "password", "password"],
            ["Confirm password", "confirmPassword", "password"],
          ].map(([label, name, type]) => (
            <label className="block" key={name}>
              <span className="mb-2 block text-xs text-text-secondary">{label}</span>
              <Input type={type} {...register(name as keyof FormValues)} className={formState.errors[name as keyof FormValues] ? "animate-[shake_0.35s] border-verdict-false" : ""} />
            </label>
          ))}
          {Object.keys(formState.errors).length ? <p className="text-sm text-verdict-false">{formState.errors.confirmPassword?.message || "Please complete every field correctly."}</p> : null}
          <MagneticButton className="w-full" disabled={formState.isSubmitting}>{formState.isSubmitting ? <span className="shimmer h-4 w-24 rounded" /> : "Create account"}</MagneticButton>
        </form>
        <p className="mt-6 text-center text-sm text-text-secondary">
          Already registered? <Link href="/login" className="text-text-accent hover:text-glow-cyan">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}
