"use client";

import Link from "next/link";
import { useRef } from "react";
import { VENUE } from "@/shared/constants/venue";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";

/**
 * 매칭 이후 무엇을 하면 되는지.
 *
 * 연락처만 주고 끝내면 대부분 첫 메시지를 못 보낸다.
 * '채팅으로 인사 → 당일 교회에서 만남'이라는 정해진 길을 보여줘서
 * 다음 행동을 고민하지 않게 한다.
 */

interface Step {
  emoji: string;
  title: string;
  detail: string;
}

const STEPS: Step[] = [
  {
    emoji: "💬",
    title: "먼저 채팅으로 인사해요",
    detail:
      "전화보다 부담이 적어요. 이름과 어떻게 매칭됐는지만 밝혀도 충분해요.",
  },
  {
    emoji: "📅",
    title: "만날 시간과 장소를 정해요",
    detail: "행사 당일 몇 시에, 교회 어디에서 볼지 미리 정해두면 편해요.",
  },
  {
    emoji: "⛪",
    title: `행사 당일 ${VENUE.name}에서 만나요`,
    detail: "직접 얼굴 보고 나누는 이야기가 제일 오래 남아요.",
  },
];

export function MentoringGuide() {
  const listRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(listRef, { selector: "[data-guide]", startDelay: 100, gap: 80 });

  return (
    <section className="px-5">
      <h2 className="text-[18px] font-bold tracking-[-0.01em] text-gray-900">
        매칭된 다음은요
      </h2>

      <div ref={listRef} className="mt-4 flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <div key={step.title} data-guide className="flex gap-3 opacity-0">
            <div className="flex flex-col items-center">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[17px]">
                {step.emoji}
              </span>
              {/* 마지막 단계 아래에는 선을 긋지 않는다. */}
              {i < STEPS.length - 1 && <span className="mt-1 w-px flex-1 bg-brand/20" />}
            </div>
            <div className="pb-1">
              <p className="text-[15px] font-bold text-gray-900">{step.title}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-500">
                {step.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/venue"
        className="mt-5 flex h-[52px] w-full items-center justify-between rounded-2xl bg-brand-soft px-5 text-[15px] font-bold text-brand active:bg-brand-soft/70"
      >
        <span>오시는 길 · 만날 장소 보기</span>
        <span className="text-[18px]">→</span>
      </Link>
    </section>
  );
}
