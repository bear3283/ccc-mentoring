/**
 * 사진이 없을 때 아바타 자리에 넣을 글자.
 *
 * 페르소나 이모지를 쓰지 않는 이유: 이모지는 성향을 나타내는 기호라
 * 사람을 가리키는 자리에 놓으면 "사진을 안 올린 사람"이 아니라
 * "그 성향인 사람"처럼 읽힌다. 이름 글자가 훨씬 정확하다.
 *
 * 한국 이름은 성 한 글자 + 이름 두 글자가 대부분이라 뒤 두 글자를 쓴다.
 * "윤서연" -> "서연" (성만 남기면 동명이인이 다 같아 보인다)
 */
export function nameInitials(name: string | undefined): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return "?";

  // 영문 이름은 각 단어의 첫 글자를 딴다. "Emma Carter" -> "EC"
  if (/^[A-Za-z\s]+$/.test(trimmed)) {
    return trimmed
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("");
  }

  return trimmed.length <= 2 ? trimmed : trimmed.slice(-2);
}
