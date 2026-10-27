"use client";

import { useMemo, useState } from "react";
import { verificationStatus } from "@/features/matching/lib/mentorStatus";
import { cn } from "@/shared/lib/cn";
import { DataTable, type TableColumn } from "./DataTable";
import { downloadCsv } from "../lib/csv";
import { rosterColumns, toRosterRows } from "./MentorVerification";
import type { AdminMentor } from "./AdminDashboard";

type Scope = "verified" | "all";

/**
 * "멘토 인증" 탭 — 인증을 받아 후배에게 소개되는 선배 명단.
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
    () => mentors.filter((m) => scope === "all" || (m.mentoringApplied && verificationStatus(m) === "verified")),
    [mentors, scope],
  );
  const campuses = useMemo(() => {
    const count = new Map<string, number>();
    for (const m of inScope) if (m.currentCampus) count.set(m.currentCampus, (count.get(m.currentCampus) ?? 0) + 1);
    return [...count.entries()].sort(([a], [b]) => a.localeCompare(b, "ko"));
  }, [inScope]);
  const rows = campus ? inScope.filter((m) => m.currentCampus === campus) : inScope;
  const verifiedCount = mentors.filter((m) => m.mentoringApplied && verificationStatus(m) === "verified").length;

  return (
    <>
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-gray-200">
          {(
            [
              ["verified", `인증된 선배 ${verifiedCount}`],
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
              `${scope === "verified" ? "인증멘토" : "대학생"}_${campus || "전체"}.csv`,
              toRosterRows(rows),
              rosterColumns,
            )
          }
          className="h-9 rounded-lg bg-brand px-3 text-[13px] font-bold text-white active:bg-brand-dark"
        >
          {campus || "전체"} 명단 CSV
        </button>
        <p className="text-[12px] text-gray-400">
          {scope === "verified"
            ? "인증을 받아 후배에게 소개되는 선배예요. 인증 처리는 \"멘토 신청자\" 탭에서 해요."
            : "등록만 한 대학생, 확인 대기·미인증 선배까지 모두 보여요. CSV 에는 캠퍼스를 고른 대학생만 담겨요."}
        </p>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchable={(r) =>
          `${r.participationCode} ${r.name} ${r.currentCampus} ${r.currentMajors.join(" ")} ${r.mentoringArea.join(" ")}`
        }
        emptyMessage={scope === "verified" ? "아직 인증된 선배가 없습니다." : "등록한 대학생이 없습니다."}
      />
    </>
  );
}
