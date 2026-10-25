/** 멘토링 영역 - 온보딩 선택지이자 매칭 점수의 입력값. */

// 캠퍼스와 학과는 양이 많아 campus.ts 로 분리했다.
// 기존 import 경로를 깨지 않도록 여기서 다시 내보낸다.
export {
  CAMPUSES,
  CAMPUSES_BY_REGION,
  campusMatches,
  REGIONS,
  MAJOR_FIELDS,
  FIELD_EMOJI,
  COMMON_MAJORS,
  fieldOf,
  regionOf,
  isCampus,
} from "./campus";
export type { Campus, Region, MajorField } from "./campus";


export const MENTORING_AREAS = [
  "학점관리",
  "탐방",
  "동아리",
  "대외활동",
  "전공공부",
  "진로설계",
  "교환학생",
  "자취생활",
  "신앙생활",
  "CCC",
] as const;

export type MentoringArea = (typeof MENTORING_AREAS)[number];

/**
 * 3열 그리드에서는 설명을 넣을 폭이 없다.
 * 이모지가 설명을 대신해 항목을 빠르게 구분해 준다.
 */
export const AREA_META: Record<
  MentoringArea,
  { emoji: string; hint: string; ask: string }
> = {
  // ask: 첫 문자에 그대로 붙여 쓸 수 있는 질문. 고3이 "뭘 물어보지"에서 막히는 걸 덜어준다.
  학점관리: {
    emoji: "📚",
    hint: "수강신청, 시험 준비, 과제 요령",
    ask: "1학년 때 수강신청은 어떻게 하셨어요?",
  },
  탐방: {
    emoji: "🚶",
    hint: "캠퍼스 투어, 학교 분위기 미리보기",
    ask: "학교 분위기는 어떤 편이에요?",
  },
  동아리: {
    emoji: "🎪",
    hint: "동아리 선택과 활동 이야기",
    ask: "동아리는 어떻게 고르셨어요?",
  },
  대외활동: {
    emoji: "🏆",
    hint: "공모전, 서포터즈, 인턴",
    ask: "대외활동은 언제부터 시작하는 게 좋을까요?",
  },
  전공공부: {
    emoji: "🔬",
    hint: "전공 커리큘럼과 공부법",
    ask: "전공 공부는 고등학교 때랑 많이 다른가요?",
  },
  진로설계: {
    emoji: "🧭",
    hint: "졸업 후 진로 고민 상담",
    ask: "진로는 언제쯤 정하게 되셨어요?",
  },
  교환학생: {
    emoji: "✈️",
    hint: "지원 준비와 현지 생활",
    ask: "교환학생은 어떻게 준비하는 거예요?",
  },
  자취생활: {
    emoji: "🏠",
    hint: "방 구하기, 생활비, 살림",
    ask: "자취는 할 만한가요?",
  },
  신앙생활: {
    emoji: "🙏",
    hint: "대학에서 신앙 지키기, 교회 생활",
    ask: "대학에 가서 신앙생활은 어떻게 이어가셨어요?",
  },
  CCC: {
    emoji: "🤝",
    hint: "캠퍼스 CCC 모임과 활동",
    ask: "CCC에서는 어떤 활동을 해요?",
  },
};

/** 같은 성별끼리만 매칭한다. 등록할 때 받는다. */
export const GENDERS = ["MALE", "FEMALE"] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABEL: Record<Gender, string> = { MALE: "남", FEMALE: "여" };

/** 더미 데이터 생성과 예시에 쓰는 대표 학과. 실제 선택지는 학교별로 만들어진다. */
export const MAJORS = [
  "경영학과",
  "컴퓨터공학과",
  "기계공학과",
  "심리학과",
  "국어국문학과",
  "전자공학과",
  "생명과학과",
  "행정학과",
  "미디어커뮤니케이션학과",
  "화학공학과",
  "수학과",
  "사회복지학과",
] as const;

/**
 * 학과는 학교마다 다르다. 고정 목록으로 묶으면 "내 학과가 없다"가 된다.
 * campus.ts 의 majorsByField() 가 학교에 맞는 후보를 만들어 주고,
 * 저장되는 값은 그 문자열이다.
 */
export type Major = string;

/**
 * 멘토 한 명이 맡을 수 있는 후배 수. 멘토가 신청할 때 고른다.
 *
 * 상한을 두는 이유: 선배 한 명이 후보 목록을 오래 차지하면 그 캠퍼스를
 * 지망한 다른 후배가 모두 그 선배에게 몰린다. DB 제약
 * (mentor_profiles_capacity_range)과 같은 범위여야 한다.
 */
export const MENTOR_CAPACITY_OPTIONS = [1, 2, 3] as const;
export type MentorCapacity = (typeof MENTOR_CAPACITY_OPTIONS)[number];

/**
 * 멘토가 고르는 학번. 최신 학번이 앞에 온다.
 *
 * 마지막 칸은 "19학번 이상"으로 그보다 앞선 학번을 모두 받는다.
 * 고학번·복학생 선배도 고를 칸이 있어야 한다. 저장값은 그 칸의 연도다.
 */
export const ADMISSION_YEARS = Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i);
const OLDEST_ADMISSION_YEAR = ADMISSION_YEARS[ADMISSION_YEARS.length - 1];

/** 2024 -> "24학번", 마지막 칸 이전 -> "19학번 이상". */
export function admissionYearLabel(year: number): string {
  return `${String(year).slice(2)}학번${year <= OLDEST_ADMISSION_YEAR ? " 이상" : ""}`;
}
