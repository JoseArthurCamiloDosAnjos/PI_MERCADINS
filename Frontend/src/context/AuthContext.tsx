import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { BASE_URL } from '../services/api';
import { api } from "../services/api";

interface Usuario {
  id_usuario: number;
  nome: string;
  email: string;
  cpf?: string;
  telefone?: string;
  data_nascimento?: string;
  email_verificado: boolean;
  foto_perfil?: string;
  is_admin?: boolean;
  status?: string;
  email_admin?: string;
}

interface AuthContextType {
  usuario: Usuario | null;
  carregando: boolean;
  temMercado: boolean;
  login: (email: string, senha: string) => Promise<{ usuario: Usuario; is_admin_login: boolean }>;
  logout: () => void;
  refreshMercados: () => Promise<void>;
  refreshUsuario: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

/** Remove do storage tudo que pertence à conta (carrinho, endereços etc.). */
function limparDadosDaConta() {
  const chavesExatas = [
    'token',
    'is_admin_login',
    'mercadins_enderecos',
    'mercadins_endereco_entrega',
    'aguardandoPagamento',
  ];
  const prefixos = ['carrinho_'];
  const paraRemover: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const chave = localStorage.key(i);
    if (!chave) continue;
    if (chavesExatas.includes(chave) || prefixos.some((p) => chave.startsWith(p))) {
      paraRemover.push(chave);
    }
  }
  paraRemover.forEach((chave) => localStorage.removeItem(chave));
  sessionStorage.removeItem('posLoginDestino');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [carregando, setCarregando] = useState(
    () => !!localStorage.getItem("token")
  );
  const [temMercado, setTemMercado] = useState(false);

  const verificarMercados = useCallback(async () => {
  const token = localStorage.getItem("token");
  if (!token) { setTemMercado(false); return; }
  try {
    const res = await fetch(`${BASE_URL}/api/usuarios-mercados/meus`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    setTemMercado((data.mercados ?? []).length > 0);
  } catch {
    setTemMercado(false);
  }
}, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    api
      .perfil()
      .then((u: Usuario) => {
        if (u.status === 'bloqueado' || u.status === 'inativo') {
          limparDadosDaConta();
          setTemMercado(false);
          return;
        }
        setUsuario(u);
        return verificarMercados();
      })
      .catch(() => {
        // 401 dispara "mercadins:sessao-expirada" (api.ts); outros erros de
        // rede mantêm a sessão para não deslogar por instabilidade.
        if (!localStorage.getItem("token")) {
          setTemMercado(false);
        }
      })
      .finally(() => setCarregando(false));
  }, [verificarMercados]);

  useEffect(() => {
    const encerrar = () => {
      limparDadosDaConta();
      setUsuario(null);
      setTemMercado(false);
    };
    window.addEventListener('mercadins:sessao-expirada', encerrar);
    return () => window.removeEventListener('mercadins:sessao-expirada', encerrar);
  }, []);

  async function login(email: string, senha: string): Promise<{ usuario: Usuario; is_admin_login: boolean }> {
    const { usuario: u, token, is_admin_login } = await api.login({ email, senha });
    if (!token) throw new Error('Resposta de login inválida. Tente novamente.');
    localStorage.setItem("token", token);
    setUsuario(u);
    await verificarMercados();
    return { usuario: u, is_admin_login: is_admin_login ?? false };
  }

  function logout() {
    limparDadosDaConta();
    setUsuario(null);
    setTemMercado(false);
  }

  async function refreshUsuario() {
    try {
      const u = await api.perfil();
      if (u.status === 'bloqueado' || u.status === 'inativo') {
        logout();
        return;
      }
      setUsuario(u);
    } catch {
      // 401 já encerra a sessão via evento; outros erros são ignorados.
      if (!localStorage.getItem("token")) {
        setUsuario(null);
        setTemMercado(false);
      }
    }
  }

  return (
    <AuthContext.Provider
      value={{ usuario, carregando, temMercado, login, logout, refreshMercados: verificarMercados, refreshUsuario }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);