import { PERSONAS } from "@/shared/constants/persona";
import type { Mentee, Mentor } from "../model/types";

/**
 * 프로필 카드에 노출할 해시태그.
 *
 * score.ts 에서 분리한 이유: 여기는 "무엇을 보여줄지"를 정하는 표시 로직이라
 * MBTI처럼 점수에 쓰지 않는 값도 자유롭게 다룬다. 점수 모듈에 섞여 있으면
 * 미반영 항목이 점수에 새어 들어갔는지 검사할 때 구분이 안 된다.
 */
/** 프로필 카드에 노출할 해시태그를 멘토 속성에서 만든다. */
export function buildHashtags(mentor: Mentor, mentee: Mentee): string[] {
  const tags = [PERSONAS[mentor.personaType].hashtag];

  // MBTI는 후배가 가장 먼저 눈여겨보는 정보라 성향 바로 뒤에 세운다.
  if (mentor.mbti) tags.push(`#${mentor.mbti}`);

  if (mentor.mentoringArea.includes("학점관리")) tags.push("#A+폭격기");
  if (mentor.mentoringArea.includes("탐방")) tags.push("#탐방러");
  if (mentor.mentoringArea.includes("교환학생")) tags.push("#교환학생경험");

  // 겹치는 학과·진로가 있으면 그것을 태그로 세운다. 멘티가 자기 관심사를 카드에서 바로 본다.
  const sharedMajor = mentor.currentMajors.find((m) => mentee.targetMajors.includes(m));
  if (sharedMajor) tags.push(`#${sharedMajor}선배`);

  const sharedCareer = mentor.careerPaths.find((c) => mentee.targetCareers.includes(c));
  if (sharedCareer) tags.push(`#${sharedCareer}루트`);

  // 카드가 지저분해지지 않도록 최대 4개까지만 보여준다.
  return tags.slice(0, 4);
}
