import { spring } from "animejs";

/**
 * 앱 전체가 공유하는 모션 토큰.
 * 화면마다 스프링 값을 따로 쓰면 "같은 앱" 느낌이 깨지므로 여기서만 정의한다.
 *
 * Anime.js v4 기준 API:
 *   v3의 `easing: 'spring(mass, stiffness, damping, velocity)'` 문자열은
 *   v4에서 `ease: spring({ mass, stiffness, damping, velocity })` 객체로 바뀌었다.
 */

/** 스텝 진입 등 큰 영역의 움직임. (1, 80, 10, 0) - 쫀득하게 안착하는 네이티브 느낌. */
export const ENTER_SPRING = spring({
  mass: 1,
  stiffness: 80,
  damping: 10,
  velocity: 0,
});

/** 버튼 눌림/체크 아이콘 등 작은 요소. 짧고 탄력 있게. */
export const TAP_SPRING = spring({
  mass: 0.6,
  stiffness: 180,
  damping: 12,
  velocity: 0,
});

/**
 * 리스트 아이템 등장에 쓰는 이징.
 * outExpo는 초반에 크게 움직이고 끝에서 급격히 감속해서,
 * 여러 개가 순차로 뜰 때 잔상이 지저분하지 않다.
 */
export const REVEAL_EASE = "outExpo" as const;

export const DURATION = {
  /** 배경 딤 등 단순 페이드 */
  fade: 200,
  /** 리스트 아이템 하나의 등장 */
  reveal: 520,
  /** 시트 닫힘 - 열릴 때보다 빨라야 답답하지 않다 */
  sheetExit: 260,
  /** 스텝 전환 */
  step: 340,
} as const;

/** 스태거 간격(ms). 4~6개 항목 기준에서 순차성이 읽히면서 지루하지 않은 값. */
export const STAGGER_GAP = 60;
