// eslint-disable-next-line no-misleading-character-class
const EMOJI_REGEX = /(?:[\u2700-\u27BF]|[\uD83C][\uDF00-\uDFFF]|\u200D|\uFE0F|\u20E3|[\u2600-\u27BF]|[\u{1F300}-\u{1F9FF}][\u200D\uFE0F]?|[\u{1FA00}-\u{1FAFF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA70}-\u{1FAFF}]|[\u{2600}-\u{27BF}]|[\u2300-\u23FF]|[\u2B50-\u2B55]|[\u203C-\u3299]|[\uD800-\uDBFF][\uDC00-\uDFFF])/gu;

export function removeEmojis(value: string): string {
  return value.replace(EMOJI_REGEX, "");
}
