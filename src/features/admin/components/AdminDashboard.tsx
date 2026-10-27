"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable, type TableColumn } from "./DataTable";
import { downloadCsv, type CsvColumn } from "../lib/csv";
import type { FallbackReason, Mentee, Mentor } from "@/features/matching/model/types";
import type { CampusDemandRow } from "../lib/campusDemand";
import type { MentorNoticeRow } from "@/features/signup/lib/repository";
import { MentorRoster } from "./MentorRoster";
import { MentorVerification, rosterColumns, toRosterRows } from "./MentorVerification";
import { verificationStatus } from "@/features/matching/lib/mentorStatus";
import { MentorNoticeList } from "./MentorNoticeList";
import { findIssues, type IssueRow } from "../lib/issues";
import { admissionYearLabel, GENDER_LABEL } from "@/shared/constants/domain";
import { EVENT_ARRIVAL_LABEL } from "@/shared/constants/venue";
import { WEIGHTS } from "@/features/matching/lib/score";
import { PERSONAS } from "@/shared/constants/persona";
import { cn } from "@/shared/lib/cn";

type Tab = "mentee" | "mentor" | "campus" | "matching" | "unmatched" | "notice" | "check";

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
  mbtiScore: number;
  personaScore: number;
  majorScore: number;
  contact: string;
  /** SUGGESTED = 추천만 됨, REQUESTED = 멘티가 연락을 요청함 */
  status: string;
  /** 지망 캠퍼스 밖의 대체 후보면 그 이유 */
  fallback?: FallbackReason;
}

/** 운영자 표의 멘토 한 행. 정원 대비 몇 명이 골랐는지를 함께 본다. */
export type AdminMentor = Mentor & { assigned: number };

const FALLBACK_LABEL: Record<FallbackReason, string> = {
  MAJOR: "대체·학과",
  REGION: "대체·지역",
};

const menteeColumns: TableColumn<Mentee>[] = [
  { key: "code", header: "참여코드", value: (r) => r.participationCode, width: "110px" },
  { key: "name", header: "이름", value: (r) => r.name, width: "80px" },
  // 운영자가 가장 자주 찾는 값이라 이름 바로 뒤에 둔다.
  { key: "contact", header: "연락처", value: (r) => r.contact, width: "130px" },
  { key: "gender", header: "성별", value: (r) => genderLabel(r.gender), align: "center", width: "60px" },
  { key: "campus1", header: "1지망", value: (r) => r.targetCampus[0] ?? "-" },
  { key: "campus2", header: "2지망", value: (r) => r.targetCampus[1] ?? "-" },
  { key: "campus3", header: "3지망", value: (r) => r.targetCampus[2] ?? "-" },
  { key: "area", header: "희망 영역", value: (r) => r.desiredAreas.join(", ") },
  { key: "persona", header: "성향", value: (r) => personaName(r.personaType), align: "center" },
  { key: "mbti", header: "MBTI", value: (r) => r.mbti ?? "-", align: "center", width: "70px" },
  { key: "major", header: "희망 학과", value: (r) => r.targetMajors.join(", ") },
  { key: "arrival", header: "채플 날 도착", value: (r) => arrivalLabel(r.eventArrival) },
  { key: "school", header: "출신 고교", value: (r) => r.highSchool ?? "-" },
  {
    key: "mentoring",
    header: "멘토링",
    value: (r) => (r.mentoringApplied ? "신청" : "등록만"),
    align: "center",
    width: "80px",
  },
];

/**
 * 등록만 한 사람은 성향이 비어 있다. 멘토링 2단계에서 받는 값이기 때문이다.
 * 그대로 PERSONAS[...] 를 태우면 undefined.name 으로 표 전체가 죽는다.
 */
function personaName(type: Mentee["personaType"] | undefined): string {
  return type ? PERSONAS[type].name : "-";
}

/** 성별을 받기 전에 등록한 사람은 비어 있다. 그런 사람은 매칭 후보가 되지 않는다. */
function genderLabel(gender: Mentee["gender"]): string {
  return gender ? GENDER_LABEL[gender] : "-";
}

/** 채플이 지난 뒤 신청했거나 이전 신청자라 비어 있을 수 있다. */
function arrivalLabel(arrival: Mentee["eventArrival"]): string {
  return arrival ? EVENT_ARRIVAL_LABEL[arrival] : "-";
}

const mentorColumns: TableColumn<AdminMentor>[] = [
  { key: "code", header: "참여코드", value: (r) => r.participationCode, width: "110px" },
  { key: "name", header: "이름", value: (r) => r.name, width: "80px" },
  { key: "gender", header: "성별", value: (r) => genderLabel(r.gender), align: "center", width: "60px" },
  { key: "campus", header: "캠퍼스", value: (r) => r.currentCampus ?? "-" },
  {
    key: "admission",
    header: "학번",
    value: (r) => (r.admissionYear ? admissionYearLabel(r.admissionYear) : "-"),
    align: "center",
    width: "80px",
  },
  // 이름·캠퍼스·학번으로 누구인지 확인한 뒤 바로 연락하도록 학번 뒤에 둔다.
  { key: "contact", header: "연락처", value: (r) => r.contact, width: "130px" },
  {
    key: "verified",
    header: "인증",
    // 인증은 "멘토 인증" 탭에서 한다. 여기서는 상태만 본다.
    value: (r) =>
      !r.mentoringApplied ? "-" : { pending: "확인 대기", verified: "인증됨", rejected: "미인증" }[verificationStatus(r)],
    align: "center",
    width: "90px",
  },
  { key: "area", header: "멘토링 영역", value: (r) => r.mentoringArea.join(", ") },
  { key: "persona", header: "성향", value: (r) => personaName(r.personaType), align: "center" },
  { key: "mbti", header: "MBTI", value: (r) => r.mbti ?? "-", align: "center", width: "70px" },
  { key: "major", header: "학과", value: (r) => r.currentMajors.join(", ") },
  { key: "arrival", header: "채플 날 도착", value: (r) => arrivalLabel(r.eventArrival) },
  {
    key: "seats",
    header: "배정/정원",
    // 등록만 한 사람은 정원을 고르지 않았다. 1/1 처럼 보이면 신청한 줄 안다.
    value: (r) => (r.mentoringApplied ? `${r.assigned}/${r.capacity}` : "-"),
    align: "center",
    width: "90px",
    // 정원이 찬 멘토는 더 이상 후보에 나오지 않는다. 운영자가 바로 알아봐야 한다.
    render: (r) =>
      r.mentoringApplied ? (
        <span
          className={cn(
            "tabular-nums",
            r.assigned >= r.capacity && "font-bold text-gray-400",
          )}
        >
          {r.assigned}/{r.capacity}
        </span>
      ) : (
        "-"
      ),
  },
  {
    key: "mentoring",
    header: "멘토링",
    value: (r) => (r.mentoringApplied ? "신청" : "등록만"),
    align: "center",
    width: "80px",
  },
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
  {
    key: "kind",
    header: "구분",
    // 대체 후보는 캠퍼스 점수가 0이라 적합도만 보면 나쁜 추천처럼 읽힌다.
    value: (r) => (r.fallback ? FALLBACK_LABEL[r.fallback] : "지망"),
    align: "center",
    width: "90px",
  },
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
  { key: "contact", header: "멘토 연락처", value: (r) => r.contact },
  // 항목별 점수는 매칭이 왜 이렇게 됐는지 따져 볼 때만 본다. 연락처 뒤로 미뤄 둔다.
  // 헤더의 배점은 WEIGHTS 에서 뽑는다. 숫자를 적어 두면 가중치를 바꿨을 때
  // 헤더만 옛 값으로 남아 표를 읽는 사람이 잘못 이해한다.
  { key: "campusScore", header: `캠퍼스(${WEIGHTS.campus})`, value: (r) => r.campusScore, align: "right" },
  { key: "areaScore", header: `영역(${WEIGHTS.area})`, value: (r) => r.areaScore, align: "right" },
  { key: "mbtiScore", header: `MBTI(${WEIGHTS.mbti})`, value: (r) => r.mbtiScore, align: "right" },
  { key: "majorScore", header: `학과(${WEIGHTS.major})`, value: (r) => r.majorScore, align: "right" },
  { key: "personaScore", header: `성경인물(${WEIGHTS.persona})`, value: (r) => r.personaScore, align: "right" },
];

const TABS: { key: Tab; label: string }[] = [
  { key: "mentee", label: "멘티 신청자" },
  // "멘토 신청자" = 인증을 처리하는 곳(확인 대기·미인증), "멘토 인증" = 인증받은 선배 명단.
  { key: "campus", label: "멘토 신청자" },
  { key: "mentor", label: "멘토 인증" },
  { key: "matching", label: "매칭 결과" },
  { key: "unmatched", label: "미매칭" },
  { key: "notice", label: "선배 알림" },
  { key: "check", label: "점검" },
];

export interface UnmatchedRow {
  code: string;
  name: string;
  targetCampus: string[];
  mentorsInCampus: number;
  reason: string;
}

interface AdminDashboardProps {
  /** 보기 전용 비밀번호로 들어온 사람. 바꾸는 버튼을 모두 숨긴다. */
  readOnly: boolean;
  mentees: Mentee[];
  mentors: AdminMentor[];
  matchRows: MatchRow[];
  unmatched: UnmatchedRow[];
  demand: CampusDemandRow[];
  notices: MentorNoticeRow[];
}

const demandColumns: TableColumn<CampusDemandRow>[] = [
  { key: "campus", header: "캠퍼스", value: (r) => r.campus },
  { key: "gender", header: "성별", value: (r) => GENDER_LABEL[r.gender], align: "center", width: "60px" },
  { key: "region", header: "지역", value: (r) => r.region ?? "-", width: "90px" },
  {
    key: "any",
    header: "지망한 후배 (1~3지망)",
    value: (r) => r.anyChoice,
    align: "right",
    width: "170px",
  },
  { key: "first", header: "그중 1지망", value: (r) => r.firstChoice, align: "right", width: "110px" },
  {
    key: "status",
    header: "상태",
    // 둘은 할 일이 다르다. 없는 곳은 모집하고, 찬 곳은 정원을 늘려 달라고 부탁한다.
    value: (r) => demandStatus(r),
    render: (r) => (
      <span className={cn(r.mentors === 0 ? "font-bold text-red-500" : "text-gray-600")}>
        {demandStatus(r)}
      </span>
    ),
  },
];

/** "여자 선배 없음"처럼 누구를 모집할지까지 읽히게 쓴다. */
function demandStatus(r: CampusDemandRow): string {
  const who = `${GENDER_LABEL[r.gender]}자 선배`;
  return r.mentors === 0 ? `${who} 없음` : `정원 마감 (${who} ${r.mentors}명)`;
}

const issueColumns: TableColumn<IssueRow>[] = [
  { key: "kind", header: "구분", value: (r) => r.kind, width: "130px" },
  { key: "contact", header: "연락처", value: (r) => r.contact, width: "140px" },
  { key: "people", header: "등록된 사람", value: (r) => r.people },
  { key: "action", header: "할 일", value: (r) => r.action },
];

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

export function AdminDashboard({
  readOnly,
  mentees,
  mentors,
  matchRows,
  unmatched,
  demand,
  notices,
}: AdminDashboardProps) {
  // 탭 머리의 숫자만 쓴다. 목록 안에서 "보냄"을 눌러도 새로고침 전까지는 그대로다.
  const pendingNotices = notices.filter((n) => !n.notifiedAt).length;
  const issues = findIssues(mentees, mentors);
  // 캠퍼스 인증을 기다리는 선배. 인증 전에는 후배에게 보이지 않아 운영자가 먼저 챙겨야 한다.
  // 미인증으로 둔 선배는 이미 결정한 사람이라 대기에서 뺀다.
  const pendingMentors = mentors.filter(
    (m) => m.mentoringApplied && m.currentCampus && verificationStatus(m) === "pending",
  ).length;
  const [tab, setTab] = useState<Tab>("matching");

  /**
   * 지우려고 고른 사람. 브라우저 확인 창 대신 표 위의 막대로 한 번 더 묻는다.
   * 지우면 프로필과 매칭까지 함께 사라지고 되돌릴 수 없다.
   */
  const [pendingDelete, setPendingDelete] = useState<{
    id: string;
    name: string;
    code: string;
    role: "MENTEE" | "MENTOR";
  }>();
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string>();

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch("/api/admin/delete-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: pendingDelete.id }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        setDeleteMessage(body.error ?? "지우지 못했어요.");
        return;
      }
      setDeleteMessage(`${pendingDelete.name}(${pendingDelete.code})을 지웠어요.`);
      setPendingDelete(undefined);
      // 표·통계·매칭 탭이 모두 같은 명단을 쓰므로 서버에서 다시 받아온다.
      router.refresh();
    } catch {
      setDeleteMessage("연결에 실패했어요.");
    } finally {
      setDeleting(false);
    }
  };

  /** 운영자만 보는 삭제 열. 보기 전용 계정에는 붙이지 않는다. */
  const deleteColumn = <T extends { id: string; name: string; participationCode: string }>(
    role: "MENTEE" | "MENTOR",
  ): TableColumn<T>[] =>
    readOnly
      ? []
      : [
          {
            key: "delete",
            header: "",
            value: () => "",
            width: "70px",
            render: (r) => (
              <button
                type="button"
                onClick={() => {
                  setDeleteMessage(undefined);
                  setPendingDelete({ id: r.id, name: r.name, code: r.participationCode, role });
                }}
                className="text-[12px] font-semibold text-red-500 underline"
              >
                삭제
              </button>
            ),
          },
        ];

  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string>();

  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  /**
   * 로그인 쿠키를 지우고 로그인 화면으로 보낸다.
   * 함께 쓰는 노트북·현장 PC에서 다음 사람이 그대로 들어오지 않게 한다.
   * 쿠키는 httpOnly 라 브라우저에서 지울 수 없어 서버에 맡긴다.
   */
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const res = await fetch("/api/admin/login", { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      router.replace("/admin/login");
      router.refresh();
    } catch {
      setRunMessage("로그아웃하지 못했어요. 다시 눌러주세요.");
      setLoggingOut(false);
    }
  };

  /**
   * 신청자 전원의 추천을 다시 계산한다.
   *
   * 추천은 멘티가 결과 화면을 열어야 저장되므로, 신청만 하고 안 본 사람은
   * 매칭 표에 없다. 이 버튼이 그 빈칸을 채운다. 짝을 정하지는 않는다.
   */
  const handleRunMatching = async () => {
    if (running) return;
    setRunning(true);
    setRunMessage(undefined);
    try {
      const res = await fetch("/api/admin/match-all", { method: "POST" });
      const body = (await res.json()) as {
        applicants?: number;
        computed?: number;
        settled?: number;
        fallbackOnly?: number;
        noCandidates?: number;
        error?: string;
      };
      if (!res.ok) {
        setRunMessage(body.error ?? "매칭을 계산하지 못했어요.");
        return;
      }
      setRunMessage(
        `신청자 ${body.applicants}명 — 추천 계산 ${body.computed}명 · ` +
          `이미 확정 ${body.settled}명 · 대체 후보만 ${body.fallbackOnly}명 · ` +
          `추천 없음 ${body.noCandidates}명. ` +
          `새로고침하면 표에 반영됩니다.`,
      );
    } catch {
      setRunMessage("연결에 실패했어요.");
    } finally {
      setRunning(false);
    }
  };

  const handleExport = () => {
    // 화면 표와 같은 열 구성으로 떨어뜨린다.
    const asCsvColumns = <T,>(cols: TableColumn<T>[]): CsvColumn<T>[] =>
      cols.map((c) => ({ key: c.key, header: c.header, value: c.value }));

    if (tab === "mentee") downloadCsv("멘티_신청자.csv", mentees, asCsvColumns(menteeColumns));
    else if (tab === "mentor") downloadCsv("멘토_전체.csv", mentors, asCsvColumns(mentorColumns));
    else if (tab === "unmatched") downloadCsv("멘토_모집_필요_캠퍼스.csv", demand, asCsvColumns(demandColumns));
    else if (tab === "check") downloadCsv("점검.csv", issues, asCsvColumns(issueColumns));
    else if (tab === "campus") downloadCsv("멘토명단_전체.csv", toRosterRows(mentors), rosterColumns);
    else downloadCsv("매칭_결과.csv", matchRows, asCsvColumns(matchColumns));
  };

  return (
    // 운영자 화면은 모바일 셸(430px)에 가두지 않는다. 열이 많아 넓을수록 유리하다.
    <div className="flex h-dvh flex-col bg-white px-6 py-5">
      <header className="shrink-0">
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3 border-b border-gray-100 pb-3">
          <div className="shrink-0">
            <p className="text-[13px] font-medium text-brand">{readOnly ? "보기 전용" : "운영자"}</p>
            <h1 className="mt-0.5 text-[22px] font-bold tracking-[-0.02em] text-gray-900">
              신청 현황 및 매칭 결과
            </h1>
          </div>

          {/*
            운영 판단에 필요한 수치. 제목과 같은 줄에 둬서 표가 세로로 더 많이 보이게 한다
            (따로 한 줄을 차지하면 노트북 화면에서 표가 열 줄 남짓밖에 안 보였다).
          */}
          <dl className="flex flex-1 flex-wrap items-end gap-x-5 gap-y-1">
            <Stat label="멘티" value={`${mentees.length}명`} />
            <Stat label="멘토" value={`${mentors.length}명`} />
            <Stat label="매칭 성사" value={`${mentees.length - unmatched.length}명`} />
            <Stat label="미매칭" value={`${unmatched.length}명`} emphasis={unmatched.length > 0} />
            <Stat label="추천 조합" value={`${matchRows.length}건`} />
            <Stat label="멘토 인증 대기" value={`${pendingMentors}명`} emphasis={pendingMentors > 0} />
            <Stat label="선배 알림 대기" value={`${pendingNotices}명`} emphasis={pendingNotices > 0} />
          </dl>

          <div className="flex shrink-0 items-center gap-2">
            {!readOnly && (
              <button
                type="button"
                onClick={handleRunMatching}
                disabled={running}
                className="h-9 rounded-lg border border-gray-200 px-4 text-[13px] font-bold text-gray-700 active:bg-gray-100 disabled:text-gray-300"
              >
                {running ? "계산 중…" : "전체 매칭 실행"}
              </button>
            )}
            <button
              type="button"
              onClick={handleExport}
              className="h-9 rounded-lg bg-brand px-4 text-[13px] font-bold text-white active:bg-brand-dark"
            >
              CSV 내보내기
            </button>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="h-9 rounded-lg px-3 text-[13px] font-semibold text-gray-500 active:bg-gray-100 disabled:text-gray-300"
            >
              {loggingOut ? "나가는 중…" : "로그아웃"}
            </button>
          </div>
        </div>

        {/* 실행 결과는 숫자로만 알린다. 무엇이 바뀌었는지 바로 확인해야 한다. */}
        {runMessage && (
          <p className="mt-3 rounded-lg bg-brand-soft px-4 py-2.5 text-[13px] font-medium text-brand">
            {runMessage}
          </p>
        )}


        <div className="flex flex-wrap gap-1 py-2.5">
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
              {t.key === "notice" && pendingNotices > 0 && (
                <span className="ml-1.5 tabular-nums">{pendingNotices}</span>
              )}
              {t.key === "campus" && pendingMentors > 0 && (
                <span className="ml-1.5 tabular-nums">{pendingMentors}</span>
              )}
              {t.key === "check" && issues.length > 0 && (
                <span className="ml-1.5 tabular-nums">{issues.length}</span>
              )}
            </button>
          ))}
        </div>
      </header>

      {(tab === "mentee" || tab === "mentor") && (pendingDelete || deleteMessage) && (
        <div className="mb-3 flex max-w-[760px] shrink-0 flex-wrap items-center gap-2 rounded-lg bg-red-500/10 px-4 py-2.5 text-[13px] text-red-700">
          {pendingDelete ? (
            <>
              <span className="font-semibold">
                {pendingDelete.name}({pendingDelete.role === "MENTOR" ? "대학생" : "고3"}, {pendingDelete.code})을
                지울까요?
              </span>
              <span>
                {pendingDelete.role === "MENTOR"
                  ? "이 선배를 고른 후배의 연결도 함께 지워져요."
                  : "이 후배의 추천·연결 기록도 함께 지워져요."}{" "}
                되돌릴 수 없어요.
              </span>
              <button
                type="button"
                onClick={() => void confirmDelete()}
                disabled={deleting}
                className="h-7 rounded-md bg-red-600 px-3 font-bold text-white disabled:opacity-40"
              >
                {deleting ? "지우는 중…" : "삭제"}
              </button>
              <button type="button" onClick={() => setPendingDelete(undefined)} className="h-7 px-2 text-gray-600">
                취소
              </button>
            </>
          ) : (
            <span>{deleteMessage}</span>
          )}
        </div>
      )}

      {tab === "mentee" && (
        <DataTable
          rows={mentees}
          columns={[...menteeColumns, ...deleteColumn<Mentee>("MENTEE")]}
          rowKey={(r) => r.id}
          searchable={(r) => `${r.participationCode} ${r.name} ${r.targetCampus.join(" ")} ${r.targetMajors.join(" ")} ${r.desiredAreas.join(" ")}`}
        />
      )}

      {tab === "mentor" && (
        <MentorRoster mentors={mentors} columns={[...mentorColumns, ...deleteColumn<AdminMentor>("MENTOR")]} />
      )}

      {tab === "unmatched" && (
        <>
          {/*
            모집 우선순위를 정하는 표가 먼저다. 미매칭 명단은 그 근거로 아래에 둔다.
            지망한 후배가 많은 캠퍼스가 위로 온다.
          */}
          {demand.length > 0 && (
            <section className="mb-5 flex max-h-[40%] shrink-0 flex-col">
              <h2 className="mb-2 text-[14px] font-bold text-gray-900">
                멘토 모집이 필요한 캠퍼스 {demand.length}곳
                <span className="ml-2 text-[12px] font-medium text-gray-400">
                  선배를 아직 고르지 못한 후배가 지망한 곳 중 남은 자리가 없는 곳 · CSV
                  내보내기는 이 표를 받습니다
                </span>
              </h2>
              <DataTable
                rows={demand}
                columns={demandColumns}
                rowKey={(r) => r.campus}
                searchable={(r) => `${r.campus} ${r.region ?? ""}`}
              />
            </section>
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

      {tab === "notice" && <MentorNoticeList initial={notices} readOnly={readOnly} />}

      {tab === "campus" && <MentorVerification mentors={mentors} readOnly={readOnly} />}

      {tab === "check" && (
        <>
          <p className="mb-3 max-w-[720px] shrink-0 text-[13px] leading-relaxed text-gray-500">
            같은 번호로 두 번 등록된 사람과, 성별이 비어 매칭 후보가 되지 못하는 사람이에요.
            새로 등록할 때는 같은 번호를 막지만, 그 전에 들어온 등록은 여기서 확인해요.
          </p>
          <DataTable
            rows={issues}
            columns={issueColumns}
            rowKey={(r) => r.id}
            searchable={(r) => `${r.kind} ${r.contact} ${r.people}`}
            emptyMessage="점검할 항목이 없습니다."
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
      <dt className="text-[11px] leading-tight text-gray-400">{label}</dt>
      <dd
        className={cn(
          "text-[16px] leading-tight font-bold tabular-nums",
          emphasis ? "text-red-500" : "text-gray-900",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
