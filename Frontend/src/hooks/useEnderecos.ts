// ─────────────────────────────────────────────────────────────────────────────
//  useEnderecos — carteira de endereços de entrega do cliente
//
//  • Cliente logado: os endereços moram na conta (banco) e aparecem em
//    qualquer aparelho — é a única fonte oficial;
//  • Sem login: não existe endereço. Nada é guardado no aparelho e nada é
//    mostrado — a tela do carrinho leva a pessoa para o login antes de
//    preencher qualquer campo;
//  • O que estava guardado só no navegador (versão antiga) continua sendo
//    enviado para a conta assim que ele entrar (migração única);
//  • Servidor fora do ar: a tela avisa, sem inventar endereço.
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

  const [enderecos, setEnderecos] = useState<EnderecoSalvo[]>([]);
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
          // Deslogado não tem endereço para mostrar — nem para guardar
          lista = [];
        }
      } catch {
        // Servidor fora do ar: avisa sem mostrar endereço de ninguém
        lista = [];
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

  /** Cadastra um endereço novo e devolve ele já com o id (só da conta) */
  const adicionar = useCallback(
    async (novo: EnderecoEntrega): Promise<EnderecoSalvo> => {
      if (!logado) throw new Error('Entre na sua conta para salvar o endereço.');
      const resposta = await api.criarEndereco(novo);
      const salvo = daConta(resposta?.endereco);
      setEnderecos((atual) => [...atual, salvo]);
      return salvo;
    },
    [logado]
  );

  /** Edita os dados de um endereço já cadastrado na conta */
  const editar = useCallback(
    async (id: string, dados: EnderecoEntrega): Promise<EnderecoSalvo> => {
      if (!logado) throw new Error('Entre na sua conta para editar o endereço.');
      const resposta = await api.atualizarEndereco(id, dados);
      const atualizado = daConta(resposta?.endereco);
      setEnderecos((atual) => atual.map((e) => (e.id === id ? atualizado : e)));
      return atualizado;
    },
    [logado]
  );

  /** Define qual endereço é o principal da conta (o que vem marcado no carrinho) */
  const definirPrincipal = useCallback(
    async (id: string): Promise<void> => {
      if (!logado) throw new Error('Entre na sua conta para definir o endereço principal.');
      const resposta = await api.definirEnderecoPrincipal(id);
      if (Array.isArray(resposta?.enderecos)) {
        setEnderecos(resposta.enderecos.map(daConta));
      }
    },
    [logado]
  );

  /** Apaga um endereço da conta */
  const remover = useCallback(
    async (id: string): Promise<void> => {
      if (!logado) return;
      await api.removerEndereco(id);
      setEnderecos((atual) => atual.filter((e) => e.id !== id));
    },
    [logado]
  );

  return { enderecos, carregando, logado, adicionar, editar, remover, definirPrincipal };
}
