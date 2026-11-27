import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useNavigate } from 'react-router-dom';
import { BASE_URL } from '../services/api';
import { IconMapPin, IconStore, IconNavigation } from './Icons';
import { onAvatarError } from '../utils/imagens';
import 'leaflet/dist/leaflet.css';
import './MapaProximos.css';

// ── Ícones customizados (os padrões do Leaflet quebram com bundlers) ──────────

const iconeUsuario = L.divIcon({
  className: 'mp-custom-pin mp-pin-usuario',
  html: '<div class="mp-pin-bolha mp-pin-bolha--usuario"><span></span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -16],
});

const iconeMercado = L.divIcon({
  className: 'mp-custom-pin mp-pin-mercado',
  html: '<div class="mp-pin-bolha mp-pin-bolha--mercado"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>',
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -28],
});

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface MercadoProximo {
  id_mercado: number;
  nome: string;
  slug: string;
  cidade?: string;
  estado?: string;
  bairro?: string;
  foto_perfil?: string;
  cor_base?: string;
  horario?: string | null;
  latitude: number;
  longitude: number;
  avaliacao: number;
  avaliacoes_count: number;
  distancia: number;
}

interface ResultadoBusca {
  chave: string;
  mercados: MercadoProximo[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatarDistancia(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1).replace('.', ',')} km`;
}

function chaveBusca(posicao: [number, number], raio: number) {
  return `${posicao[0].toFixed(5)},${posicao[1].toFixed(5)},${raio}`;
}

// ── Ajusta o zoom para enquadrar tudo ────────────────────────────────────────

function AjustarView({ centro, pontos }: { centro: [number, number]; pontos: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (pontos.length === 0) {
      map.setView(centro, 14);
      return;
    }
    const bounds = L.latLngBounds([centro, ...pontos]);
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
  }, [map, centro, pontos]);
  return null;
}

// ── Detecta clique no mapa para mover o ponto de partida ─────────────────────

function CliqueMapa({ onClique }: { onClique: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClique(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function MapaProximos() {
  const navigate = useNavigate();

  // O "sem localização" nasce pronto — nada de setState dentro do effect.
  const [semLocalizacao] = useState(
    () => typeof navigator === 'undefined' || !('geolocation' in navigator),
  );
  const [erroLocal, setErroLocal] = useState(() =>
    semLocalizacao ? 'Seu navegador não oferece localização. Use um CEP na busca da home.' : '',
  );
  const [posicao, setPosicao] = useState<[number, number] | null>(null);
  const [resultado, setResultado] = useState<ResultadoBusca | null>(null);
  const [erroBusca, setErroBusca] = useState('');
  const [raio, setRaio] = useState(10);
  const [mercadoSelecionado, setMercadoSelecionado] = useState<MercadoProximo | null>(null);
  const [listaAberta, setListaAberta] = useState(true);

  // ── Localização do usuário ──────────────────────────────────────────────────
  useEffect(() => {
    if (semLocalizacao) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosicao([pos.coords.latitude, pos.coords.longitude]);
        setErroLocal('');
      },
      () => setErroLocal('Permissão de localização negada. Ative a localização do navegador para ver o mapa.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
    );
  }, [semLocalizacao]);

  // ── Busca mercados próximos ────────────────────────────────────────────────
  const chave = posicao ? chaveBusca(posicao, raio) : null;

  useEffect(() => {
    if (!chave || !posicao) return;
    let cancelado = false;

    (async () => {
      try {
        const res = await fetch(
          `${BASE_URL}/api/mercados/proximos?lat=${posicao[0]}&lng=${posicao[1]}&raio=${raio}`,
        );
        if (!res.ok) throw new Error('resposta inválida');
        const data = await res.json();
        if (cancelado) return;
        setResultado({ chave, mercados: data.mercados ?? [] });
        setErroBusca('');
      } catch {
        if (!cancelado) {
          setResultado({ chave, mercados: [] });
          setErroBusca('Não foi possível carregar os mercados próximos.');
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [chave, posicao, raio]);

  const carregandoLocal = !posicao && !erroLocal;
  const carregandoBusca = !!chave && (!resultado || resultado.chave !== chave);
  const carregando = carregandoLocal || carregandoBusca;
  const erro = erroLocal || erroBusca;
  const mercados = resultado && resultado.chave === chave ? resultado.mercados : [];

  // ── Geocodifica o endereço de um mercado sem coordenadas ───────────────────
  const geocodificarEEntra = useCallback(
    async (mercado: MercadoProximo) => {
      if (mercado.latitude && mercado.longitude) {
        navigate(`/${mercado.slug}`);
        return;
      }
      try {
        const token = localStorage.getItem('token');
        await fetch(`${BASE_URL}/api/mercados/${mercado.id_mercado}/geocodificar`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // segue para a loja mesmo sem geocodificar
      }
      navigate(`/${mercado.slug}`);
    },
    [navigate],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  if (!posicao && carregandoLocal) {
    return (
      <section className="mp-shell">
        <div className="mp-loading">
          <div className="mp-spinner" />
          <p>Localizando você...</p>
        </div>
      </section>
    );
  }

  if (!posicao && erro) {
    return (
      <section className="mp-shell">
        <div className="mp-erro">
          <IconMapPin size={32} />
          <h3>Sem localização</h3>
          <p>{erro}</p>
          <button className="mp-btn-primario" onClick={() => navigate('/')}>
            Voltar ao início
          </button>
        </div>
      </section>
    );
  }

  const pontosMercados: [number, number][] = mercados
    .filter((m) => m.latitude && m.longitude)
    .map((m) => [m.latitude, m.longitude]);

  return (
    <section className="mp-shell">
      <div className="mp-topo">
        <div className="mp-topo-info">
          <h2 className="mp-titulo">
            <IconMapPin size={16} /> Mercados perto de você
          </h2>
          <p className="mp-subtitulo">
            {carregando
              ? 'Buscando mercados...'
              : `${mercados.length} mercado${mercados.length !== 1 ? 's' : ''} em até ${raio} km`}
          </p>
        </div>
        <div className="mp-controles">
          <div className="mp-raio" role="group" aria-label="Raio de busca">
            {[5, 10, 25, 50].map((r) => (
              <button
                key={r}
                className={`mp-raio-btn${raio === r ? ' ativo' : ''}`}
                onClick={() => setRaio(r)}
              >
                {r} km
              </button>
            ))}
          </div>
          <button
            className="mp-toggle-lista"
            onClick={() => setListaAberta((v) => !v)}
            aria-expanded={listaAberta}
          >
            {listaAberta ? 'Ver só mapa' : 'Ver lista'}
          </button>
        </div>
      </div>

      <div className={`mp-corpo${listaAberta ? ' mp-corpo--lista' : ''}`}>
        {/* ── Mapa ──────────────────────────────────────────────────────────── */}
        <div className="mp-mapa-wrap">
          {posicao && (
            <MapContainer center={posicao} zoom={14} className="mp-mapa" scrollWheelZoom>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <AjustarView centro={posicao} pontos={pontosMercados} />
              <CliqueMapa onClique={(lat, lng) => setPosicao([lat, lng])} />

              {/* Localização do usuário */}
              <Marker position={posicao} icon={iconeUsuario}>
                <Popup>
                  <strong>Você está aqui</strong>
                  <br />
                  Clique no mapa para mudar o ponto de partida.
                </Popup>
              </Marker>

              {/* Mercados */}
              {mercados
                .filter((m) => m.latitude && m.longitude)
                .map((m) => (
                  <Marker
                    key={m.id_mercado}
                    position={[m.latitude, m.longitude]}
                    icon={iconeMercado}
                    eventHandlers={{ click: () => setMercadoSelecionado(m) }}
                  >
                    <Popup>
                      <div className="mp-popup">
                        <strong>{m.nome}</strong>
                        <span className="mp-popup-dist">{formatarDistancia(m.distancia)} de você</span>
                        {m.cidade && (
                          <span className="mp-popup-local">
                            {m.bairro ? `${m.bairro} · ` : ''}
                            {m.cidade}
                            {m.estado ? ` - ${m.estado}` : ''}
                          </span>
                        )}
                        <button className="mp-popup-btn" onClick={() => geocodificarEEntra(m)}>
                          Ver loja
                        </button>
                      </div>
                    </Popup>
                  </Marker>
                ))}
            </MapContainer>
          )}
          {erroBusca && !carregando && <p className="mp-mapa-erro">{erroBusca}</p>}
        </div>

        {/* ── Lista lateral ─────────────────────────────────────────────────── */}
        {listaAberta && (
          <aside className="mp-lista" aria-label="Mercados próximos">
            <div className="mp-lista-topo">
              <IconStore size={15} />
              <span>Mercados próximos</span>
            </div>

            {carregando ? (
              <div className="mp-lista-vazio">
                <div className="mp-spinner mp-spinner--pequeno" />
                <p>Procurando mercados...</p>
              </div>
            ) : mercados.length === 0 ? (
              <div className="mp-lista-vazio">
                <IconStore size={28} />
                <p>Nenhum mercado nesta região</p>
                <span>Tente aumentar o raio de busca.</span>
              </div>
            ) : (
              <ul className="mp-lista-itens">
                {mercados.map((m) => (
                  <li key={m.id_mercado}>
                    <button
                      className={`mp-item${mercadoSelecionado?.id_mercado === m.id_mercado ? ' ativo' : ''}`}
                      onClick={() => setMercadoSelecionado(m)}
                      onDoubleClick={() => geocodificarEEntra(m)}
                    >
                      <span
                        className="mp-item-foto"
                        style={m.cor_base ? { background: m.cor_base } : undefined}
                      >
                        {m.foto_perfil ? <img src={m.foto_perfil} alt="" onError={onAvatarError} /> : <IconStore size={16} />}
                      </span>
                      <span className="mp-item-info">
                        <strong>{m.nome}</strong>
                        <small>
                          {m.bairro ? `${m.bairro} · ` : ''}
                          {m.cidade ?? ''}
                        </small>
                        <small className="mp-item-meta">
                          {m.avaliacao > 0 && (
                            <span className="mp-item-nota">★ {m.avaliacao.toFixed(1)}</span>
                          )}
                          <span>{formatarDistancia(m.distancia)}</span>
                        </small>
                      </span>
                      <IconNavigation size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        )}
      </div>

      {mercadoSelecionado && (
        <div className="mp-cta">
          <span>
            <strong>{mercadoSelecionado.nome}</strong>
            {' · '}
            {formatarDistancia(mercadoSelecionado.distancia)}
          </span>
          <button className="mp-btn-primario" onClick={() => geocodificarEEntra(mercadoSelecionado)}>
            Acessar loja
          </button>
        </div>
      )}
    </section>
  );
}
