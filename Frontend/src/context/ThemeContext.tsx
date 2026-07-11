import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface ThemeContextType {
  tema: 'escuro' | 'claro';
  toggleTema: () => void;
}

const ThemeContext = createContext<ThemeContextType>({} as ThemeContextType);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [tema, setTema] = useState<'escuro' | 'claro'>(() => {
    return (localStorage.getItem('tema') as 'escuro' | 'claro') ?? 'escuro';
  });

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root) return;
    if (tema === 'claro') {
      root.classList.add('tema-claro');
    } else {
      root.classList.remove('tema-claro');
    }
    localStorage.setItem('tema', tema);
  }, [tema]);

  const toggleTema = () => setTema(t => t === 'escuro' ? 'claro' : 'escuro');

  return (
    <ThemeContext.Provider value={{ tema, toggleTema }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
