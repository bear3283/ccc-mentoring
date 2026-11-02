"use client";

import { useMemo, useState } from "react";
import { verificationStatus } from "@/features/matching/lib/mentorStatus";
import { cn } from "@/shared/lib/cn";
import { DataTable, type TableColumn } from "./DataTable";
import { downloadCsv } from "../lib/csv";
import { NEWEST_FIRST } from "../lib/time";
import { rosterColumns, toRosterRows } from "./MentorVerification";
import type { AdminMentor } from "./AdminDashboard";

/**
 * applied = 멘토 신청(인증 여부 무관), verified = 그중 인증된 선배,
 * unapplied = 행사만 등록한 일반 대학생, all = 전체.
 */
type Scope = "applied" | "verified" | "unapplied" | "all";

function inScopeOf(m: AdminMentor, scope: Scope): boolean {
  if (scope === "all") return true;
  if (scope === "unapplied") return !m.mentoringApplied;
  if (scope === "applied") return m.mentoringApplied === true;
  return m.mentoringApplied === true && verificationStatus(m) === "verified";
}

/**
 * "대학생 명단" 탭 — 멘토 신청 / 멘토 인증 / 일반 / 전체 대학생을 나눠 본다.
 * 기본은 인증을 받아 후배에게 소개되는 선배 명단이다.
 *
 * 인증 처리는 "멘토 신청자" 탭에서 한다. 여기는 처리가 끝난 명단을 보고 캠퍼스별로
 * 내려받는 곳이다(캠퍼스 리더에게 최종 명단을 돌려주거나, 캠퍼스별로 연락할 때).
 * "전체 대학생"으로 바꾸면 등록만 한 사람과 확인 대기·미인증 선배까지 모두 보인다.
 */
export function MentorRoster({
  mentors,
  columns,
}: {
  mentors: AdminMentor[];
  /** 운영자 화면의 멘토 표 열(삭제 열 포함). 표는 자세히, CSV 는 이름·캠퍼스·학번·연락처만. */
  columns: TableColumn<AdminMentor>[];
}) {
  const [scope, setScope] = useState<Scope>("verified");
  const [campus, setCampus] = useState("");

  const inScope = useMemo(
    () => mentors.filter((m) => inScopeOf(m, scope)),
    [mentors, scope],
  );
  const campuses = useMemo(() => {
    const count = new Map<string, number>();
    for (const m of inScope) if (m.currentCampus) count.set(m.currentCampus, (count.get(m.currentCampus) ?? 0) + 1);
    return [...count.entries()].sort(([a], [b]) => a.localeCompare(b, "ko"));
  }, [inScope]);
  const rows = campus ? inScope.filter((m) => m.currentCampus === campus) : inScope;
  const countOf = (s: Scope) => mentors.filter((m) => inScopeOf(m, s)).length;

  return (
    <>
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-gray-200">
          {(
            [
              ["applied", `멘토 신청 ${countOf("applied")}`],
              ["verified", `멘토 인증 ${countOf("verified")}`],
              ["unapplied", `일반 ${countOf("unapplied")}`],
              ["all", `전체 대학생 ${mentors.length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setScope(key);
                setCampus("");
              }}
              className={cn(
                "h-9 px-3 text-[13px] font-semibold tabular-nums",
                scope === key ? "bg-gray-900 text-white" : "bg-white text-gray-600",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <select
          value={campus}
          onChange={(e) => setCampus(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-semibold text-gray-800"
        >
          <option value="">전체 캠퍼스 ({inScope.length}명)</option>
          {campuses.map(([name, n]) => (
            <option key={name} value={name}>
              {name} ({n}명)
            </option>
          ))}
        </select>
        {/* 캠퍼스별 명단. 고른 캠퍼스(없으면 전체)를 이름·캠퍼스·학번·연락처만 담아 내려받는다. */}
        <button
          type="button"
          onClick={() =>
            downloadCsv(
              `${{ applied: "멘토신청", verified: "인증멘토", unapplied: "일반대학생", all: "대학생" }[scope]}_${campus || "전체"}.csv`,
              toRosterRows(rows),
              rosterColumns,
            )
          }
          className="h-9 rounded-lg bg-brand px-3 text-[13px] font-bold text-white active:bg-brand-dark"
        >
          {campus || "전체"} 명단 CSV
        </button>
        <p className="text-[12px] text-gray-400">
          {
            {
              applied: "멘토를 신청한 대학생 전원이에요(확인 대기·인증·미인증). 인증 처리는 \"멘토 신청자\" 탭에서 해요.",
              verified: "인증을 받아 후배에게 소개되는 선배예요. 인증 처리는 \"멘토 신청자\" 탭에서 해요.",
              unapplied: "행사만 등록하고 멘토는 신청하지 않은 대학생이에요. 후배 추천에는 나오지 않아요.",
              all: "등록만 한 대학생, 확인 대기·미인증 선배까지 모두 보여요. CSV 에는 캠퍼스를 고른 대학생만 담겨요.",
            }[scope]
          }
        </p>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchable={(r) =>
          `${r.participationCode} ${r.name} ${r.currentCampus} ${r.currentMajors.join(" ")} ${r.mentoringArea.join(" ")}`
        }
        emptyMessage={
          {
            applied: "아직 멘토 신청자가 없습니다.",
            verified: "아직 인증된 선배가 없습니다.",
            unapplied: "멘토를 신청하지 않은 대학생이 없습니다.",
            all: "등록한 대학생이 없습니다.",
          }[scope]
        }
        initialSort={NEWEST_FIRST}
      />
    </>
  );
}
