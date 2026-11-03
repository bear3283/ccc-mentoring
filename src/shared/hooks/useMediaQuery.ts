"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * 화면 너비 같은 미디어 쿼리가 맞는지.
 *
 * CSS 로 숨기는 대신 이 값으로 아예 한쪽만 그린다. 운영자 표는 수백 행이라
 * 표와 카드를 둘 다 그려 두면 휴대폰에서 같은 명단을 두 번 만드는 셈이다.
 * 서버에서는 알 수 없어 false(넓은 화면)로 그린 뒤, 브라우저에서 맞춘다.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Tailwind 의 md(768px) 아래. 운영자 화면은 여기서 표 대신 카드로 바뀐다. */
export const PHONE_QUERY = "(max-width: 767px)";
