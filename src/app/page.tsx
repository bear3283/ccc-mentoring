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

/**
 * 등록에서 실제로 묻는 것. 미리 알려주면 "얼마나 걸리지?"를 재지 않는다.
 * 한 줄에 이어 붙이므로 각 항목은 짧아야 한다.
 */
const ASKS = ["이름", "연락처", "고3인지 대학생인지", "출석 교회"] as const;

// 운영자 화면(/admin)은 여기에 두지 않는다.
// 이 화면은 QR을 스캔한 참가자가 보는 곳이라, 관리자 링크가 노출되면 안 된다.
// 운영자는 주소를 직접 입력해 들어간다.

export default function HomePage() {
  const bodyRef = useRef<HTMLDivElement>(null);

  useStaggerReveal(bodyRef, { selector: "[data-reveal]", startDelay: 200 });

  return (
    // h-dvh 여야 본문이 스크롤되고 하단 CTA가 화면에 붙어 있을 수 있다.
    // min-h-dvh 로 두면 내용이 길어질 때 버튼이 아래로 밀려 내려간다.
    <div className="mx-auto flex h-dvh w-full max-w-[430px] flex-col bg-white">
      <div ref={bodyRef} className="flex min-h-0 flex-1 flex-col px-6">
        {/*
          제목·날짜·장소를 한 줄에 담는다. 크기로 위계를 주면 줄을 나누지 않아도
          무엇이 행사 이름이고 무엇이 부가 정보인지 읽힌다. 줄 수를 줄인 만큼
          포스터에 쓸 수 있는 높이가 늘어난다.
        */}
        <header className="shrink-0 pt-7" data-reveal>
          <h1 className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-[28px] leading-none font-bold tracking-[-0.03em] text-gray-900">
              고3채플
            </span>
            <span className="text-[15px] font-semibold text-gray-500">
              {EVENT_DATE_LABEL} · {VENUE.name}
            </span>
          </h1>
        </header>

        {/*
          포스터가 남는 높이를 전부 가져간다. 스크롤을 두지 않으므로
          기기가 작든 크든 한 화면에 들어오고, object-contain 이라 잘리지 않는다.
          자세히 보려는 사람은 눌러서 원본을 열 수 있다.
        */}
        {EVENT_POSTER ? (
          <a
            data-reveal
            href={EVENT_POSTER.src}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-0 flex-1 items-center justify-center py-4"
            aria-label={`${EVENT_POSTER.alt} (눌러서 크게 보기)`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={EVENT_POSTER.src}
              alt={EVENT_POSTER.alt}
              className="max-h-full max-w-full rounded-2xl bg-gray-50 object-contain"
            />
          </a>
        ) : (
          process.env.NODE_ENV === "development" && (
            <div
              data-reveal
              className="my-4 flex min-h-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-gray-200 px-6 text-center"
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

        {/*
          무엇을 묻는지 미리 알려 "얼마나 걸리지?"를 재지 않게 한다.
          카드로 쌓으면 높이를 많이 먹어서, 한 줄로 줄이고 그만큼을 포스터에 준다.
        */}
        <p data-reveal className="shrink-0 pb-4 text-[13px] leading-relaxed text-gray-500">
          {ASKS.join(" · ")}만 여쭤봐요.
          <br />
          선배와 이어지는 멘토링은 등록한 뒤에 신청할 수 있어요.
        </p>
      </div>

      {/* 스크롤과 무관하게 늘 보인다. 포스터가 아무리 길어도 버튼을 찾아 헤매지 않는다. */}
      <div className="shrink-0 border-t border-gray-100 bg-white px-6 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="flex flex-col gap-2">
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
    </div>
  );
}
