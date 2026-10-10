import { unzipSync } from 'fflate';
import { Parser } from 'saxen';
import { MAX_CSV_BYTES, MAX_CSV_ROWS, parseCsv, type CsvData } from './training-csv';

export type SpreadsheetSheet = { name: string; data?: CsvData; error?: string };

function jsonRecords(records: unknown[], sourceRows = records.map((_, index) => index + 1), lines = false): CsvData {
  if (!records.length) throw new Error('This JSON contains no examples. Add objects describing your cases.');
  if (records.length > MAX_CSV_ROWS) throw new Error('Use at most 20,000 examples. Choose a smaller export.');
  const fields = new Set<string>();
  const objects = records.map((record, index) => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) throw new Error(`${lines ? 'JSONL line' : 'JSON example'} ${sourceRows[index]} must be an object with named fields.`);
    const keys = Object.keys(record);
    if (!keys.length || keys.some(key => !key.trim())) throw new Error(`Example ${sourceRows[index]} needs nonempty field names.`);
    keys.forEach(key => fields.add(key));
    if (fields.size > 64) throw new Error('Use at most 64 fields. Keep only the fields needed for this decision.');
    return record as Record<string, unknown>;
  });
  const headers = [...fields];
  const rows = objects.map(record => headers.map(header => {
    const value = Object.hasOwn(record, header) ? record[header] : null;
    return value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value).trim();
  }));
  return { headers, rows, sourceRows };
}

function readJson(source: string, name: string, linesOnly: boolean): SpreadsheetSheet[] {
  const text = source.replace(/^\uFEFF/, '').trim();
  if (!text) throw new Error('This JSON is empty. Add examples first.');
  const parse = (value: string): unknown => JSON.parse(value, (_key, item) => {
    if (typeof item === 'number' && (!Number.isFinite(item) || (Number.isInteger(item) && !Number.isSafeInteger(item)))) throw new Error('A number is too large to read accurately. Put large numbers and identifiers in quotes in the source JSON.');
    return item;
  });
  let payload: unknown;
  if (!linesOnly) {
    try { payload = parse(text); }
    catch (error) {
      if (!(error instanceof SyntaxError)) throw error;
      if (text.startsWith('[') || !text.includes('\n')) throw new Error('This JSON could not be read. Check its quotes, commas, and brackets.');
      linesOnly = true;
    }
  }
  if (linesOnly) {
    const records: unknown[] = [], sourceRows: number[] = [];
    for (const [index, line] of source.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/).entries()) {
      if (!line.trim()) continue;
      try { records.push(parse(line)); }
      catch (error) { throw new Error(`JSONL line ${index + 1}: ${error instanceof SyntaxError ? 'could not be read. Put one complete JSON object on each line.' : (error as Error).message}`); }
      sourceRows.push(index + 1);
      if (records.length > MAX_CSV_ROWS) throw new Error('Use at most 20,000 examples. Choose a smaller export.');
    }
    return [{ name, data: jsonRecords(records, sourceRows, true) }];
  }
  if (Array.isArray(payload)) return [{ name, data: jsonRecords(payload) }];
  const whole = jsonRecords([payload]);
  const lists = Object.entries(payload as Record<string, unknown>).filter(([, value]) => Array.isArray(value) && value.length && value.every(item => item && typeof item === 'object' && !Array.isArray(item)));
  return [
    { name: lists.length ? 'Whole JSON object' : name, data: whole },
    ...lists.map(([key, records]) => {
      try { return { name: key, data: jsonRecords(records as unknown[]) }; }
      catch (error) { return { name: key, error: (error as Error).message }; }
    }),
  ];
}

/** Inspect ZIP directory sizes without inflating entries or loading cell contents. */
export function checkWorkbookArchive(bytes: Uint8Array, maxExpandedBytes = 64 * 1024 * 1024) {
  let expanded = 0, entries = 0;
  try {
    unzipSync(bytes, { filter: entry => {
      expanded += entry.originalSize;
      if (++entries > 512 || !Number.isSafeInteger(expanded) || expanded > maxExpandedBytes) {
        throw new Error('This workbook is too large when expanded. Save just the examples sheet as a new workbook or CSV.');
      }
      return false;
    } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('expanded')) throw error;
    throw new Error('This file could not be read as an Excel workbook. Save it as .xlsx or CSV UTF-8 and try again.');
  }
}

/** Sparse cell addresses can allocate huge tables even in a very small ZIP. */
export function checkWorkbookRanges(bytes: Uint8Array) {
  const contents = unzipSync(bytes, { filter: entry => entry.name.endsWith('.xml') });
  let sheets = 0, allocatedCells = 0;
  for (const content of Object.values(contents)) {
    const xml = new TextDecoder('utf-8', { fatal: true }).decode(content);
    let rows = 0, maxRow = 0, maxColumn = 0;
    const parser = new Parser();
    parser.on('error', error => { throw error; });
    parser.on('warn', error => { throw error; });
    parser.on('openTag', (name, attributes, decode) => {
      const tag = name.split(':').at(-1);
      if (tag === 'sheetData' && ++sheets > 32) throw new Error('Choose a workbook with at most 32 sheets.');
      if (tag !== 'row' && tag !== 'c') return;
      const reference = decode(attributes().r || '');
      if (tag === 'row') {
        if (++rows > MAX_CSV_ROWS + 1 || (reference && (!/^\d+$/.test(reference) || Number(reference) > MAX_CSV_ROWS + 1))) throw new Error('Use at most 20,000 rows per sheet. Save only your examples in a smaller workbook.');
      } else {
        const cell = /^([A-Z]+)([1-9]\d*)$/.exec(reference);
        if (!cell) throw new Error('This workbook contains an invalid cell reference. Export the examples as CSV UTF-8.');
        const column = [...cell[1]].reduce((value, letter) => value * 26 + letter.charCodeAt(0) - 64, 0);
        const row = Number(cell[2]);
        if (column > 64 || row > MAX_CSV_ROWS + 1) throw new Error('Use at most 20,000 rows and 64 columns per sheet. Remove unused rows and columns or export just your examples as CSV.');
        maxRow = Math.max(maxRow, row); maxColumn = Math.max(maxColumn, column);
      }
    });
    parser.parse(xml);
    allocatedCells += maxRow * maxColumn;
    if (allocatedCells > 4_000_000) throw new Error('This workbook has too many cells. Save only the examples sheet as a new workbook or CSV.');
  }
}

/** Excel omits empty cells; pad them while retaining the visible spreadsheet row. */
export function normalizeSheet(cells: unknown[][]): CsvData {
  if (cells.length > MAX_CSV_ROWS + 1) throw new Error('Use at most 20,000 spreadsheet rows per sheet.');
  const text = (value: unknown) => {
    if (value == null) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    throw new Error('A cell could not be read. Save the sheet as CSV UTF-8 and try again.');
  };
  const records = cells.map((row, index) => ({ cells: row.map(text), sourceRow: index + 1 }));
  const nonempty = records.filter(row => row.cells.some(Boolean));
  const first = nonempty.shift();
  if (!first) throw new Error('This sheet is empty. Choose a sheet with examples.');
  const headers = [...first.cells];
  while (headers.length && !headers.at(-1)) headers.pop();
  if (headers.length < 2) throw new Error('Add a header row with at least two columns: information and the correct answer.');
  if (headers.length > 64) throw new Error('Use at most 64 columns. Keep only fields needed for this decision.');
  if (headers.some(header => !header) || new Set(headers).size !== headers.length) throw new Error('Give every column a unique, nonempty header.');
  if (!nonempty.length) throw new Error('This sheet has headers but no examples.');
  const rows = nonempty.map(row => {
    if (row.cells.slice(headers.length).some(Boolean)) throw new Error(`Row ${row.sourceRow} contains values in a column without a header. Add a header or remove that column.`);
    return headers.map((_, index) => row.cells[index] || '');
  });
  if (new TextEncoder().encode(JSON.stringify(rows)).length > 32 * 1024 * 1024) throw new Error('This sheet contains too much text. Keep only the examples and fields needed for this decision.');
  return { headers, rows, sourceRows: nonempty.map(row => row.sourceRow) };
}

/** The file is parsed in browser memory; no network or persistent storage is used. */
export async function readSpreadsheet(file: File): Promise<SpreadsheetSheet[]> {
  if (!file.size) throw new Error('This file is empty. Choose a file with examples.');
  if (file.size > MAX_CSV_BYTES) throw new Error('Choose data smaller than 10 MiB, or use prepared files.');
  if (!/\.(csv|xlsx|json|jsonl|ndjson)$/i.test(file.name)) throw new Error('Choose a CSV, Excel (.xlsx), JSON, or JSONL file. Save older Excel files as .xlsx first.');
  const buffer = await file.arrayBuffer();
  if (!/\.xlsx$/i.test(file.name)) {
    let source: string;
    try { source = new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
    catch { throw new Error('Save the file with UTF-8 encoding and choose the exported file again.'); }
    return /\.csv$/i.test(file.name) ? [{ name: file.name, data: parseCsv(source) }] : readJson(source, file.name, /\.(jsonl|ndjson)$/i.test(file.name));
  }
  const bytes = new Uint8Array(buffer);
  checkWorkbookArchive(bytes);
  try { checkWorkbookRanges(bytes); }
  catch (error) { throw new Error(error instanceof Error ? error.message : 'Could not read this workbook. Export it as CSV UTF-8.'); }
  // Universal reads in the browser as well as in tests, without server APIs.
  const { default: readWorkbook } = await import('read-excel-file/universal');
  let workbook;
  try { workbook = await readWorkbook(buffer, { parseNumber: value => value }); }
  catch { throw new Error('Could not read this Excel workbook. Remove password protection and save it as .xlsx, or export CSV UTF-8.'); }
  if (!workbook.length) throw new Error('This workbook has no sheets. Choose a spreadsheet with examples.');
  if (workbook.length > 32) throw new Error('Choose a workbook with at most 32 sheets. Save the examples in a smaller workbook.');
  return workbook.map(sheet => {
    try { return { name: sheet.sheet, data: normalizeSheet(sheet.data) }; }
    catch (error) { return { name: sheet.sheet, error: error instanceof Error ? error.message : 'This sheet could not be read.' }; }
  });
}
