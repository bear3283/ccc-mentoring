"use client";

import { useMemo, useState } from "react";
import { admissionYearLabel } from "@/shared/constants/domain";
import { verificationStatus, type VerificationStatus } from "@/features/matching/lib/mentorStatus";
import { cn } from "@/shared/lib/cn";
import { DataTable, type TableColumn } from "./DataTable";
import { downloadCsv } from "../lib/csv";
import type { AdminMentor } from "./AdminDashboard";

/** 멘토 인증 표의 한 줄. 캠퍼스 리더에게 넘길 정보만 담는다. */
export interface RosterRow {
  id: string;
  campus: string;
  name: string;
  admission: string;
  contact: string;
  status: VerificationStatus;
}

/** CSV·복사로 캠퍼스 리더에게 넘기는 열. 인증 상태는 운영자만 보면 된다. */
export const rosterColumns: TableColumn<RosterRow>[] = [
  { key: "campus", header: "캠퍼스", value: (r) => r.campus, width: "140px" },
  { key: "name", header: "이름", value: (r) => r.name, width: "90px" },
  { key: "admission", header: "학번", value: (r) => r.admission, align: "center", width: "90px" },
  { key: "contact", header: "연락처", value: (r) => r.contact, width: "140px" },
];

/**
 * 멘토링을 신청한 선배. 캠퍼스 가나다 → 이름 순.
 * 등록만 하고 멘토링을 신청하지 않은 대학생은 학교를 답하지 않아 빠진다.
 */
export function toRosterRows(mentors: AdminMentor[]): RosterRow[] {
  return mentors
    .filter((m) => m.mentoringApplied && m.currentCampus)
    .map((m) => ({
      id: m.id,
      campus: m.currentCampus,
      name: m.name,
      admission: m.admissionYear ? admissionYearLabel(m.admissionYear) : "-",
      contact: m.contact,
      status: verificationStatus(m),
    }))
    .sort((a, b) => a.campus.localeCompare(b.campus, "ko") || a.name.localeCompare(b.name, "ko"));
}

type StatusFilter = VerificationStatus | "all";

type Action = "verify" | "reject" | "reset";

const STATUS_LABEL: Record<VerificationStatus, string> = {
  pending: "확인 대기",
  verified: "인증됨",
  rejected: "미인증",
};

const STATUS_STYLE: Record<VerificationStatus, string> = {
  pending: "bg-amber-100 text-amber-700",
  verified: "bg-green-500/15 text-green-600",
  rejected: "bg-red-500/10 text-red-600",
};

/** 처리한 뒤 그 줄이 갖게 되는 상태. */
const RESULT: Record<Action, VerificationStatus> = { verify: "verified", reject: "rejected", reset: "pending" };

/**
 * 멘토(선배) 캠퍼스 인증.
 *
 * 흐름: 선배 신청 → 여기서 캠퍼스별 명단을 뽑아 캠퍼스 리더에게 보냄(CSV·글 복사)
 * → 실제 그 캠퍼스 학생인지 확인받음 → 운영자가 "인증" → 그때부터 후배 추천 후보가 된다.
 *
 * 선배가 적어 낸 학교는 이 서비스가 확인할 수 없다. 인증 전 선배는 후배에게 보이지 않는다.
 * 보기 전용 계정은 명단을 보고 내려받을 수만 있다.
 */
export function MentorVerification({ mentors, readOnly }: { mentors: AdminMentor[]; readOnly: boolean }) {
  // 인증을 누르면 새로고침 없이 바로 반영되도록 이 표만 따로 들고 있는다.
  const [all, setAll] = useState(() => toRosterRows(mentors));
  const campuses = useMemo(() => {
    const count = new Map<string, { total: number; pending: number }>();
    for (const r of all) {
      const c = count.get(r.campus) ?? { total: 0, pending: 0 };
      c.total++;
      if (r.status === "pending") c.pending++;
      count.set(r.campus, c);
    }
    return [...count.entries()];
  }, [all]);

  const [campus, setCampus] = useState("");
  const [status, setStatus] = useState<StatusFilter>("pending");
  const inCampus = all.filter((r) => !campus || r.campus === campus);
  const rows = inCampus.filter((r) => status === "all" || r.status === status);
  /** "모두 인증"의 대상. 상태 탭과 상관없이 고른 캠퍼스(없으면 전체)의 확인 대기 전원이다. */
  const pendingInScope = inCampus.filter((r) => r.status === "pending");
  const countOf = (st: VerificationStatus) => inCampus.filter((r) => r.status === st).length;

  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  /** 여러 명을 한꺼번에 인증할 때는 한 번 더 묻는다. 브라우저 확인 창 대신 버튼으로. */
  const [confirmBulk, setConfirmBulk] = useState(false);

  const apply = async (ids: string[], action: Action) => {
    if (busy || ids.length === 0) return;
    setBusy(true);
    setError(undefined);
    try {
      const res = await fetch("/api/admin/mentor-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: ids, action }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? "저장하지 못했어요.");
        return;
      }
      const set = new Set(ids);
      setAll((prev) => prev.map((r) => (set.has(r.id) ? { ...r, status: RESULT[action] } : r)));
    } catch {
      setError("연결에 실패했어요.");
    } finally {
      setBusy(false);
      setConfirmBulk(false);
    }
  };

  /** 캠퍼스 리더에게 카톡·문자로 바로 붙여 보낼 수 있는 글. */
  const copyText = async () => {
    const head = `[고3채플] ${campus || "전체"} 멘토 신청 선배 ${rows.length}명 — 우리 캠퍼스 CCC가 맞는지 확인 부탁드려요`;
    const lines = rows.map((r) => `${campus ? "" : `${r.campus} `}${r.name} ${r.admission} ${r.contact}`);
    try {
      await navigator.clipboard.writeText([head, ...lines].join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드가 막히면 CSV 로 받으면 된다.
    }
  };

  const columns: TableColumn<RosterRow>[] = [
    {
      key: "status",
      header: "인증",
      value: (r) => STATUS_LABEL[r.status],
      align: "center",
      width: "90px",
      render: (r) => (
        <span className={cn("rounded px-1.5 py-0.5 text-[12px] font-semibold", STATUS_STYLE[r.status])}>
          {STATUS_LABEL[r.status]}
        </span>
      ),
    },
    ...rosterColumns,
    ...(readOnly
      ? []
      : [
          {
            key: "action",
            header: "",
            value: () => "",
            width: "170px",
            // 확인 대기: 인증 / 미인증. 이미 정한 사람: 확인 대기로 되돌리기(잘못 누른 경우).
            render: (r: RosterRow) => (
              <span className="flex gap-1.5">
                {r.status === "pending" ? (
                  <>
                    <ActionButton onClick={() => void apply([r.id], "verify")} disabled={busy} tone="primary">
                      인증
                    </ActionButton>
                    <ActionButton onClick={() => void apply([r.id], "reject")} disabled={busy} tone="danger">
                      미인증
                    </ActionButton>
                  </>
                ) : (
                  <ActionButton onClick={() => void apply([r.id], "reset")} disabled={busy} tone="plain">
                    {r.status === "verified" ? "인증 취소" : "미인증 취소"}
                  </ActionButton>
                )}
              </span>
            ),
          } satisfies TableColumn<RosterRow>,
        ]),
  ];

  return (
    <>
      {/*
        "모두 인증"은 맨 위에 둔다. 캠퍼스 리더 확인 없이 전원을 한꺼번에 인증해야 할 때가 있다.
        고른 캠퍼스가 있으면 그 캠퍼스, 없으면 전체의 확인 대기 선배가 대상이다.
      */}
      {!readOnly && (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          {confirmBulk ? (
            <span className="flex flex-wrap items-center gap-1.5 rounded-lg bg-brand-soft px-3 py-1.5 text-[13px] font-semibold text-brand">
              {campus || "전체 캠퍼스"} 확인 대기 {pendingInScope.length}명을 모두 인증할까요? 인증하면 바로 후배 추천에 나와요.
              <button
                type="button"
                onClick={() => void apply(pendingInScope.map((r) => r.id), "verify")}
                disabled={busy}
                className="h-7 rounded-md bg-brand px-3 font-bold text-white disabled:opacity-40"
              >
                {busy ? "저장 중…" : "모두 인증"}
              </button>
              <button type="button" onClick={() => setConfirmBulk(false)} className="h-7 px-2 text-gray-500">
                취소
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmBulk(true)}
              disabled={pendingInScope.length === 0}
              className="h-10 rounded-lg bg-brand px-4 text-[14px] font-bold text-white active:bg-brand-dark disabled:bg-brand/30"
            >
              {campus || "전체"} 확인 대기 {pendingInScope.length}명 모두 인증
            </button>
          )}
        </div>
      )}

      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <select
          value={campus}
          onChange={(e) => {
            setCampus(e.target.value);
            setConfirmBulk(false);
          }}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-semibold text-gray-800"
        >
          <option value="">전체 캠퍼스 ({all.length}명)</option>
          {campuses.map(([name, c]) => (
            <option key={name} value={name}>
              {name} ({c.total}명{c.pending > 0 ? ` · 대기 ${c.pending}` : ""})
            </option>
          ))}
        </select>
        <div className="flex overflow-hidden rounded-lg border border-gray-200">
          {(
            [
              ["pending", `확인 대기 ${countOf("pending")}`],
              ["verified", `인증됨 ${countOf("verified")}`],
              ["rejected", `미인증 ${countOf("rejected")}`],
              ["all", "전체"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              className={cn(
                "h-9 px-3 text-[13px] font-semibold tabular-nums",
                status === key ? "bg-gray-900 text-white" : "bg-white text-gray-600",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            downloadCsv(campus ? `멘토명단_${campus}.csv` : "멘토명단_전체.csv", rows, rosterColumns)
          }
          className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] font-bold text-gray-700 active:bg-gray-100"
        >
          이 목록 CSV
        </button>
        <button
          type="button"
          onClick={copyText}
          className="h-9 rounded-lg border border-gray-200 px-3 text-[13px] font-bold text-gray-700 active:bg-gray-100"
        >
          {copied ? "복사했어요" : "캠퍼스 리더에게 보낼 글 복사"}
        </button>
      </div>

      <p className="mb-3 max-w-[760px] shrink-0 text-[12px] leading-relaxed text-gray-500">
        ① 캠퍼스를 골라 명단을 캠퍼스 리더에게 보내요 → ② 실제 그 캠퍼스 학생인지 확인받아요 →
        ③ 확인된 선배는 인증, 그 캠퍼스 학생이 아니면 미인증으로 둬요.{" "}
        <b className="text-gray-700">인증된 선배만 후배의 추천 후보가 돼요.</b> 잘못 눌렀으면 "취소"로
        확인 대기로 되돌릴 수 있어요. 다시 신청하며 학교를 바꾸면 확인 대기로 돌아가요.
      </p>

      {error && (
        <p className="mb-3 max-w-[640px] shrink-0 rounded-lg bg-red-500/10 px-4 py-2.5 text-[13px] text-red-600">
          {error}
        </p>
      )}

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchable={(r) => `${r.campus} ${r.name} ${r.contact}`}
        emptyMessage={
          status === "pending"
            ? "확인을 기다리는 선배가 없습니다."
            : status === "rejected"
              ? "미인증으로 둔 선배가 없습니다."
              : "해당하는 선배가 없습니다."
        }
      />
    </>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled: boolean;
  tone: "primary" | "danger" | "plain";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-7 rounded-md px-2.5 text-[12px] font-bold disabled:opacity-40",
        tone === "primary" && "bg-brand text-white active:bg-brand-dark",
        tone === "danger" && "border border-red-300 text-red-600 active:bg-red-50",
        tone === "plain" && "text-gray-500 underline",
      )}
    >
      {children}
    </button>
  );
}
