/** In-memory Google Apps Script runtime used to unit test src/gas/Code.gs. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

export class MockSheet {
  rows: unknown[][] = [];
  constructor(public name: string, header: string[] = []) {
    if (header.length) this.rows.push([...header]);
  }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return Math.max(0, ...this.rows.map((r) => r.length)); }
  appendRow(row: unknown[]) { this.rows.push([...row]); return this; }
  setFrozenRows() { return this; }
  getRange(row: number, col: number, numRows = 1, numCols = 1) {
    const sheet = this;
    return {
      getValues() {
        return Array.from({ length: numRows }, (_, r) => Array.from({ length: numCols }, (_, c) => sheet.rows[row - 1 + r]?.[col - 1 + c] ?? ''));
      },
      setValues(values: unknown[][]) {
        values.forEach((vr, r) => vr.forEach((v, c) => {
          while (sheet.rows.length < row + r) sheet.rows.push([]);
          sheet.rows[row - 1 + r][col - 1 + c] = v;
        }));
        return this;
      },
      setValue(v: unknown) { return this.setValues([[v]]); },
      setNumberFormat() { return this; },
    };
  }
}

export function createGasSandbox(opts: { adminToken?: string; sheets?: Record<string, MockSheet> } = {}) {
  const sheets: Record<string, MockSheet> = { ...(opts.sheets ?? {}) };
  const lock = { waits: [] as number[], released: 0, waitLock(ms: number) { this.waits.push(ms); }, releaseLock() { this.released++; } };
  let clock = Date.parse('2026-11-14T10:00:00Z');
  const context: Record<string, unknown> = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (n: string) => sheets[n] ?? null,
        insertSheet: (n: string) => (sheets[n] = new MockSheet(n)),
      }),
    },
    LockService: { getScriptLock: () => lock },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => (k === 'ADMIN_TOKEN' ? opts.adminToken ?? null : null) }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (content: string) => ({ content, setMimeType() { return this; }, getContent() { return content; } }),
    },
    Date: class extends Date {
      constructor(...a: unknown[]) {
        if (a.length) super(...(a as [string]));
        else { super(clock); clock += 60_000; }
      }
    },
  };
  vm.createContext(context);
  vm.runInContext(readFileSync(join(__dirname, '../../src/gas/Code.gs'), 'utf8'), context, { filename: 'Code.gs' });
  const call = (fn: string, ...args: unknown[]) => (context[fn] as (...a: unknown[]) => unknown)(...args);
  const post = (payload: unknown) => JSON.parse((call('doPost', { postData: { contents: JSON.stringify(payload), type: 'text/plain' } }) as { getContent(): string }).getContent());
  /** fetch() implementation that routes into doPost, emulating the Apps Script web app. */
  const fetchImpl = async (_url: string | URL | Request, init?: RequestInit) => {
    const out = call('doPost', { postData: { contents: String(init?.body ?? ''), type: 'text/plain' } }) as { getContent(): string };
    return new Response(out.getContent(), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  return { sheets, lock, call, post, fetchImpl, context };
}
