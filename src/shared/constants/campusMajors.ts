/**
 * 캠퍼스별 실제 학과 조회.
 *
 * 생성된 데이터가 138KB쯤 되어, domain.ts 에서 re-export 하지 않는다.
 * 그렇게 하면 랜딩까지 포함한 모든 화면이 이 무게를 지고 시작한다.
 * 학과 스텝에서만 동적으로 불러 쓰도록 여기 따로 둔다.
 */

import {
  COMMON_MAJORS,
  fieldOf,
  MAJOR_FIELDS,
  type MajorField,
} from "./campus";
import {
  CAMPUS_MAJOR_INDEX,
  MAJOR_FIELD_INDEX,
  MAJOR_FIELD_ORDER,
  MAJOR_NAMES,
} from "./campusMajors.generated";

/**
 * 학과명 -> 교육부가 공시한 계열.
 * 3,400개를 매번 훑지 않도록 Map 으로 한 번만 세운다.
 */
const OFFICIAL_FIELD: Map<string, MajorField> = new Map(
  MAJOR_NAMES.map((name, i) => [name, MAJOR_FIELD_ORDER[MAJOR_FIELD_INDEX[i]]]),
);

/** 이 캠퍼스에 실제로 있는 학과. 공시자료에 없는 학교면 빈 배열. */
function majorsOfCampus(campus: string): string[] {
  return (CAMPUS_MAJOR_INDEX[campus] ?? []).map((i) => MAJOR_NAMES[i]);
}

/**
 * 이 캠퍼스에서 고를 수 있는 학과를 계열별로 돌려준다.
 *
 * 공시자료에 그 학교의 실제 학과가 있으면 그것만 보여준다.
 * 일반 목록을 덧붙이면 그 학교에 없는 학과까지 고를 수 있게 되는데,
 * 고3이 "여기 있으니 있는 학과겠지" 하고 고른 뒤에야 어긋난다.
 *
 * 학교를 아직 고르지 않았을 때만 일반 목록으로 물러선다.
 */
export function majorsByField(campuses: readonly string[]): Record<MajorField, string[]> {
  const real = new Set(campuses.flatMap((campus) => majorsOfCampus(campus)));

  const result = {} as Record<MajorField, string[]>;
  for (const field of MAJOR_FIELDS) result[field] = [];

  if (real.size === 0) {
    for (const field of MAJOR_FIELDS) result[field] = [...COMMON_MAJORS[field]];
    return result;
  }

  for (const major of [...real].sort((a, b) => a.localeCompare(b, "ko"))) {
    // 공시에 분류가 있으면 그것을 쓰고, 없을 때만 이름으로 추정한다.
    result[OFFICIAL_FIELD.get(major) ?? fieldOf(major)].push(major);
  }
  return result;
}
