const COLUMN_SEPARATOR = "||";

// 2026-10-02 15:14:19 CST：统一使用双竖线分列并支持引号转义，避免标题中的分隔符或换行破坏导入记录。
// 触发场景：字段映射、模板和数据字典页面导入/导出 TXT；维护时保持导入表头与各页面的映射字段同步。
export function serializeTxt(headers: string[], rows: string[][]): string {
  const encodeField = (value: string) => {
    if (!/["\r\n]/.test(value) && !value.includes(COLUMN_SEPARATOR) && value === value.trim()) return value;
    return `"${value.replaceAll('"', '""')}"`;
  };
  return `\uFEFF${[headers, ...rows].map((row) => row.map(encodeField).join(COLUMN_SEPARATOR)).join("\r\n")}\r\n`;
}

export function parseTxt(text: string, expectedHeaders: string[]): string[][] {
  const source = text.replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (quoted) {
      if (char === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
        closedQuote = true;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"' && field.length === 0 && !closedQuote) {
      quoted = true;
      continue;
    }
    if (char === '"') throw new Error("字段中的引号必须使用双引号转义");
    if (source.startsWith(COLUMN_SEPARATOR, index)) {
      row.push(field);
      field = "";
      closedQuote = false;
      index += COLUMN_SEPARATOR.length - 1;
      continue;
    }
    if (char === "\r" || char === "\n") {
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.length > 0)) records.push(row);
      row = [];
      field = "";
      closedQuote = false;
      continue;
    }
    if (closedQuote) throw new Error("引号后的内容格式无效");
    field += char;
  }

  if (quoted) throw new Error("TXT 文件存在未闭合的引号");
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((value) => value.length > 0)) records.push(row);
  }
  if (records.length < 2) throw new Error("TXT 文件没有可导入的数据");
  if (records[0].length !== expectedHeaders.length || records[0].some((header, index) => header !== expectedHeaders[index])) {
    throw new Error(`表头必须为：${expectedHeaders.join(COLUMN_SEPARATOR)}`);
  }
  const entries = records.slice(1);
  const malformed = entries.findIndex((record) => record.length !== expectedHeaders.length);
  if (malformed >= 0) throw new Error(`第 ${malformed + 2} 行字段数量不正确`);
  return entries;
}

export function downloadTxt(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
