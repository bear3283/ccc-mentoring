import { loadDraft } from "@/features/onboarding/lib/draftStore";
import { MOCK_MENTEES, MOCK_MENTORS } from "@/shared/lib/mock/generate";

export interface RosterEntry {
  code: string;
  name: string;
  role: "MENTEE" | "MENTOR";
}

/** 하이픈 유무나 공백 차이로 조회가 실패하지 않도록 숫자만 남긴다. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * 이름과 연락처가 "둘 다" 맞아야 참여코드를 알려준다.
 *
 * 이름만으로 조회되게 하면 아무나 남의 참여코드를 볼 수 있다.
 * 연락처는 본인만 아는 값이라 이 조합이 최소한의 확인 수단이 된다.
 *
 * 지금은 더미 명단 + 이 브라우저에서 신청한 사람만 조회 대상이다.
 * 서버가 붙으면 이 함수가 API 조회로 바뀌고, 그때부터 다른 기기에서 신청한
 * 사람도 찾을 수 있다.
 */
export function findByNameAndPhone(name: string, phone: string): RosterEntry | undefined {
  const targetName = name.trim();
  const targetPhone = digitsOnly(phone);
  if (targetName.length < 2 || targetPhone.length < 10) return undefined;

  const matches = (candidateName: string, candidateContact: string) =>
    candidateName === targetName && digitsOnly(candidateContact) === targetPhone;

  // 이 기기에서 방금 신청한 사람을 먼저 본다.
  const stored = loadDraft();
  if (
    stored?.draft.name &&
    stored.draft.contact &&
    matches(stored.draft.name, stored.draft.contact)
  ) {
    return {
      code: stored.participationCode,
      name: stored.draft.name,
      role: stored.role,
    };
  }

  const mentee = MOCK_MENTEES.find((m) => matches(m.name, m.contact));
  if (mentee) {
    return { code: mentee.participationCode, name: mentee.name, role: "MENTEE" };
  }

  const mentor = MOCK_MENTORS.find((m) => matches(m.name, m.contact));
  if (mentor) {
    return { code: mentor.participationCode, name: mentor.name, role: "MENTOR" };
  }

  return undefined;
}
