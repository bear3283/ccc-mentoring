"use client";

import { animate } from "animejs";
import { useEffect, useRef } from "react";
import { DURATION, REVEAL_EASE } from "@/shared/lib/anime";
import { cn } from "@/shared/lib/cn";

interface ProgressBarProps {
  /** 0 ~ 1 */
  value: number;
  /** 전체 스텝 수. 주면 그 수만큼 물감 자국(점)을 찍는다. */
  steps?: number;
}

/**
 * 붓질 진행 표시.
 *
 * 포스터가 "다시 칠하다"라 진행률도 한 획이 칠해져 가는 것으로 읽히게 했다.
 * 획은 옅은 살구에서 시작해 지금 자리에서 가장 짙어진다 — 붓이 막 지나간 곳이
 * 물감이 가장 진한 것처럼. 지나온 점은 채워지고 지금 점만 테두리를 두른다.
 * "어디까지 왔고 지금 어디인지"가 막대 길이보다 점의 개수로 더 빨리 읽힌다.
 *
 * steps 가 없으면(끝을 모르는 경우) 그냥 획만 칠해진다.
 */
export function ProgressBar({ value, steps }: ProgressBarProps) {
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

  // 지금 몇 번째 점인지. value 는 (현재 스텝+1)/전체 라서 그대로 점 번호가 된다.
  const current = steps ? Math.round(clamped * steps) : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className="relative h-2.5 w-full"
    >
      {/* 캔버스와 획 */}
      <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-gray-200" />
      <div
        ref={fillRef}
        className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-paint-peach to-brand"
        style={{ width: `${clamped * 100}%` }}
      />

      {/* 점. 스텝이 많아지면 점이 뭉개지므로 10개까지만 찍는다. */}
      {steps && steps <= 10 && (
        <div className="absolute inset-0 flex items-center justify-between">
          {Array.from({ length: steps }, (_, i) => {
            const passed = i + 1 < current;
            const here = i + 1 === current;
            return (
              <span
                key={i}
                className={cn(
                  "size-2.5 rounded-full border-2 transition-colors duration-200",
                  here && "border-brand bg-white",
                  passed && "border-brand bg-brand",
                  !here && !passed && "border-gray-200 bg-gray-200",
                )}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
