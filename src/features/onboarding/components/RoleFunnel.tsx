"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Role } from "@/shared/constants/role";
import { loadDraft, saveDraft } from "../lib/draftStore";
import { OnboardingFunnel, type StepRegistry } from "./OnboardingFunnel";
import { AreaStep } from "./steps/AreaStep";
import { BasicStep } from "./steps/BasicStep";
import { CampusStep } from "./steps/CampusStep";
import { ChurchStep } from "./steps/ChurchStep";
import { ConsentStep } from "./steps/ConsentStep";
import { MajorStep } from "./steps/MajorStep";
import { MbtiStep } from "./steps/MbtiStep";
import { MentoringIntroStep } from "./steps/MentoringIntroStep";
import { PersonaStep } from "./steps/PersonaStep";
import { PhotoStep } from "./steps/PhotoStep";
import { RoleStep } from "./steps/RoleStep";
import { ScheduleStep } from "./steps/ScheduleStep";
import {
  EMPTY_DRAFT,
  MENTORING_STEPS_BY_ROLE,
  REGISTER_STEPS,
  type OnboardingDraft,
  type OnboardingStep,
} from "../model/types";

/**
 * 스텝 이름 → 컴포넌트.
 * 같은 컴포넌트가 역할에 따라 다르게 묻는 경우 두 이름을 같은 곳에 건다.
 */
const REGISTRY: StepRegistry = {
  // ── 1단계: 고3채플 등록 (역할과 무관하게 모두 같은 순서) ──
  consent: ConsentStep,
  basic: BasicStep,
  role: RoleStep,
  church: ChurchStep,

  // ── 2단계: 멘토링 신청 (여기서부터 역할별로 갈라진다) ──
  mentoringIntro: MentoringIntroStep,
  targetCampus: CampusStep,
  currentCampus: CampusStep,
  persona: PersonaStep,
  mbti: MbtiStep,
  desiredArea: AreaStep,
  mentoringArea: AreaStep,
  targetMajor: MajorStep,
  currentMajor: MajorStep,
  schedule: ScheduleStep,
  photo: PhotoStep,
};

type RoleOnly = Extract<Role, "MENTEE" | "MENTOR">;

interface RoleFunnelProps {
  /**
   * 2단계에서만 쓴다. 1단계는 역할을 묻는 것이 스텝의 일부라
   * 시작 시점에는 아직 정해지지 않는다.
   */
  role?: RoleOnly;
  /**
   * 어느 단계를 진행하는지.
   * register = 고3채플 등록(모두), mentoring = 멘토링 신청(원하는 사람만)
   */
  phase: "register" | "mentoring";
}

export function RoleFunnel({ role, phase }: RoleFunnelProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();

  const isMentoring = phase === "mentoring";

  /**
   * 2단계는 1단계에서 저장한 내용 위에 이어 쓴다.
   * 처음부터 다시 묻지 않으려면 브라우저에 남긴 초안을 먼저 읽어야 한다.
   */
  const initialDraft: OnboardingDraft = isMentoring
    ? (loadDraft()?.draft ?? EMPTY_DRAFT)
    : EMPTY_DRAFT;

  // 1단계는 모두 같은 순서를 밟는다. 역할은 그 안의 한 스텝으로 받는다.
  const source = isMentoring ? MENTORING_STEPS_BY_ROLE[role ?? "MENTEE"] : REGISTER_STEPS;

  // 구현이 끝난 스텝만 태운다.
  const activeSteps = source.filter((step): step is OnboardingStep => step in REGISTRY);

  const handleComplete = async (draft: OnboardingDraft) => {
    if (submitting) return;

    // 1단계에서는 고른 신분이 곧 역할이다. 2단계는 등록 때 정해진 것을 따른다.
    const effectiveRole = isMentoring ? role : draft.role;
    if (!effectiveRole) {
      setError("고3인지 대학생인지 골라주세요.");
      return;
    }

    setSubmitting(true);
    setError(undefined);

    const payload = isMentoring ? { ...draft, mentoringApplied: true } : draft;

    try {
      // 참여코드는 서버가 발급한다. 브라우저가 정한 코드를 그대로 쓰면
      // 원하는 코드를 골라 넣거나 남의 코드와 충돌시키는 요청을 만들 수 있다.
      const res = await fetch(isMentoring ? "/api/mentoring" : "/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isMentoring
            ? {
                role: effectiveRole,
                draft: payload,
                // 누구의 신청인지는 코드로 가린다. 이름·번호를 다시 받으면
                // 남의 등록에 멘토링을 붙일 수 있다.
                participationCode: loadDraft()?.participationCode,
              }
            : { role: effectiveRole, draft: payload },
        ),
      });

      const body = (await res.json()) as {
        participationCode?: string;
        alreadyRegistered?: boolean;
        error?: string;
      };

      if (!res.ok || !body.participationCode) {
        setError(body.error ?? "저장하지 못했어요. 잠시 후 다시 시도해주세요.");
        setSubmitting(false);
        return;
      }

      // 완료 화면과 결과 화면이 읽을 수 있게 이 브라우저에도 남긴다.
      saveDraft(effectiveRole, payload, body.participationCode, body.alreadyRegistered);
      router.push(isMentoring ? "/onboarding/mentoring/complete" : "/onboarding/complete");
    } catch {
      setError("연결에 실패했어요. 인터넷 상태를 확인해주세요.");
      setSubmitting(false);
    }
  };

  return (
    <>
      <OnboardingFunnel
        role={role ?? "MENTEE"}
        steps={activeSteps}
        registry={REGISTRY}
        initialDraft={initialDraft}
        onComplete={handleComplete}
      />

      {/* 제출 실패는 마지막 스텝 위에 덮어 보여준다. 화면을 벗어나면 다시 채워야 한다. */}
      {error && (
        <div className="fixed inset-x-0 bottom-[max(90px,env(safe-area-inset-bottom))] z-50 flex justify-center px-5">
          <p className="w-full max-w-[390px] rounded-2xl bg-red-500 px-5 py-4 text-center text-[14px] font-semibold text-white shadow-lg">
            {error}
          </p>
        </div>
      )}
    </>
  );
}
