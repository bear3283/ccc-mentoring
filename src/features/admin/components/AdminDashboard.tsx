"use client";

import { useState } from "react";
import { DataTable, type TableColumn } from "./DataTable";
import { downloadCsv, type CsvColumn } from "../lib/csv";
import type { Mentee, Mentor } from "@/features/matching/model/types";
import { formatTimeSlotShort } from "@/shared/constants/domain";
import { WEIGHTS } from "@/features/matching/lib/score";
import { PERSONAS } from "@/shared/constants/persona";
import { cn } from "@/shared/lib/cn";

type Tab = "mentee" | "mentor" | "matching" | "unmatched";

/** 매칭 표의 한 행. 멘티 1명 x 추천 멘토 1명. */
export interface MatchRow {
  id: string;
  rank: number;
  menteeCode: string;
  menteeName: string;
  menteeCampus: string;
  menteeArea: string;
  mentorName: string;
  mentorCampus: string;
  score: number;
  campusScore: number;
  areaScore: number;
  scheduleScore: number;
  mbtiScore: number;
  personaScore: number;
  majorScore: number;
  contact: string;
  /** SUGGESTED = 추천만 됨, REQUESTED = 멘티가 연락을 요청함 */
  status: string;
}

const menteeColumns: TableColumn<Mentee>[] = [
  { key: "code", header: "참여코드", value: (r) => r.participationCode, width: "110px" },
  { key: "name", header: "이름", value: (r) => r.name, width: "80px" },
  {
    key: "church",
    header: "출석 교회",
    // 새친구는 눈에 띄어야 한다. 행사 당일 따로 맞이해야 하는 분들이다.
    value: (r) => (r.isNewFriend ? "🌱 새친구" : (r.church ?? "-")),
    width: "120px",
  },
  { key: "campus1", header: "1지망", value: (r) => r.targetCampus[0] },
  { key: "campus2", header: "2지망", value: (r) => r.targetCampus[1] },
  { key: "campus3", header: "3지망", value: (r) => r.targetCampus[2] },
  { key: "area", header: "희망 영역", value: (r) => r.desiredAreas.join(", ") },
  { key: "persona", header: "성향", value: (r) => PERSONAS[r.personaType].name, align: "center" },
  { key: "mbti", header: "MBTI", value: (r) => r.mbti ?? "-", align: "center", width: "70px" },
  { key: "major", header: "희망 학과", value: (r) => r.targetMajors.join(", ") },
  { key: "career", header: "희망 진로", value: (r) => r.targetCareers.join(", ") },
  { key: "times", header: "가능 시간", value: (r) => r.availableTimes.map(formatTimeSlotShort).join(", ") },
  { key: "school", header: "출신 고교", value: (r) => r.highSchool ?? "-" },
  {
    key: "mentoring",
    header: "멘토링",
    value: (r) => (r.mentoringApplied ? "신청" : "등록만"),
    align: "center",
    width: "80px",
  },
  { key: "contact", header: "연락처", value: (r) => r.contact },
];

const mentorColumns: TableColumn<Mentor>[] = [
  { key: "code", header: "참여코드", value: (r) => r.participationCode, width: "110px" },
  { key: "name", header: "이름", value: (r) => r.name, width: "80px" },
  {
    key: "church",
    header: "출석 교회",
    // 새친구는 눈에 띄어야 한다. 행사 당일 따로 맞이해야 하는 분들이다.
    value: (r) => (r.isNewFriend ? "🌱 새친구" : (r.church ?? "-")),
    width: "120px",
  },
  { key: "campus", header: "캠퍼스", value: (r) => r.currentCampus },
  { key: "admission", header: "학번", value: (r) => `${String(r.admissionYear).slice(2)}학번`, align: "center", width: "80px" },
  { key: "area", header: "멘토링 영역", value: (r) => r.mentoringArea.join(", ") },
  { key: "persona", header: "성향", value: (r) => PERSONAS[r.personaType].name, align: "center" },
  { key: "mbti", header: "MBTI", value: (r) => r.mbti ?? "-", align: "center", width: "70px" },
  { key: "major", header: "학과", value: (r) => r.currentMajors.join(", ") },
  { key: "career", header: "진로", value: (r) => r.careerPaths.join(", ") },
  { key: "times", header: "가능 시간", value: (r) => r.availableTimes.map(formatTimeSlotShort).join(", ") },
  {
    key: "mentoring",
    header: "멘토링",
    value: (r) => (r.mentoringApplied ? "신청" : "등록만"),
    align: "center",
    width: "80px",
  },
  { key: "contact", header: "연락처", value: (r) => r.contact },
];

const matchColumns: TableColumn<MatchRow>[] = [
  { key: "menteeCode", header: "참여코드", value: (r) => r.menteeCode, width: "100px" },
  { key: "menteeName", header: "멘티", value: (r) => r.menteeName, width: "80px" },
  { key: "rank", header: "순위", value: (r) => r.rank, align: "center", width: "60px" },
  {
    key: "score",
    header: "적합도",
    value: (r) => r.score,
    align: "right",
    width: "80px",
    // 점수대가 한눈에 구분돼야 운영자가 검토 대상을 빨리 고른다.
    render: (r) => (
      <span
        className={cn(
          "rounded px-1.5 py-0.5 font-semibold tabular-nums",
          r.score >= 80 && "bg-green-500/15 text-green-500",
          r.score >= 60 && r.score < 80 && "bg-brand-soft text-brand",
          r.score < 60 && "bg-gray-100 text-gray-500",
        )}
      >
        {r.score}%
      </span>
    ),
  },
  { key: "mentorName", header: "멘토", value: (r) => r.mentorName, width: "80px" },
  { key: "mentorCampus", header: "멘토 캠퍼스", value: (r) => r.mentorCampus },
  { key: "menteeCampus", header: "멘티 1지망", value: (r) => r.menteeCampus },
  {
    key: "status",
    header: "상태",
    value: (r) => (r.status === "REQUESTED" ? "요청함" : "추천됨"),
    align: "center",
    width: "80px",
    // 멘티가 실제로 연락을 요청한 건이 운영자가 챙겨야 할 대상이다.
    render: (r) => (
      <span
        className={cn(
          "rounded px-1.5 py-0.5 text-[12px] font-semibold",
          r.status === "REQUESTED"
            ? "bg-brand-soft text-brand"
            : "bg-gray-100 text-gray-500",
        )}
      >
        {r.status === "REQUESTED" ? "요청함" : "추천됨"}
      </span>
    ),
  },
  // 헤더의 배점은 WEIGHTS 에서 뽑는다. 숫자를 적어 두면 가중치를 바꿨을 때
  // 헤더만 옛 값으로 남아 표를 읽는 사람이 잘못 이해한다.
  { key: "campusScore", header: `캠퍼스(${WEIGHTS.campus})`, value: (r) => r.campusScore, align: "right" },
  { key: "areaScore", header: `영역(${WEIGHTS.area})`, value: (r) => r.areaScore, align: "right" },
  {
    key: "scheduleScore",
    header: `시간대(${WEIGHTS.schedule})`,
    value: (r) => r.scheduleScore,
    align: "right",
    // 0점이면 만날 시간이 없다는 뜻이라 운영자가 먼저 확인해야 한다.
    render: (r) => (
      <span className={cn(r.scheduleScore === 0 && "font-bold text-red-500")}>
        {r.scheduleScore}
      </span>
    ),
  },
  { key: "mbtiScore", header: `MBTI(${WEIGHTS.mbti})`, value: (r) => r.mbtiScore, align: "right" },
  { key: "majorScore", header: `학과·진로(${WEIGHTS.majorAndCareer})`, value: (r) => r.majorScore, align: "right" },
  { key: "personaScore", header: `성경인물(${WEIGHTS.persona})`, value: (r) => r.personaScore, align: "right" },
  { key: "contact", header: "멘토 연락처", value: (r) => r.contact },
];

const TABS: { key: Tab; label: string }[] = [
  { key: "mentee", label: "멘티 신청자" },
  { key: "mentor", label: "멘토 신청자" },
  { key: "matching", label: "매칭 결과" },
  { key: "unmatched", label: "미매칭" },
];

export interface UnmatchedRow {
  code: string;
  name: string;
  targetCampus: string[];
  mentorsInCampus: number;
  reason: string;
}

interface AdminDashboardProps {
  mentees: Mentee[];
  mentors: Mentor[];
  matchRows: MatchRow[];
  unmatched: UnmatchedRow[];
}

const unmatchedColumns: TableColumn<UnmatchedRow>[] = [
  { key: "code", header: "참여코드", value: (r) => r.code, width: "110px" },
  { key: "name", header: "이름", value: (r) => r.name, width: "90px" },
  { key: "campus", header: "지망 캠퍼스", value: (r) => r.targetCampus.join(" > ") },
  {
    key: "mentors",
    header: "지망 캠퍼스 멘토 수",
    value: (r) => r.mentorsInCampus,
    align: "right",
    width: "150px",
    // 0이면 멘토를 더 모집해야 한다는 신호다.
    render: (r) => (
      <span className={cn(r.mentorsInCampus === 0 && "font-bold text-red-500")}>
        {r.mentorsInCampus}
      </span>
    ),
  },
  { key: "reason", header: "원인", value: (r) => r.reason },
];

export function AdminDashboard({ mentees, mentors, matchRows, unmatched }: AdminDashboardProps) {
  const [tab, setTab] = useState<Tab>("matching");

  // 어느 캠퍼스에 멘토가 없어서 막혔는지 한 줄로 보여준다.
  const campusGaps = [
    ...new Set(unmatched.filter((u) => u.mentorsInCampus === 0).flatMap((u) => u.targetCampus)),
  ].filter((campus) => !mentors.some((m) => m.currentCampus === campus));

  const handleExport = () => {
    // 화면 표와 같은 열 구성으로 떨어뜨린다.
    const asCsvColumns = <T,>(cols: TableColumn<T>[]): CsvColumn<T>[] =>
      cols.map((c) => ({ key: c.key, header: c.header, value: c.value }));

    if (tab === "mentee") downloadCsv("멘티_신청자.csv", mentees, asCsvColumns(menteeColumns));
    else if (tab === "mentor") downloadCsv("멘토_신청자.csv", mentors, asCsvColumns(mentorColumns));
    else downloadCsv("매칭_결과.csv", matchRows, asCsvColumns(matchColumns));
  };

  return (
    // 운영자 화면은 모바일 셸(430px)에 가두지 않는다. 열이 많아 넓을수록 유리하다.
    <div className="flex h-dvh flex-col bg-white px-6 py-5">
      <header className="shrink-0">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[13px] font-medium text-brand">운영자</p>
            <h1 className="mt-0.5 text-[22px] font-bold tracking-[-0.02em] text-gray-900">
              신청 현황 및 매칭 결과
            </h1>
          </div>

          <button
            type="button"
            onClick={handleExport}
            className="h-9 rounded-lg bg-brand px-4 text-[13px] font-bold text-white active:bg-brand-dark"
          >
            CSV 내보내기
          </button>
        </div>

        {/* 운영 판단에 필요한 수치를 표 위에 고정해 둔다. */}
        <dl className="mt-4 flex gap-6 border-y border-gray-100 py-3">
          <Stat label="멘티" value={`${mentees.length}명`} />
          <Stat label="멘토" value={`${mentors.length}명`} />
          <Stat label="매칭 성사" value={`${mentees.length - unmatched.length}명`} />
          <Stat
            label="미매칭"
            value={`${unmatched.length}명`}
            emphasis={unmatched.length > 0}
          />
          <Stat label="추천 조합" value={`${matchRows.length}건`} />
        </dl>

        <div className="flex gap-1 py-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors",
                tab === t.key ? "bg-brand text-white" : "bg-gray-100 text-gray-600",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      {tab === "mentee" && (
        <DataTable
          rows={mentees}
          columns={menteeColumns}
          rowKey={(r) => r.id}
          searchable={(r) => `${r.participationCode} ${r.name} ${r.targetCampus.join(" ")} ${r.targetMajors.join(" ")} ${r.desiredAreas.join(" ")}`}
        />
      )}

      {tab === "mentor" && (
        <DataTable
          rows={mentors}
          columns={mentorColumns}
          rowKey={(r) => r.id}
          searchable={(r) => `${r.participationCode} ${r.name} ${r.currentCampus} ${r.currentMajors.join(" ")} ${r.mentoringArea.join(" ")}`}
        />
      )}

      {tab === "unmatched" && (
        <>
          {campusGaps.length > 0 && (
            <p className="mb-3 rounded-lg bg-red-500/10 px-4 py-3 text-[13px] text-red-600">
              <strong>{campusGaps.join(", ")}</strong> 캠퍼스에 멘토가 없습니다. 해당 캠퍼스
              멘토를 모집하면 {unmatched.filter((u) => u.mentorsInCampus === 0).length}명이
              매칭될 수 있습니다.
            </p>
          )}
          <DataTable
            rows={unmatched}
            columns={unmatchedColumns}
            rowKey={(r) => r.code}
            searchable={(r) => `${r.code} ${r.name} ${r.targetCampus.join(" ")}`}
            emptyMessage="미매칭 인원이 없습니다."
          />
        </>
      )}

      {tab === "matching" && (
        <DataTable
          rows={matchRows}
          columns={matchColumns}
          rowKey={(r) => r.id}
          searchable={(r) => `${r.menteeCode} ${r.menteeName} ${r.mentorName} ${r.mentorCampus} ${r.menteeArea}`}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div>
      <dt className="text-[12px] text-gray-400">{label}</dt>
      <dd
        className={cn(
          "mt-0.5 text-[18px] font-bold tabular-nums",
          emphasis ? "text-red-500" : "text-gray-900",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
