import type { TableColumn } from "../components/DataTable";

/**
 * 운영자 표의 등록 시각.
 *
 * 서버(Vercel)와 운영자 노트북의 시간대가 달라도 같은 시각이 보이도록 한국 시간으로 고정한다.
 * "2026-10-27 14:03" 모양이라 글자 순서대로 정렬해도 시간 순서와 같다(표의 정렬·CSV 에 그대로 쓴다).
 */
const PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function seoulDateTime(iso: string | undefined): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  const p = Object.fromEntries(PARTS.formatToParts(date).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** 표에 보일 짧은 모양. "10/27 14:03" */
export function shortDateTime(iso: string | undefined): string {
  const full = seoulDateTime(iso);
  if (full === "-") return full;
  const [date, time] = full.split(" ");
  const [, month, day] = date.split("-");
  return `${month}/${day} ${time}`;
}

/**
 * 운영자 표의 "등록 시각" 열. 정렬은 전체 시각, 화면에는 짧게 보인다.
 * 명단이 늘어날수록 "방금 들어온 사람"을 찾는 일이 많아 표마다 같은 열을 쓴다.
 */
export function createdAtColumn<T extends { createdAt?: string }>(): TableColumn<T> {
  return {
    key: "created",
    header: "등록 시각",
    value: (r) => seoulDateTime(r.createdAt),
    render: (r) => <span className="tabular-nums text-gray-500">{shortDateTime(r.createdAt)}</span>,
    width: "100px",
    align: "center",
  };
}

/** 표를 처음 열 때 최신 등록이 위로 오게 한다. */
export const NEWEST_FIRST = { key: "created", direction: "desc" } as const;
