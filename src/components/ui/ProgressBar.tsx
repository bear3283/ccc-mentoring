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

  // 점은 10개까지만 찍는다. 많아지면 뭉개진다.
  const showDots = !!steps && steps > 1 && steps <= 10;

  // 지금 몇 번째 점인지(1부터). value 는 (현재 스텝+1)/전체 라서 그대로 점 번호가 된다.
  const current = steps ? Math.round(clamped * steps) : 0;

  /*
   * 획이 칠해지는 길이.
   * 점은 양 끝을 포함해 고르게 놓이므로 n번째 점은 (n-1)/(전체-1) 자리에 있다.
   * value 를 그대로 쓰면 1/8 단계에서 획이 첫 점을 지나 둘째 점 쪽으로 반쯤 나가 있어,
   * "지금 어디인지"가 점과 획에서 서로 다르게 읽혔다. 점이 있을 때는 지금 점에서 멈춘다.
   */
  const fill = showDots ? Math.max(current - 1, 0) / (steps! - 1) : clamped;

  useEffect(() => {
    if (!fillRef.current) return;
    animate(fillRef.current, {
      width: `${fill * 100}%`,
      duration: DURATION.step,
      ease: REVEAL_EASE,
    });
  }, [fill]);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className="relative h-3 w-full"
    >
      {/*
        캔버스·획·점을 같은 폭 안에 둔다. 점 반지름(6px)만큼 안쪽으로 들여서
        첫 점과 끝 점의 가운데가 획의 시작·끝과 정확히 겹치게 한다.
      */}
      <div className="absolute inset-y-0 right-1.5 left-1.5">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-gray-200" />
        <div
          ref={fillRef}
          className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-paint-peach to-brand"
          style={{ width: `${fill * 100}%` }}
        />

        {showDots &&
          Array.from({ length: steps! }, (_, i) => {
            const passed = i + 1 < current;
            const here = i + 1 === current;
            return (
              <span
                key={i}
                style={{ left: `${(i / (steps! - 1)) * 100}%` }}
                className={cn(
                  "absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all duration-200",
                  here && "size-3 border-[3px] border-brand bg-white",
                  passed && "size-2 bg-brand",
                  !here && !passed && "size-2 bg-gray-200",
                )}
              />
            );
          })}
      </div>
    </div>
  );
}
