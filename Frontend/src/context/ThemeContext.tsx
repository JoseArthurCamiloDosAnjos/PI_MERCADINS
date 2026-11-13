/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, type ReactNode } from "react";

interface ThemeContextType {
  tema: 'escuro';
}

const ThemeContext = createContext<ThemeContextType>({ tema: 'escuro' });

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.getElementById('root')?.classList.remove('tema-claro');
    document.documentElement.classList.remove('tema-claro');
    localStorage.removeItem('tema');
  }, []);

  return (
    <ThemeContext.Provider value={{ tema: 'escuro' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
