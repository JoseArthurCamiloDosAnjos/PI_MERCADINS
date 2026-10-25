import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import {
  IconCreditCard,
  IconClock,
  IconAlert,
  IconStore,
  IconArrowRight,
} from '../Icons';
import './TelaAssinaturas.css';

// ─────────────────────────────────────────────────────────────────────────────
//  Aba "Assinaturas" da sidebar (perfil do cliente e painel do vendedor):
//  1 cartão por assinatura, cada um com o plano, a validade da vigência
//  atual e o MERCADO VINCULADO (importante quando o usuário tem mais de uma
//  loja, já que cada uma pode ter um plano diferente). Oferece também o
//  cancelamento do plano — cancela as cobranças futuras no Asaas, mas a loja
//  fica no ar até acabar o período já pago.
//  Os dados vêm de GET /api/assinaturas/minha.
// ─────────────────────────────────────────────────────────────────────────────

interface Plano {
  codigo: string;
  nome: string;
  ciclo: string;
  valor: number;
}

interface MercadoVinculado {
  id_mercado: number;
  nome: string;
  status: string;
  suspenso_em: string | null;
}

interface Pagamento {
  id: number;
  asaas_payment_id?: string;
  valor: string;
  status: string;
  metodo?: string;
  vencimento?: string | null;
  pago_em?: string | null;
}

// Item devolvido pelo backend em `assinaturas` (um por loja/plan)
interface AssinaturaResumo {
  id: number;
  status: string;
  codigo_plano: string;
  ciclo: string;
  valor: string | number;
  plano: Plano;
  proximo_pagamento: string | null;
  validade_ate: string | null;
  dias_restantes: number | null;
  mercado: MercadoVinculado | null;
  url_pagamento: string | null;
  criada_em: string;
}

interface AssinaturaPrincipal {
  id: number;
  codigo_plano: string;
  ciclo: string;
  status: string;
  valor: string | number;
}

interface RespostaAssinatura {
  assinatura: AssinaturaPrincipal | null;
  assinaturas?: AssinaturaResumo[];
  plano?: Plano;
  validade_ate?: string | null;
  dias_restantes?: number | null;
  carencia_dias?: number;
  mercado_status?: MercadoVinculado | null;
  pagamentos?: Pagamento[];
  urlPagamento?: string | null;
}

const ROTULOS_STATUS: Record<string, { texto: string; classe: string }> = {
  ativa:        { texto: 'Ativa',                 classe: 'sa-badge-ativa' },
  pendente:     { texto: 'Aguardando pagamento',  classe: 'sa-badge-pendente' },
  inadimplente: { texto: 'Vencida',               classe: 'sa-badge-vencida' },
  cancelada:    { texto: 'Cancelada',             classe: 'sa-badge-cancelada' },
};

const ROTULOS_MERCADO: Record<string, string> = {
  ativo:     'No ar',
  suspenso:  'Suspenso',
  bloqueado: 'Bloqueado',
};

const ROTULOS_PAGAMENTO: Record<string, string> = {
  CONFIRMED: 'Confirmado',
  RECEIVED:  'Recebido',
  PENDING:   'Pendente',
  OVERDUE:   'Vencido',
  REFUNDED:  'Estornado',
  FAILED:    'Falhou',
};

// Data 'YYYY-MM-DD' sem deslocar o dia (new Date('...') vira meia-noite UTC)
function dataLocal(valor?: string | null) {
  if (!valor) return '—';
  return new Date(`${valor.slice(0, 10)}T12:00:00`).toLocaleDateString('pt-BR');
}

function dinheiro(valor?: string | number | null) {
  const n = Number(valor ?? 0);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Fallback defensivo caso o backend ainda devolva só a assinatura principal
function paraResposta(r: RespostaAssinatura): AssinaturaResumo | null {
  const p = r.assinatura;
  if (!p) return null;
  return {
    id: p.id,
    status: p.status,
    codigo_plano: p.codigo_plano,
    ciclo: p.ciclo,
    valor: p.valor,
    plano: r.plano ?? {
      codigo: p.codigo_plano,
      nome: p.codigo_plano,
      ciclo: p.ciclo,
      valor: Number(p.valor),
    },
    proximo_pagamento: null,
    validade_ate: r.validade_ate ?? null,
    dias_restantes: r.dias_restantes ?? null,
    mercado: r.mercado_status ?? null,
    url_pagamento: r.urlPagamento ?? null,
    criada_em: '',
  };
}

export default function TelaAssinaturas() {
  const navigate = useNavigate();
  const [dados, setDados] = useState<RespostaAssinatura | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [recado, setRecado] = useState<{ texto: string; ok: boolean } | null>(null);
  const [confirmando, setConfirmando] = useState<number | null>(null);
  const [cancelando, setCancelando] = useState(false);

  // O loading já começa true no useState; nada de setState síncrono aqui
  // dentro do efeito (regra react-hooks/set-state-in-effect)
  const carregar = useCallback(() => {
    api.minhaAssinatura()
      .then((r: RespostaAssinatura) => {
        setErro(false);
        setDados(r);
      })
      .catch(() => setErro(true))
      .finally(() => setCarregando(false));
  }, []);

  // Botão "tentar novamente": volta para o skeleton enquanto busca
  function recarregar() {
    setCarregando(true);
    carregar();
  }

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Cancela a assinatura selecionada e recarrega a tela em seguida
  function confirmarCancelamento() {
    if (confirmando == null) return;
    setCancelando(true);
    api.cancelarAssinatura(confirmando)
      .then(() => {
        setRecado({
          texto: 'Assinatura cancelada. Nada mais será cobrado e a loja permanece no ar até o fim do período já pago.',
          ok: true,
        });
        setConfirmando(null);
        setCarregando(true);
        carregar();
      })
      .catch((e: Error) => {
        setRecado({ texto: e.message || 'Não foi possível cancelar a assinatura.', ok: false });
      })
      .finally(() => setCancelando(false));
  }

  if (carregando) {
    return (
      <div className="sa-wrap">
        <div className="sa-skeleton" />
        <div className="sa-skeleton sa-skeleton-baixo" />
      </div>
    );
  }

  if (erro) {
    return (
      <div className="sa-wrap">
        <div className="sa-erro">
          <IconAlert size={22} />
          <p>Não foi possível carregar suas assinaturas.</p>
          <button className="sa-btn sa-btn-secundario" onClick={recarregar}>
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  const principalResumo = dados ? paraResposta(dados) : null;
  const lista: AssinaturaResumo[] = dados?.assinaturas?.length
    ? dados.assinaturas
    : principalResumo
      ? [principalResumo]
      : [];

  if (lista.length === 0) {
    return (
      <div className="sa-wrap">
        <div className="sa-vazio">
          <div className="sa-vazio-icone"><IconCreditCard size={24} /></div>
          <h2>Você ainda não tem uma assinatura</h2>
          <p>
            Escolha um plano para cadastrar seu mercado e começar a vender.
          </p>
          <button
            className="sa-btn sa-btn-primario"
            onClick={() => navigate('/planos')}
          >
            Ver planos <IconArrowRight size={15} />
          </button>
        </div>
      </div>
    );
  }

  const multiplo = lista.length > 1;
  const carencia = dados?.carencia_dias ?? 3;
  const pagamentos = dados?.pagamentos ?? [];
  const alvoCancelamento = lista.find((a) => a.id === confirmando) ?? null;

  return (
    <div className="sa-wrap">
      {recado && (
        <div className={`sa-aviso ${recado.ok ? 'sa-aviso-ok' : 'sa-aviso-erro'}`}>
          {recado.ok ? <IconStore size={16} /> : <IconAlert size={16} />}
          <span>{recado.texto}</span>
        </div>
      )}

      {multiplo && (
        <p className="sa-intro">
          Você tem {lista.length} assinaturas — cada loja com o seu próprio
          plano, validade e forma de pagamento.
        </p>
      )}

      {lista.map((a) => {
        const rotulo = ROTULOS_STATUS[a.status] ?? {
          texto: a.status,
          classe: 'sa-badge-cancelada',
        };
        const mercado = a.mercado;
        const dias = a.dias_restantes;
        const vencida = a.status === 'inadimplente' || (dias != null && dias < 0);

        return (
          <section className="sa-card" key={a.id}>
            <header className="sa-card-topo">
              <div className="sa-plano">
                <span className="sa-plano-icone"><IconCreditCard size={18} /></span>
                <div>
                  <h2 className="sa-plano-nome">Plano {a.plano.nome}</h2>
                  <p className="sa-plano-ciclo">
                    Ciclo {a.plano.ciclo === 'ANUAL' ? 'anual' : 'mensal'}
                    {' · '}{dinheiro(a.plano.valor)}
                    {a.plano.ciclo === 'ANUAL' ? '/ano' : '/mês'}
                  </p>
                </div>
              </div>
              <span className={`sa-badge ${rotulo.classe}`}>{rotulo.texto}</span>
            </header>

            {/* ── Qual loja esta assinatura cobre ─────────────────────────── */}
            <div className="sa-mercado">
              <span className="sa-mercado-icone"><IconStore size={16} /></span>
              <div className="sa-mercado-corpo">
                <p className="sa-mercado-rotulo">Mercado vinculado</p>
                <p className="sa-mercado-nome">
                  {mercado
                    ? mercado.nome
                    : a.status === 'pendente'
                      ? 'A loja é criada após a confirmação do pagamento'
                      : 'Nenhuma loja vinculada'}
                </p>
              </div>
              {mercado && (
                <span className={`sa-chip sa-chip--${mercado.status}`}>
                  {ROTULOS_MERCADO[mercado.status] ?? mercado.status}
                </span>
              )}
            </div>

            <div className="sa-validade">
              <div className="sa-validade-icone"><IconClock size={16} /></div>
              <div className="sa-validade-corpo">
                <p className="sa-validade-rotulo">
                  {a.status === 'cancelada' ? 'Válida até' : 'Prazo de validade'}
                </p>
                <p className="sa-validade-data">
                  {a.validade_ate ? dataLocal(a.validade_ate) : '—'}
                  {dias != null && a.status !== 'cancelada' && (
                    <span className={vencida ? 'sa-dias sa-dias-vencido' : 'sa-dias'}>
                      {vencida
                        ? ` · vencida há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? '' : 's'}`
                        : ` · faltam ${dias} dia${dias === 1 ? '' : 's'}`}
                    </span>
                  )}
                </p>
                <p className="sa-validade-obs">
                  {a.status === 'cancelada'
                    ? `Cancelada — ${mercado ? `o mercado ${mercado.nome}` : 'a loja'} segue no ar até essa data.`
                    : `Renove até essa data para manter ${mercado ? `o mercado ${mercado.nome}` : 'seu mercado'} no ar.`}
                  {vencida && ` Após ${carencia} dias de carência o mercado é suspenso.`}
                </p>
              </div>
            </div>

            {vencida && (
              <div className="sa-aviso sa-aviso-erro">
                <IconAlert size={16} />
                <span>
                  Assinatura vencida — regularize o pagamento para reativar
                  {mercado ? ` o mercado ${mercado.nome}` : ' seu mercado'}.
                </span>
              </div>
            )}

            {a.status === 'pendente' && (
              <div className="sa-aviso sa-aviso-pendente">
                <IconAlert size={16} />
                <span>Primeiro pagamento ainda não confirmado.</span>
              </div>
            )}

            {mercado?.status === 'suspenso' && (
              <div className="sa-aviso sa-aviso-erro">
                <IconStore size={16} />
                <span>
                  Mercado {mercado.nome} suspenso desde{' '}
                  {mercado.suspenso_em
                    ? new Date(mercado.suspenso_em).toLocaleDateString('pt-BR')
                    : '—'}
                  {' — '}fora das buscas e vitrines.
                </span>
              </div>
            )}

            <div className="sa-acoes">
              {a.url_pagamento && a.status !== 'ativa' && (
                <a
                  className="sa-btn sa-btn-primario"
                  href={a.url_pagamento}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ir para o pagamento <IconArrowRight size={15} />
                </a>
              )}

              {a.status !== 'cancelada' && (
                <button
                  className="sa-btn sa-btn-perigo"
                  onClick={() => {
                    setRecado(null);
                    setConfirmando(a.id);
                  }}
                  disabled={cancelando}
                >
                  Cancelar plano
                </button>
              )}
            </div>
          </section>
        );
      })}

      {/* ── Últimas faturas ──────────────────────────────────────────────── */}
      <section className="sa-card">
        <header className="sa-card-topo">
          <div className="sa-plano">
            <span className="sa-plano-icone"><IconClock size={18} /></span>
            <div>
              <h2 className="sa-plano-nome">Últimos pagamentos</h2>
              <p className="sa-plano-ciclo">
                {pagamentos.length > 0
                  ? `${pagamentos.length} lançamento${pagamentos.length === 1 ? '' : 's'}${multiplo ? ` · plano ${principalResumo?.plano.nome ?? ''}` : ''}`
                  : 'Nenhuma fatura até agora'}
              </p>
            </div>
          </div>
        </header>

        {pagamentos.length > 0 && (
          <ul className="sa-lista">
            {pagamentos.map((p) => {
              const confirmado = p.status === 'CONFIRMED' || p.status === 'RECEIVED';
              return (
                <li key={p.id} className="sa-item">
                  <span className={`sa-item-ponto ${confirmado ? 'ok' : 'pend'}`} />
                  <span className="sa-item-valor">{dinheiro(p.valor)}</span>
                  <span className="sa-item-status">
                    {ROTULOS_PAGAMENTO[p.status] ?? p.status}
                  </span>
                  <span className="sa-item-data">
                    {p.pago_em
                      ? dataLocal(p.pago_em)
                      : p.vencimento
                        ? `vence ${dataLocal(p.vencimento)}`
                        : '—'}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Confirmação de cancelamento ───────────────────────────────────── */}
      {alvoCancelamento && (
        <div
          className="sa-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Cancelar assinatura"
          onClick={() => !cancelando && setConfirmando(null)}
        >
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <span className="sa-modal-icone"><IconAlert size={40} /></span>
            <h3 className="sa-modal-titulo">Cancelar plano {alvoCancelamento.plano.nome}?</h3>
            <p className="sa-modal-texto">
              As próximas cobranças são canceladas e nada mais será cobrado.
              {alvoCancelamento.mercado
                ? ` O mercado ${alvoCancelamento.mercado.nome}`
                : ' A loja'}{' '}
              continua no ar até <b>{dataLocal(alvoCancelamento.validade_ate)}</b>;
              depois disso ele sai das buscas e é suspenso. Esta ação não pode
              ser desfeita.
            </p>
            <div className="sa-modal-acoes">
              <button
                className="sa-btn sa-btn-secundario"
                onClick={() => setConfirmando(null)}
                disabled={cancelando}
              >
                Manter plano
              </button>
              <button
                className="sa-btn sa-btn-perigo"
                onClick={confirmarCancelamento}
                disabled={cancelando}
              >
                {cancelando ? 'Cancelando…' : 'Sim, cancelar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
