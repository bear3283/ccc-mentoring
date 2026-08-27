"use client";

import { animate, utils } from "animejs";
import { useEffect, useRef, type ComponentType } from "react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DURATION, REVEAL_EASE } from "@/shared/lib/anime";
import { useFunnel } from "../hooks/useFunnel";
import type { Role } from "@/shared/constants/role";
import type { OnboardingDraft, OnboardingStep, StepProps } from "../model/types";

/**
 * 스텝 이름 -> 컴포넌트 레지스트리.
 * 퍼널은 순서와 진행 상태만 알고, 어떤 화면이 붙는지는 호출부가 정한다.
 * 새 스텝을 만들면 여기에 등록만 하면 된다.
 */
export type StepRegistry = Partial<Record<OnboardingStep, ComponentType<StepProps>>>;

interface OnboardingFunnelProps {
  role: Extract<Role, "MENTEE" | "MENTOR">;
  steps: readonly OnboardingStep[];
  registry: StepRegistry;
  onComplete: (draft: OnboardingDraft) => void;
}

export function OnboardingFunnel({ role, steps, registry, onComplete }: OnboardingFunnelProps) {
  const { step, stepIndex, progress, draft, isFirst, isLast, next, back, update } =
    useFunnel(steps);

  const mainRef = useRef<HTMLElement>(null);
  const previousStepRef = useRef(step);

  // 스텝이 바뀔 때 본문 전체가 옆에서 밀려 들어온다.
  // 첫 진입에는 재생하지 않는다 - 스텝 내부의 스태거가 이미 등장을 담당한다.
  useEffect(() => {
    if (previousStepRef.current === step) return;
    previousStepRef.current = step;

    const main = mainRef.current;
    if (!main) return;

    animate(main, {
      opacity: [0, 1],
      translateX: [20, 0],
      duration: DURATION.step,
      ease: REVEAL_EASE,
    });

    return () => {
      utils.remove(main);
    };
  }, [step]);

  const StepComponent = registry[step];

  if (!StepComponent) {
    throw new Error(`온보딩 스텝 "${step}"이 registry에 등록되지 않았습니다.`);
  }

  const handleNext = (patch: Partial<OnboardingDraft>) => {
    if (isLast) {
      onComplete({ ...draft, ...patch });
      return;
    }
    next(patch);
  };

  return (
    // min-h-dvh 가 아니라 h-dvh 여야 한다. 높이가 고정되어야 스텝 내부의
    // 선택지 영역이 스크롤되고 하단 CTA가 화면에 붙어 있을 수 있다.
    <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-white">
      <header className="flex items-center gap-3 px-5 pt-[max(12px,env(safe-area-inset-top))] pb-3">
        <button
          type="button"
          onClick={back}
          disabled={isFirst}
          aria-label="이전 단계로"
          className="-ml-2 flex size-9 items-center justify-center rounded-full text-gray-700 disabled:opacity-0"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="none" aria-hidden>
            <path
              d="M15 19 8 12l7-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <div className="flex-1">
          <ProgressBar value={progress} />
        </div>

        <span className="w-10 text-right text-[13px] font-medium tabular-nums text-gray-400">
          {stepIndex + 1}/{steps.length}
        </span>
      </header>

      <main ref={mainRef} className="flex min-h-0 flex-1 flex-col">
        {/* key가 없으면 React가 스텝 간에 DOM 노드와 내부 상태를 재사용한다.
            이전 스텝의 스크롤 위치가 남아 첫 선택지가 잘려 보이고,
            같은 컴포넌트를 쓰는 스텝끼리는 선택값까지 새어 나온다. */}
        <StepComponent
          key={step}
          role={role}
          draft={draft}
          onNext={handleNext}
          onChange={update}
        />
      </main>
    </div>
  );
}
