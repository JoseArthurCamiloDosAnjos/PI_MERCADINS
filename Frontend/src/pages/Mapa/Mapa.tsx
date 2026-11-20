import MapaProximos from '../../components/MapaProximos';
import { IconMapPin } from '../../components/Icons';
import LogoTopbar from '../../components/LogoTopbar';
import './Mapa.css';

//  Página pública "/mapa": sua localização e os mercados próximos.
//  Entra pela home (botão "Usar minha localização") ou direto pela URL.

export default function Mapa() {
  return (
    <div className="mapa-page">
      <div className="mapa-topbar">
        <LogoTopbar />
        <div className="mapa-titulo">
          <h1>
            <IconMapPin size={15} /> Mercados perto de você
          </h1>
          <p>Sua localização e as lojas da região em um só mapa</p>
        </div>
      </div>

      <main className="mapa-conteudo">
        <MapaProximos />
      </main>
    </div>
  );
}
