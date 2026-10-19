import { regionOf, type Region } from "@/shared/constants/campus";
import type { Mentee, Mentor } from "@/features/matching/model/types";

/** 선배가 없거나 자리가 다 찬 캠퍼스 한 곳과 그곳을 지망한 후배 수. */
export interface CampusDemandRow {
  campus: string;
  region?: Region;
  /** 이 캠퍼스를 1지망으로 적은, 아직 선배를 고르지 못한 멘티 */
  firstChoice: number;
  /** 1~3지망 어디에든 적은, 아직 선배를 고르지 못한 멘티 */
  anyChoice: number;
  /** 멘토링을 신청한 이 캠퍼스 멘토. 0이면 모집, 1 이상이면 정원 마감이다. */
  mentors: number;
}

/**
 * 어느 캠퍼스 선배를 더 모집해야 하는지.
 *
 * 미매칭 명단만으로는 이 판단이 안 된다. 한 멘티가 세 캠퍼스를 적기 때문에
 * 명단을 눈으로 훑어서는 어느 캠퍼스가 가장 급한지 셀 수 없다.
 *
 * 남은 자리가 0인 캠퍼스만 담는다. 선배가 아예 없는 곳과 있지만 정원이 다 찬
 * 곳을 함께 보여주는 이유: 후배 입장에서는 둘 다 "고를 선배가 없다"로 같다.
 * 정원이 찬 곳은 그 캠퍼스 선배에게 정원을 늘려 달라고 부탁하는 길도 있다.
 *
 * 이미 선배를 고른 멘티는 세지 않는다. 그 멘티의 지망은 더 이상 수요가 아니다.
 */
export function campusDemand(
  mentees: Mentee[],
  mentors: Mentor[],
  activeByMentor: ReadonlyMap<string, number>,
  settledMentees: ReadonlySet<string>,
): CampusDemandRow[] {
  const applied = mentors.filter((m) => m.mentoringApplied);

  const seatsLeft = (campus: string) =>
    applied
      .filter((m) => m.currentCampus === campus)
      .reduce((sum, m) => sum + Math.max(m.capacity - (activeByMentor.get(m.id) ?? 0), 0), 0);

  const rows = new Map<string, CampusDemandRow>();
  for (const mentee of mentees) {
    if (!mentee.mentoringApplied || settledMentees.has(mentee.id)) continue;

    mentee.targetCampus.forEach((campus, rank) => {
      const row = rows.get(campus) ?? {
        campus,
        region: regionOf(campus),
        firstChoice: 0,
        anyChoice: 0,
        mentors: applied.filter((m) => m.currentCampus === campus).length,
      };
      row.anyChoice++;
      if (rank === 0) row.firstChoice++;
      rows.set(campus, row);
    });
  }

  return [...rows.values()]
    .filter((row) => seatsLeft(row.campus) === 0)
    .sort((a, b) => b.anyChoice - a.anyChoice || b.firstChoice - a.firstChoice);
}
