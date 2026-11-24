/**
 * 멘토링 신청 화면 주소와, 등록 정보가 없을 때 돌려보낼 조회 화면 주소.
 *
 * 신청 화면은 QR·카톡 링크로 바로 열린다. 그러면 새 탭이라 sessionStorage 에 등록 정보가
 * 없다. 끝까지 답한 뒤에 막히지 않도록, 들어오자마자 조회 화면으로 보내고 조회가 끝나면
 * 원래 신청 화면으로 돌려보낸다.
 */

export const MENTORING_PATH = {
  MENTOR: "/onboarding/mentoring/mentor",
  MENTEE: "/onboarding/mentoring/mentee",
} as const;

export type MentoringRole = keyof typeof MENTORING_PATH;

/**
 * 조회 뒤 돌아갈 주소로 허용하는 것은 신청 화면 두 곳뿐이다.
 * 아무 값이나 받으면 `?next=https://...` 로 다른 사이트에 보내는 링크를 만들 수 있다.
 */
export function safeMentoringNext(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw === MENTORING_PATH.MENTOR || raw === MENTORING_PATH.MENTEE ? raw : null;
}

/** 등록 정보가 없을 때 보내는 곳. reason 은 조회 화면이 안내 문구를 고르는 데 쓴다. */
export function lookupUrlFor(next: string, reason?: "expired"): string {
  const params = new URLSearchParams({ next });
  if (reason) params.set("reason", reason);
  return `/lookup?${params.toString()}`;
}
