import type { Mentor } from "../model/types";

/**
 * 후배의 추천 후보가 될 수 있는 선배인지. 정원은 따로 본다.
 *
 * 멘토링을 신청했고, 운영자가 캠퍼스를 인증한 선배만 후보가 된다.
 * 선배가 적어 낸 학교가 맞는지는 이 서비스가 알 수 없어서, 운영자가 캠퍼스 리더에게
 * 명단을 확인받은 뒤 인증한다(운영자 화면 "멘토 인증" 탭).
 *
 * 서버(추천 계산)와 운영자 화면(모집 필요 캠퍼스)이 같은 기준을 써야 해서 한곳에 둔다.
 */
export function isMatchableMentor(mentor: Pick<Mentor, "mentoringApplied" | "verifiedAt">): boolean {
  return !!mentor.mentoringApplied && !!mentor.verifiedAt;
}

/** 운영자 화면과 선배 화면이 쓰는 인증 상태. 확인 대기 = 아직 아무 결정도 없음. */
export type VerificationStatus = "pending" | "verified" | "rejected";

export function verificationStatus(mentor: Pick<Mentor, "verifiedAt" | "rejectedAt">): VerificationStatus {
  if (mentor.verifiedAt) return "verified";
  if (mentor.rejectedAt) return "rejected";
  return "pending";
}
