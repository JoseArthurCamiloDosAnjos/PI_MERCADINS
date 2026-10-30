// ─────────────────────────────────────────────────────────────────────────────
//  EnderecoPopup — janela para cadastrar um endereço de entrega
//
//  Usada em dois lugares:
//   • no carrinho, quando a pessoa escolhe receber em casa;
//   • no perfil, em "Endereços de entrega".
//
//  Os campos são os mesmos do pedido: Rua, Número, Bairro, CEP, Cidade e
//  Complemento (opcional). O CEP recebe a máscara sozinho e, assim que os 8
//  dígitos ficam completos, puxa rua, bairro e cidade sozinho (ViaCEP) —
//  sobra só número e complemento. Nada é salvo com campo obrigatório em falta.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type EnderecoEntrega,
  type CampoEndereco,
  NOMES_CAMPOS_ENDERECO,
  camposEnderecoFaltando,
  mascaraCep,
} from "../../utils/endereco";
import { buscarCep, digitosCep } from "../../utils/cep";
import "./EnderecoPopup.css";

// Um campo do endereço (rua, número, bairro, CEP, cidade, complemento)
function CampoEndereco({
  id,
  label,
  campo,
  valor,
  placeholder,
  maxLength = 80,
  inputMode,
  autoComplete,
  comErro,
  onMudar,
}: {
  id: string;
  label: string;
  campo: CampoEndereco | "complemento";
  valor: string;
  placeholder?: string;
  maxLength?: number;
  inputMode?: "text" | "numeric";
  autoComplete?: string;
  comErro?: boolean;
  onMudar: (valor: string) => void;
}) {
  return (
    <div className={`endereco-campo endereco-campo--${campo}${comErro ? " is-erro" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={valor}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        autoComplete={autoComplete}
        onChange={(e) => onMudar(e.target.value)}
      />
    </div>
  );
}

export interface EnderecoPopupProps {
  aberto: boolean;
  /** Endereço que já existe (quando quiser editar) — vazio para cadastrar novo */
  enderecoInicial?: EnderecoEntrega;
  titulo?: string;
  /** true enquanto o servidor grava (deixa o botão parado) */
  salvando?: boolean;
  /** Erro vindo do servidor (ex.: rede fora do ar) */
  erro?: string | null;
  onFechar: () => void;
  onSalvar: (endereco: EnderecoEntrega) => void;
}

export default function EnderecoPopup({
  aberto,
  enderecoInicial,
  titulo = "Adicionar endereço de entrega",
  salvando = false,
  erro = null,
  onFechar,
  onSalvar,
}: EnderecoPopupProps) {
  const [endereco, setEndereco] = useState<EnderecoEntrega>(
    enderecoInicial ?? {
      cep: "",
      rua: "",
      numero: "",
      bairro: "",
      complemento: "",
      cidade: "",
    }
  );
  // Só destaca os campos em vermelho depois que a pessoa tenta salvar
  const [tentouSalvar, setTentouSalvar] = useState(false);
  // Aviso do preenchimento automático (buscando, preenchido ou CEP sem achado)
  const [avisoCep, setAvisoCep] = useState<string | null>(null);
  // CEP que já foi consultado — evita buscar a mesma coisa duas vezes
  const ultimoCepBuscado = useRef<string | null>(
    digitosCep(enderecoInicial?.cep ?? "") || null
  );
  // Guarda se rua/bairro/cidade vieram do ViaCEP (aí o apagar o CEP apaga eles
  // junto). Digitado à mão, continua na tela.
  const veioDoCep = useRef(false);

  // Com os 8 dígitos do CEP completos, a ViaCEP devolve rua, bairro e cidade
  // na hora. Número e complemento continuam com o que a pessoa digitar.
  useEffect(() => {
    const digitos = digitosCep(endereco.cep);

    if (digitos.length !== 8) {
      ultimoCepBuscado.current = null;
      // o aviso só muda depois desta tecla, nunca dentro do efeito na hora
      Promise.resolve().then(() => setAvisoCep(null));
      return;
    }
    if (digitos === ultimoCepBuscado.current) return;
    ultimoCepBuscado.current = digitos;

    let vivo = true;
    Promise.resolve().then(() => {
      if (vivo) setAvisoCep("Buscando endereço pelo CEP...");
    });

    buscarCep(endereco.cep).then((dados) => {
      if (!vivo) return;
      if (!dados) {
        setAvisoCep("CEP não encontrado. Preencha os campos manualmente.");
        return;
      }
      setEndereco((atual) => ({
        ...atual,
        rua: dados.rua || atual.rua,
        bairro: dados.bairro || atual.bairro,
        cidade: dados.cidade || atual.cidade,
      }));
      veioDoCep.current = true;
      setAvisoCep("Endereço preenchido pelo CEP.");
    });

    return () => {
      vivo = false;
    };
  }, [endereco.cep]);

  const faltando = camposEnderecoFaltando(endereco);
  const camposComErro = new Set<CampoEndereco>(tentouSalvar ? faltando : []);

  const mudarCampo = (campo: keyof EnderecoEntrega, valor: string) => {
    const novo: EnderecoEntrega = { ...endereco };
    if (campo === "cep") {
      novo.cep = mascaraCep(valor);
      // Apagou o CEP? O que ele trouxe junto também sai (prático e evita
      // endereço com CEP em branco e rua antiga)
      if (valor === "" && veioDoCep.current) {
        veioDoCep.current = false;
        novo.rua = "";
        novo.bairro = "";
        novo.cidade = "";
        setAvisoCep(null);
      }
      setEndereco(novo);
      return;
    }
    novo[campo] = valor;
    setEndereco(novo);
  };

  const tentarSalvar = () => {
    if (faltando.length > 0) {
      setTentouSalvar(true);
      return;
    }
    if (salvando) return;
    onSalvar(endereco);
  };

  if (!aberto) return null;

  const nomesFaltando = faltando.map((campo) => NOMES_CAMPOS_ENDERECO[campo]);

  // Enviado para o <body>: assim o pop-up fica centralizado na tela mesmo
  // dentro de páginas que usam transformação/efeitos no container
  return createPortal(
    <>
      <div className="endereco-popup__backdrop" onClick={onFechar} />
      <div
        className="endereco-popup"
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="endereco-popup__header">
          <h3 className="endereco-popup__titulo">{titulo}</h3>
          <button
            type="button"
            className="endereco-popup__fechar"
            onClick={onFechar}
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <div className="endereco-popup__body">
          <div className="endereco-grid">
            <CampoEndereco
              id="popup-endereco-rua"
              label="Rua"
              campo="rua"
              valor={endereco.rua}
              placeholder="Ex.: Rua das Flores"
              autoComplete="address-line1"
              comErro={camposComErro.has("rua")}
              onMudar={(valor) => mudarCampo("rua", valor)}
            />
            <CampoEndereco
              id="popup-endereco-numero"
              label="Número"
              campo="numero"
              valor={endereco.numero}
              placeholder="Ex.: 123"
              maxLength={10}
              inputMode="numeric"
              comErro={camposComErro.has("numero")}
              onMudar={(valor) => mudarCampo("numero", valor)}
            />
            <CampoEndereco
              id="popup-endereco-bairro"
              label="Bairro"
              campo="bairro"
              valor={endereco.bairro}
              placeholder="Ex.: Centro"
              comErro={camposComErro.has("bairro")}
              onMudar={(valor) => mudarCampo("bairro", valor)}
            />
            <CampoEndereco
              id="popup-endereco-cep"
              label="CEP"
              campo="cep"
              valor={endereco.cep}
              placeholder="00000-000"
              maxLength={9}
              inputMode="numeric"
              autoComplete="postal-code"
              comErro={camposComErro.has("cep")}
              onMudar={(valor) => mudarCampo("cep", valor)}
            />
            <CampoEndereco
              id="popup-endereco-cidade"
              label="Cidade"
              campo="cidade"
              valor={endereco.cidade}
              placeholder="Ex.: Taquaritinga"
              autoComplete="address-level2"
              comErro={camposComErro.has("cidade")}
              onMudar={(valor) => mudarCampo("cidade", valor)}
            />
            <CampoEndereco
              id="popup-endereco-complemento"
              label="Complemento (opcional)"
              campo="complemento"
              valor={endereco.complemento}
              placeholder="Apto, bloco, referência…"
              onMudar={(valor) => mudarCampo("complemento", valor)}
            />
          </div>

          {avisoCep && (
            <p className="endereco-popup__dica" role="status">
              {avisoCep}
            </p>
          )}

          {tentouSalvar && faltando.length > 0 && (
            <p className="endereco-popup__erro" role="alert">
              Preencha: {nomesFaltando.join(", ")}.
            </p>
          )}

          {erro && (
            <p className="endereco-popup__erro" role="alert">
              {erro}
            </p>
          )}
        </div>

        <div className="endereco-popup__footer">
          <button type="button" className="endereco-popup__btn-cancelar" onClick={onFechar}>
            Cancelar
          </button>
          <button
            type="button"
            className="endereco-popup__btn-salvar"
            onClick={tentarSalvar}
            disabled={salvando}
          >
            {salvando ? "Salvando..." : "Salvar endereço"}
          </button>
        </div>
      </div>
    </>,
    document.body
  );
}
