"use client";

import { useState } from "react";
import type { Mentee } from "@/features/matching/model/types";
import { cn } from "@/shared/lib/cn";
import { DataTable, type TableColumn } from "./DataTable";
import { NEWEST_FIRST } from "../lib/time";

/** applied = 멘티 신청, general = 행사만 등록한 고3, all = 전체 고3. */
type Scope = "applied" | "general" | "all";

function inScopeOf(m: Mentee, scope: Scope): boolean {
  if (scope === "all") return true;
  return scope === "applied" ? m.mentoringApplied === true : !m.mentoringApplied;
}

const EMPTY: Record<Scope, string> = {
  applied: "아직 멘티 신청자가 없습니다.",
  general: "멘티를 신청하지 않은 고3이 없습니다.",
  all: "등록한 고3이 없습니다.",
};

/**
 * "고3" 탭. 고3은 행사만 등록하고 멘티는 신청하지 않을 수 있어
 * 멘티 신청 / 일반 / 전체 명단을 나눠 본다.
 */
export function MenteeRoster({
  mentees,
  columns,
}: {
  mentees: Mentee[];
  columns: TableColumn<Mentee>[];
}) {
  const [scope, setScope] = useState<Scope>("applied");
  const rows = mentees.filter((m) => inScopeOf(m, scope));
  const countOf = (s: Scope) => mentees.filter((m) => inScopeOf(m, s)).length;

  return (
    <>
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-gray-200">
          {(
            [
              ["applied", `멘티 신청 ${countOf("applied")}`],
              ["general", `일반 ${countOf("general")}`],
              ["all", `전체 고3 ${mentees.length}`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setScope(key)}
              className={cn(
                "h-9 px-3 text-[13px] font-semibold tabular-nums",
                scope === key ? "bg-gray-900 text-white" : "bg-white text-gray-600",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[12px] text-gray-400">
          일반은 행사만 등록하고 멘티는 신청하지 않은 고3이에요. 위쪽 CSV 내보내기에는 전체 고3이 담기고, "멘토링" 열로 구분돼요.
        </p>
      </div>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => r.id}
        searchable={(r) =>
          `${r.participationCode} ${r.name} ${r.targetCampus.join(" ")} ${r.targetMajors.join(" ")} ${r.desiredAreas.join(" ")}`
        }
        emptyMessage={EMPTY[scope]}
        initialSort={NEWEST_FIRST}
      />
    </>
  );
}
