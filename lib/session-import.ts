import { unzipSync } from 'fflate';

export type SessionImportRecord = {
  rowNumber: number;
  session: {
    venue: string;
    date: string;
    startTime: string;
    endTime: string;
    pricePence: number | string;
    capacity: number | string;
    formats: string[];
    description: string;
    descriptionZh: string;
    status: string;
  };
};

export type SessionImportErrorCode =
  | 'invalid_file'
  | 'missing_columns'
  | 'empty_workbook'
  | 'empty_sessions'
  | 'too_many_rows';

export class SessionImportError extends Error {
  constructor(readonly code: SessionImportErrorCode) {
    super(code);
    this.name = 'SessionImportError';
  }
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const MAX_ROWS = 200;

const headers = {
  venue: ['venuename', '场地名称'],
  date: ['date', '日期'],
  startTime: ['starttime', '开始时间'],
  endTime: ['endtime', '结束时间'],
  price: ['priceperperson', '每人价格'],
  capacity: ['capacity', '名额'],
  formats: ['formats', '形式'],
  description: ['descriptionenglish', '英文描述'],
  descriptionZh: ['descriptionchinese', '中文描述'],
  status: ['status', '状态'],
} as const;

function parseXml(source: Uint8Array | undefined) {
  if (!source) throw new SessionImportError('invalid_file');
  const xml = new DOMParser().parseFromString(new TextDecoder().decode(source), 'application/xml');
  if (xml.getElementsByTagName('parsererror').length) throw new SessionImportError('invalid_file');
  return xml;
}

function descendants(element: Element | Document, localName: string) {
  return Array.from(element.getElementsByTagNameNS('*', localName));
}

function pathFromWorkbookTarget(target: string) {
  if (target.startsWith('/')) return target.slice(1);
  const parts = ['xl'];
  for (const part of target.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

function readSharedStrings(files: Record<string, Uint8Array>) {
  const bytes = files['xl/sharedStrings.xml'];
  if (!bytes) return [] as string[];
  const xml = parseXml(bytes);
  return descendants(xml, 'si').map((item) =>
    descendants(item, 't').map((text) => text.textContent ?? '').join(''),
  );
}

function columnIndex(reference: string) {
  const letters = reference.match(/^[A-Z]+/i)?.[0].toUpperCase();
  if (!letters) return -1;
  let index = 0;
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64;
  return index - 1;
}

function cellText(cell: Element, sharedStrings: string[]) {
  const type = cell.getAttribute('t');
  if (type === 'inlineStr') {
    return descendants(cell, 't').map((text) => text.textContent ?? '').join('');
  }
  const value = descendants(cell, 'v')[0]?.textContent ?? '';
  if (type === 's') return sharedStrings[Number(value)] ?? '';
  return value;
}

function readWorksheetRows(bytes: Uint8Array, sharedStrings: string[]) {
  const xml = parseXml(bytes);
  return descendants(xml, 'row').map((row, index) => {
    const values: string[] = [];
    for (const cell of descendants(row, 'c')) {
      const reference = cell.getAttribute('r') ?? '';
      const column = columnIndex(reference);
      if (column >= 0) values[column] = cellText(cell, sharedStrings);
    }
    return { rowNumber: Number(row.getAttribute('r')) || index + 1, values };
  });
}

function normalizedHeader(value: string) {
  return value.toLocaleLowerCase().replace(/[\s_()（）/.-]+/g, '');
}

function locateHeader(rows: Array<{ rowNumber: number; values: string[] }>) {
  for (const row of rows.slice(0, 10)) {
    const names = row.values.map((value) => normalizedHeader(value ?? ''));
    const indices: Record<keyof typeof headers, number> = {} as Record<keyof typeof headers, number>;
    let found = true;
    for (const [field, aliases] of Object.entries(headers) as Array<[keyof typeof headers, readonly string[]]>) {
      const index = names.findIndex((name) => aliases.some((alias) => name.includes(normalizedHeader(alias))));
      if (index < 0) {
        found = false;
        break;
      }
      indices[field] = index;
    }
    if (found) return { row, indices };
  }
  throw new SessionImportError('missing_columns');
}

function excelDate(value: string) {
  const clean = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(clean)) {
    const serial = Number(clean);
    if (!Number.isFinite(serial) || serial < 1) return clean;
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000);
    return Number.isNaN(date.getTime()) ? clean : date.toISOString().slice(0, 10);
  }
  const ukDate = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ukDate) return `${ukDate[3]}-${ukDate[2].padStart(2, '0')}-${ukDate[1].padStart(2, '0')}`;
  return clean;
}

function excelTime(value: string) {
  const clean = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(clean)) {
    const serial = Number(clean);
    if (!Number.isFinite(serial) || serial < 0 || serial >= 2) return clean;
    const totalMinutes = Math.round((serial % 1) * 1440) % 1440;
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, '0')}:${String(totalMinutes % 60).padStart(2, '0')}`;
  }
  const match = clean.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return clean;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

function parseFormats(value: string) {
  if (!value.trim()) return ['singles', 'doubles'];
  const tokens = value.toLocaleLowerCase().split(/[,，;；|/\s]+/).filter(Boolean);
  const formats = tokens.map((token) => {
    if (token === 'singles' || token === '单打') return 'singles';
    if (token === 'doubles' || token === '双打') return 'doubles';
    return `invalid:${token}`;
  });
  return [...new Set(formats)];
}

function poundsToPence(value: string): number | string {
  const clean = value.trim().replace(/[£,\s]/g, '');
  const pounds = Number(clean);
  if (!clean || !Number.isFinite(pounds)) return 'invalid';
  const pence = Math.round(pounds * 100);
  return Math.abs(pounds * 100 - pence) < 0.001 ? pence : 'invalid';
}

function numericOrInvalid(value: string): number | string {
  const clean = value.trim();
  if (!clean) return 'invalid';
  const number = Number(clean);
  return Number.isFinite(number) ? number : 'invalid';
}

export async function parseSessionWorkbook(file: File): Promise<SessionImportRecord[]> {
  if (!file.name.toLocaleLowerCase().endsWith('.xlsx') || file.size > MAX_FILE_SIZE) {
    throw new SessionImportError('invalid_file');
  }

  try {
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const workbook = parseXml(files['xl/workbook.xml']);
    const workbookRelationships = parseXml(files['xl/_rels/workbook.xml.rels']);
    const firstSheet = descendants(workbook, 'sheet')[0];
    const relationshipId = firstSheet?.getAttribute('r:id') ?? firstSheet?.getAttributeNS(
      'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
      'id',
    );
    const relationship = descendants(workbookRelationships, 'Relationship')
      .find((item) => item.getAttribute('Id') === relationshipId);
    const target = relationship?.getAttribute('Target');
    if (!target) throw new SessionImportError('invalid_file');
    const rows = readWorksheetRows(files[pathFromWorkbookTarget(target)], readSharedStrings(files));
    const { row: headerRow, indices } = locateHeader(rows);
    const records = rows
      .filter((row) => row.rowNumber > headerRow.rowNumber && row.values.some((value) => value?.trim()))
      .map(({ rowNumber, values }): SessionImportRecord => {
        const get = (field: keyof typeof headers) => values[indices[field]] ?? '';
        const status = get('status').trim() || 'draft';
        return {
          rowNumber,
          session: {
            venue: get('venue').trim(),
            date: excelDate(get('date')),
            startTime: excelTime(get('startTime')),
            endTime: excelTime(get('endTime')),
            pricePence: poundsToPence(get('price')),
            capacity: numericOrInvalid(get('capacity')),
            formats: parseFormats(get('formats')),
            description: get('description').trim(),
            descriptionZh: get('descriptionZh').trim(),
            status,
          },
        };
      });

    if (!records.length) throw new SessionImportError('empty_sessions');
    if (records.length > MAX_ROWS) throw new SessionImportError('too_many_rows');
    return records;
  } catch (error) {
    if (error instanceof SessionImportError) throw error;
    throw new SessionImportError('invalid_file');
  }
}
