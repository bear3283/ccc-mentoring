/**
 * 개인정보 마스킹.
 *
 * 원칙: 연락처는 "만나기로 한 사이"에만 완전히 보인다.
 * 그 전까지는 본인 확인용으로 일부만 보여준다.
 */

/** 010-1234-5678 -> 010-****-5678 */
export function maskContact(contact: string): string {
  const digits = contact.replace(/\D/g, "");
  if (digits.length < 10) return "***";

  const head = digits.slice(0, 3);
  const tail = digits.slice(-4);
  return `${head}-****-${tail}`;
}

/** 홍길동 -> 홍*동 / 김철 -> 김* */
export function maskName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}${"*".repeat(trimmed.length - 2)}${trimmed.at(-1)}`;
}

/**
 * 로그에 남겨도 되는 형태로 바꾼다.
 *
 * 서버 로그는 보관 기간이 길고 여러 사람이 본다. 이름·연락처를 그대로 찍으면
 * 로그 자체가 개인정보 파일이 된다. 식별이 필요하면 참여코드만 남긴다.
 */
export function safeForLog(value: {
  participationCode?: string;
  id?: string;
}): string {
  return value.participationCode ?? value.id?.slice(0, 8) ?? "unknown";
}
