"use client";

import { useRef } from "react";
import { EVENT_DATE_LABEL, isAfterEvent, VENUE } from "@/shared/constants/venue";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/**
 * 멘토링 신청의 첫 화면.
 *
 * 여기서부터 질문이 여섯 개 더 이어진다. 왜 답해야 하는지 모르면
 * 두세 개 만에 그만둔다. 어떤 일이 벌어지는지 먼저 보여주고 시작한다.
 */

const FLOW = [
  {
    emoji: "📝",
    title: "몇 가지만 더 물어볼게요",
    detail: "관심사와 만날 수 있는 시간을 알려주시면 잘 맞는 짝을 찾아요.",
  },
  {
    emoji: "💬",
    title: "매칭되면 문자로 인사해요",
    detail: "전화보다 부담이 적어요. 편한 시간에 천천히 이야기 나눠요.",
  },
  {
    emoji: "⛪",
    // 채플이 지난 뒤에 신청한 사람에게 지난 날짜를 안내할 수는 없다.
    title: isAfterEvent()
      ? `${VENUE.name}에서 만나요`
      : `${EVENT_DATE_LABEL} ${VENUE.name}에서 만나요`,
    detail: isAfterEvent()
      ? "서로 편한 때를 정해 얼굴 보고 이야기하면 훨씬 깊어져요."
      : "미리 정한 장소에서 얼굴 보고 이야기하면 훨씬 깊어져요.",
  },
];

export function MentoringIntroStep({ role, onNext }: StepProps) {
  const isMentee = role === "MENTEE";

  const bodyRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(bodyRef, { selector: "[data-flow]", startDelay: 180, gap: 100 });

  return (
    <StepLayout
      eyebrow="멘토링 신청"
      question={isMentee ? "선배와 이어드릴게요" : "후배와 이어드릴게요"}
      hint={
        isMentee
          ? "궁금한 걸 먼저 겪어본 선배에게 물어볼 수 있어요."
          : "먼저 걸어온 길을 후배에게 나눠줄 수 있어요."
      }
      ctaLabel="시작할게요"
      onCta={() => onNext({})}
    >
      <div ref={bodyRef} className="flex flex-col gap-3">
        {FLOW.map((item, i) => (
          <div key={item.title} data-flow className="flex gap-3 opacity-0">
            <div className="flex flex-col items-center">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[18px]">
                {item.emoji}
              </span>
              {i < FLOW.length - 1 && <span className="mt-1 w-px flex-1 bg-brand/20" />}
            </div>
            <div className="pb-2">
              <p className="text-[16px] font-bold text-gray-900">{item.title}</p>
              <p className="mt-1 text-[14px] leading-relaxed text-gray-500">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-5 rounded-2xl bg-gray-50 px-4 py-3.5 text-[13px] leading-relaxed text-gray-500">
        신청하지 않아도 채플에는 오실 수 있어요. 등록은 이미 끝났어요.
      </p>
    </StepLayout>
  );
}
