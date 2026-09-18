"use client";

import Link from "next/link";
import { MentoringGuide } from "@/features/venue/components/MentoringGuide";
import { useEffect, useRef, useState } from "react";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Name } from "@/components/ui/Name";
import { MentorCard } from "@/features/matching/components/MentorCard";
import type { MatchDiagnosis, PublicMatchResult } from "@/features/matching/model/types";
import { loadDraft } from "@/features/onboarding/lib/draftStore";
import { PERSONAS, type PersonaType } from "@/shared/constants/persona";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { objectParticle } from "@/shared/lib/particle";

interface MenteeSummary {
  name: string;
  participationCode: string;
  targetCampus: string[];
  desiredAreas: string[];
  personaType: PersonaType;
}

type State =
  | { kind: "loading" }
  | {
      kind: "ready";
      mentee: MenteeSummary;
      results: PublicMatchResult[];
      diagnosis?: MatchDiagnosis;
      /** 이미 매칭을 마쳤다면 그 멘토의 id. 1:1이라 한 명뿐이다. */
      settledMentorId?: string;
    }
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
          settledMentorId?: string;
          error?: string;
        };
        if (cancelled) return;

        if (!res.ok || !body.mentee || !body.results) {
          setState({ kind: "error", message: body.error ?? "결과를 불러오지 못했어요." });
          return;
        }
        setState({
          kind: "ready",
          mentee: body.mentee,
          results: body.results,
          diagnosis: body.diagnosis,
          settledMentorId: body.settledMentorId,
        });
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

  const [pending, setPending] = useState<PublicMatchResult>();
  const [matchError, setMatchError] = useState<string>();

  const handleMatch = async (result: PublicMatchResult) => {
    if (state.kind !== "ready" || requesting) return;

    // 1:1이라 한 번 고르면 되돌릴 수 없다. 먼저 확인을 받는다.
    // 이미 매칭한 상대의 연락처를 다시 보는 경우는 확인이 필요 없다.
    if (result.mentor.id !== state.settledMentorId && pending?.mentor.id !== result.mentor.id) {
      setPending(result);
      return;
    }

    setPending(undefined);
    setMatchError(undefined);
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
      } else {
        setMatchError(body.error ?? "요청하지 못했어요. 잠시 후 다시 시도해주세요.");
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
  const areas = mentee.desiredAreas.join(", ");
  // 서버가 확정된 매칭을 알려주면 그걸 따른다.
  // 화면을 새로 열면 revealed 는 비어 있으므로 이것만으로는 판단할 수 없다.
  const hasMatched = !!state.settledMentorId || Object.keys(revealed).length > 0;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-gray-100">
      <header className="bg-white px-6 pt-[max(20px,env(safe-area-inset-top))] pb-6">
        {/*
          아직 짝이 없을 때 "0명을 찾았어요"로 맞이하면 실패를 선언하는 꼴이 된다.
          아래 카드는 "조금만 기다려주세요"라고 하는데 제목만 반대로 말하고 있었다.
        */}
        <p className="text-[14px] font-medium text-brand">
          {results.length === 0 ? "멘토링 신청 완료" : "매칭 완료"}
        </p>
        <h1 className="mt-2 text-[22px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          {results.length === 0 ? (
            <>
              <Name replayKey={mentee.participationCode}>{mentee.name}</Name>님,
              <br />
              선배를 찾고 있어요
            </>
          ) : (
            <>
              <Name replayKey={mentee.participationCode}>{mentee.name}</Name>님과 잘 맞는
              <br />
              선배 {results.length}명을 찾았어요
            </>
          )}
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-gray-500">
          {mentee.targetCampus.join(" · ")} 중에서
          <br />
          {areas}
          {objectParticle(areas)} 도와줄 {PERSONAS[mentee.personaType].name}형 멘티 기준
        </p>

        <div className="mt-5">
          <CodeBadge code={mentee.participationCode} size="compact" />
        </div>
      </header>

      {matchError && (
        <p className="mx-5 mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-[14px] leading-relaxed text-red-600">
          {matchError}
        </p>
      )}

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
              myName={mentee.name}
              busy={requesting === result.mentor.id}
              // 한 명과 매칭했으면 나머지는 고를 수 없다.
              locked={hasMatched && result.mentor.id !== state.settledMentorId && !revealed[result.mentor.id]}
              settled={result.mentor.id === state.settledMentorId}
            />
          ))
        )}
      </div>

      {/* 매칭 결과가 있을 때만. 0명인 화면에 만남 안내를 붙이면 공허하다. */}
      {results.length > 0 && (
        <div className="mt-6 mb-10">
          <MentoringGuide />
        </div>
      )}

      {/* 되돌릴 수 없는 선택이라 한 번 더 확인한다. */}
      {pending && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
          <div className="w-full max-w-[390px] rounded-3xl bg-white p-6">
            <p className="text-[18px] leading-snug font-bold text-gray-900">
              {pending.mentor.name} 선배와 매칭할까요?
            </p>
            <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
              한 분과만 연결돼요. 매칭하면 다른 선배는 고를 수 없고,
              선택한 선배도 다른 후배와 매칭되지 않아요.
            </p>
            <button
              type="button"
              onClick={() => void handleMatch(pending)}
              className="mt-5 h-[52px] w-full rounded-2xl bg-brand text-[16px] font-bold text-white"
            >
              네, 이 선배와 할래요
            </button>
            <button
              type="button"
              onClick={() => setPending(undefined)}
              className="mt-2 h-[52px] w-full rounded-2xl bg-gray-100 text-[16px] font-semibold text-gray-700"
            >
              더 볼게요
            </button>
          </div>
        </div>
      )}
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
