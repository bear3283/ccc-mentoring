import type { Mentee, Mentor } from "@/features/matching/model/types";

/** 운영자가 손봐야 할 등록 한 건. */
export interface IssueRow {
  id: string;
  kind: "같은 번호 중복" | "성별 미입력";
  contact: string;
  /** "김지훈(고3, AB12CD) · 김지훈(대학생, EF34GH)" 처럼 누가 걸렸는지 */
  people: string;
  action: string;
}

const ROLE_LABEL = { MENTEE: "고3", MENTOR: "대학생" } as const;

type Person = (Mentee | Mentor) & { role: keyof typeof ROLE_LABEL };

function describe(p: Person): string {
  return `${p.name}(${ROLE_LABEL[p.role]}, ${p.participationCode})`;
}

/**
 * 운영자 화면 "점검" 탭에 올릴 항목.
 *
 * 1. 같은 번호 중복 — DB 유니크 제약은 (연락처, 역할) 이라 같은 번호로 고3과
 *    대학생을 하나씩 등록할 수 있었다. 지금은 등록할 때 역할과 상관없이 막지만,
 *    그 전에 들어온 등록은 남아 있다. 하이픈을 떼고 숫자만 비교한다.
 * 2. 성별 미입력 — 멘토링을 신청했는데 성별이 비어 있으면 같은 성별끼리만 잇는
 *    매칭에서 후보가 되지 못한다. 성별을 받기 전에 등록한 사람들이다.
 *
 * 화면이 이미 받은 명단으로 계산한다. 따로 조회하지 않는다.
 */
export function findIssues(mentees: Mentee[], mentors: Mentor[]): IssueRow[] {
  const people: Person[] = [
    ...mentees.map((m) => ({ ...m, role: "MENTEE" as const })),
    ...mentors.map((m) => ({ ...m, role: "MENTOR" as const })),
  ];

  const byNumber = new Map<string, Person[]>();
  for (const p of people) {
    const digits = p.contact.replace(/\D/g, "");
    byNumber.set(digits, [...(byNumber.get(digits) ?? []), p]);
  }

  const duplicates: IssueRow[] = [...byNumber.entries()]
    .filter(([, group]) => group.length > 1)
    .map(([digits, group]) => ({
      id: `dup-${digits}`,
      kind: "같은 번호 중복",
      contact: group[0].contact,
      people: group.map(describe).join(" · "),
      action: "본인에게 확인해 하나만 남기세요. 남의 번호를 잘못 적었다면 매칭 문자가 엉뚱한 사람에게 가요.",
    }));

  const noGender: IssueRow[] = people
    .filter((p) => p.mentoringApplied && !p.gender)
    .map((p) => ({
      id: `gender-${p.id}`,
      kind: "성별 미입력",
      contact: p.contact,
      people: describe(p),
      action: "매칭 후보에서 빠져 있어요. 멘토링 신청을 다시 하면서 성별을 고르도록 안내하세요.",
    }));

  return [...duplicates, ...noGender];
}
