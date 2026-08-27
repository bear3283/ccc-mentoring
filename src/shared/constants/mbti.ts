/**
 * MBTI.
 *
 * 16개를 한 번에 나열하면 고르기 어렵고, 자기 유형을 정확히 모르는 사람도 많다.
 * 4개 축을 하나씩 물어 유형이 완성되게 하고, 모르면 건너뛸 수 있게 한다.
 */

export const MBTI_AXES = [
  {
    key: "EI",
    question: "사람들과 있을 때",
    options: [
      { letter: "E", label: "외향", description: "여럿과 어울리면 기운이 나요" },
      { letter: "I", label: "내향", description: "혼자 있어야 충전돼요" },
    ],
  },
  {
    key: "SN",
    question: "무언가를 볼 때",
    options: [
      { letter: "S", label: "감각", description: "지금 눈앞의 사실부터 봐요" },
      { letter: "N", label: "직관", description: "그래서 뭐가 될지를 상상해요" },
    ],
  },
  {
    key: "TF",
    question: "결정할 때",
    options: [
      { letter: "T", label: "사고", description: "논리와 근거를 먼저 따져요" },
      { letter: "F", label: "감정", description: "사람 마음을 먼저 살펴요" },
    ],
  },
  {
    key: "JP",
    question: "일정을 잡을 때",
    options: [
      { letter: "J", label: "계획", description: "미리 정해두면 마음이 편해요" },
      { letter: "P", label: "즉흥", description: "상황 봐서 정하는 게 좋아요" },
    ],
  },
] as const;

export type MbtiAxisKey = (typeof MBTI_AXES)[number]["key"];

/** 축별로 고른 글자. 네 축이 모두 차면 유형이 완성된다. */
export type MbtiSelection = Partial<Record<MbtiAxisKey, string>>;

export const MBTI_TYPES = [
  "ISTJ", "ISFJ", "INFJ", "INTJ",
  "ISTP", "ISFP", "INFP", "INTP",
  "ESTP", "ESFP", "ENFP", "ENTP",
  "ESTJ", "ESFJ", "ENFJ", "ENTJ",
] as const;

export type MbtiType = (typeof MBTI_TYPES)[number];

/** 네 축이 다 채워졌을 때만 유형 문자열을 만든다. */
export function buildMbtiType(selection: MbtiSelection): MbtiType | undefined {
  const letters = MBTI_AXES.map((axis) => selection[axis.key]).join("");
  return (MBTI_TYPES as readonly string[]).includes(letters)
    ? (letters as MbtiType)
    : undefined;
}

/** 저장된 유형을 다시 축별 선택으로 되돌린다. 뒤로 갔을 때 복원용. */
export function splitMbtiType(type: MbtiType | undefined): MbtiSelection {
  if (!type) return {};
  return {
    EI: type[0],
    SN: type[1],
    TF: type[2],
    JP: type[3],
  };
}
