import Table from "cli-table3";

export type TableCellValue = string | number | boolean | null | undefined;
export type TableRow = readonly TableCellValue[];
export type KeyValueRow = readonly [label: string, value: TableCellValue];

type RenderTableInput = {
  head?: readonly string[];
  rows: readonly TableRow[];
};

export function renderTable(input: RenderTableInput): string {
  const table = new Table({
    head: input.head ? [...input.head] : undefined,
    style: {
      head: [],
    },
    wordWrap: true,
  });

  for (const row of input.rows) {
    table.push(row.map(formatTableValue));
  }

  return table.toString();
}

export function renderKeyValueTable(rows: readonly KeyValueRow[]): string {
  return renderTable({
    head: ["Field", "Value"],
    rows: rows.map(([label, value]) => [label, value]),
  });
}

export function formatTableValue(value: TableCellValue): string {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}
