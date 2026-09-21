"use client";

import Link from "next/link";
import { useRef } from "react";
import { EVENT_DATE_LABEL, EVENT_POSTER, VENUE } from "@/shared/constants/venue";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";

/**
 * QR로 들어온 참가자가 처음 보는 화면.
 *
 * 여기서 하는 일은 고3채플 등록이지 멘토링 신청이 아니다.
 * 그래서 역할을 고르게 하지 않는다 — 등록하러 온 사람에게 아직 신청하지도
 * 않은 프로그램의 용어로 자기를 분류하라고 할 이유가 없다.
 * 고3인지 대학생인지는 등록 안에서 한 번 물어본다.
 */

/** 등록에서 실제로 묻는 것. 미리 알려주면 "얼마나 걸리지?"를 재지 않는다. */
const ASKS = [
  { emoji: "🙋", text: "이름과 연락처" },
  { emoji: "🎓", text: "고3인지, CCC 대학생인지" },
  { emoji: "⛪", text: "출석하는 교회 (없어도 괜찮아요)" },
] as const;

// 운영자 화면(/admin)은 여기에 두지 않는다.
// 이 화면은 QR을 스캔한 참가자가 보는 곳이라, 관리자 링크가 노출되면 안 된다.
// 운영자는 주소를 직접 입력해 들어간다.

export default function HomePage() {
  const bodyRef = useRef<HTMLDivElement>(null);

  useStaggerReveal(bodyRef, { selector: "[data-reveal]", startDelay: 200 });

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white px-6">
      <div ref={bodyRef} className="flex-1">
        {/*
          포스터가 첫 화면의 시각적 앵커가 된다. 글보다 "무슨 행사인지"가 빨리 읽힌다.
          아직 없으면 개발 중에만 자리를 점선으로 보여준다.
        */}
        {EVENT_POSTER ? (
          /*
            높이를 화면의 1/3 로 묶는다. 묶지 않으면 세로 포스터가 첫 화면을
            통째로 차지해 "등록 시작하기"가 스크롤 아래로 밀린다.
            잘라내지 않고(object-contain) 줄이므로 포스터 글자가 잘리지 않는다.
            자세히 보려는 사람을 위해 눌러서 원본을 열 수 있게 한다.
          */
          <a
            data-reveal
            href={EVENT_POSTER.src}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 block"
            aria-label={`${EVENT_POSTER.alt} (눌러서 크게 보기)`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={EVENT_POSTER.src}
              alt={EVENT_POSTER.alt}
              style={{ aspectRatio: EVENT_POSTER.ratio }}
              className="mx-auto max-h-[33vh] w-auto max-w-full rounded-2xl bg-gray-50 object-contain"
            />
          </a>
        ) : (
          process.env.NODE_ENV === "development" && (
            <div
              data-reveal
              style={{ aspectRatio: "3 / 4" }}
              className="mx-auto mt-8 flex max-h-[33vh] w-auto max-w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-200 px-6 text-center"
            >
              <p className="text-[15px] font-bold text-gray-400">포스터 자리</p>
              <p className="text-[12px] leading-relaxed text-gray-400">
                public/ 에 이미지를 넣고
                <br />
                venue.ts 의 EVENT_POSTER 를 채우세요
                <br />
                (개발 중에만 보입니다)
              </p>
            </div>
          )
        )}

        <header className="pt-8 pb-8" data-reveal>
          {/* 언제·어디서인지가 첫 화면에 없으면 등록하고도 "그래서 언제지?"가 남는다. */}
          <p className="text-[14px] font-medium text-brand">
            고3채플 · {EVENT_DATE_LABEL} {VENUE.name}
          </p>
          <h1 className="mt-1.5 text-[26px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
            먼저 등록부터
            <br />
            할게요
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
            2분이면 끝나요. 선배와 만나는 멘토링은 등록한 뒤에 신청할 수 있어요.
          </p>
        </header>

        <ul className="flex flex-col gap-2.5" data-reveal>
          {ASKS.map((ask) => (
            <li
              key={ask.text}
              className="flex items-center gap-3.5 rounded-2xl bg-gray-50 px-4 py-3.5"
            >
              <span className="text-[20px]" aria-hidden>
                {ask.emoji}
              </span>
              <span className="text-[15px] font-medium text-gray-700">{ask.text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-2 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Link
          href="/onboarding/register"
          className="flex h-[54px] w-full items-center justify-center gap-1.5 rounded-2xl bg-brand text-[17px] font-bold text-white active:bg-brand-dark"
        >
          등록 시작하기
          <span className="text-[18px]" aria-hidden>
            →
          </span>
        </Link>

        {/*
          이미 등록한 사람이 다시 들어왔을 때의 통로.
          13px 회색 글씨로는 눌러야 하는 것으로 보이지 않아, 버튼 크기로 올린다.
          코드를 잊고 다시 들어오는 일은 드물지 않다.
        */}
        <Link
          href="/lookup"
          className="flex h-[52px] w-full items-center justify-center gap-1.5 rounded-2xl bg-gray-50 text-[15px] font-semibold text-gray-700 active:bg-gray-100"
        >
          이미 등록했어요
          <span className="font-bold text-brand">참여코드 조회</span>
        </Link>
      </div>
    </div>
  );
}
