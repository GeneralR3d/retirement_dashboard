"use client";

import { createContext, useContext, useState } from "react";

type SrsToggleContextType = {
  srsEnabled: boolean;
  setSrsEnabled: (v: boolean) => void;
};

const SrsToggleContext = createContext<SrsToggleContextType>({
  srsEnabled: false,
  setSrsEnabled: () => {},
});

export function SrsToggleProvider({ children }: { children: React.ReactNode }) {
  const [srsEnabled, setSrsEnabled] = useState(false);
  return (
    <SrsToggleContext.Provider value={{ srsEnabled, setSrsEnabled }}>
      {children}
    </SrsToggleContext.Provider>
  );
}

export function useSrsToggle() {
  return useContext(SrsToggleContext);
}
