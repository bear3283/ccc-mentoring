"use client";

import { useEffect, useRef, useState } from "react";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { StepLayout } from "../StepLayout";
import type { StepProps } from "../../model/types";

/**
 * 등록의 마지막 화면. 둘 다 선택이라 비워도 넘어간다.
 *
 * 예전에는 출석 교회를 여기서 받았다. 교회 정보는 민감정보로 따로 동의를 받아야 하는데
 * 채플 운영에 꼭 필요하지 않아 받지 않기로 했다(2026-10-26).
 */
export function ExtraStep({ role, draft, onNext, onChange }: StepProps) {
  const isMentee = role === "MENTEE";

  const [referrer, setReferrer] = useState(draft.referrer ?? "");
  const [highSchool, setHighSchool] = useState(draft.highSchool ?? "");

  const bodyRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(bodyRef, { selector: "[data-group]", startDelay: 160, gap: 70 });

  const payload = {
    referrer: referrer.trim() || undefined,
    ...(isMentee ? { highSchool: highSchool.trim() || undefined } : {}),
  };

  useEffect(() => {
    onChange(payload);
    // payload 는 매 렌더 새로 만들어지므로 값들을 직접 의존성으로 둔다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [referrer, highSchool, onChange]);

  return (
    <StepLayout
      eyebrow="마지막이에요"
      question="누가 초대해 주었나요?"
      hint="적지 않아도 등록할 수 있어요."
      ctaLabel="등록 완료하기"
      onCta={() => onNext(payload)}
    >
      <div ref={bodyRef} className="flex flex-col gap-5">
        <section data-group>
          <Label optional>추천인</Label>
          <input
            type="text"
            value={referrer}
            onChange={(e) => setReferrer(e.target.value)}
            placeholder="초대해 준 분의 이름"
            className="h-[52px] w-full rounded-2xl bg-gray-50 px-4 text-[16px] font-medium text-gray-900 outline-none placeholder:text-gray-300 focus:bg-brand-soft"
          />
        </section>

        {isMentee && (
          <section data-group>
            <Label optional>출신 고등학교</Label>
            <input
              type="text"
              value={highSchool}
              onChange={(e) => setHighSchool(e.target.value)}
              placeholder="한빛고등학교"
              className="h-[52px] w-full rounded-2xl bg-gray-50 px-4 text-[16px] font-medium text-gray-900 outline-none placeholder:text-gray-300 focus:bg-brand-soft"
            />
          </section>
        )}
      </div>
    </StepLayout>
  );
}

function Label({ children, optional }: { children: React.ReactNode; optional?: boolean }) {
  return (
    <h2 className="mb-2 flex items-baseline gap-1.5 text-[15px] font-bold text-gray-900">
      {children}
      {optional && <span className="text-[13px] font-medium text-gray-400">선택</span>}
    </h2>
  );
}
