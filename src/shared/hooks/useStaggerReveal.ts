"use client";

import { animate, stagger, utils } from "animejs";
import { useEffect, useLayoutEffect, type RefObject } from "react";
import { DURATION, REVEAL_EASE, STAGGER_GAP } from "@/shared/lib/anime";

/**
 * SSR에서는 useLayoutEffect가 경고를 내므로 서버에서만 useEffect로 낮춘다.
 * 브라우저에서는 반드시 useLayoutEffect여야 한다 - 페인트 전에 요소를 숨겨야
 * 최종 위치가 한 프레임 보였다가 애니메이션이 시작되는 깜빡임이 없다.
 */
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface StaggerRevealOptions {
  /** 컨테이너 안에서 순차 등장시킬 요소를 고르는 CSS 선택자 */
  selector: string;
  /** 아이템 사이 지연(ms) */
  gap?: number;
  /** 아래에서 올라오는 거리(px) */
  distance?: number;
  /** 첫 아이템이 뜨기까지의 대기(ms). 시트가 올라오는 동안 기다리게 할 때 쓴다. */
  startDelay?: number;
  /** 값이 바뀌면 애니메이션을 다시 재생한다 (예: 스텝 이름) */
  replayKey?: string | number;
}

/**
 * 컨테이너 하위 요소들을 Fade-in + Slide-up으로 순차 등장시킨다.
 * 온보딩 선택지와 매칭 결과 카드가 같은 리듬을 공유하도록 훅으로 분리했다.
 */
export function useStaggerReveal(
  containerRef: RefObject<HTMLElement | null>,
  {
    selector,
    gap = STAGGER_GAP,
    distance = 14,
    startDelay = 0,
    replayKey,
  }: StaggerRevealOptions,
) {
  useIsomorphicLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const targets = Array.from(container.querySelectorAll<HTMLElement>(selector));
    if (targets.length === 0) return;

    // 사용자가 "동작 줄이기"를 켰다면 움직임 없이 보여주기만 한다.
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReducedMotion) {
      utils.set(targets, { opacity: 1, translateY: 0 });
      return;
    }

    // 페인트 전에 숨겨 두고 시작한다.
    utils.set(targets, { opacity: 0, translateY: distance });

    const animation = animate(targets, {
      opacity: [0, 1],
      translateY: [distance, 0],
      duration: DURATION.reveal,
      ease: REVEAL_EASE,
      delay: stagger(gap, { start: startDelay }),
    });

    return () => {
      // StrictMode의 이펙트 중복 실행이나 스텝 전환 시 이전 애니메이션이
      // 살아남아 새 애니메이션과 싸우지 않도록 확실히 제거한다.
      animation.pause();
      utils.remove(targets);
    };
  }, [containerRef, selector, gap, distance, startDelay, replayKey]);
}
