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
    detail: "관심사와 학교를 알려주시면 잘 맞는 짝을 찾아요.",
  },
  {
    emoji: "💬",
    title: "매칭되면 문자로 인사해요",
    detail: "전화보다 부담이 적어요. 멘토링 날짜도 문자로 서로 편한 때를 정해요.",
  },
  /*
   * 선배·후배의 만남은 채플 이후에 약속을 잡아 한 번 하는 것이 원칙이다.
   * 채플 날은 얼굴을 익히는 인사 자리라 따로 적는다. 채플이 지난 뒤에 신청한 사람에게는
   * 지난 날짜를 안내하지 않는다.
   */
  ...(isAfterEvent()
    ? []
    : [
        {
          emoji: "⛪",
          title: `${EVENT_DATE_LABEL} 채플에서 인사해요`,
          detail: `${VENUE.name}에서 얼굴을 익혀 두면 다음 만남이 훨씬 편해져요.`,
        },
      ]),
  {
    emoji: "📅",
    title: isAfterEvent() ? "약속을 잡고 한 번 만나요" : "채플 이후에 약속을 잡고 한 번 만나요",
    detail: "서로 편한 날을 문자로 정해 1회 만나 이야기를 나눠요.",
  },
];

export function MentoringIntroStep({ role, onNext }: StepProps) {
  const isMentee = role === "MENTEE";

  const bodyRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(bodyRef, { selector: "[data-flow]", startDelay: 180, gap: 100 });

  return (
    <StepLayout
      eyebrow={isMentee ? "멘토링 신청" : "한 영혼 품기 운동 · 멘토 신청"}
      question={isMentee ? "선배와 이어드릴게요" : "후배 한 영혼을 품어 주세요"}
      hint={
        isMentee
          ? "궁금한 걸 먼저 겪어본 선배에게 물어볼 수 있어요."
          : "고3·예비 27학번 후배에게 먼저 걸어온 길을 나눠 주세요."
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
