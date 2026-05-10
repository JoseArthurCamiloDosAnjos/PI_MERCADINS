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
  login: (email: string, senha: string) => Promise<Usuario>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setCarregando(false);// eslint-disable-line
      return;
    } 
    api
      .perfil()
      .then((u: Usuario) => setUsuario(u))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setCarregando(false));
  }, []);
  async function login(email: string, senha: string): Promise<Usuario> {
    const { usuario: u, token } = await api.login({ email, senha });
    localStorage.setItem("token", token);
    setUsuario(u);
    return u;
  }

  function logout() {
    localStorage.removeItem("token");
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, carregando, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
