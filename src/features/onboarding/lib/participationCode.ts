/**
 * 참여코드.
 *
 * 신청자가 나중에 문의할 때 이름 대신 대고, 운영자는 표에서 바로 찾는다.
 * 동명이인이 있어도 코드로는 한 사람만 특정된다.
 */

/**
 * 0/O, 1/I/L 처럼 눈이나 귀로 헷갈리는 글자를 뺀 알파벳.
 * 전화로 불러주거나 손으로 받아 적는 상황을 전제한다.
 */
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

/** 표시용 구분자 위치. 6자를 3-3으로 끊으면 한 번에 읽힌다. */
const GROUP_SIZE = 3;

/**
 * 암호학적 난수로 코드를 만든다.
 * Math.random을 쓰면 같은 밀리초에 제출한 두 사람이 같은 코드를 받을 수 있다.
 */
export function generateParticipationCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);

  let code = "";
  for (const byte of bytes) {
    // 알파벳 길이가 2의 거듭제곱이 아니라 미세한 편향이 생기지만,
    // 사람이 읽는 식별자에서는 문제가 되지 않는 수준이다.
    code += ALPHABET[byte % ALPHABET.length];
  }
  return code;
}

/** "K7M2X9" -> "K7M-2X9" */
export function formatParticipationCode(code: string): string {
  if (code.length !== CODE_LENGTH) return code;
  return `${code.slice(0, GROUP_SIZE)}-${code.slice(GROUP_SIZE)}`;
}

/** 사용자가 입력한 코드를 비교 가능한 형태로 정규화한다. */
export function normalizeParticipationCode(input: string): string {
  return input.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

export function isValidParticipationCode(input: string): boolean {
  const normalized = normalizeParticipationCode(input);
  if (normalized.length !== CODE_LENGTH) return false;
  return [...normalized].every((ch) => ALPHABET.includes(ch));
}
