"use client";

import { createContext, useContext, useState } from "react";
import { useAppData } from "@/lib/hooks/useAppData";
import type { UseAppDataReturn } from "@/lib/hooks/useAppData";

export type AppDataContextValue = UseAppDataReturn & {
  previewAppTheme: string | null;
  setPreviewAppTheme: (v: string | null) => void;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: React.ReactNode }) {
  const data = useAppData();
  const [previewAppTheme, setPreviewAppTheme] = useState<string | null>(null);
  return (
    <AppDataContext.Provider value={{ ...data, previewAppTheme, setPreviewAppTheme }}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppDataContext(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppDataContext must be used within AppDataProvider");
  return ctx;
}
