// ─────────────────────────────────────────────────────────────────────────────
//  useEnderecos — carteira de endereços de entrega do cliente
//
//  • Cliente logado: os endereços moram na conta (banco) e aparecem em
//    qualquer aparelho — é a fonte oficial;
//  • Sem login: ficam guardados só neste navegador, e o que estava aqui é
//    enviado para a conta assim que ele entrar (migração única);
//  • Servidor fora do ar: a tela continua com o que há no navegador.
//
//  Usado na tela do carrinho (escolher onde receber) e no perfil
//    (cadastrar, editar, apagar e escolher o endereço principal).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  type EnderecoEntrega,
  type EnderecoSalvo,
  ENDERECO_VAZIO,
  camposEnderecoFaltando,
  carregarEnderecos,
  guardarEnderecos,
  gerarIdEndereco,
} from '../utils/endereco';

/** Converte uma linha do banco no formato usado pela tela */
function daConta(linha: unknown): EnderecoSalvo {
  const e = (linha ?? {}) as Partial<EnderecoSalvo>;
  return {
    id: String(e.id ?? ''),
    cep: e.cep ?? '',
    rua: e.rua ?? '',
    numero: e.numero ?? '',
    bairro: e.bairro ?? '',
    cidade: e.cidade ?? '',
    complemento: e.complemento ?? '',
    principal: e.principal === true,
  };
}

/**
 * Endereços guardados neste navegador. Serve de base para quem ainda não
 * logou e também recupera o endereço antigo, que era gravado em uma chave
 * única (mercadins_endereco_entrega).
 */
function noNavegador(): EnderecoSalvo[] {
  const salvos = carregarEnderecos();
  if (salvos.length > 0) return salvos;

  try {
    const bruto = localStorage.getItem('mercadins_endereco_entrega');
    if (!bruto) return [];
    const dados: unknown = JSON.parse(bruto);
    const antigo = {
      ...ENDERECO_VAZIO,
      ...(dados && typeof dados === 'object' ? (dados as Partial<EnderecoEntrega>) : {}),
    };
    // Endereço incompleto não vale a pena copiar
    if (camposEnderecoFaltando(antigo).length > 0) return [];

    const primeiro: EnderecoSalvo = { ...antigo, id: gerarIdEndereco() };
    guardarEnderecos([primeiro]);
    return [primeiro];
  } catch {
    return [];
  }
}

/** Endereços que já estão na conta do cliente */
async function naConta(): Promise<EnderecoSalvo[]> {
  const resposta = await api.listarEnderecos();
  const linhas = Array.isArray(resposta?.enderecos) ? resposta.enderecos : [];
  return linhas.map(daConta);
}

/** Texto que identifica um endereço (para não cadastrar o mesmo duas vezes) */
function chaveDe(endereco: EnderecoEntrega): string {
  return `${endereco.cep}|${endereco.rua}|${endereco.numero}`.toLowerCase();
}

/**
 * Migração única: o que estava guardado só no navegador passa a morar na
 * conta. Endereços já existentes são pulados (evita duplicar) e a promessa
 * fica guardada, para o React não enviar tudo duas vezes quando monta o
 * componente em duplicidade (modo estrito de desenvolvimento).
 */
let migracaoEmAndamento: Promise<void> | null = null;

async function migrarParaConta(): Promise<void> {
  if (migracaoEmAndamento) return migracaoEmAndamento;

  migracaoEmAndamento = (async () => {
    const locais = noNavegador();
    if (locais.length === 0) return;

    const jaTem = await naConta();
    const existentes = new Set(jaTem.map(chaveDe));

    for (const endereco of locais) {
      if (existentes.has(chaveDe(endereco))) continue;
      await api.criarEndereco({
        cep: endereco.cep,
        rua: endereco.rua,
        numero: endereco.numero,
        bairro: endereco.bairro,
        cidade: endereco.cidade,
        complemento: endereco.complemento,
      });
    }

    // Depois de levar para a conta, o navegador não precisa mais guardar
    guardarEnderecos([]);
  })();

  try {
    await migracaoEmAndamento;
  } catch (erro) {
    // Falhou? Deixa a próxima tela tentar de novo
    migracaoEmAndamento = null;
    throw erro;
  }
}

export function useEnderecos() {
  const { usuario } = useAuth();
  const logado = !!usuario;

  const [enderecos, setEnderecos] = useState<EnderecoSalvo[]>(() => noNavegador());
  const [carregando, setCarregando] = useState(true);

  // Carrega quando a tela abre e de novo se o cliente entrar/sair da conta
  useEffect(() => {
    let ativo = true;

    async function carregar() {
      let lista: EnderecoSalvo[];
      try {
        if (logado) {
          await migrarParaConta();
          lista = await naConta();
        } else {
          await Promise.resolve(); // mantém tudo fora do caminho síncrono
          lista = noNavegador();
        }
      } catch {
        // Servidor fora do ar: segue com o que existe no navegador
        lista = noNavegador();
      }

      if (!ativo) return;
      setEnderecos(lista);
      setCarregando(false);
    }

    carregar();
    return () => {
      ativo = false;
    };
  }, [logado]);

  /** Cadastra um endereço novo e devolve ele já com o id */
  const adicionar = useCallback(
    async (novo: EnderecoEntrega): Promise<EnderecoSalvo> => {
      if (logado) {
        const resposta = await api.criarEndereco(novo);
        const salvo = daConta(resposta?.endereco);
        setEnderecos((atual) => [...atual, salvo]);
        return salvo;
      }

      // O primeiro endereço do navegador também nasce como principal
      const salvo: EnderecoSalvo = {
        ...novo,
        id: gerarIdEndereco(),
        principal: enderecos.length === 0,
      };
      const lista = [...enderecos, salvo];
      guardarEnderecos(lista);
      setEnderecos(lista);
      return salvo;
    },
    [logado, enderecos]
  );

  /** Edita os dados de um endereço já cadastrado */
  const editar = useCallback(
    async (id: string, dados: EnderecoEntrega): Promise<EnderecoSalvo> => {
      if (logado) {
        const resposta = await api.atualizarEndereco(id, dados);
        const atualizado = daConta(resposta?.endereco);
        setEnderecos((atual) => atual.map((e) => (e.id === id ? atualizado : e)));
        return atualizado;
      }

      const antigo = enderecos.find((e) => e.id === id);
      const atualizado: EnderecoSalvo = { ...dados, id, principal: antigo?.principal };
      const lista = enderecos.map((e) => (e.id === id ? atualizado : e));
      guardarEnderecos(lista);
      setEnderecos(lista);
      return atualizado;
    },
    [logado, enderecos]
  );

  /** Define qual endereço é o principal da conta (o que vem marcado no carrinho) */
  const definirPrincipal = useCallback(
    async (id: string): Promise<void> => {
      if (logado) {
        const resposta = await api.definirEnderecoPrincipal(id);
        if (Array.isArray(resposta?.enderecos)) {
          setEnderecos(resposta.enderecos.map(daConta));
          return;
        }
      }

      const lista = enderecos.map((e) => ({ ...e, principal: e.id === id }));
      guardarEnderecos(lista);
      setEnderecos(lista);
    },
    [logado, enderecos]
  );

  /** Apaga um endereço (da conta ou do navegador) */
  const remover = useCallback(
    async (id: string): Promise<void> => {
      if (logado) {
        await api.removerEndereco(id);
      } else {
        guardarEnderecos(enderecos.filter((e) => e.id !== id));
      }
      setEnderecos((atual) => atual.filter((e) => e.id !== id));
    },
    [logado, enderecos]
  );

  return { enderecos, carregando, logado, adicionar, editar, remover, definirPrincipal };
}
