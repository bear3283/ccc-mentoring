"use client";

import { useState } from "react";
import type { Mentee } from "@/features/matching/model/types";
import { mentoringInviteText, smsHref } from "../lib/mentorNotice";

/**
 * 등록만 하고 멘토링을 신청하지 않은 고3에게 신청 안내 문자 보내기.
 *
 * 이분들은 지망 학교·관심 분야를 답하지 않아 매칭할 수 없다. 문자의 링크를 열면
 * 등록을 다시 하지 않고 멘토링 신청으로 바로 이어진다. 신청하면 추천이 계산되고,
 * 선배를 고르지 않으면 "직접 연결" 탭에서 운영자가 이어 준다.
 *
 * "연결 알림" 탭의 맨 아래에 붙는다. 보내는 방식은 위의 선배·후배 알림과 같다.
 */
export function InviteList({ mentees, readOnly }: { mentees: Mentee[]; readOnly: boolean }) {
  const [invited, setInvited] = useState<Record<string, string | undefined>>(() =>
    Object.fromEntries(mentees.map((m) => [m.id, m.mentoringInvitedAt])),
  );
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const targets = mentees.filter((m) => !m.mentoringApplied);
  const pending = targets.filter((m) => !invited[m.id]);
  const done = targets.filter((m) => invited[m.id]);

  const mark = async (mentee: Mentee, undo: boolean) => {
    if (busy) return;
    setBusy(mentee.id);
    setError(undefined);
    try {
      const res = await fetch("/api/admin/mentoring-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: mentee.id, undo }),
      });
      const body = (await res.json()) as { invitedAt?: string | null; error?: string };
      if (!res.ok) {
        setError(body.error ?? "기록하지 못했어요.");
        return;
      }
      setInvited((prev) => ({ ...prev, [mentee.id]: body.invitedAt ?? undefined }));
    } catch {
      setError("연결에 실패했어요.");
    } finally {
      setBusy(undefined);
    }
  };

  if (targets.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="mb-1 text-[14px] font-bold text-gray-900">
        멘토링 신청 안내 <span className="tabular-nums text-brand">{pending.length}</span>
        <span className="ml-2 text-[12px] font-medium text-gray-400">등록만 하고 멘토링을 신청하지 않은 고3</span>
      </h2>
      <p className="mb-3 max-w-[640px] text-[13px] leading-relaxed text-gray-500">
        링크를 열면 등록을 다시 하지 않고 멘토링 신청으로 바로 이어져요. 신청한 뒤 선배를 고르지 않으면{" "}
        <b className="text-gray-700">직접 연결</b> 탭에서 이어 주세요.
      </p>

      {error && (
        <p className="mb-3 max-w-[640px] rounded-lg bg-red-500/10 px-4 py-2.5 text-[13px] text-red-600">{error}</p>
      )}

      {pending.length > 0 && (
        <ul className="mb-4 flex max-w-[640px] flex-col gap-2">
          {pending.map((m) => (
            <li key={m.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-[16px] font-bold text-gray-900">
                {m.name}
                <span className="ml-2 font-mono text-[13px] font-medium text-gray-500">{m.participationCode}</span>
              </p>
              <p className="mt-0.5 font-mono text-[14px] text-gray-700 select-all">{m.contact}</p>
              {!readOnly && (
                <div className="mt-3 flex gap-2">
                  <a
                    href={smsHref(
                      m.contact,
                      mentoringInviteText({ menteeName: m.name, menteeCode: m.participationCode }),
                    )}
                    className="flex h-11 flex-1 items-center justify-center rounded-lg bg-brand text-[14px] font-bold text-white active:bg-brand-dark"
                  >
                    문자 열기
                  </a>
                  <button
                    type="button"
                    onClick={() => void mark(m, false)}
                    disabled={busy === m.id}
                    className="h-11 flex-1 rounded-lg border border-gray-200 text-[14px] font-bold text-gray-700 active:bg-gray-100 disabled:text-gray-300"
                  >
                    {busy === m.id ? "기록 중…" : "보냄"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {done.length > 0 && (
        <ul className="flex max-w-[640px] flex-col gap-2 pb-6">
          {done.map((m) => (
            <li key={m.id} className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-gray-900">
                  {m.name}
                  <span className="ml-2 font-mono text-[12px] font-medium text-gray-500">{m.participationCode}</span>
                </p>
                <p className="mt-1 text-[12px] text-gray-500">안내 보냄 {formatTime(invited[m.id]!)}</p>
              </div>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => void mark(m, true)}
                  disabled={busy === m.id}
                  className="shrink-0 text-[12px] font-semibold text-gray-500 underline disabled:text-gray-300"
                >
                  되돌리기
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
