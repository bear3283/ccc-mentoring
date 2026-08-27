"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MentorCard } from "@/features/matching/components/MentorCard";
import { matchMentors } from "@/features/matching/lib/score";
import type { MatchResult, Mentee } from "@/features/matching/model/types";
import { loadDraft } from "@/features/onboarding/lib/draftStore";
import { draftToMentee } from "@/features/onboarding/lib/draftToProfile";
import { CodeBadge } from "@/components/ui/CodeBadge";
import { Name } from "@/components/ui/Name";
import { useStaggerReveal } from "@/shared/hooks/useStaggerReveal";
import { MOCK_MENTEES, MOCK_MENTORS } from "@/shared/lib/mock/generate";
import { PERSONAS } from "@/shared/constants/persona";

/** 온보딩을 거쳐 온 사람인지, 더미로 화면만 보는 중인지 구분한다. */
type Source = { kind: "loading" } | { kind: "submitted"; mentee: Mentee } | { kind: "preview" };

export default function MatchingResultPage() {
  const [source, setSource] = useState<Source>({ kind: "loading" });
  // 더미로 볼 때만 쓰는 멘티 전환기.
  const [previewIndex, setPreviewIndex] = useState(1);

  // sessionStorage는 서버에서 읽을 수 없어 마운트 후에 확인한다.
  useEffect(() => {
    const stored = loadDraft();
    if (stored?.role === "MENTEE") {
      const mentee = draftToMentee(stored.draft, stored.participationCode);
      if (mentee) {
        setSource({ kind: "submitted", mentee });
        return;
      }
    }
    setSource({ kind: "preview" });
  }, []);

  const mentee =
    source.kind === "submitted" ? source.mentee : MOCK_MENTEES[previewIndex];

  const results = useMemo(
    () => (mentee ? matchMentors(mentee, MOCK_MENTORS, 3) : []),
    [mentee],
  );

  const listRef = useRef<HTMLDivElement>(null);
  useStaggerReveal(listRef, {
    selector: "[data-card]",
    gap: 90,
    distance: 20,
    startDelay: 120,
    replayKey: mentee?.id ?? "none",
  });

  const handleMatch = (result: MatchResult) => {
    // 실제로는 연락처 공개 동의를 받고 Matchings 레코드를 만든다.
    console.log("[matching] match", result.mentor.id, result.mentor.contact);
  };

  // 판별이 끝나기 전에 더미를 먼저 그리면 이름이 바뀌며 깜빡인다.
  if (source.kind === "loading" || !mentee) return null;

  const isSubmitted = source.kind === "submitted";

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[430px] bg-gray-100">
      <header className="bg-white px-6 pt-[max(20px,env(safe-area-inset-top))] pb-6">
        <p className="text-[14px] font-medium text-brand">매칭 완료</p>
        <h1 className="mt-2 text-[22px] leading-[1.35] font-bold tracking-[-0.02em] text-gray-900">
          <Name replayKey={mentee.id}>{mentee.name}</Name>님과 잘 맞는
          <br />
          선배 {results.length}명을 찾았어요
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-gray-500">
          {mentee.targetCampus.join(" · ")} 중에서
          <br />
          {mentee.desiredAreas.join(", ")}을(를) 도와줄{" "}
          {PERSONAS[mentee.personaType].name}형 멘티 기준
        </p>

        {isSubmitted ? (
          // 신청자에게는 참여코드를 계속 보여준다. 캡처 한 장으로 끝나게.
          <div className="mt-5">
            <CodeBadge code={mentee.participationCode} size="compact" />
          </div>
        ) : (
          // 온보딩을 거치지 않고 열었을 때만 나오는 더미 전환기.
          <div className="mt-5">
            <p className="mb-2 text-[12px] text-gray-400">
              신청 내역이 없어 예시 데이터를 보여주고 있어요.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewIndex((i) => (i - 1 + MOCK_MENTEES.length) % MOCK_MENTEES.length)}
                className="h-9 flex-1 rounded-xl bg-gray-100 text-[14px] font-semibold text-gray-700"
              >
                이전 예시
              </button>
              <span className="w-16 text-center text-[13px] font-medium text-gray-400 tabular-nums">
                {previewIndex + 1}/{MOCK_MENTEES.length}
              </span>
              <button
                type="button"
                onClick={() => setPreviewIndex((i) => (i + 1) % MOCK_MENTEES.length)}
                className="h-9 flex-1 rounded-xl bg-gray-100 text-[14px] font-semibold text-gray-700"
              >
                다음 예시
              </button>
            </div>
            <Link
              href="/onboarding/mentee"
              className="mt-2 flex h-9 items-center justify-center rounded-xl bg-brand-soft text-[14px] font-bold text-brand"
            >
              내 정보로 매칭받기
            </Link>
          </div>
        )}
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
