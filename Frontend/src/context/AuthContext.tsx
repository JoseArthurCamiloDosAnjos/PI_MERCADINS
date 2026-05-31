// AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { api } from "../services/api";

interface Usuario {
  id_usuario: number;
  nome: string;
  email: string;
  telefone?: string;
  email_verificado: boolean;
}

interface AuthContextType {
  usuario: Usuario | null;
  carregando: boolean;
  temMercado: boolean;
  login: (email: string, senha: string) => Promise<Usuario>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [temMercado, setTemMercado] = useState(false);

  async function verificarMercados() {
    try {
      const res = await fetch('/api/mercados');
      const data = await res.json();
      setTemMercado((data.mercados ?? []).length > 0);
    } catch {
      setTemMercado(false);
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setCarregando(false);
      return;
    }
    api
      .perfil()
      .then((u: Usuario) => {
        setUsuario(u);
        return verificarMercados();
      })
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setCarregando(false));
  }, []);

  async function login(email: string, senha: string): Promise<Usuario> {
    const { usuario: u, token } = await api.login({ email, senha });
    localStorage.setItem("token", token);
    setUsuario(u);
    await verificarMercados();
    return u;
  }

  function logout() {
    localStorage.removeItem("token");
    setUsuario(null);
    setTemMercado(false);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, temMercado, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);