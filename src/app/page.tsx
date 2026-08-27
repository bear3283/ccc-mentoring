"use client";

import Link from "next/link";
import { useRef } from "react";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";

/**
 * QR로 들어온 참가자가 처음 보는 화면.
 * 여기서 역할을 고르고 나면 서로 다른 온보딩으로 갈라진다.
 */
const ENTRIES = [
  {
    href: "/onboarding/mentee",
    emoji: "🎓",
    title: "멘티로 시작하기",
    description: "예비 대학생이에요. 선배를 찾고 싶어요.",
  },
  {
    href: "/onboarding/mentor",
    emoji: "🙌",
    title: "멘토로 시작하기",
    description: "CCC 재학생이에요. 후배를 도와주고 싶어요.",
  },
] as const;

// 운영자 화면(/admin)은 여기에 두지 않는다.
// 이 화면은 QR을 스캔한 참가자가 보는 곳이라, 관리자 링크가 노출되면 안 된다.
// 운영자는 주소를 직접 입력해 들어간다.

export default function HomePage() {
  const listRef = useRef<HTMLUListElement>(null);

  useStaggerReveal(listRef, { selector: "[data-entry]", startDelay: 200 });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white px-6">
      <header className="pt-16 pb-8">
        <p className="text-[14px] font-medium text-brand">CCC 멘토-멘티</p>
        <h1 className="mt-1.5 text-[26px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          어떤 이름으로
          <br />
          들어오시나요?
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
          역할에 따라 묻는 질문과 보이는 화면이 달라요.
        </p>
      </header>

      <ul ref={listRef} className="flex flex-col gap-2.5">
        {ENTRIES.map((entry) => (
          <li key={entry.href} data-entry>
            <Link
              href={entry.href}
              className="flex items-center gap-4 rounded-2xl bg-gray-50 p-4 transition-colors duration-150 active:bg-brand-soft"
            >
              <span
                className="flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-[24px]"
                aria-hidden
              >
                {entry.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-bold text-gray-900">
                  {entry.title}
                </span>
                <span className="mt-0.5 block text-[14px] text-gray-500">
                  {entry.description}
                </span>
              </span>
              <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-gray-300" fill="none" aria-hidden>
                <path
                  d="m9 5 7 7-7 7"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </li>
        ))}
      </ul>

      {/* 이미 신청한 사람이 다시 들어왔을 때의 통로 */}
      <p className="mt-6 text-center text-[13px] text-gray-400">
        이미 신청하셨나요?{" "}
        <Link href="/lookup" className="font-semibold text-brand">
          참여코드 조회
        </Link>
      </p>
    </div>
  );
}
