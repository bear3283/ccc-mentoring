"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Name } from "@/components/ui/Name";
import { MentorCard } from "@/features/matching/components/MentorCard";
import type { PublicMatchResult } from "@/features/matching/model/types";
import { loadDraft } from "@/features/onboarding/lib/draftStore";
import { PERSONAS, type PersonaType } from "@/shared/constants/persona";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";

interface MenteeSummary {
  name: string;
  participationCode: string;
  targetCampus: string[];
  desiredAreas: string[];
  personaType: PersonaType;
}

type State =
  | { kind: "loading" }
  | { kind: "ready"; mentee: MenteeSummary; results: PublicMatchResult[] }
  | { kind: "noSignup" }
  | { kind: "error"; message: string };

export default function MatchingResultPage() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const stored = loadDraft();
    if (!stored || stored.role !== "MENTEE") {
      setState({ kind: "noSignup" });
      return;
    }

    let cancelled = false;

    // 매칭은 서버에서 계산한다. 브라우저로는 상위 3명만, 연락처는 가려서 온다.
    fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participationCode: stored.participationCode }),
    })
      .then(async (res) => {
        const body = (await res.json()) as {
          mentee?: MenteeSummary;
          results?: PublicMatchResult[];
          error?: string;
        };
        if (cancelled) return;

        if (!res.ok || !body.mentee || !body.results) {
          setState({ kind: "error", message: body.error ?? "결과를 불러오지 못했어요." });
          return;
        }
        setState({ kind: "ready", mentee: body.mentee, results: body.results });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ kind: "error", message: "연결에 실패했어요. 잠시 후 다시 시도해주세요." });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const listRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(listRef, {
    selector: "[data-card]",
    gap: 90,
    distance: 20,
    startDelay: 120,
    replayKey: state.kind === "ready" ? state.mentee.participationCode : "none",
  });

  const handleMatch = (result: PublicMatchResult) => {
    // 실제로는 연락처 공개 동의를 받고 Matchings 상태를 REQUESTED 로 바꾼다.
    console.log("[matching] request", result.mentor.id);
  };

  if (state.kind === "loading") {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center justify-center bg-white">
        <p className="text-[15px] text-gray-400">잘 맞는 선배를 찾고 있어요…</p>
      </div>
    );
  }

  if (state.kind === "noSignup" || state.kind === "error") {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col justify-center bg-white px-6">
        <h1 className="text-[22px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          {state.kind === "noSignup" ? "신청 내역이 없어요" : "결과를 불러오지 못했어요"}
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
          {state.kind === "noSignup"
            ? "먼저 신청하시면 잘 맞는 선배를 찾아드려요."
            : state.message}
        </p>
        <Link
          href={state.kind === "noSignup" ? "/onboarding/mentee" : "/lookup"}
          className="mt-6 flex h-[54px] w-full items-center justify-center rounded-2xl bg-brand text-[17px] font-bold text-white"
        >
          {state.kind === "noSignup" ? "신청하기" : "참여코드로 조회하기"}
        </Link>
      </div>
    );
  }

  const { mentee, results } = state;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-gray-100">
      <header className="bg-white px-6 pt-[max(20px,env(safe-area-inset-top))] pb-6">
        <p className="text-[14px] font-medium text-brand">매칭 완료</p>
        <h1 className="mt-2 text-[22px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          <Name replayKey={mentee.participationCode}>{mentee.name}</Name>님과 잘 맞는
          <br />
          선배 {results.length}명을 찾았어요
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-gray-500">
          {mentee.targetCampus.join(" · ")} 중에서
          <br />
          {mentee.desiredAreas.join(", ")}을(를) 도와줄{" "}
          {PERSONAS[mentee.personaType].name}형 멘티 기준
        </p>

        <div className="mt-5">
          <CodeBadge code={mentee.participationCode} size="compact" />
        </div>
      </header>

      <div ref={listRef} className="flex flex-col gap-4 px-5 py-6">
        {results.length === 0 ? (
          <p className="rounded-2xl bg-white px-5 py-10 text-center text-[15px] leading-relaxed text-gray-500">
            조건에 맞는 멘토를 찾지 못했어요.
            <br />
            지망 캠퍼스나 가능 시간을 넓혀보세요.
          </p>
        ) : (
          results.map((result) => (
            <MentorCard key={result.mentor.id} result={result} onMatch={handleMatch} />
          ))
        )}
      </div>
    </div>
  );
}
