"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

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
      const nextPath = new URLSearchParams(window.location.search).get("next");
      router.push(nextPath || "/dashboard");
    } catch {
      setError("Invalid email or password.");
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md rounded-lg border border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-2xl">Log in to Veridex</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input placeholder="Email" type="email" {...register("email")} />
            <div className="relative">
              <Input placeholder="Password" type={showPassword ? "text" : "password"} {...register("password")} />
              <button type="button" className="absolute right-2 top-2 text-text-secondary" onClick={() => setShowPassword((value) => !value)}>
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {(formState.errors.email || formState.errors.password || error) ? (
              <p className="text-sm text-[#ff7b72]">{error || "Enter a valid email and an 8 character password."}</p>
            ) : null}
            <Button className="w-full" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Signing in..." : "Log in"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-text-secondary">
            New here? <Link href="/register" className="text-[#79c0ff]">Create an account</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
