"use client";

import { useRef } from "react";
import { MEETING_SPOTS, MEETING_SPOTS_ARE_DRAFT } from "@/shared/constants/venue";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";

/**
 * 교회 안에서 멘토와 멘티가 만날 만한 장소.
 *
 * 행사 당일 "어디서 만나지?"에서 대화가 끊기는 일이 많다.
 * 미리 몇 곳을 정해 두면 채팅에서 장소를 고르기만 하면 된다.
 */
export function MeetingSpots() {
  const listRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(listRef, { selector: "[data-spot]", startDelay: 120, gap: 70 });

  return (
    <section className="px-5">
      <h2 className="text-[18px] font-bold tracking-[-0.01em] text-gray-900">
        어디서 만날까요?
      </h2>
      <p className="mt-1.5 text-[14px] leading-relaxed text-gray-500">
        교회 안에서 이야기 나누기 좋은 곳이에요. 채팅으로 미리 정해두면
        당일에 헤매지 않아요.
      </p>

      <div ref={listRef} className="mt-4 flex flex-col gap-2">
        {MEETING_SPOTS.map((spot) => (
          <div
            key={spot.id}
            data-spot
            className="flex gap-3 rounded-2xl bg-gray-50 p-4 opacity-0"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[20px]">
              {spot.emoji}
            </span>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5">
                <span className="text-[16px] font-bold text-gray-900">{spot.name}</span>
                <span className="rounded-md bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-500">
                  {spot.floor}
                </span>
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-600">{spot.mood}</p>
              <p className="mt-1 text-[12px] text-gray-400">적정 인원 {spot.capacity}</p>
            </div>
          </div>
        ))}
      </div>

      {MEETING_SPOTS_ARE_DRAFT && (
        <p className="mt-3 rounded-xl bg-brand-soft px-3.5 py-2.5 text-[12px] leading-relaxed text-brand">
          아직 예시예요. 행사 공간이 확정되면 실제 장소로 바뀝니다.
        </p>
      )}
    </section>
  );
}
