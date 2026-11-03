"use client";

import { useMemo, useState } from "react";
import { cn } from "@/shared/lib/cn";
import { PHONE_QUERY, useMediaQuery } from "@/shared/hooks/useMediaQuery";

export interface TableColumn<T> {
  key: string;
  header: string;
  /** 셀에 표시할 값. 정렬도 이 값을 기준으로 한다. */
  value: (row: T) => string | number;
  /** 값과 다르게 그리고 싶을 때 (뱃지 등) */
  render?: (row: T) => React.ReactNode;
  width?: string;
  align?: "left" | "right" | "center";
}

interface DataTableProps<T> {
  rows: T[];
  columns: TableColumn<T>[];
  rowKey: (row: T) => string;
  /** 검색어가 걸리는 대상 문자열 */
  searchable?: (row: T) => string;
  emptyMessage?: string;
  /** 처음 열었을 때의 정렬. 예: 등록 시각 최신순. 헤더를 누르면 바뀐다. */
  initialSort?: SortState;
}

export type SortState = { key: string; direction: "asc" | "desc" } | null;

/**
 * 엑셀에 가까운 밀도의 표.
 * 운영자는 수백 행을 훑으며 비교하므로 카드가 아니라 표여야 하고,
 * 헤더 고정 + 행 번호 + 얼룩무늬(zebra) + 정렬이 필요하다.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  searchable,
  emptyMessage = "데이터가 없습니다.",
  initialSort = null,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(initialSort);
  const [query, setQuery] = useState("");
  const phone = useMediaQuery(PHONE_QUERY);

  const visibleRows = useMemo(() => {
    let result = rows;

    if (query.trim() && searchable) {
      const q = query.trim().toLowerCase();
      result = result.filter((row) => searchable(row).toLowerCase().includes(q));
    }

    if (sort) {
      const column = columns.find((c) => c.key === sort.key);
      if (column) {
        // 원본 배열을 건드리지 않도록 복사 후 정렬한다.
        result = [...result].sort((a, b) => {
          const av = column.value(a);
          const bv = column.value(b);
          const diff =
            typeof av === "number" && typeof bv === "number"
              ? av - bv
              : String(av).localeCompare(String(bv), "ko");
          return sort.direction === "asc" ? diff : -diff;
        });
      }
    }

    return result;
  }, [rows, columns, sort, query, searchable]);

  const toggleSort = (key: string) => {
    setSort((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { key, direction: "asc" },
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {searchable && (
        <div className="flex items-center gap-3 pb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="참여코드, 이름, 캠퍼스로 검색"
            className="h-9 min-w-0 flex-1 rounded-lg border border-gray-200 px-3 text-[13px] outline-none focus:border-brand md:w-72 md:flex-none"
          />
          <span className="shrink-0 text-[13px] text-gray-500 tabular-nums">
            {visibleRows.length.toLocaleString()}행
            {query && ` / 전체 ${rows.length.toLocaleString()}행`}
          </span>
        </div>
      )}

      {phone ? (
        <CardList rows={visibleRows} columns={columns} rowKey={rowKey} emptyMessage={emptyMessage} />
      ) : (
        <TableView
          rows={visibleRows}
          columns={columns}
          rowKey={rowKey}
          emptyMessage={emptyMessage}
          sort={sort}
          onSort={toggleSort}
        />
      )}
    </div>
  );
}

function TableView<T>({
  rows: visibleRows,
  columns,
  rowKey,
  emptyMessage,
  sort,
  onSort: toggleSort,
}: {
  rows: T[];
  columns: TableColumn<T>[];
  rowKey: (row: T) => string;
  emptyMessage: string;
  sort: SortState;
  onSort: (key: string) => void;
}) {
  return (
    <>

      {/* 표 전체가 가로로도 스크롤되어야 좁은 화면에서 열이 뭉개지지 않는다. */}
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-gray-200">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-100">
              <th className="w-12 border-b border-gray-200 px-2 py-2 text-right font-semibold text-gray-500">
                #
              </th>
              {columns.map((col) => {
                const active = sort?.key === col.key;
                return (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={cn(
                      "border-b border-gray-200 px-3 py-2 font-semibold whitespace-nowrap",
                      "cursor-pointer select-none hover:bg-gray-200",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      !col.align && "text-left",
                      active ? "text-brand" : "text-gray-600",
                    )}
                    onClick={() => toggleSort(col.key)}
                    aria-sort={
                      active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"
                    }
                  >
                    {col.header}
                    <span className="ml-1 text-[10px]">
                      {active ? (sort.direction === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-3 py-10 text-center text-gray-400"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, i) => (
                <tr key={rowKey(row)} className="even:bg-gray-50 hover:bg-brand-soft">
                  <td className="border-b border-gray-100 px-2 py-1.5 text-right text-gray-400 tabular-nums">
                    {i + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "border-b border-gray-100 px-3 py-1.5 whitespace-nowrap text-gray-800",
                        col.align === "right" && "text-right tabular-nums",
                        col.align === "center" && "text-center",
                      )}
                    >
                      {col.render ? col.render(row) : col.value(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** 카드를 펼치기 전에 보일 항목 수. 나머지는 "자세히"를 눌러야 보인다. */
const CARD_PREVIEW = 6;

/** 이름이 들어 있는 열. 카드 제목이 된다. */
const TITLE_KEYS = ["name", "menteeName"];

/**
 * 휴대폰에서 보는 명단.
 *
 * 표는 열이 열 개가 넘어 휴대폰에서는 옆으로 한참 밀어야 하고, 삭제·인증 버튼이
 * 맨 오른쪽 끝에 있어 누르기 어렵다. 한 사람을 카드 하나로 세우고,
 * 머리글이 빈 열(삭제·인증 같은 버튼)은 카드 아래쪽에 모아 바로 누르게 한다.
 * 열 구성은 표와 같아서 탭마다 따로 만들지 않는다.
 */
function CardList<T>({
  rows,
  columns,
  rowKey,
  emptyMessage,
}: {
  rows: T[];
  columns: TableColumn<T>[];
  rowKey: (row: T) => string;
  emptyMessage: string;
}) {
  const title = columns.find((c) => TITLE_KEYS.includes(c.key));
  const actions = columns.filter((c) => c.header === "");
  const fields = columns.filter((c) => c !== title && c.header !== "");

  if (rows.length === 0) {
    return <p className="rounded-lg border border-gray-200 px-3 py-10 text-center text-[13px] text-gray-400">{emptyMessage}</p>;
  }

  return (
    <ul className="flex flex-col gap-2 pb-24">
      {rows.map((row) => (
        <Card key={rowKey(row)} row={row} title={title} fields={fields} actions={actions} />
      ))}
    </ul>
  );
}

function Card<T>({
  row,
  title,
  fields,
  actions,
}: {
  row: T;
  title?: TableColumn<T>;
  fields: TableColumn<T>[];
  actions: TableColumn<T>[];
}) {
  const [open, setOpen] = useState(false);
  const shown = open ? fields : fields.slice(0, CARD_PREVIEW);
  const cell = (col: TableColumn<T>) => (col.render ? col.render(row) : col.value(row));

  return (
    <li className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      {title && <p className="mb-2 text-[16px] font-bold text-gray-900">{cell(title)}</p>}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[13px]">
        {shown.map((col) => (
          <div key={col.key} className="contents">
            <dt className="whitespace-nowrap text-gray-400">{col.header}</dt>
            <dd className="min-w-0 break-words text-gray-800">{cell(col)}</dd>
          </div>
        ))}
      </dl>
      {(fields.length > CARD_PREVIEW || actions.length > 0) && (
        <div className="mt-3 flex items-center gap-2">
          {fields.length > CARD_PREVIEW && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="h-9 text-[13px] font-semibold text-gray-500"
            >
              {open ? "접기" : `자세히 (${fields.length - CARD_PREVIEW})`}
            </button>
          )}
          {actions.length > 0 && (
            <div className="ml-auto flex items-center gap-3">
              {actions.map((col) => (
                <span key={col.key}>{cell(col)}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
