import type { Role } from "@/shared/constants/role";
import type { OnboardingDraft } from "../model/types";

/**
 * 온보딩 결과를 다음 화면으로 넘기기 위한 임시 저장소.
 *
 * React Context를 쓰지 않는 이유: 새로고침하면 사라져서 결과 화면을 직접 열어
 * 확인할 수 없다. sessionStorage는 탭이 살아 있는 동안 유지되고,
 * 탭을 닫으면 개인정보가 함께 사라진다.
 *
 * Supabase를 붙이면 이 파일이 서버 저장으로 교체된다.
 */

const STORAGE_KEY = "ccc.onboarding.draft.v1";

export interface StoredDraft {
  role: Extract<Role, "MENTEE" | "MENTOR">;
  draft: OnboardingDraft;
  /** 제출 시 발급된 참여코드 */
  participationCode: string;
  /** 언제 제출했는지. 오래된 값을 걸러낼 때 쓴다. */
  savedAt: number;
}

export function saveDraft(
  role: Extract<Role, "MENTEE" | "MENTOR">,
  draft: OnboardingDraft,
  participationCode: string,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredDraft = { role, draft, participationCode, savedAt: Date.now() };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // 저장 용량 초과(사진이 큰 경우) 등으로 실패해도 온보딩 자체는 막지 않는다.
    // 결과 화면은 저장된 값이 없을 때의 경로로 자연스럽게 넘어간다.
  }
}

export function loadDraft(): StoredDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft;
    if (!parsed?.draft || !parsed?.role || !parsed?.participationCode) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
