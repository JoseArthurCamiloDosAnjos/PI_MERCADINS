//  useEnderecos — carteira de endereços de entrega do cliente

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

    guardarEnderecos([]);
  })();

  try {
    await migracaoEmAndamento;
  } catch (erro) {
    migracaoEmAndamento = null;
    throw erro;
  }
}

export function useEnderecos() {
  const { usuario } = useAuth();
  const logado = !!usuario;

  const [enderecos, setEnderecos] = useState<EnderecoSalvo[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    async function carregar() {
      let lista: EnderecoSalvo[];
      try {
        if (logado) {
          await migrarParaConta();
          lista = await naConta();
        } else {
          await Promise.resolve();
          lista = [];
        }
      } catch {
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
