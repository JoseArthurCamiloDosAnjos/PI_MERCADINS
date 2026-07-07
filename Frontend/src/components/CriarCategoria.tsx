import { useState } from 'react';
import type { ChangeEvent } from 'react';
import './CriarCategoria.css';

interface CriarCategoriaProps {
  salvando?: boolean;
  onSalvar: (nome: string) => void;
  onCancelar: () => void;
}

export default function CriarCategoria({
  salvando = false,
  onSalvar,
  onCancelar,
}: CriarCategoriaProps) {
  const [nome, setNome] = useState('');
  const [erro, setErro] = useState('');

  function handleSalvar() {
    if (!nome.trim()) { setErro('Informe o nome da categoria.'); return; }
    onSalvar(nome.trim());
  }

  return (
    <div className="cc-overlay" role="dialog" aria-modal="true" aria-label="Nova categoria">
      <div className="cc-modal">

        <div className="cc-header">
          <h2 className="cc-titulo">Nova categoria</h2>
          <button className="cc-btn-fechar" onClick={onCancelar} disabled={salvando} aria-label="Fechar">✕</button>
        </div>

        <div className="cc-body">
          <div className="cc-campo">
            <label htmlFor="cc-nome" className="cc-label">Nome da categoria</label>
            <input
              id="cc-nome"
              type="text"
              className={`cc-input ${erro ? 'cc-input--erro' : ''}`}
              value={nome}
              maxLength={100}
              placeholder="Ex: Laticínios, Bebidas, Hortifruti…"
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                setNome(e.target.value);
                setErro('');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleSalvar()}
              autoFocus
            />
            {erro && <span className="cc-erro">{erro}</span>}
          </div>
        </div>

        <div className="cc-footer">
          <button className="cc-btn cc-btn--secundario" onClick={onCancelar} disabled={salvando}>
            Cancelar
          </button>
          <button
            className={`cc-btn cc-btn--primario ${salvando ? 'cc-btn--carregando' : ''}`}
            onClick={handleSalvar}
            disabled={salvando}
          >
            {salvando ? 'Criando…' : 'Criar categoria'}
          </button>
        </div>

      </div>
    </div>
  );
}