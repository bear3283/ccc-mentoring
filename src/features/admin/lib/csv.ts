/**
 * 표를 CSV로 내보낸다.
 * 운영자가 엑셀에서 이어서 작업하는 것이 실제 워크플로라, 화면 표와
 * 같은 열 구성 그대로 떨어지게 만든다.
 */

export interface CsvColumn<T> {
  key: string;
  header: string;
  value: (row: T) => string | number;
}

/** 쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싸고 내부 따옴표는 두 번 쓴다 (RFC 4180). */
function escapeCell(input: string | number): string {
  const text = String(input);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(","));
  return [header, ...body].join("\r\n");
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]) {
  // 엑셀이 한글을 깨뜨리지 않도록 UTF-8 BOM을 앞에 붙인다.
  const blob = new Blob(["﻿" + toCsv(rows, columns)], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
