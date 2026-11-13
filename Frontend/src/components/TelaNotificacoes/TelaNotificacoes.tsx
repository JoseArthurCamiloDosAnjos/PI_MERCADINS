//  Notificações por e-mail

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { IconBell, IconMail } from '../Icons';
import './TelaNotificacoes.css';

interface Notificacao {
  id: number;
  telefone?: string;
  canal: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  status: string;
  erro?: string;
  lida: boolean;
  criado_em: string;
  enviado_em?: string | null;
}

const ROTULOS_STATUS: Record<string, string> = {
  enviada: 'Enviada',
  sem_provedor: 'Aguardando envio',
  registrada: 'Registrada',
  erro: 'Falhou',
};

function formatarData(valor: string) {
  if (!valor) return '';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TelaNotificacoes() {
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [email, setEmail] = useState('');
  const [canalConfigurado, setCanalConfigurado] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [marcando, setMarcando] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await api.listarNotificacoes();
      setNotificacoes(dados.notificacoes ?? []);
      setNaoLidas(Number(dados.naoLidas ?? 0));
      setEmail(dados.email ?? '');
      setCanalConfigurado(Boolean(dados.canalConfigurado));
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : 'Não foi possível carregar as notificações.'
      );
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    let vivo = true;
    Promise.resolve().then(() => {
      if (vivo) void carregar();
    });
    return () => {
      vivo = false;
    };
  }, [carregar]);

  async function enviarTeste() {
    if (enviandoTeste) return;
    setEnviandoTeste(true);
    setAviso('');
    setErro('');
    try {
      const dados = await api.enviarNotificacaoTeste();
      setAviso(dados.mensagem || 'Aviso de teste registrado.');
      await carregar();
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : 'Não foi possível enviar o aviso de teste agora.'
      );
    } finally {
      setEnviandoTeste(false);
    }
  }

  async function marcarLida(id: number) {
    if (marcando) return;
    setErro('');
    try {
      await api.marcarNotificacaoLida(id);
      setNotificacoes((atual) =>
        atual.map((item) => (item.id === id ? { ...item, lida: true } : item))
      );
      setNaoLidas((n) => Math.max(0, n - 1));
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : 'Não foi possível marcar como lida.'
      );
    }
  }

  async function marcarTodasLidas() {
    if (marcando || naoLidas === 0) return;
    setMarcando(true);
    setErro('');
    try {
      await api.marcarNotificacoesLidas();
      setNotificacoes((atual) => atual.map((item) => ({ ...item, lida: true })));
      setNaoLidas(0);
    } catch (falha) {
      setErro(
        falha instanceof Error
          ? falha.message
          : 'Não foi possível marcar todas como lidas.'
      );
    } finally {
      setMarcando(false);
    }
  }

  return (
    <div className="notificacoes">
      <div className="notificacoes__cabecalho">
        <div className="notificacoes__icone" aria-hidden="true">
          <IconBell size={22} />
        </div>
        <div>
          <h2 className="notificacoes__titulo">Avisos por e-mail</h2>
          <p className="notificacoes__texto">
            O Mercadins usa o e-mail do seu cadastro para avisar quando algo
            importante acontece: conta criada, e-mail confirmado, loja criada e
            andamento dos pedidos.
          </p>
        </div>
      </div>

      <div className="notificacoes__resumo">
        <div>
          <span className="notificacoes__rotulo">E-mail cadastrado</span>
          <strong className="notificacoes__telefone">
            {email || 'Nenhum e-mail cadastrado'}
          </strong>
        </div>
        <div>
          <span className="notificacoes__rotulo">Canal</span>
          <strong className="notificacoes__telefone">E-mail</strong>
        </div>
        <div>
          <span className="notificacoes__rotulo">Envio automático</span>
          <strong
            className={`notificacoes__situacao ${
              canalConfigurado ? 'notificacoes__situacao--ok' : ''
            }`}
          >
            {canalConfigurado ? 'Ativado' : 'Ainda não configurado'}
          </strong>
        </div>
      </div>

      {!canalConfigurado && (
        <p className="notificacoes__explicacao">
          O envio automático de e-mail depende da chave do serviço configurada
          no servidor. Até lá, cada aviso fica guardado aqui no histórico.
        </p>
      )}

      <div className="notificacoes__acoes">
        <button
          type="button"
          className="notificacoes__btn-teste"
          onClick={enviarTeste}
          disabled={enviandoTeste || !email}
        >
          <IconMail size={15} />
          {enviandoTeste ? 'Registrando teste...' : 'Enviar aviso de teste'}
        </button>
        <button
          type="button"
          className="notificacoes__btn-atualizar"
          onClick={() => void carregar()}
          disabled={carregando}
        >
          {carregando ? 'Atualizando...' : 'Atualizar lista'}
        </button>
        {naoLidas > 0 && (
          <button
            type="button"
            className="notificacoes__btn-lidas"
            onClick={() => void marcarTodasLidas()}
            disabled={marcando}
          >
            {marcando
              ? 'Marcando...'
              : `Marcar todas como lidas (${naoLidas})`}
          </button>
        )}
      </div>

      {aviso && (
        <p className="notificacoes__aviso" role="status">
          {aviso}
        </p>
      )}
      {erro && (
        <p className="notificacoes__erro" role="alert">
          {erro}
        </p>
      )}

      <div className="notificacoes__lista">
        {carregando && notificacoes.length === 0 && (
          <p className="notificacoes__vazio">Carregando avisos...</p>
        )}

        {!carregando && notificacoes.length === 0 && (
          <p className="notificacoes__vazio">
            Nenhum aviso por enquanto. Quando você criar a conta, cadastrar um
            mercado ou fizer um pedido, o aviso aparece aqui.
          </p>
        )}

        {notificacoes.map((item) => (
          <article
            className={`notificacoes__item${
              item.lida ? '' : ' notificacoes__item--nao-lida'
            }`}
            key={item.id}
          >
            <div className="notificacoes__item-topo">
              <strong className="notificacoes__item-titulo">
                {item.titulo || 'Aviso do Mercadins'}
              </strong>
              <span
                className={`notificacoes__status notificacoes__status--${item.status}`}
              >
                {ROTULOS_STATUS[item.status] || item.status}
              </span>
            </div>
            <p className="notificacoes__item-mensagem">{item.mensagem}</p>
            <div className="notificacoes__item-rodape">
              <span>{formatarData(item.criado_em)}</span>
              <div className="notificacoes__item-acoes">
                {!item.lida && (
                  <button
                    type="button"
                    className="notificacoes__btn-lida"
                    onClick={() => void marcarLida(item.id)}
                    disabled={marcando}
                  >
                    Marcar como lida
                  </button>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
