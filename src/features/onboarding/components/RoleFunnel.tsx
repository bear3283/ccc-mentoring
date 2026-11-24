"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Role } from "@/shared/constants/role";
import { isAfterEvent } from "@/shared/constants/venue";
import { clearDraft, loadDraft, saveDraft, type StoredDraft } from "../lib/draftStore";
import { lookupUrlFor, MENTORING_PATH } from "../lib/mentoringPath";
import { OnboardingFunnel, type StepRegistry } from "./OnboardingFunnel";
import { ArrivalStep } from "./steps/ArrivalStep";
import { AreaStep } from "./steps/AreaStep";
import { BasicStep } from "./steps/BasicStep";
import { CampusStep, RegisterCampusStep } from "./steps/CampusStep";
import { CapacityStep } from "./steps/CapacityStep";
import { ConsentStep } from "./steps/ConsentStep";
import { ExtraStep } from "./steps/ExtraStep";
import { MajorStep } from "./steps/MajorStep";
import { MbtiStep } from "./steps/MbtiStep";
import { MentoringIntroStep } from "./steps/MentoringIntroStep";
import { PersonaStep } from "./steps/PersonaStep";
import { PhotoStep } from "./steps/PhotoStep";
import { RoleStep } from "./steps/RoleStep";
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
  registerCampus: RegisterCampusStep,
  extra: ExtraStep,

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
  capacity: CapacityStep,
  eventArrival: ArrivalStep,
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
  const mentoringRole: RoleOnly = role ?? "MENTEE";

  /**
   * 2단계는 등록한 사람만 할 수 있다. 등록 정보(참여코드)는 이 탭의 sessionStorage 에만 있어서
   * QR·카톡 링크로 새 탭에서 열면 비어 있다. 확인 없이 질문을 다 받으면 마지막 제출에서야
   * "등록 정보를 찾지 못했어요"로 막히므로, 들어오자마자 확인해서 없으면 조회 화면으로 보낸다.
   * 조회가 끝나면 이 화면으로 돌아온다(next).
   *
   * undefined = 아직 확인 전. sessionStorage 는 브라우저에서만 읽을 수 있어 첫 렌더 뒤에 확인한다.
   */
  const [stored, setStored] = useState<StoredDraft | null>();

  useEffect(() => {
    if (!isMentoring) return;
    const found = loadDraft();
    if (!found) {
      router.replace(lookupUrlFor(MENTORING_PATH[mentoringRole]));
      return;
    }
    // 고3으로 등록한 사람이 멘토 신청 QR을 찍은 경우처럼 역할이 다르면, 맞는 신청 화면으로 보낸다.
    // 그대로 두면 서버가 "등록하신 역할과 달라요"로 마지막에 막는다.
    if (found.role !== mentoringRole) {
      router.replace(MENTORING_PATH[found.role]);
      return;
    }
    setStored(found);
  }, [isMentoring, mentoringRole, router]);

  /**
   * 2단계는 1단계에서 저장한 내용 위에 이어 쓴다.
   * 처음부터 다시 묻지 않으려면 브라우저에 남긴 초안을 먼저 읽어야 한다.
   */
  const initialDraft: OnboardingDraft = isMentoring
    ? (stored?.draft ?? EMPTY_DRAFT)
    : EMPTY_DRAFT;

  const campusKnownAtStart = isMentoring && !!initialDraft.currentCampus && !!initialDraft.admissionYear;

  // 1단계는 모두 같은 순서를 밟는다. 역할은 그 안의 한 스텝으로 받는다.
  const source = isMentoring ? MENTORING_STEPS_BY_ROLE[role ?? "MENTEE"] : REGISTER_STEPS;

  // 구현이 끝난 스텝만 태운다. 채플이 지난 뒤에는 당일 도착 시간을 묻지 않는다.
  const activeSteps = source.filter(
    (step): step is OnboardingStep =>
      step in REGISTRY && !(step === "eventArrival" && isAfterEvent()),
  );

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
        reason?: string;
      };

      // 답하는 도중 등록 정보가 사라졌거나 서버에 없는 코드였다. 오류만 띄우면 할 수 있는 게 없으니
      // 조회 화면으로 보내 다시 찾고 이 화면으로 돌아오게 한다.
      if (isMentoring && res.status === 401 && body.reason === "NOT_REGISTERED") {
        clearDraft();
        router.replace(lookupUrlFor(MENTORING_PATH[mentoringRole], "expired"));
        return;
      }

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

  // 등록 확인이 끝나기 전에는 질문을 보여주지 않는다. 확인이 안 되면 곧바로 조회 화면으로 넘어간다.
  if (isMentoring && !stored) return null;

  return (
    <>
      <OnboardingFunnel
        role={role ?? "MENTEE"}
        steps={activeSteps}
        registry={REGISTRY}
        initialDraft={initialDraft}
        // 대학생은 추천인·출신 고교 대신 학교·학번을 답하고 거기서 등록이 끝난다.
        // 멘토 신청에서는 등록 때 학교·학번을 이미 고른 사람의 학교 화면을 건너뛴다.
        // 처음 초안으로 정한다. 지금 초안으로 보면 학교를 고르는 순간 이 화면이 목록에서 빠진다.
        skip={(step, draft) =>
          (step === "extra" && draft.role === "MENTOR") ||
          (step === "registerCampus" && draft.role !== "MENTOR") ||
          (step === "currentCampus" && campusKnownAtStart)
        }
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
