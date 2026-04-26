import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { UserDTO } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

interface AuthStore {
  user: UserDTO | null;
  accessToken: string | null;
  isLoading: boolean;
  setAuth: (user: UserDTO, token: string) => void;
  clearAuth: () => void;
  refreshToken: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      setAuth: (user, token) => set({ user, accessToken: token, isLoading: false }),
      clearAuth: () => set({ user: null, accessToken: null, isLoading: false }),
      refreshToken: async () => {
        set({ isLoading: true });
        const response = await fetch(`${API_URL}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
        });
        if (!response.ok) {
          set({ user: null, accessToken: null, isLoading: false });
          throw new Error("Session expired");
        }
        const data = await response.json();
        set({ accessToken: data.accessToken, isLoading: false });
      },
    }),
    {
      name: "veridex-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken }),
    }
  )
);
