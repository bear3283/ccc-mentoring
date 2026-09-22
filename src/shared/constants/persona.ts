/**
 * 성경 인물 페르소나.
 * 온보딩 아이스브레이킹 질문의 선택지이자, 매칭 점수(WEIGHTS.persona)의 성향 축으로 함께 쓰인다.
 * 온보딩과 매칭 로직이 같은 상수를 참조하도록 shared 레이어에 둔다.
 */

/**
 * 넷만 두었을 때는 "넷 중엔 이게 제일 가깝네" 로 고르게 되어
 * 고른 사람도 자기를 설명했다고 느끼지 못했다. 여덟로 넓혔다.
 *
 * 여기에 값을 더하면 DB enum 도 함께 넓혀야 한다.
 * supabase/migrations/2026-09-15-persona-expand.sql 을 참고할 것.
 */
export const PERSONA_TYPES = [
  "DAVID",
  "SOLOMON",
  "ESTHER",
  "NOAH",
  "NEHEMIAH",
  "DANIEL",
  "RUTH",
  "DEBORAH",
] as const;

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
  /** 결과 카드 상단 밴드. 포스터 노선색에서 한 명씩 배정해 범례처럼 읽히게 한다. */
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
    gradient: ["#d9604f", "#e8917c"],
  },
  SOLOMON: {
    type: "SOLOMON",
    emoji: "📖",
    name: "솔로몬",
    hashtag: "#솔로몬형",
    description: "깊이 파고들어 답을 찾는 탐구파",
    keywords: ["지혜", "학업"],
    gradient: ["#4a7e94", "#7aabbd"],
  },
  ESTHER: {
    type: "ESTHER",
    emoji: "🤝",
    name: "에스더",
    hashtag: "#에스더형",
    description: "사람을 먼저 챙기는 공동체파",
    keywords: ["관계", "섬김"],
    gradient: ["#d9a84e", "#ecc784"],
  },
  NOAH: {
    type: "NOAH",
    emoji: "🌱",
    name: "노아",
    hashtag: "#노아형",
    description: "묵묵히 오래 쌓아가는 성실파",
    keywords: ["성실", "꾸준함"],
    gradient: ["#5aa06d", "#8cc49a"],
  },
  NEHEMIAH: {
    type: "NEHEMIAH",
    emoji: "🧱",
    name: "느헤미야",
    hashtag: "#느헤미야형",
    description: "계획을 세워 끝까지 해내는 완성파",
    keywords: ["기획", "추진"],
    gradient: ["#1d4e5f", "#41798c"],
  },
  DANIEL: {
    type: "DANIEL",
    emoji: "🦁",
    name: "다니엘",
    hashtag: "#다니엘형",
    description: "흔들리지 않고 소신을 지키는 신념파",
    keywords: ["소신", "절제"],
    gradient: ["#b4705a", "#d19b86"],
  },
  RUTH: {
    type: "RUTH",
    emoji: "🌾",
    name: "룻",
    hashtag: "#룻형",
    description: "곁을 지키며 함께 걷는 동행파",
    keywords: ["신의", "동행"],
    gradient: ["#d78f92", "#ecbabc"],
  },
  DEBORAH: {
    type: "DEBORAH",
    emoji: "⚖️",
    name: "드보라",
    hashtag: "#드보라형",
    description: "판을 읽고 앞에서 이끄는 리더파",
    keywords: ["결단", "리더십"],
    gradient: ["#a8a244", "#c6c076"],
  },
};

export const PERSONA_LIST: Persona[] = PERSONA_TYPES.map((t) => PERSONAS[t]);

/**
 * 페르소나 궁합 점수 (0.0 ~ 1.0).
 * 매칭의 성향 항목(WEIGHTS.persona)에 곱해 쓴다.
 * 같은 유형은 1.0, 서로 보완하는 유형은 0.7, 그 외는 0.4를 준다.
 * (완전 불일치에도 0을 주지 않는 이유: 캠퍼스/영역이 맞는 좋은 멘토가
 *  성향 하나 때문에 후보에서 사라지는 것을 막기 위함)
 */
const COMPLEMENTARY: Record<PersonaType, PersonaType[]> = {
  // 저돌적으로 부딪히는 쪽과 재고 따지는 쪽
  DAVID: ["SOLOMON"],
  SOLOMON: ["DAVID"],
  // 사람들과 어울리는 쪽과 자기 기준을 지키는 쪽
  ESTHER: ["DANIEL"],
  DANIEL: ["ESTHER"],
  // 오래 쌓는 쪽과 기한 안에 끝내는 쪽
  NOAH: ["NEHEMIAH"],
  NEHEMIAH: ["NOAH"],
  // 곁에서 함께 가는 쪽과 앞에서 이끄는 쪽
  RUTH: ["DEBORAH"],
  DEBORAH: ["RUTH"],
};

export function getPersonaAffinity(a: PersonaType, b: PersonaType): number {
  if (a === b) return 1;
  if (COMPLEMENTARY[a].includes(b)) return 0.7;
  return 0.4;
}
