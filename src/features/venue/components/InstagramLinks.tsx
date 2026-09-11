"use client";

import { useRef } from "react";
import { instagramLinkFor } from "@/shared/constants/instagram";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";

/**
 * 캠퍼스 CCC 인스타그램으로 연결.
 *
 * 행사가 끝나도 이어질 통로가 필요하다. 매칭된 한 사람만 남기보다
 * 그 캠퍼스 공동체로 연결되는 편이 오래 간다.
 */
interface InstagramLinksProps {
  /** 멘티는 지망 학교들, 멘토는 재학 중인 학교. */
  campuses: readonly string[];
}

export function InstagramLinks({ campuses }: InstagramLinksProps) {
  const listRef = useRef<HTMLUListElement>(null);
  useStaggerReveal(listRef, { selector: "[data-ig]", startDelay: 120, gap: 70 });

  if (campuses.length === 0) return null;

  return (
    <section className="px-5">
      <h2 className="text-[18px] font-bold tracking-[-0.01em] text-gray-900">
        캠퍼스 CCC 소식 받기
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-gray-500">
        관심 있는 학교의 CCC를 팔로우하면 모임과 행사 소식을 먼저 볼 수 있어요.
      </p>

      <ul ref={listRef} className="mt-4 flex flex-col gap-2">
        {campuses.map((campus) => {
          const link = instagramLinkFor(campus);

          return (
            <li key={campus} data-ig className="opacity-0">
              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3.5 active:bg-gray-100"
              >
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[17px]"
                  style={{
                    background:
                      "linear-gradient(45deg,#f9ce34 0%,#ee2a7b 50%,#6228d7 100%)",
                  }}
                >
                  📷
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-bold text-gray-900">
                    {campus} CCC
                  </span>
                  {/* 확인된 계정이 아니면 그렇다고 밝힌다.
                      바로 프로필이 열릴 거라 기대하고 눌렀다가 검색 결과가 나오면 당황한다. */}
                  <span className="mt-0.5 block text-[12px] text-gray-400">
                    {link.verified ? "인스타그램에서 보기" : "인스타그램에서 찾아보기"}
                  </span>
                </span>
                <span className="shrink-0 text-[16px] text-gray-300">→</span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
