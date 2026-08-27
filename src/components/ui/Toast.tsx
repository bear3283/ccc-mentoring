"use client";

import { animate, utils } from "animejs";
import { useEffect, useRef } from "react";
import { DURATION, ENTER_SPRING, REVEAL_EASE } from "@/shared/lib/anime";

interface ToastProps {
  /** 표시할 내용. null이면 아무것도 그리지 않는다. */
  message: string | null;
  /** 본문 아래 덧붙이는 보조 안내 */
  description?: string;
}

/**
 * 화면 하단에 잠깐 떴다 사라지는 알림.
 * 사라지는 시점은 이 컴포넌트가 아니라 부모가 message를 null로 바꿔 정한다.
 */
export function Toast({ message, description }: ToastProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !message) return;

    utils.set(el, { translateY: 24, opacity: 0 });
    animate(el, { translateY: [24, 0], opacity: [0, 1], ease: ENTER_SPRING });

    return () => {
      utils.remove(el);
    };
  }, [message]);

  if (!message) return null;

  return (
    <div
      // 스크린리더가 흐름을 끊지 않고 읽도록 polite 로 알린다.
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-[max(24px,env(safe-area-inset-bottom))] z-50 flex justify-center px-5"
    >
      <div
        ref={ref}
        className="w-full max-w-[390px] rounded-2xl bg-gray-900/95 px-5 py-4 text-center shadow-lg"
      >
        <p className="text-[15px] font-bold text-white">{message}</p>
        {description && (
          <p className="mt-1 text-[13px] leading-relaxed text-gray-300">{description}</p>
        )}
      </div>
    </div>
  );
}

/** 눌렀을 때 살짝 눌리는 반응. 복사 버튼처럼 결과가 눈에 안 보이는 동작에 필요하다. */
export function pressFeedback(el: HTMLElement) {
  animate(el, { scale: [0.97, 1], duration: DURATION.fade, ease: REVEAL_EASE });
}
