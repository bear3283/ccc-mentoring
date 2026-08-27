import type { Mentee, Mentor } from "@/features/matching/model/types";
import type { OnboardingDraft } from "../model/types";

/**
 * 온보딩 draft를 매칭이 쓰는 프로필 형태로 변환한다.
 *
 * draft의 모든 필드는 "아직 안 채워졌을 수 있다"는 뜻에서 옵셔널이지만,
 * 매칭은 값이 다 있다고 가정하고 계산한다. 그 경계를 여기서 한 번만 검사해
 * 매칭 로직이 undefined를 신경 쓰지 않아도 되게 한다.
 * 하나라도 비면 null을 돌려주고, 호출부가 "아직 완성 전"으로 처리한다.
 */

/** 서버에 저장하기 전까지 쓰는 임시 id. */
const LOCAL_ID = "local";

export function draftToMentee(
  draft: OnboardingDraft,
  participationCode: string,
): Mentee | null {
  if (
    !draft.name ||
    !draft.gender ||
    !draft.contact ||
    !draft.personaType ||
    draft.targetCampus.length === 0 ||
    draft.desiredAreas.length === 0 ||
    draft.targetMajors.length === 0 ||
    draft.targetCareers.length === 0 ||
    draft.availableTimes.length === 0
  ) {
    return null;
  }

  return {
    id: LOCAL_ID,
    participationCode,
    name: draft.name,
    gender: draft.gender,
    contact: draft.contact,
    highSchool: draft.highSchool,
    referrer: draft.referrer,
    photoUrl: draft.photoUrl,
    availableTimes: draft.availableTimes,
    targetCampus: draft.targetCampus,
    desiredAreas: draft.desiredAreas,
    personaType: draft.personaType,
    targetMajors: draft.targetMajors,
    targetCareers: draft.targetCareers,
  };
}

export function draftToMentor(
  draft: OnboardingDraft,
  participationCode: string,
): Mentor | null {
  if (
    !draft.name ||
    !draft.gender ||
    !draft.contact ||
    !draft.personaType ||
    !draft.currentCampus ||
    !draft.admissionYear ||
    draft.mentoringArea.length === 0 ||
    draft.currentMajors.length === 0 ||
    draft.careerPaths.length === 0 ||
    draft.availableTimes.length === 0
  ) {
    return null;
  }

  return {
    id: LOCAL_ID,
    participationCode,
    name: draft.name,
    gender: draft.gender,
    contact: draft.contact,
    highSchool: draft.highSchool,
    referrer: draft.referrer,
    photoUrl: draft.photoUrl,
    availableTimes: draft.availableTimes,
    currentCampus: draft.currentCampus,
    admissionYear: draft.admissionYear,
    mentoringArea: draft.mentoringArea,
    personaType: draft.personaType,
    currentMajors: draft.currentMajors,
    careerPaths: draft.careerPaths,
  };
}
