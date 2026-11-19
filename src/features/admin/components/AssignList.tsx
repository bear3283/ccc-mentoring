"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Mentee } from "@/features/matching/model/types";
import { cn } from "@/shared/lib/cn";
import type { MatchRow } from "./AdminDashboard";

const SETTLED = new Set(["REQUESTED", "CONFIRMED"]);

/**
 * "직접 연결" 탭 — 멘티를 신청했지만 선배를 고르지 않은 후배를 운영자가 잇는다.
 *
 * 후배마다 저장된 추천(최대 3명)을 보여 주고 1순위를 먼저 골라 둔다. 운영자가 다른
 * 선배로 바꿀 수 있다. 연결하면 후배가 직접 고른 것과 같아져서 선배 정원이 차고,
 * "연결 알림" 탭에 선배·후배 알림이 함께 올라온다.
 *
 * 추천이 없는 후배는 "전체 매칭 실행"으로 추천을 먼저 만들어야 한다.
 * 휴대폰에서도 쓰도록 표가 아니라 카드로 둔다.
 */
export function AssignList({
  mentees,
  matchRows,
  readOnly,
}: {
  mentees: Mentee[];
  matchRows: MatchRow[];
  readOnly: boolean;
}) {
  const router = useRouter();
  const settledCodes = new Set(matchRows.filter((r) => SETTLED.has(r.status)).map((r) => r.menteeCode));
  const waiting = mentees.filter((m) => m.mentoringApplied && !settledCodes.has(m.participationCode));
  const candidatesOf = (code: string) =>
    matchRows.filter((r) => r.menteeCode === code && r.status === "SUGGESTED").sort((a, b) => a.rank - b.rank);
  const withCandidates = waiting.filter((m) => candidatesOf(m.participationCode).length > 0);
  const without = waiting.filter((m) => candidatesOf(m.participationCode).length === 0);

  /** 후배별로 고른 추천(matchingId). 고르지 않았으면 1순위. */
  const [picked, setPicked] = useState<Record<string, string>>({});
  /** 한 번 더 묻는 중인 후배 코드 */
  const [confirming, setConfirming] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string }>();

  const assign = async (mentee: Mentee, row: MatchRow) => {
    if (busy) return;
    setBusy(true);
    setMessage(undefined);
    try {
      const res = await fetch("/api/admin/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchingId: row.matchingId }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setMessage({ tone: "error", text: body.error ?? "연결하지 못했어요." });
        return;
      }
      setMessage({
        tone: "ok",
        text: `${mentee.name} 후배와 ${row.mentorName} 선배를 연결했어요. "연결 알림" 탭에서 두 사람에게 문자를 보내 주세요.`,
      });
      setConfirming(undefined);
      // 매칭 표·미매칭·알림 탭이 모두 같은 데이터를 쓴다. 서버에서 다시 받는다.
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "연결에 실패했어요." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto pb-6">
      <p className="mb-4 max-w-[640px] text-[13px] leading-relaxed text-gray-500">
        멘티를 신청했지만 아직 선배를 고르지 않은 후배예요. 추천된 선배 중 한 명을 골라{" "}
        <b className="text-gray-700">연결</b>하면 후배가 직접 고른 것과 같아져요. 연결한 뒤에는{" "}
        <b className="text-gray-700">연결 알림</b> 탭에서 선배와 후배 모두에게 문자를 보내 주세요.
      </p>

      {message && (
        <p
          className={cn(
            "mb-3 max-w-[640px] rounded-lg px-4 py-2.5 text-[13px]",
            message.tone === "ok" ? "bg-brand-soft font-medium text-brand" : "bg-red-500/10 text-red-600",
          )}
        >
          {message.text}
        </p>
      )}

      <h2 className="mb-2 text-[14px] font-bold text-gray-900">
        연결할 후배 <span className="tabular-nums text-brand">{withCandidates.length}</span>
      </h2>
      {withCandidates.length === 0 ? (
        <p className="mb-6 max-w-[640px] rounded-lg bg-gray-50 px-4 py-6 text-center text-[13px] text-gray-500">
          선배를 기다리는 후배가 없어요.
        </p>
      ) : (
        <ul className="mb-6 flex max-w-[640px] flex-col gap-2">
          {withCandidates.map((mentee) => {
            const candidates = candidatesOf(mentee.participationCode);
            const chosen = candidates.find((c) => c.matchingId === picked[mentee.participationCode]) ?? candidates[0];
            return (
              <li key={mentee.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-[16px] font-bold text-gray-900">
                  {mentee.name} 후배
                  <span className="ml-2 font-mono text-[13px] font-medium text-gray-500">
                    {mentee.participationCode}
                  </span>
                </p>
                <p className="mt-0.5 text-[13px] text-gray-500">
                  지망 {mentee.targetCampus.join(" > ") || "-"}
                </p>

                <ul role="radiogroup" className="mt-3 flex flex-col gap-1.5">
                  {candidates.map((c) => {
                    const active = c.matchingId === chosen.matchingId;
                    return (
                      <li key={c.matchingId}>
                        <button
                          type="button"
                          role="radio"
                          aria-checked={active}
                          disabled={readOnly}
                          onClick={() => {
                            setPicked((p) => ({ ...p, [mentee.participationCode]: c.matchingId }));
                            setConfirming(undefined);
                          }}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left text-[14px]",
                            active ? "border-brand bg-brand-soft" : "border-transparent bg-gray-50",
                          )}
                        >
                          <span className="w-10 shrink-0 text-[12px] font-semibold text-gray-400">{c.rank}순위</span>
                          <span className="min-w-0 flex-1">
                            <b className="text-gray-900">{c.mentorName}</b>
                            <span className="ml-1.5 text-gray-500">{c.mentorCampus}</span>
                            {c.fallback && (
                              <span className="ml-1.5 rounded bg-gray-200 px-1 text-[11px] text-gray-600">
                                {c.fallback === "MAJOR" ? "대체·학과" : "대체·지역"}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 tabular-nums text-[13px] font-semibold text-gray-600">
                            {c.score}%
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                {!readOnly &&
                  (confirming === mentee.participationCode ? (
                    <div className="mt-3 rounded-lg bg-brand-soft px-3 py-2.5 text-[13px] text-brand">
                      <p className="font-semibold">
                        {mentee.name} 후배를 {chosen.mentorName} 선배({chosen.mentorCampus})와 연결할까요?
                      </p>
                      <p className="mt-0.5 text-gray-600">선배 자리가 하나 차요. 되돌리려면 개발자에게 요청해야 해요.</p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => void assign(mentee, chosen)}
                          disabled={busy}
                          className="h-10 flex-1 rounded-lg bg-brand text-[14px] font-bold text-white disabled:opacity-40"
                        >
                          {busy ? "연결 중…" : "연결"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(undefined)}
                          className="h-10 px-4 text-[14px] font-semibold text-gray-500"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMessage(undefined);
                        setConfirming(mentee.participationCode);
                      }}
                      className="mt-3 h-11 w-full rounded-lg bg-brand text-[14px] font-bold text-white active:bg-brand-dark"
                    >
                      {chosen.mentorName} 선배와 연결
                    </button>
                  ))}
              </li>
            );
          })}
        </ul>
      )}

      {without.length > 0 && (
        <>
          <h2 className="mb-2 text-[14px] font-bold text-gray-900">
            추천이 없는 후배 <span className="tabular-nums text-gray-500">{without.length}</span>
          </h2>
          <p className="mb-2 max-w-[640px] text-[13px] text-gray-500">
            추천을 아직 계산하지 않았거나, 지망 캠퍼스·같은 학과·같은 지역에 자리가 남은 선배가 없어요.
            {!readOnly && " 위쪽 \"전체 매칭 실행\"을 누르고 새로고침하면 다시 찾아봐요."}
          </p>
          <ul className="flex max-w-[640px] flex-col gap-1.5">
            {without.map((m) => (
              <li key={m.id} className="rounded-lg bg-gray-50 px-4 py-2.5 text-[14px]">
                <b className="text-gray-900">{m.name}</b>
                <span className="ml-2 font-mono text-[12px] text-gray-500">{m.participationCode}</span>
                <span className="ml-2 text-[13px] text-gray-500">지망 {m.targetCampus.join(" > ") || "-"}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
