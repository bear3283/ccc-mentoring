"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { MentoringGuide } from "@/features/venue/components/MentoringGuide";
import { useEffect, useRef, useState } from "react";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Name } from "@/components/ui/Name";
import { MentorCard } from "@/features/matching/components/MentorCard";
import type { MatchDiagnosis, PublicMatchResult } from "@/features/matching/model/types";
import { loadDraft, saveDraft } from "@/features/onboarding/lib/draftStore";
import { EMPTY_DRAFT, type OnboardingDraft } from "@/features/onboarding/model/types";
import {
  isValidParticipationCode,
  normalizeParticipationCode,
} from "@/features/onboarding/lib/participationCode";
import type { PersonaType } from "@/shared/constants/persona";
import type { EventArrival } from "@/shared/constants/venue";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { objectParticle } from "@/shared/lib/particle";

interface MenteeSummary {
  name: string;
  participationCode: string;
  targetCampus: string[];
  desiredAreas: string[];
  personaType?: PersonaType;
  eventArrival?: EventArrival;
}

type State =
  | { kind: "loading" }
  | {
      kind: "ready";
      mentee: MenteeSummary;
      results: PublicMatchResult[];
      diagnosis?: MatchDiagnosis;
      /** 이미 매칭을 마쳤다면 그 멘토의 id. 멘티는 한 명만 고르므로 하나뿐이다. */
      settledMentorId?: string;
    }
  /** 참여코드를 모르는 상태. 코드를 넣는 칸을 보여준다. */
  | { kind: "enterCode"; message?: string; needsMentoring?: boolean };

export default function MatchingResultPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });

  /**
   * 결과를 불러온다. 참여코드만 있으면 어느 기기에서든 볼 수 있다.
   *
   * 예전에는 이 브라우저에 남은 신청 기록(sessionStorage)으로만 열려서, 탭을 닫았거나
   * 다른 폰으로 들어오면 코드를 알아도 결과를 볼 수 없었다.
   * 결과를 받으면 이 탭에도 기록해 둔다. 다음 화면(/matching/settled)이 그 기록을 읽는다.
   */
  const load = async (code: string) => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participationCode: code }),
      });
      const body = (await res.json()) as {
        mentee?: MenteeSummary;
        results?: PublicMatchResult[];
        diagnosis?: MatchDiagnosis;
        settledMentorId?: string;
        needsMentoring?: boolean;
        error?: string;
      };

      if (!res.ok || !body.mentee || !body.results) {
        setState({
          kind: "enterCode",
          message: body.error ?? "결과를 불러오지 못했어요.",
          needsMentoring: body.needsMentoring,
        });
        return;
      }

      const stored = loadDraft();
      const sameCode = stored?.participationCode === body.mentee.participationCode;
      saveDraft(
        "MENTEE",
        {
          ...(sameCode && stored ? stored.draft : EMPTY_DRAFT),
          name: body.mentee.name,
          desiredAreas: body.mentee.desiredAreas as OnboardingDraft["desiredAreas"],
          eventArrival: body.mentee.eventArrival,
        },
        body.mentee.participationCode,
      );

      setState({
        kind: "ready",
        mentee: body.mentee,
        results: body.results,
        diagnosis: body.diagnosis,
        settledMentorId: body.settledMentorId,
      });
    } catch {
      setState({ kind: "enterCode", message: "연결에 실패했어요. 잠시 후 다시 시도해주세요." });
    }
  };

  /*
   * 코드를 고르는 순서:
   *  - 링크의 #뒤 코드(참여코드 조회 화면에서 넘어온 경우). #뒤는 서버 접속 기록에 남지 않는다.
   *  - 이 브라우저에서 방금 신청한 고3의 코드
   *  - 둘 다 없으면 코드를 넣는 칸
   */
  useEffect(() => {
    const fromLink = normalizeParticipationCode(decodeURIComponent(window.location.hash.slice(1)));
    const stored = loadDraft();
    const code = isValidParticipationCode(fromLink)
      ? fromLink
      : stored?.role === "MENTEE"
        ? stored.participationCode
        : undefined;
    if (code) void load(code);
    else setState({ kind: "enterCode" });
    // load 는 상태를 바꾸기만 해서 첫 렌더 한 번만 돌리면 된다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const listRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(listRef, {
    selector: "[data-card]",
    gap: 90,
    distance: 20,
    startDelay: 120,
    replayKey: state.kind === "ready" ? state.mentee.participationCode : "none",
  });

  const [requesting, setRequesting] = useState<string>();

  const [pending, setPending] = useState<PublicMatchResult>();
  const [matchError, setMatchError] = useState<string>();

  const handleMatch = async (result: PublicMatchResult) => {
    if (state.kind !== "ready" || requesting) return;

    // 한 번 고르면 되돌릴 수 없다. 먼저 확인을 받는다.
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
        // 연락처를 이 목록 안에서 펼치지 않고 전용 화면으로 보낸다.
        // 여기서는 "고르는 일"이 끝났고, 다음은 "연락하는 일"이라 화면을 나눈다.
        router.push("/matching/settled");
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

  if (state.kind === "enterCode") {
    return (
      <CodeEntry
        message={state.message}
        needsMentoring={state.needsMentoring}
        onSubmit={(code) => {
          // 새로고침해도 같은 결과가 나오게 주소에도 남긴다.
          window.history.replaceState(null, "", `#${code}`);
          void load(code);
        }}
      />
    );
  }

  const { mentee, results, diagnosis } = state;
  const areas = mentee.desiredAreas.join(", ");
  // 확정 여부는 서버가 알려주는 값 하나로만 판단한다.
  const hasMatched = !!state.settledMentorId;
  // 지망 캠퍼스에 선배가 없어 같은 학과·지역 선배를 대신 보여주는 경우.
  // 서버는 지망 캠퍼스 후보가 한 명이라도 있으면 대체 후보를 섞지 않는다.
  const isFallback = results.length > 0 && results.every((r) => r.fallback);

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-gray-100">
      <header className="bg-white px-6 pt-[max(20px,env(safe-area-inset-top))] pb-6">
        {/*
          아직 짝이 없을 때 "0명을 찾았어요"로 맞이하면 실패를 선언하는 꼴이 된다.
          아래 카드는 "조금만 기다려주세요"라고 하는데 제목만 반대로 말하고 있었다.
        */}
        <p className="text-[14px] font-medium text-brand">
          {results.length === 0
            ? "멘토링 신청 완료"
            : isFallback && !hasMatched
              ? "지망 캠퍼스 밖에서 찾았어요"
              : "매칭 완료"}
        </p>
        <h1 className="mt-2 text-[22px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          {results.length === 0 ? (
            <>
              <Name replayKey={mentee.participationCode}>{mentee.name}</Name>님,
              <br />
              선배를 찾고 있어요
            </>
          ) : isFallback && !hasMatched ? (
            <>
              <Name replayKey={mentee.participationCode}>{mentee.name}</Name>님께 도움이 될
              <br />
              선배 {results.length}명을 찾았어요
            </>
          ) : (
            <>
              <Name replayKey={mentee.participationCode}>{mentee.name}</Name>님과 잘 맞는
              <br />
              선배 {results.length}명을 찾았어요
            </>
          )}
        </h1>
        {isFallback && !hasMatched ? (
          // 지망을 무시한 결과처럼 보이면 안 된다. 왜 다른 학교 선배인지 먼저 밝힌다.
          <p className="mt-3 text-[14px] leading-relaxed text-gray-500">
            {mentee.targetCampus.join(" · ")}에는 아직 선배가 없어서
            <br />
            희망 학과를 다니거나 같은 지역에 있는 선배를 모았어요.
          </p>
        ) : (
          <p className="mt-3 text-[14px] leading-relaxed text-gray-500">
            {mentee.targetCampus.join(" · ")} 중에서
            <br />
            {areas}
            {objectParticle(areas)} 도와줄 선배를 찾았어요
          </p>
        )}

        <div className="mt-5">
          <CodeBadge code={mentee.participationCode} size="compact" />
        </div>
      </header>

      {matchError && (
        <p className="mx-5 mt-4 rounded-2xl bg-red-500/10 px-4 py-3 text-[14px] leading-relaxed text-red-600">
          {matchError}
        </p>
      )}

      {/*
        이미 고른 사람은 목록을 다시 볼 이유가 없다. 할 일은 "연락하기" 하나뿐이라
        그 화면으로 가는 길을 맨 위에 둔다.
      */}
      {state.settledMentorId && (
        <div className="px-5 pt-5">
          <Link
            href="/matching/settled"
            className="flex h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-brand text-[17px] font-bold text-white active:bg-brand-dark"
          >
            연결된 선배에게 문자 보내기
            <span className="text-[19px]" aria-hidden>
              →
            </span>
          </Link>
        </div>
      )}

      <div ref={listRef} className="flex flex-col gap-4 px-5 py-6">
        {/*
          기다리는 것도 선택지다. 지망 캠퍼스 선배는 계속 신청하고 있어서,
          지금 고르지 않고 나중에 다시 열면 그쪽이 먼저 나온다.
        */}
        {isFallback && !hasMatched && (
          <p className="rounded-2xl bg-white px-4 py-3 text-[13px] leading-relaxed text-gray-600">
            지망 캠퍼스 선배를 기다리고 싶다면 지금 고르지 않아도 돼요. 선배가 신청하면
            이 화면을 다시 열었을 때 먼저 보여드려요.
          </p>
        )}
        {results.length === 0 ? (
          <EmptyResult diagnosis={diagnosis} targetCampus={mentee.targetCampus} />
        ) : (
          results.map((result) => (
            <MentorCard
              key={result.mentor.id}
              result={result}
              onMatch={handleMatch}
              busy={requesting === result.mentor.id}
              // 한 명과 매칭했으면 나머지는 고를 수 없다.
              locked={hasMatched && result.mentor.id !== state.settledMentorId}
              settled={result.mentor.id === state.settledMentorId}
            />
          ))
        )}
      </div>

      {/*
        매칭 결과가 있을 때만. 0명인 화면에 만남 안내를 붙이면 공허하다.
        이미 확정한 사람에게는 연결 화면에서 같은 안내를 "지금 할 일"과 함께 보여주므로
        여기서 또 보여주지 않는다.
      */}
      {results.length > 0 && !state.settledMentorId && (
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
              {pending.fallback && "지망 캠퍼스 밖의 선배예요. "}
              선배는 한 분만 고를 수 있어요. 매칭하면 다른 선배는 더 고를 수 없어요.
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

    // 성별을 받기 전에 등록한 사람. 같은 성별끼리만 이어서 후보가 0명으로 나온다.
    if (diagnosis.genderMissing) {
      return {
        title: "성별을 알려주시면 선배를 찾아드릴게요",
        detail:
          "같은 성별의 선배와 이어드려요. 처음 화면에서 같은 이름·번호로 다시 등록하며 성별을 고르고, 이어서 멘토링을 신청해주세요.",
      };
    }

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
      {/*
        보통은 멘토링 신청으로 보낸다. 등록은 이미 끝났다.
        성별이 비어 있으면 성별을 묻는 등록부터 다시 해야 한다(같은 번호면 기존 코드가 나온다).
      */}
      <Link
        href={diagnosis?.genderMissing ? "/onboarding/register" : "/onboarding/mentoring/mentee"}
        className="mt-5 inline-flex h-11 items-center rounded-xl bg-brand-soft px-5 text-[14px] font-bold text-brand"
      >
        {diagnosis?.genderMissing ? "성별 넣어 다시 등록하기" : "조건 바꿔서 다시 신청하기"}
      </Link>
    </div>
  );
}

/**
 * 참여코드로 결과 열기. 선배 확인 화면(/mentor/match)과 같은 방식이다.
 *
 * 코드를 모를 때만 이름·연락처 조회(/lookup)로 보낸다. "참여코드로 조회하기"를 눌렀는데
 * 이름과 연락처를 묻는 화면이 나오면 무엇을 해야 하는지 헷갈린다.
 */
function CodeEntry({
  message,
  needsMentoring,
  onSubmit,
}: {
  message?: string;
  needsMentoring?: boolean;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  const normalized = normalizeParticipationCode(code);
  const valid = isValidParticipationCode(normalized);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-white px-6">
      <header className="pt-14 pb-6">
        <p className="text-[14px] font-medium text-brand">매칭 결과</p>
        <h1 className="mt-1.5 text-[24px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          참여코드를 넣어주세요
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-gray-500">
          등록할 때 받은 6자리 코드로 선배 매칭 결과를 볼 수 있어요.
        </p>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) onSubmit(normalized);
        }}
      >
        <h2 className="mb-2 text-[15px] font-bold text-gray-900">참여코드</h2>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="예: K7PQ4M"
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={8}
          className="h-[52px] w-full rounded-2xl bg-gray-50 px-4 font-mono text-[18px] tracking-[0.2em] text-gray-900 outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-gray-300 focus:bg-brand-soft"
        />

        {message && (
          <p className="mt-3 rounded-xl bg-red-500/10 px-4 py-3 text-[14px] leading-relaxed text-red-600">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={!valid}
          className="mt-4 h-[54px] w-full rounded-2xl bg-brand text-[17px] font-bold text-white active:bg-brand-dark disabled:bg-brand/30"
        >
          결과 보기
        </button>
      </form>

      {/* 등록만 하고 멘토링을 신청하지 않은 고3. 같은 이름·번호로 다시 등록하면 기존 코드로 이어진다. */}
      {needsMentoring && (
        <Link
          href="/onboarding/register"
          className="mt-3 flex h-[52px] w-full items-center justify-center rounded-2xl bg-brand-soft text-[16px] font-bold text-brand"
        >
          멘토링 신청하러 가기
        </Link>
      )}

      <div className="mt-auto pt-8 pb-[max(24px,env(safe-area-inset-bottom))]">
        <p className="text-center text-[13px] text-gray-400">
          코드를 잊으셨나요?{" "}
          <Link href="/lookup" className="font-semibold text-brand">
            이름과 연락처로 찾기
          </Link>
        </p>
      </div>
    </div>
  );
}
