"use client";

import { useEffect, useRef } from "react";
import { CtaButton } from "@/components/ui/CtaButton";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";

interface StepLayoutProps {
  /** 질문 위의 작은 라벨 */
  eyebrow: string;
  /** 이 스텝의 질문. 한 스텝에 하나만. */
  question: React.ReactNode;
  /** 질문 아래 보조 설명 */
  hint?: string;
  /** 선택지/입력 영역 */
  children: React.ReactNode;
  ctaLabel: string;
  ctaDisabled?: boolean;
  onCta: () => void;
}

/**
 * 토스식 대화형 온보딩 스텝의 공통 골격.
 *
 * 바텀 시트를 쓰지 않는 이유:
 * 시트는 높이가 콘텐츠에 묶여서 선택지가 늘어나면 CTA가 화면 밖으로 밀려나고,
 * 시트가 배경 스크롤까지 잠그면 사용자가 다음으로 진행할 방법이 사라진다.
 * 대신 화면 전체를 쓰고 CTA를 하단에 고정해 어떤 길이의 질문에도 안전하게 대응한다.
 *
 * 구조: [질문 헤더] [스크롤되는 선택지 영역] [항상 보이는 하단 CTA]
 */
export function StepLayout({
  eyebrow,
  question,
  hint,
  children,
  ctaLabel,
  ctaDisabled,
  onCta,
}: StepLayoutProps) {
  const headerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 라벨 -> 질문 -> 힌트 순으로 말을 거는 것처럼 순차 등장한다.
  useStaggerReveal(headerRef, {
    selector: "[data-reveal]",
    gap: 70,
    distance: 10,
  });

  // 스텝이 바뀌어도 React가 같은 스크롤 컨테이너를 재사용하기 때문에
  // 이전 스텝에서 내려둔 스크롤 위치가 그대로 남아 첫 선택지가 잘려 보인다.
  // 질문이 바뀔 때마다 맨 위로 되돌린다.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [question]);

  return (
    // min-h-0 이 있어야 자식의 overflow-y-auto 가 실제로 스크롤된다.
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 셸 폭이 430px로 고정이라 반응형 크기 변화를 두지 않는다.
          작은 화면(667px)에서도 선택지 전체와 CTA가 스크롤 없이 들어가는 값. */}
      <div ref={headerRef} className="shrink-0 px-6 pt-5 pb-4">
        <p data-reveal className="text-[14px] font-medium text-brand">
          {eyebrow}
        </p>

        <h1
          data-reveal
          className="mt-1.5 text-[22px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900"
        >
          {question}
        </h1>

        {hint && (
          <p data-reveal className="mt-2 text-[14px] leading-relaxed text-gray-500">
            {hint}
          </p>
        )}
      </div>

      {/* 선택지가 많아지면 이 영역만 스크롤된다. CTA는 영향받지 않는다. */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
        {children}
      </div>

      {/* 항상 화면 하단에 붙어 있는 CTA. 위쪽 그라디언트로 스크롤 여지를 암시한다. */}
      <div className="shrink-0 px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
        <CtaButton disabled={ctaDisabled} onClick={onCta}>
          {ctaLabel}
        </CtaButton>
      </div>
    </div>
  );
}
