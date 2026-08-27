"use client";

import { animate, utils } from "animejs";
import { useEffect, useRef } from "react";
import { REVEAL_EASE } from "@/shared/lib/anime";
import { cn } from "@/shared/lib/cn";

/** 획이 그어지는 데 걸리는 시간. 너무 빠르면 그어진 걸 눈치채지 못한다. */
const STROKE_DURATION = 620;
/** 문장이 먼저 읽히고 나서 형광펜이 지나가야 자연스럽다. */
const STROKE_DELAY = 260;

interface NameProps {
  children: string;
  /** 애니메이션을 다시 재생시키고 싶을 때 바꿔주는 값 (예: 멘티 id) */
  replayKey?: string | number;
  className?: string;
}

/**
 * 사람 이름 강조.
 * 문장 안에 섞인 이름 뒤로 라임색 형광펜이 지나가듯 그어진다.
 * 바이올렛 위에 바이올렛을 겹치면 묻히기 때문에 보색 쪽 라임을 쓴다.
 */
export function Name({ children, replayKey, className }: NameProps) {
  const strokeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const stroke = strokeRef.current;
    if (!stroke) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      utils.set(stroke, { scaleX: 1 });
      return;
    }

    utils.set(stroke, { scaleX: 0 });
    animate(stroke, {
      scaleX: [0, 1],
      duration: STROKE_DURATION,
      delay: STROKE_DELAY,
      ease: REVEAL_EASE,
    });

    return () => {
      utils.remove(stroke);
    };
  }, [children, replayKey]);

  return (
    <span className={cn("relative inline-block", className)}>
      {/* 글자 아래쪽 절반을 덮어 형광펜처럼 보이게 한다. em 단위라 어떤 글자 크기에서도 비율이 유지된다. */}
      <span
        ref={strokeRef}
        aria-hidden
        className="absolute inset-x-[-0.1em] bottom-[0.13em] h-[0.46em] origin-left rounded-[0.08em] bg-accent-lime"
        style={{ transform: "scaleX(0)" }}
      />
      {/* 형광펜 위로 글자가 올라오도록 별도 레이어로 감싼다. */}
      <span className="relative">{children}</span>
    </span>
  );
}
