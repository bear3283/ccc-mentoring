"use client";

import Link from "next/link";
import { useRef } from "react";
import { EVENT_DATE_LABEL, isAfterEvent, VENUE } from "@/shared/constants/venue";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { cn } from "@/shared/lib/cn";

/**
 * 매칭 이후 무엇을 하면 되는지.
 *
 * 연락처만 주고 끝내면 대부분 첫 메시지를 못 보낸다.
 * '문자로 인사 → 채플 날 얼굴 보고 인사 → 그 뒤에 1:1 멘토링'이라는
 * 정해진 길을 보여줘서 다음 행동을 고민하지 않게 한다.
 *
 * 채플 날은 인사만 하는 자리고, 멘토링은 따로 한 번 한다. 예전 순서
 * (시간 정하기 → 채플에서 만나기)는 멘토링을 목요일에 하는 것처럼 읽혔다.
 */

interface Step {
  emoji: string;
  title: string;
  detail: string;
}

const GREET: Step = {
  emoji: "💬",
  title: "먼저 문자로 인사해요",
  detail: "전화보다 부담이 적어요. 이름과 어떻게 매칭됐는지만 밝혀도 충분해요.",
};

const CHAPEL: Step = {
  emoji: "⛪",
  title: `${EVENT_DATE_LABEL} 채플에서 얼굴 보고 인사해요`,
  detail: `${VENUE.name}에 몇 시쯤 오는지 서로 알려두고, 짧게 인사하며 얼굴을 익혀요.`,
};

const MENTORING: Step = {
  emoji: "📅",
  title: "1:1 멘토링 날을 정해요",
  detail: "서로 편한 날짜를 문자로 정해 따로 한 번 만나요. 온라인으로 해도 돼요.",
};

/** 채플이 지나면 인사 단계가 빠진다. 지난 날을 기다리라고 안내하지 않는다. */
const STEPS: Step[] = isAfterEvent() ? [GREET, MENTORING] : [GREET, CHAPEL, MENTORING];

interface MentoringGuideProps {
  /**
   * 지금 해야 할 단계(0부터). 주면 그 줄을 강조하고 "지금 할 일"을 붙인다.
   *
   * 매칭 직후 화면에서는 "문자 보내기"가 곧 1단계라, 버튼과 이 안내가
   * 같은 것을 가리켜야 한다. 따로 놓으면 버튼은 버튼대로 안내는 안내대로
   * 읽혀서 무엇을 먼저 할지가 흐려진다.
   */
  activeStep?: number;
  title?: string;
}

export function MentoringGuide({ activeStep, title = "매칭된 다음은요" }: MentoringGuideProps = {}) {
  const listRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(listRef, { selector: "[data-guide]", startDelay: 100, gap: 80 });

  return (
    <section className="px-5">
      <h2 className="text-[18px] font-bold tracking-[-0.01em] text-gray-900">
        {title}
      </h2>

      <div ref={listRef} className="mt-4 flex flex-col gap-3">
        {STEPS.map((step, i) => {
          const active = activeStep === i;
          const done = activeStep !== undefined && i < activeStep;
          return (
            <div key={step.title} data-guide className="flex gap-3 opacity-0">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[17px]",
                    active ? "bg-brand text-white" : "bg-brand-soft",
                    done && "opacity-40",
                  )}
                >
                  {step.emoji}
                </span>
                {/* 마지막 단계 아래에는 선을 긋지 않는다. */}
                {i < STEPS.length - 1 && <span className="mt-1 w-px flex-1 bg-brand/20" />}
              </div>
              <div className={cn("pb-1", done && "opacity-40")}>
                <p className="flex items-center gap-1.5 text-[15px] font-bold text-gray-900">
                  {step.title}
                  {active && (
                    <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">
                      지금 할 일
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-gray-500">
                  {step.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href="/venue"
        className="mt-5 flex h-[52px] w-full items-center justify-between rounded-2xl bg-brand-soft px-5 text-[15px] font-bold text-brand active:bg-brand-soft/70"
      >
        <span>오시는 길 보기</span>
        <span className="text-[18px]">→</span>
      </Link>
    </section>
  );
}
