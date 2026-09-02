import { useState, useRef} from 'react';
import type{DragEvent, ChangeEvent } from 'react';
import { removeEmojis } from '../hooks/useBlockEmojis';
import { supabase } from '../services/supabase';
import './CadastroProduto.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImagemItem { 
  url: string;
  file: File | null;
  uploading?: boolean;
  progress?: number;
}

interface ProdutoForm {
  nome: string;
  descricao: string;
  preco: string;
  imagens: string[];
  files: File[];
  categoriaId: number;
  estoque: number;
}

interface Erros {
  nome?: string;
  descricao?: string;
  preco?: string;
}

interface CadastroProdutoProps {
  categoriaId: number;
  salvando?: boolean;
  produto?: { id_produto: number; nome: string; descricao?: string; preco?: string; imagem?: string; imagens?: string[]; estoque?: number };
  onSalvar: (produto: ProdutoForm) => void;
  onCancelar: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CadastroProduto({
  categoriaId,
  salvando = false,
  produto,
  onSalvar,
  onCancelar,
}: CadastroProdutoProps) {
  const [nome, setNome]               = useState(produto?.nome ?? '');
  const [descricao, setDescricao]     = useState(produto?.descricao ?? '');
  const [preco, setPreco]             = useState(() => {
    if (!produto?.preco) return '';
    const valor = Number(produto.preco);
    if (Number.isNaN(valor)) return '';
    return valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  });
  const [imagens, setImagens]         = useState<ImagemItem[]>(() => {
    if (produto?.imagens && produto.imagens.length > 0) {
      return produto.imagens.map(url => ({ url, file: null as unknown as File }));
    }
    if (produto?.imagem) {
      return [{ url: produto.imagem, file: null as unknown as File }];
    }
    return [];
  });
  const [estoque, setEstoque]         = useState(produto?.estoque ?? 0);
  const [slideAtual, setSlideAtual]   = useState(0);
  const [erros, setErros]             = useState<Erros>({});
  const [arrastando, setArrastando]   = useState(false);
  const [enviando, setEnviando]       = useState(false);

  const inputFileRef = useRef<HTMLInputElement>(null);
  const editando = !!produto;

  // ── Upload ──────────────────────────────────────────────────────────────────

  async function uploadParaSupabase(file: File): Promise<string | null> {
    const ext = file.name.split('.').pop() || 'png';
    const nomeArquivo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const caminho = `produtos/${nomeArquivo}`;

    const { error } = await supabase.storage
      .from('imagens')
      .upload(caminho, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Erro ao enviar imagem:', error);
      return null;
    }

    const { data } = supabase.storage
      .from('imagens')
      .getPublicUrl(caminho);

    return data.publicUrl;
  }

  function lerArquivos(files: FileList | null) {
    if (!files) return;
    const permitidos = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!permitidos.length) return;

    permitidos.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e: ProgressEvent<FileReader>) => {
        const url = e.target?.result;
        if (typeof url !== 'string') return;
        setImagens(prev => {
          const novas = [...prev, { url, file, uploading: false, progress: 0 }];
          setSlideAtual(novas.length - 1);
          return novas;
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function removerImagem(idx: number) {
    setImagens(prev => {
      const novas = prev.filter((_, i) => i !== idx);
      setSlideAtual(s => Math.min(s, Math.max(0, novas.length - 1)));
      return novas;
    });
  }

  function slide(dir: 'prev' | 'next') {
    setSlideAtual(prev =>
      dir === 'prev'
        ? (prev - 1 + imagens.length) % imagens.length
        : (prev + 1) % imagens.length
    );
  }

  // ── Drag-and-drop ───────────────────────────────────────────────────────────

  function handleDragOver(e: DragEvent<HTMLDivElement>)  { e.preventDefault(); setArrastando(true); }
  function handleDragLeave()                              { setArrastando(false); }
  function handleDrop(e: DragEvent<HTMLDivElement>)      { e.preventDefault(); setArrastando(false); lerArquivos(e.dataTransfer.files); }

  // ── Preço ───────────────────────────────────────────────────────────────────

  function formatarPreco(valor: string) {
    let apenasNumeros = valor.replace(/\D/g, '');

    if (apenasNumeros.length === 0) {
      setPreco('');
      return;
    }

    if (apenasNumeros.length > 1 && apenasNumeros[0] === '0') {
      apenasNumeros = apenasNumeros.replace(/^0+/, '');
    }

    if (apenasNumeros.length > 7) {
      apenasNumeros = apenasNumeros.slice(0, 7);
    }

    if (apenasNumeros.length <= 2) {
      if (apenasNumeros.length === 1) {
        setPreco(`0,0${apenasNumeros}`);
      } else {
        setPreco(`0,${apenasNumeros}`);
      }
    } else {
      const parteInteira = apenasNumeros.slice(0, -2);
      const parteDecimal = apenasNumeros.slice(-2);
      setPreco(`${Number(parteInteira).toLocaleString('pt-BR')},${parteDecimal}`);
    }
  }

  // ── Validação ───────────────────────────────────────────────────────────────

  function validar(): boolean {
    const e: Erros = {};
    if (!nome.trim())      e.nome      = 'Informe o nome do produto.';
    if (!descricao.trim()) e.descricao = 'Informe a descrição.';
    if (!preco.trim())     e.preco     = 'Informe o preço.';
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function handleSalvar() {
    if (!validar()) return;

    setEnviando(true);

    try {
      const urlsSupabase: string[] = [];

      for (let i = 0; i < imagens.length; i++) {
        const img = imagens[i];
        if (img.file) {
          setImagens(prev => prev.map((item, idx) =>
            idx === i ? { ...item, uploading: true } : item
          ));

          const url = await uploadParaSupabase(img.file);
          if (url) {
            urlsSupabase.push(url);
          }

          setImagens(prev => prev.map((item, idx) =>
            idx === i ? { ...item, uploading: false, progress: 100 } : item
          ));
        } else {
          urlsSupabase.push(img.url);
        }
      }

      onSalvar({
        nome,
        descricao,
        preco,
        imagens: urlsSupabase,
        files: [],
        categoriaId,
        estoque,
      });
    } catch (error) {
      console.error('Erro ao salvar:', error);
    } finally {
      setEnviando(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="cp-overlay" role="dialog" aria-modal="true" aria-label="Cadastrar produto">
      <div className="cp-modal">

        {/* Header */}
        <div className="cp-header">
          <h2 className="cp-titulo">{editando ? 'Editar produto' : 'Novo produto'}</h2>
          <button
            className="cp-btn-fechar"
            onClick={onCancelar}
            disabled={salvando}
            aria-label="Fechar"
          >✕</button>
        </div>

        <div className="cp-body">

          {/* ── Upload / Carrocel ─────────────────────────────────────── */}
          <section className="cp-secao">
            <label className="cp-label">Imagens do produto</label>

            <div
              className={`cp-upload-area ${arrastando ? 'cp-upload-area--arrastando' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => inputFileRef.current?.click()}
            >
              <input
                ref={inputFileRef}
                type="file"
                accept="image/*"
                multiple
                className="cp-input-file"
                onChange={(e: ChangeEvent<HTMLInputElement>) => lerArquivos(e.target.files)}
              />
              <span className="cp-upload-icon">⬆</span>
              <span className="cp-upload-texto">
                Arraste imagens aqui ou <strong>clique para selecionar</strong>
              </span>
              <span className="cp-upload-hint">PNG, JPG, WEBP — múltiplos arquivos permitidos</span>
            </div>

            {imagens.length > 0 && (
              <div className="cp-carrocel">
                <div className="cp-carrocel-tela">
                  <img
                    src={imagens[slideAtual].url}
                    alt={`Imagem ${slideAtual + 1}`}
                    className="cp-carrocel-img"
                  />

                  <button
                    className="cp-carrocel-remover"
                    onClick={() => removerImagem(slideAtual)}
                    aria-label="Remover imagem"
                  >✕</button>

                  {imagens.length > 1 && (
                    <>
                      <button
                        className="cp-carrocel-seta cp-carrocel-seta--prev"
                        onClick={() => slide('prev')}
                        aria-label="Imagem anterior"
                      >‹</button>
                      <button
                        className="cp-carrocel-seta cp-carrocel-seta--next"
                        onClick={() => slide('next')}
                        aria-label="Próxima imagem"
                      >›</button>
                    </>
                  )}
                </div>

                {imagens.length > 1 && (
                  <div className="cp-dots" aria-label="Miniaturas">
                    {imagens.map((img, i) => (
                      <button
                        key={i}
                        className={`cp-dot ${i === slideAtual ? 'cp-dot--ativo' : ''}`}
                        onClick={() => setSlideAtual(i)}
                        aria-label={`Imagem ${i + 1}`}
                      >
                        <img src={img.url} alt="" className="cp-dot-thumb" />
                      </button>
                    ))}
                  </div>
                )}

                <span className="cp-carrocel-contador">
                  {slideAtual + 1} / {imagens.length}
                </span>
              </div>
            )}
          </section>

          {/* ── Campos ───────────────────────────────────────────────── */}
          <section className="cp-secao">

            <div className="cp-campo">
              <label htmlFor="cp-nome" className="cp-label">Nome do produto</label>
              <input
                id="cp-nome"
                type="text"
                className={`cp-input ${erros.nome ? 'cp-input--erro' : ''}`}
                placeholder="Ex: Arroz integral 1 kg"
                value={nome}
                maxLength={150}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setNome(removeEmojis(e.target.value));
                  setErros(p => ({ ...p, nome: undefined }));
                }}
              />
              {erros.nome && <span className="cp-erro">{erros.nome}</span>}
            </div>

            <div className="cp-campo">
              <label htmlFor="cp-descricao" className="cp-label">Descrição</label>
              <textarea
                id="cp-descricao"
                className={`cp-textarea ${erros.descricao ? 'cp-input--erro' : ''}`}
                placeholder="Detalhes: marca, quantidade, variante…"
                value={descricao}
                rows={3}
                maxLength={500}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                  setDescricao(removeEmojis(e.target.value));
                  setErros(p => ({ ...p, descricao: undefined }));
                }}
              />
              <span className="cp-char-count">{descricao.length}/500</span>
              {erros.descricao && <span className="cp-erro">{erros.descricao}</span>}
            </div>

            <div className="cp-campo cp-campo--metade">
              <label htmlFor="cp-preco" className="cp-label">Preço (R$)</label>
              <input
                id="cp-preco"
                type="text"
                inputMode="numeric"
                className={`cp-input cp-input--preco ${erros.preco ? 'cp-input--erro' : ''}`}
                placeholder="0,00"
                value={preco}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  formatarPreco(e.target.value);
                  setErros(p => ({ ...p, preco: undefined }));
                }}
              />
              {erros.preco && <span className="cp-erro">{erros.preco}</span>}
            </div>

            <div className="cp-campo cp-campo--metade">
              <label htmlFor="cp-estoque" className="cp-label">Estoque</label>
              <input
                id="cp-estoque"
                type="number"
                inputMode="numeric"
                className="cp-input cp-input--preco"
                placeholder="0"
                min={0}
                value={estoque}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  setEstoque(Number(e.target.value) || 0);
                }}
              />
            </div>

          </section>
        </div>

        {/* Footer */}
        <div className="cp-footer">
          <button
            className="cp-btn cp-btn--secundario"
            onClick={onCancelar}
            disabled={salvando || enviando}
          >
            Cancelar
          </button>
          <button
            className={`cp-btn cp-btn--primario ${(salvando || enviando) ? 'cp-btn--carregando' : ''}`}
            onClick={handleSalvar}
            disabled={salvando || enviando}
          >
            {enviando ? 'Enviando imagens…' : salvando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar produto'}
          </button>
        </div>

      </div>
    </div>
  );
}