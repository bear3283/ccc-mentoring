"use client";

import { useEffect, useState } from "react";
import type { SeniorPreview as Preview } from "@/app/api/seniors/route";
import type { Gender } from "@/shared/constants/domain";
import { cn } from "@/shared/lib/cn";

/** 칩이 너무 많으면 카드가 길어져 신청 버튼이 밀려난다. */
const MAX_CHIPS = 6;

/**
 * "선배 N명이 기다리고 있어요" + 학교 칩.
 *
 * 멘토링을 권하는 자리(등록 완료 화면, 결과 화면의 신청 안내)에 붙인다.
 * 선배가 없거나 불러오지 못하면 아무것도 그리지 않는다 — "0명"은 신청을 오히려 막는다.
 *
 * tone="onBrand" 는 브랜드색 카드 위, "plain" 은 흰 바탕 위.
 */
export function SeniorPreview({ gender, tone }: { gender?: Gender; tone: "onBrand" | "plain" }) {
  const [preview, setPreview] = useState<Preview>();

  useEffect(() => {
    if (!gender) return;
    let alive = true;
    fetch(`/api/seniors?gender=${gender}`)
      .then((res) => (res.ok ? (res.json() as Promise<Preview>) : undefined))
      .then((body) => {
        if (alive && body) setPreview(body);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [gender]);

  if (!preview || preview.total === 0) return null;

  const shown = preview.campuses.slice(0, MAX_CHIPS);
  const rest = preview.campuses.length - shown.length;
  const onBrand = tone === "onBrand";

  return (
    <div className={cn("rounded-2xl p-4", onBrand ? "bg-white/12" : "bg-brand-soft")}>
      <p className={cn("text-[15px] leading-snug font-bold", onBrand ? "text-white" : "text-gray-900")}>
        지금 <span className={onBrand ? "" : "text-brand"}>{preview.campuses.length}개 학교</span> 선배{" "}
        <span className={onBrand ? "" : "text-brand"}>{preview.total}명</span>이 기다리고 있어요
      </p>
      <ul className="mt-2.5 flex flex-wrap gap-1.5">
        {shown.map((c) => (
          <li
            key={c.campus}
            className={cn(
              "rounded-full px-2.5 py-1 text-[13px] font-semibold",
              onBrand ? "bg-white/90 text-brand" : "bg-white text-gray-700",
            )}
          >
            {c.campus}
            <span className={cn("ml-1 tabular-nums", onBrand ? "text-brand/60" : "text-gray-400")}>{c.count}</span>
          </li>
        ))}
        {rest > 0 && (
          <li className={cn("px-1 py-1 text-[13px] font-semibold", onBrand ? "text-white/75" : "text-gray-500")}>
            외 {rest}곳
          </li>
        )}
      </ul>
    </div>
  );
}
