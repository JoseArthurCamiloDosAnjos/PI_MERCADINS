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

export default function PasswordStrength({ senha }: PasswordStrengthProps) {
  const strength = getSenhaStrength(senha);
  if (!strength) return null;

  return (
    <div className="senha-strength show">
      <div className="strength-bar">
        <div
          className="strength-fill"
          style={{ width: strength.pct, background: strength.color }}
        />
      </div>
      <span className="strength-label" style={{ color: strength.color }}>
        {strength.label}
      </span>
    </div>
  );
}