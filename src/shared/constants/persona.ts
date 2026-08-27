/**
 * 성경 인물 페르소나.
 * 온보딩 아이스브레이킹 질문의 선택지이자, 매칭 점수(2순위 30%)의 성향 축으로 함께 쓰인다.
 * 온보딩과 매칭 로직이 같은 상수를 참조하도록 shared 레이어에 둔다.
 */

export const PERSONA_TYPES = ["DAVID", "SOLOMON", "ESTHER", "NOAH"] as const;

export type PersonaType = (typeof PERSONA_TYPES)[number];

export interface Persona {
  type: PersonaType;
  emoji: string;
  /** 선택지 제목 - "다윗" */
  name: string;
  /** 매칭 카드 해시태그 - "#다윗형" */
  hashtag: string;
  /** 선택지 한 줄 설명 */
  description: string;
  /** 프로필 카드에서 강조할 성향 키워드 */
  keywords: [string, string];
  /** 결과 카드 상단 밴드의 그라디언트 (레퍼런스 프로필 카드의 컬러 헤더) */
  gradient: readonly [string, string];
}

export const PERSONAS: Record<PersonaType, Persona> = {
  DAVID: {
    type: "DAVID",
    emoji: "🔥",
    name: "다윗",
    hashtag: "#다윗형",
    description: "겁 없이 부딪히며 배우는 도전파",
    keywords: ["도전", "열정"],
    gradient: ["#f2705f", "#f4a261"],
  },
  SOLOMON: {
    type: "SOLOMON",
    emoji: "📖",
    name: "솔로몬",
    hashtag: "#솔로몬형",
    description: "깊이 파고들어 답을 찾는 탐구파",
    keywords: ["지혜", "학업"],
    gradient: ["#6c5ce7", "#8e7bf0"],
  },
  ESTHER: {
    type: "ESTHER",
    emoji: "🤝",
    name: "에스더",
    hashtag: "#에스더형",
    description: "사람을 먼저 챙기는 공동체파",
    keywords: ["관계", "섬김"],
    gradient: ["#f0a04b", "#f6c453"],
  },
  NOAH: {
    type: "NOAH",
    emoji: "🌱",
    name: "노아",
    hashtag: "#노아형",
    description: "묵묵히 오래 쌓아가는 성실파",
    keywords: ["성실", "꾸준함"],
    gradient: ["#38b48b", "#6fcf97"],
  },
};

export const PERSONA_LIST: Persona[] = PERSONA_TYPES.map((t) => PERSONAS[t]);

/**
 * 페르소나 궁합 점수 (0.0 ~ 1.0).
 * 매칭 2순위(30%)의 성향 매칭 항목에서 사용한다.
 * 같은 유형은 1.0, 서로 보완하는 유형은 0.7, 그 외는 0.4를 준다.
 * (완전 불일치에도 0을 주지 않는 이유: 캠퍼스/영역이 맞는 좋은 멘토가
 *  성향 하나 때문에 후보에서 사라지는 것을 막기 위함)
 */
const COMPLEMENTARY: Record<PersonaType, PersonaType[]> = {
  DAVID: ["ESTHER"],
  SOLOMON: ["NOAH"],
  ESTHER: ["DAVID"],
  NOAH: ["SOLOMON"],
};

export function getPersonaAffinity(a: PersonaType, b: PersonaType): number {
  if (a === b) return 1;
  if (COMPLEMENTARY[a].includes(b)) return 0.7;
  return 0.4;
}
