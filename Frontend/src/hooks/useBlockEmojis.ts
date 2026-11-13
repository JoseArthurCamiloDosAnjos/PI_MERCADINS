// eslint-disable-next-line no-misleading-character-class
const EMOJI_REGEX = /(?:[\u2700-\u27BF]|[\uD83C][\uDF00-\uDFFF]|\u200D|\uFE0F|\u20E3|[\u2600-\u27BF]|[\u{1F300}-\u{1F9FF}][\u200D\uFE0F]?|[\u{1FA00}-\u{1FAFF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u2300-\u23FF]|[\u2B50-\u2B55]|[\u203C-\u3299]|[\uD800-\uDBFF][\uDC00-\uDFFF])/gu;

const NAME_REGEX = /[^a-zA-ZÀ-ÿ0-9\s.'-]/g;
const EMAIL_REGEX = /[^a-zA-Z0-9@._-]/g;
// eslint-disable-next-line no-control-regex
const CONTROL_REGEX = /[\u0000-\u0020\u007F]/g;

export const LIMITS = {
  nome: 150,
  email: 150,
  senha: 72,
  confirmar: 72,
  telefone: 15,
  cpf: 14,
  data_nascimento: 10,
} as const;

export function removeEmojis(value: string): string {
  return value.replace(EMOJI_REGEX, "");
}

export function removeSpecialChars(value: string): string {
  return value.replace(NAME_REGEX, "");
}

export function removeSpecialCharsEmail(value: string): string {
  return value.replace(EMAIL_REGEX, "");
}

export function sanitizeName(value: string): string {
  return removeSpecialChars(removeEmojis(value)).slice(0, LIMITS.nome);
}

export function sanitizeEmail(value: string): string {
  return removeSpecialCharsEmail(removeEmojis(value)).slice(0, LIMITS.email);
}

export function sanitizePassword(value: string): string {
  return removeEmojis(value).replace(CONTROL_REGEX, "").slice(0, LIMITS.senha);
}

export function bloquearEspaco(e: { key: string; preventDefault: () => void }) {
  if (e.key === " ") e.preventDefault();
}
