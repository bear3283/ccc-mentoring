"use client";

import { useMemo, useState } from "react";
import { admissionYearLabel } from "@/shared/constants/domain";
import { DataTable, type TableColumn } from "./DataTable";
import { downloadCsv } from "../lib/csv";
import type { AdminMentor } from "./AdminDashboard";

/** 캠퍼스 확인용 한 줄. 캠퍼스 리더에게 넘길 정보만 담는다. */
export interface RosterRow {
  id: string;
  campus: string;
  name: string;
  admission: string;
  contact: string;
}

export const rosterColumns: TableColumn<RosterRow>[] = [
  { key: "campus", header: "캠퍼스", value: (r) => r.campus, width: "140px" },
  { key: "name", header: "이름", value: (r) => r.name, width: "90px" },
  { key: "admission", header: "학번", value: (r) => r.admission, align: "center", width: "90px" },
  { key: "contact", header: "연락처", value: (r) => r.contact, width: "140px" },
];

/**
 * 멘토링을 신청한 선배를 캠퍼스별로 뽑는다. 캠퍼스 검증용이다.
 *
 * 선배가 적어 낸 학교가 맞는지는 이 서비스가 확인할 수 없다. 캠퍼스 간사·리더에게
 * "이 사람들이 우리 캠퍼스 CCC가 맞는지" 물어보는 것이 가장 빠르다. 그래서 캠퍼스를
 * 골라 이름·학번·연락처만 CSV나 문자로 넘길 수 있게 한다. 다른 정보(성향, 사진 등)는
 * 확인에 필요 없어 싣지 않는다.
 *
 * 등록만 하고 멘토링을 신청하지 않은 대학생은 캠퍼스를 답하지 않아 빠진다.
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
    }))
    .sort((a, b) => a.campus.localeCompare(b.campus, "ko") || a.name.localeCompare(b.name, "ko"));
}

export function CampusRoster({ mentors }: { mentors: AdminMentor[] }) {
  const all = useMemo(() => toRosterRows(mentors), [mentors]);
  const campuses = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of all) count.set(r.campus, (count.get(r.campus) ?? 0) + 1);
    return [...count.entries()];
  }, [all]);

  const [campus, setCampus] = useState("");
  const rows = campus ? all.filter((r) => r.campus === campus) : all;
  const [copied, setCopied] = useState(false);

  /** 캠퍼스 리더에게 카톡·문자로 바로 붙여 보낼 수 있는 글. */
  const copyText = async () => {
    const head = campus ? `[고3채플] ${campus} 멘토 신청 선배 ${rows.length}명` : `[고3채플] 멘토 신청 선배 ${rows.length}명`;
    const lines = rows.map((r) => `${campus ? "" : `${r.campus} `}${r.name} ${r.admission} ${r.contact}`);
    try {
      await navigator.clipboard.writeText([head, ...lines].join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드가 막히면 CSV 로 받으면 된다.
    }
  };

  return (
    <>
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <select
          value={campus}
          onChange={(e) => setCampus(e.target.value)}
          className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-[13px] font-semibold text-gray-800"
        >
          <option value="">전체 캠퍼스 ({all.length}명)</option>
          {campuses.map(([name, n]) => (
            <option key={name} value={name}>
              {name} ({n}명)
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() =>
            downloadCsv(campus ? `캠퍼스확인_${campus}.csv` : "캠퍼스확인_전체.csv", rows, rosterColumns)
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
          {copied ? "복사했어요" : "문자로 보낼 글 복사"}
        </button>
        <p className="text-[12px] text-gray-400">
          캠퍼스 리더에게 우리 캠퍼스 CCC가 맞는지 확인받을 때 써요. 멘토링을 신청한 선배만 나와요.
        </p>
      </div>
      <DataTable
        rows={rows}
        columns={rosterColumns}
        rowKey={(r) => r.id}
        searchable={(r) => `${r.campus} ${r.name} ${r.contact}`}
        emptyMessage="멘토링을 신청한 선배가 없습니다."
      />
    </>
  );
}
