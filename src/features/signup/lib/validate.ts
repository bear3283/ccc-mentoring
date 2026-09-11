import { CONSENT_VERSION } from "@/shared/constants/privacy";
import type { OnboardingDraft } from "@/features/onboarding/model/types";

/**
 * 서버에서 다시 검증한다.
 * 브라우저 검증은 사용자를 돕는 장치일 뿐, 요청을 직접 만들면 그냥 우회된다.
 *
 * 가입이 두 단계로 나뉘면서 검증도 나뉘었다.
 * 행사 등록만 한 사람에게 성향·시간대를 요구하면 등록 자체가 막힌다.
 */

/** 사진은 data URL로 들어온다. 지나치게 크면 저장소와 응답이 함께 무거워진다. */
const MAX_PHOTO_BYTES = 400_000;

/** 1단계 — 행사 등록. 행사에 오는 모든 사람이 통과해야 한다. */
export function validateRegistration(
  role: "MENTEE" | "MENTOR",
  draft: OnboardingDraft,
): string | null {
  if (!draft) return "잘못된 요청이에요.";

  if (!draft.name || draft.name.trim().length < 2) return "이름을 확인해주세요.";
  if (draft.name.trim().length > 20) return "이름이 너무 길어요.";
  if (!draft.contact || !/^01[016-9]-\d{3,4}-\d{4}$/.test(draft.contact)) {
    return "연락처 형식을 확인해주세요.";
  }

  // 동의는 브라우저에서 체크박스를 지나쳐도 서버가 다시 막는다.
  if (!draft.consentedAt || !draft.consentVersion) {
    return "개인정보 동의가 필요해요.";
  }
  if (draft.consentVersion !== CONSENT_VERSION) {
    return "동의 문구가 변경되었어요. 화면을 새로고침한 뒤 다시 시도해주세요.";
  }

  // 교회를 적었거나 새친구라고 밝혔거나. 둘 다 비면 집계할 수 없다.
  if (!draft.isNewFriend && !draft.church?.trim()) {
    return "출석하는 교회를 알려주세요.";
  }
  if (draft.church && draft.church.trim().length > 40) {
    return "교회 이름이 너무 길어요.";
  }

  if (role === "MENTEE") {
    if (draft.targetCampus.length < 1 || draft.targetCampus.length > 3) {
      return "지망 학교를 확인해주세요.";
    }
  } else {
    if (!draft.currentCampus) return "학교를 골라주세요.";
    if (!draft.admissionYear) return "학번을 골라주세요.";
  }

  return null;
}

/** 2단계 — 멘토링 신청. 원하는 사람만 통과하면 된다. */
export function validateMentoring(
  role: "MENTEE" | "MENTOR",
  draft: OnboardingDraft,
): string | null {
  if (!draft) return "잘못된 요청이에요.";

  if (!draft.personaType) return "성향을 골라주세요.";
  if (!draft.availableTimes || draft.availableTimes.length === 0) {
    return "가능한 시간을 골라주세요.";
  }

  if (role === "MENTEE") {
    if (draft.desiredAreas.length < 1 || draft.desiredAreas.length > 3) {
      return "관심 분야를 확인해주세요.";
    }
    if (draft.targetMajors.length < 1 || draft.targetMajors.length > 3) {
      return "희망 학과를 확인해주세요.";
    }
    if (draft.targetCareers.length < 1 || draft.targetCareers.length > 3) {
      return "희망 진로를 확인해주세요.";
    }
  } else {
    if (draft.mentoringArea.length < 1) return "도와줄 영역을 골라주세요.";
    if (draft.currentMajors.length < 1 || draft.currentMajors.length > 3) {
      return "전공을 확인해주세요.";
    }
    if (draft.careerPaths.length < 1 || draft.careerPaths.length > 3) {
      return "진로를 확인해주세요.";
    }
  }

  if (draft.photoUrl && draft.photoUrl.length > MAX_PHOTO_BYTES) {
    return "사진 용량이 너무 커요.";
  }

  return null;
}
