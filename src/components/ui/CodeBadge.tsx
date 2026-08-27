"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { pressFeedback, Toast } from "./Toast";

/** 알림이 떠 있는 시간. 너무 짧으면 못 읽고, 길면 화면을 가린다. */
const TOAST_MS = 2600;

interface CodeBadgeProps {
  code: string;
  /** large = 발급 직후 주인공, compact = 다른 화면에서 참고용 */
  size?: "large" | "compact";
}

/**
 * 참여코드를 누르면 클립보드에 복사되고 알림이 뜬다.
 * 코드는 나중에 다시 입력해야 하는 값이라, 보여주기만 하면 사용자가 직접
 * 받아 적어야 한다. 코드 자체를 누를 수 있게 만들어 그 수고를 없앤다.
 */
export function CodeBadge({ code, size = "large" }: CodeBadgeProps) {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  // 컴포넌트가 사라진 뒤 setState가 불리지 않도록 타이머를 정리한다.
  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setToast(null), TOAST_MS);
  }, []);

  const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
    pressFeedback(e.currentTarget);
    try {
      await navigator.clipboard.writeText(code);
      showToast("참여코드를 복사했어요");
    } catch {
      // 클립보드가 막힌 환경(비 HTTPS 등)에서는 화면의 코드를 보고 적으면 된다.
      showToast("복사하지 못했어요");
    }
  };

  const isLarge = size === "large";

  return (
    <>
      <button
        type="button"
        onClick={handleCopy}
        aria-label={`참여코드 ${code.split("").join(" ")} 복사하기`}
        className={cn(
          "w-full rounded-3xl bg-brand-soft transition-colors duration-150 active:bg-brand/15",
          isLarge ? "px-6 py-7" : "px-4 py-3",
        )}
      >
        {isLarge ? (
          <>
            <span className="block text-[13px] font-semibold text-brand">나의 참여코드</span>
            <span className="mt-2 block font-mono text-[34px] leading-none font-bold tracking-[0.2em] text-gray-900">
              {code}
            </span>
            <span className="mt-3 block text-[13px] font-semibold text-brand">
              눌러서 복사하기
            </span>
          </>
        ) : (
          <span className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-brand">참여코드</span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-[16px] font-bold tracking-[0.14em] text-gray-900">
                {code}
              </span>
              <span className="text-[12px] font-semibold text-brand">복사</span>
            </span>
          </span>
        )}
      </button>

      <Toast
        message={toast}
        description={
          toast === "참여코드를 복사했어요"
            ? "메모장이나 메시지에 붙여넣어 두세요. 현장에서 입력해야 해요."
            : undefined
        }
      />
    </>
  );
}
