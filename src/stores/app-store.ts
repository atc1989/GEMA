import { create } from "zustand";

type AppRole = "public" | "member" | "admin";

type AppState = {
  activeRole: AppRole;
  setActiveRole: (role: AppRole) => void;
};

export const useAppStore = create<AppState>((set) => ({
  activeRole: "public",
  setActiveRole: (activeRole) => set({ activeRole }),
}));
