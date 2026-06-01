// AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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
  refreshMercados: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  // ✅ Fix 1: inicializa como true só se há token — evita setState síncrono no effect
  const [carregando, setCarregando] = useState(
    () => !!localStorage.getItem("token")
  );
  const [temMercado, setTemMercado] = useState(false);

  // ✅ Fix 2: useCallback para estabilizar a referência e poder incluir no dep array
  const verificarMercados = useCallback(async () => {
    try {
      const res = await fetch("/api/mercados");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTemMercado((data.mercados ?? []).length > 0);
    } catch {
      setTemMercado(false);
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return; // carregando já é false, nada a fazer

    api
      .perfil()
      .then((u: Usuario) => {
        setUsuario(u);
        return verificarMercados();
      })
      .catch(() => {
        localStorage.removeItem("token");
        setTemMercado(false);
      })
      .finally(() => setCarregando(false));
  }, [verificarMercados]);

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
    // ✅ Fix 3: expõe refreshMercados para que RegistrarMercado possa atualizar
    //    temMercado após cadastrar o primeiro mercado (App.tsx usa temMercado
    //    para decidir rota /vendedor vs /perfil)
    <AuthContext.Provider
      value={{ usuario, carregando, temMercado, login, logout, refreshMercados: verificarMercados }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);