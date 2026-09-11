"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Name } from "@/components/ui/Name";
import { MentorCard } from "@/features/matching/components/MentorCard";
import type { MatchDiagnosis, PublicMatchResult } from "@/features/matching/model/types";
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
  | { kind: "ready"; mentee: MenteeSummary; results: PublicMatchResult[]; diagnosis?: MatchDiagnosis }
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
          diagnosis?: MatchDiagnosis;
          error?: string;
        };
        if (cancelled) return;

        if (!res.ok || !body.mentee || !body.results) {
          setState({ kind: "error", message: body.error ?? "결과를 불러오지 못했어요." });
          return;
        }
        setState({ kind: "ready", mentee: body.mentee, results: body.results, diagnosis: body.diagnosis });
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

  // 요청해서 공개된 연락처. 멘토 id -> 전체 번호
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [requesting, setRequesting] = useState<string>();

  const handleMatch = async (result: PublicMatchResult) => {
    if (state.kind !== "ready" || requesting) return;
    setRequesting(result.mentor.id);
    try {
      const res = await fetch("/api/match/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participationCode: state.mentee.participationCode,
          mentorId: result.mentor.id,
        }),
      });
      const body = (await res.json()) as { contact?: string; error?: string };
      if (res.ok && body.contact) {
        setRevealed((prev) => ({ ...prev, [result.mentor.id]: body.contact! }));
      }
    } catch {
      // 실패하면 카드는 그대로 두고 다시 누를 수 있게 한다.
    } finally {
      setRequesting(undefined);
    }
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

  const { mentee, results, diagnosis } = state;

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
          <EmptyResult diagnosis={diagnosis} targetCampus={mentee.targetCampus} />
        ) : (
          results.map((result) => (
            <MentorCard
              key={result.mentor.id}
              result={result}
              onMatch={handleMatch}
              revealedContact={revealed[result.mentor.id]}
              busy={requesting === result.mentor.id}
            />
          ))
        )}
      </div>
    </div>
  );
}

/**
 * 결과가 없을 때.
 *
 * "조건에 맞는 멘토가 없어요" 만으로는 무엇을 고쳐야 할지 알 수 없다.
 * 어느 단계에서 걸렀는지 구체적으로 알려준다.
 */
function EmptyResult({
  diagnosis,
  targetCampus,
}: {
  diagnosis?: MatchDiagnosis;
  targetCampus: string[];
}) {
  const reason = (() => {
    if (!diagnosis) return null;

    if (diagnosis.totalMentors === 0) {
      return {
        title: "아직 등록된 선배가 없어요",
        detail: "선배들이 신청을 마치면 알려드릴게요. 조금만 기다려주세요.",
      };
    }

    if (diagnosis.inTargetCampus === 0) {
      const empty = diagnosis.emptyCampuses.join(", ") || targetCampus.join(", ");
      return {
        title: `${empty}에는 아직 선배가 없어요`,
        detail: `다른 캠퍼스에는 ${diagnosis.totalMentors}명이 신청했어요. 지망 캠퍼스를 넓히면 만날 수 있어요.`,
      };
    }

    return {
      title: "선배는 있는데 조건이 맞지 않아요",
      detail: `지망 캠퍼스에 ${diagnosis.inTargetCampus}명이 있어요. 관심 분야를 넓혀보세요.`,
    };
  })();

  return (
    <div className="rounded-2xl bg-white px-5 py-9 text-center">
      <p className="text-[16px] font-bold text-gray-900">
        {reason?.title ?? "조건에 맞는 선배를 찾지 못했어요"}
      </p>
      <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
        {reason?.detail ?? "지망 캠퍼스나 관심 분야를 넓혀보세요."}
      </p>
      <Link
        href="/onboarding/mentee"
        className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand-soft px-5 text-[14px] font-bold text-brand"
      >
        조건 바꿔서 다시 신청하기
      </Link>
    </div>
  );
}
