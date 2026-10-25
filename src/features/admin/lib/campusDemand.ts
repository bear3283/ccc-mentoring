import { regionOf, type Region } from "@/shared/constants/campus";
import { isMatchableMentor } from "@/features/matching/lib/mentorStatus";
import type { Mentee, Mentor } from "@/features/matching/model/types";
import type { Gender } from "@/shared/constants/domain";

/** 선배가 없거나 자리가 다 찬 캠퍼스 한 곳과 그곳을 지망한 후배 수. */
export interface CampusDemandRow {
  campus: string;
  /** 매칭은 같은 성별끼리라, 같은 캠퍼스라도 성별마다 따로 센다. */
  gender: Gender;
  region?: Region;
  /** 이 캠퍼스를 1지망으로 적은, 아직 선배를 고르지 못한 멘티 */
  firstChoice: number;
  /** 1~3지망 어디에든 적은, 아직 선배를 고르지 못한 멘티 */
  anyChoice: number;
  /** 인증된 이 캠퍼스·성별 멘토. 0이면 모집(또는 인증), 1 이상이면 정원 마감이다. */
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
 * 성별이 비어 있는 멘티도 세지 않는다. 모집할 일이 아니라 성별을 받아야 할 일이고,
 * 운영자 화면의 점검 탭에 따로 나온다.
 */
export function campusDemand(
  mentees: Mentee[],
  mentors: Mentor[],
  activeByMentor: ReadonlyMap<string, number>,
  settledMentees: ReadonlySet<string>,
): CampusDemandRow[] {
  // 인증 전 선배는 후배가 고를 수 없으니 자리로 세지 않는다.
  const applied = mentors.filter(isMatchableMentor);

  const sameSlot = (m: Mentor, campus: string, gender: Gender) =>
    m.currentCampus === campus && m.gender === gender;

  const seatsLeft = (campus: string, gender: Gender) =>
    applied
      .filter((m) => sameSlot(m, campus, gender))
      .reduce((sum, m) => sum + Math.max(m.capacity - (activeByMentor.get(m.id) ?? 0), 0), 0);

  const rows = new Map<string, CampusDemandRow>();
  for (const mentee of mentees) {
    const gender = mentee.gender;
    if (!mentee.mentoringApplied || settledMentees.has(mentee.id) || !gender) continue;

    mentee.targetCampus.forEach((campus, rank) => {
      const key = `${campus}|${gender}`;
      const row = rows.get(key) ?? {
        campus,
        gender,
        region: regionOf(campus),
        firstChoice: 0,
        anyChoice: 0,
        mentors: applied.filter((m) => sameSlot(m, campus, gender)).length,
      };
      row.anyChoice++;
      if (rank === 0) row.firstChoice++;
      rows.set(key, row);
    });
  }

  return [...rows.values()]
    .filter((row) => seatsLeft(row.campus, row.gender) === 0)
    .sort((a, b) => b.anyChoice - a.anyChoice || b.firstChoice - a.firstChoice);
}
