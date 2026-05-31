interface PasswordStrengthProps {
  senha: string;
}

function getSenhaStrength(senha: string) {
  let score = 0;
  if (senha.length >= 8) score++;
  if (/[A-Z]/.test(senha)) score++;
  if (/[0-9]/.test(senha)) score++;
  if (/[^A-Za-z0-9]/.test(senha)) score++;
  const map = [
    { pct: "25%", color: "#ef4444", label: "Fraca" },
    { pct: "50%", color: "#f59e0b", label: "Razoável" },
    { pct: "75%", color: "#3b82f6", label: "Boa" },
    { pct: "100%", color: "#22c55e", label: "Forte" },
  ];
  return score > 0 ? map[score - 1] : null;
}

function IconCheck() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function IconCircle() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
    </svg>
  );
}

function SenhaRequisitos({ senha }: { senha: string }) {
  const requisitos = [
    { ok: senha.length >= 8,          texto: 'Mínimo 8 caracteres' },
    { ok: /[A-Z]/.test(senha),        texto: 'Uma letra maiúscula' },
    { ok: /[0-9]/.test(senha),        texto: 'Um número' },
    { ok: /[^A-Za-z0-9]/.test(senha), texto: 'Um caractere especial (!@#$...)' },
  ];

  return (
    <div className="senha-requisitos">
      {requisitos.map((r, i) => (
        <div key={i} className={`senha-req-item ${r.ok ? 'ok' : ''}`}>
          <span className="senha-req-icon">
            {r.ok ? <IconCheck /> : <IconCircle />}
          </span>
          {r.texto}
        </div>
      ))}
    </div>
  );
}

export default function PasswordStrength({ senha }: PasswordStrengthProps) {
  const strength = getSenhaStrength(senha);
  if (!strength) return null;

  return (
    <>
      <div className="senha-strength show">
        <div className="strength-bar">
          <div
            className="strength-fill"
            style={{ width: strength.pct, background: strength.color }}
          />
        </div>
        <span className="senha-strength-label" style={{ color: strength.color }}>
          {strength.label}
        </span>
      </div>
      <SenhaRequisitos senha={senha} />
    </>
  );
}