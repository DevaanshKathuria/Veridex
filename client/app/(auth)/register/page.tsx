"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { authAPI } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

const schema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

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
    <div className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md rounded-lg border border-border bg-surface">
        <CardHeader>
          <CardTitle className="text-2xl">Create your Veridex account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input placeholder="Name" {...register("name")} />
            <Input placeholder="Email" type="email" {...register("email")} />
            <Input placeholder="Password" type="password" {...register("password")} />
            <Input placeholder="Confirm password" type="password" {...register("confirmPassword")} />
            {Object.keys(formState.errors).length ? (
              <p className="text-sm text-[#ff7b72]">{formState.errors.confirmPassword?.message || "Please complete every field correctly."}</p>
            ) : null}
            <Button className="w-full" disabled={formState.isSubmitting}>{formState.isSubmitting ? "Creating..." : "Sign up"}</Button>
          </form>
          <p className="mt-4 text-center text-sm text-text-secondary">
            Already have an account? <Link href="/login" className="text-[#79c0ff]">Log in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
