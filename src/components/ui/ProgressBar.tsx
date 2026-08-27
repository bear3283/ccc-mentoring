"use client";

import { animate } from "animejs";
import { useEffect, useRef } from "react";
import { DURATION, REVEAL_EASE } from "@/shared/lib/anime";

interface ProgressBarProps {
  /** 0 ~ 1 */
  value: number;
}

export function ProgressBar({ value }: ProgressBarProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const clamped = Math.min(Math.max(value, 0), 1);

  useEffect(() => {
    if (!fillRef.current) return;
    animate(fillRef.current, {
      width: `${clamped * 100}%`,
      duration: DURATION.step,
      ease: REVEAL_EASE,
    });
  }, [clamped]);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className="h-1 w-full overflow-hidden rounded-full bg-gray-100"
    >
      {/* 초기 너비를 인라인으로 넣어 첫 렌더에도 올바른 진행률이 보이게 한다. */}
      <div
        ref={fillRef}
        className="h-full rounded-full bg-brand"
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  );
}
