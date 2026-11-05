// ─────────────────────────────────────────────────────────────────────────────
//  Notificações por telefone
//
//  Mostra o histórico dos avisos que o Mercadins mandou (ou registrou) para o
//  telefone cadastrado: cadastro concluído, e-mail confirmado, mercado criado,
//  pedido recebido, saiu para entrega, entregue, cancelado...
//
//  Enquanto o serviço de WhatsApp/SMS não estiver contratado, cada aviso fica
//  com o botão "Abrir no WhatsApp": a mensagem já vai escrita e a pessoa só
//  escolhe o contato. Nada se perde.
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from 'react';
import { api } from '../../services/api';
import { IconBell, IconPhone } from '../Icons';
import './TelaNotificacoes.css';

interface Notificacao {
  id: number;
  telefone: string;
  canal: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  status: string;
  erro?: string;
  criado_em: string;
  enviado_em?: string | null;
  linkWhatsApp?: string;
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
  const [telefone, setTelefone] = useState('');
  const [canalConfigurado, setCanalConfigurado] = useState(false);
  const [canal, setCanal] = useState('whatsapp');
  const [carregando, setCarregando] = useState(true);
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [aviso, setAviso] = useState('');
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const dados = await api.listarNotificacoes();
      setNotificacoes(dados.notificacoes ?? []);
      setTelefone(dados.telefone ?? '');
      setCanalConfigurado(Boolean(dados.canalConfigurado));
      setCanal(dados.canal ?? 'whatsapp');
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
    // Adia um tique para o carregamento não disparar setState no corpo do
    // efeito (evita renderização em cascata).
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

  return (
    <div className="notificacoes">
      <div className="notificacoes__cabecalho">
        <div className="notificacoes__icone" aria-hidden="true">
          <IconBell size={22} />
        </div>
        <div>
          <h2 className="notificacoes__titulo">Avisos no seu telefone</h2>
          <p className="notificacoes__texto">
            O Mercadins usa o telefone do seu cadastro para avisar quando algo
            importante acontece: conta criada, e-mail confirmado, mercado
            aprovado e andamento dos pedidos.
          </p>
        </div>
      </div>

      <div className="notificacoes__resumo">
        <div>
          <span className="notificacoes__rotulo">Telefone cadastrado</span>
          <strong className="notificacoes__telefone">
            {telefone || 'Nenhum telefone cadastrado'}
          </strong>
        </div>
        <div>
          <span className="notificacoes__rotulo">Canal</span>
          <strong className="notificacoes__telefone">
            {canal === 'sms' ? 'SMS' : 'WhatsApp'}
          </strong>
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
          O envio automático depende de um serviço de WhatsApp ou SMS
          contratado. Até lá, cada aviso fica guardado aqui e pode ser aberto no
          WhatsApp com a mensagem pronta — nada é perdido.
        </p>
      )}

      <div className="notificacoes__acoes">
        <button
          type="button"
          className="notificacoes__btn-teste"
          onClick={enviarTeste}
          disabled={enviandoTeste || !telefone}
        >
          <IconPhone size={15} />
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
          <article className="notificacoes__item" key={item.id}>
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
              {item.linkWhatsApp && (
                <a
                  className="notificacoes__link"
                  href={item.linkWhatsApp}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir no WhatsApp
                </a>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
