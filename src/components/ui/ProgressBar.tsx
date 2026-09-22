"use client";

import { animate } from "animejs";
import { useEffect, useRef } from "react";
import { DURATION, REVEAL_EASE } from "@/shared/lib/anime";
import { cn } from "@/shared/lib/cn";

interface ProgressBarProps {
  /** 0 ~ 1 */
  value: number;
  /** 전체 스텝 수. 주면 역(station)을 그 수만큼 찍는다. */
  steps?: number;
}

/**
 * 노선도 진행 표시.
 *
 * 포스터가 노선도라 진행률도 노선으로 읽히게 했다. 지나온 역은 채워지고
 * 지금 있는 역만 테두리를 두른다 — "어디까지 왔고 지금 어디인지"가
 * 막대 길이보다 역의 개수로 더 빨리 읽힌다.
 *
 * steps 가 없으면(끝을 모르는 경우) 그냥 선만 찬다.
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

  // 지금 몇 번째 역인지. value 는 (현재 스텝+1)/전체 라서 그대로 역 번호가 된다.
  const current = steps ? Math.round(clamped * steps) : 0;

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className="relative h-2.5 w-full"
    >
      {/* 노선 */}
      <div className="absolute top-1/2 h-[3px] w-full -translate-y-1/2 rounded-full bg-gray-200" />
      <div
        ref={fillRef}
        className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-brand"
        style={{ width: `${clamped * 100}%` }}
      />

      {/* 역. 스텝이 많아지면 점이 뭉개지므로 10개까지만 찍는다. */}
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
