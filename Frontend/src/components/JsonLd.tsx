// ─────────────────────────────────────────────────────────────────────────────
//  JsonLd — injeta dados estruturados na página (SEO - C6)
//
//  O Google usa esse bloco (padrão schema.org) para mostrar informações ricas
//  na busca: nome e endereço da loja, preço e disponibilidade do produto,
//  média de avaliações etc. O replace de "<" evita quebrar o HTML se algum
//  texto do banco contiver esse caractere.
// ─────────────────────────────────────────────────────────────────────────────

export default function JsonLd({ dados }: { dados: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(dados).replace(/</g, '\\u003c') }}
    />
  );
}
