/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, type ReactNode } from "react";

// O site é fixo no tema escuro — o tema claro foi removido.
interface ThemeContextType {
  tema: 'escuro';
}

const ThemeContext = createContext<ThemeContextType>({ tema: 'escuro' });

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    // Garante que ninguém fique preso no tema claro salvo no navegador
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
