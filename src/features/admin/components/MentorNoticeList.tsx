"use client";

import { useState } from "react";
import type { MentorNoticeRow } from "@/features/signup/lib/repository";
import { EVENT_ARRIVAL_LABEL } from "@/shared/constants/venue";
import { cn } from "@/shared/lib/cn";
import { mentorNoticeText, smsHref } from "../lib/mentorNotice";

const VIA_LABEL: Record<NonNullable<MentorNoticeRow["notifiedVia"]>, string> = {
  ADMIN_SMS: "운영자 문자",
  MAC_MESSAGES: "맥 메시지 앱",
};

/**
 * 선배에게 매칭 알림 문자 보내기.
 *
 * 후배가 선배를 골라도 선배에게는 자동 알림이 가지 않는다. 운영자가 휴대폰으로
 * 이 탭을 열고 "문자 열기"를 누르면 문구가 채워진 문자 앱이 열린다. 보낸 뒤
 * "보냄"을 눌러 기록한다 — 문자 앱이 실제로 보냈는지 이 화면은 알 수 없다.
 *
 * 운영자는 휴대폰으로 볼 가능성이 높아 표 대신 세로 목록으로 둔다.
 */
export function MentorNoticeList({ initial }: { initial: MentorNoticeRow[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState<string>();

  const pending = rows.filter((r) => !r.notifiedAt);
  const done = rows.filter((r) => r.notifiedAt);

  const mark = async (row: MentorNoticeRow, undo: boolean) => {
    if (busy) return;
    setBusy(row.matchingId);
    setError(undefined);
    try {
      const res = await fetch("/api/admin/mentor-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchingId: row.matchingId, undo }),
      });
      const body = (await res.json()) as { notifiedAt?: string | null; error?: string };
      if (!res.ok) {
        setError(body.error ?? "기록하지 못했어요.");
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          r.matchingId === row.matchingId
            ? {
                ...r,
                notifiedAt: body.notifiedAt ?? undefined,
                notifiedVia: body.notifiedAt ? (r.notifiedVia ?? "ADMIN_SMS") : undefined,
              }
            : r,
        ),
      );
    } catch {
      setError("연결에 실패했어요.");
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <p className="mb-4 max-w-[640px] text-[13px] leading-relaxed text-gray-500">
        후배가 선배를 골랐다는 것을 선배는 알 수 없어요. <b className="text-gray-700">문자 열기</b>를
        누르면 내용이 채워진 문자 앱이 열려요. 보낸 뒤 <b className="text-gray-700">보냄</b>을 눌러 두면
        다른 운영자와 겹치지 않아요. 여러 건을 맥에서 한 번에 보내려면{" "}
        <code className="rounded bg-gray-100 px-1">npm run notify:mentors</code>.
      </p>

      {error && (
        <p className="mb-3 max-w-[640px] rounded-lg bg-red-500/10 px-4 py-2.5 text-[13px] text-red-600">
          {error}
        </p>
      )}

      <h2 className="mb-2 text-[14px] font-bold text-gray-900">
        보낼 차례 <span className="tabular-nums text-brand">{pending.length}</span>
      </h2>
      {pending.length === 0 ? (
        <p className="mb-6 max-w-[640px] rounded-lg bg-gray-50 px-4 py-6 text-center text-[13px] text-gray-500">
          알릴 선배가 없어요. 후배가 선배를 고르면 여기에 나와요.
        </p>
      ) : (
        <ul className="mb-6 flex max-w-[640px] flex-col gap-2">
          {pending.map((row) => (
            <li key={row.matchingId} className="rounded-xl border border-gray-200 bg-white p-4">
              <NoticeSummary row={row} />
              <div className="mt-3 flex gap-2">
                <a
                  href={smsHref(row.mentorContact, mentorNoticeText(row))}
                  className="flex h-11 flex-1 items-center justify-center rounded-lg bg-brand text-[14px] font-bold text-white active:bg-brand-dark"
                >
                  문자 열기
                </a>
                <button
                  type="button"
                  onClick={() => void mark(row, false)}
                  disabled={busy === row.matchingId}
                  className="h-11 flex-1 rounded-lg border border-gray-200 text-[14px] font-bold text-gray-700 active:bg-gray-100 disabled:text-gray-300"
                >
                  {busy === row.matchingId ? "기록 중…" : "보냄"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mb-2 text-[14px] font-bold text-gray-900">
        보낸 기록 <span className="tabular-nums text-gray-500">{done.length}</span>
      </h2>
      <ul className="flex max-w-[640px] flex-col gap-2 pb-6">
        {done.map((row) => (
          <li
            key={row.matchingId}
            className="flex items-center gap-3 rounded-xl bg-gray-50 px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <NoticeSummary row={row} compact />
              <p className="mt-1 text-[12px] text-gray-500">
                {formatTime(row.notifiedAt!)} · {row.notifiedVia ? VIA_LABEL[row.notifiedVia] : "-"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void mark(row, true)}
              disabled={busy === row.matchingId}
              className="shrink-0 text-[12px] font-semibold text-gray-500 underline disabled:text-gray-300"
            >
              되돌리기
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NoticeSummary({ row, compact }: { row: MentorNoticeRow; compact?: boolean }) {
  return (
    <div className="min-w-0">
      <p className={cn("font-bold text-gray-900", compact ? "text-[14px]" : "text-[16px]")}>
        {row.mentorName} 선배
        <span className="ml-2 font-mono text-[13px] font-medium text-gray-500">{row.mentorCode}</span>
      </p>
      {!compact && (
        <>
          <p className="mt-0.5 font-mono text-[14px] text-gray-700 select-all">{row.mentorContact}</p>
          <p className="mt-1 text-[13px] text-gray-500">
            고른 후배 <b className="text-gray-700">{row.menteeName}</b>
            {row.menteeArrival && ` · 채플 날 ${EVENT_ARRIVAL_LABEL[row.menteeArrival]}`}
          </p>
        </>
      )}
    </div>
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
