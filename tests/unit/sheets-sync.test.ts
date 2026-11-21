import { describe, it, expect, vi } from 'vitest';
import { createGasSandbox, MockSheet } from '../helpers/gas-sandbox';
import { normalizeVnPhone } from '../../src/shared/phone-normalizer';
import { SheetsClient, syncInvitationList, INVITATION_HEADERS } from '../../src/backend/sheets-sync';
import { WeddingDb } from '../../src/backend/db';
import { computeShortId, decodeGuestToken } from '../../src/shared/guest-codec';

const FIRST = { fullName: 'Nguyễn Văn An', phone: '+84 905 123 456', relationship: 'bạn bè chú rể', attendees: 2 };

describe('Code.gs doPost — RSVP upsert by unique phone', () => {
  it('normalizes the phone and INSERTS a new row (spec scenario 1)', () => {
    const gas = createGasSandbox();
    const r = gas.post(FIRST);
    expect(r).toMatchObject({ ok: true, operation: 'INSERTED', phone: '0905123456' });
    const sheet = gas.sheets.RSVP_Responses;
    expect(sheet.rows[0]).toEqual(['Phone_Unique', 'Full_Name', 'Relationship', 'Attendees_Count', 'Created_At', 'Updated_At']);
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[1].slice(0, 4)).toEqual(["'0905123456", 'Nguyễn Văn An', 'bạn bè chú rể', 2]);
    expect(sheet.rows[1][4]).toBe(sheet.rows[1][5]);
  });

  it('UPDATES the existing row in place for a repeated phone (spec scenario 2)', () => {
    const gas = createGasSandbox();
    gas.post({ ...FIRST, attendees: 1 });
    const created = gas.sheets.RSVP_Responses.rows[1][4];
    const r = gas.post({ fullName: 'Vợ chồng Nguyễn Văn An', phone: '0905-123-456', relationship: 'bạn bè chú rể', attendees: 2 });
    expect(r).toMatchObject({ ok: true, operation: 'UPDATED', phone: '0905123456' });
    const rows = gas.sheets.RSVP_Responses.rows;
    expect(rows).toHaveLength(2);
    expect(rows[1].slice(0, 5)).toEqual(["'0905123456", 'Vợ chồng Nguyễn Văn An', 'bạn bè chú rể', 2, created]);
    expect(rows[1][5]).not.toBe(created);
  });

  it('matches phones stored with or without the leading apostrophe', () => {
    const sheet = new MockSheet('RSVP_Responses', ['Phone_Unique', 'Full_Name', 'Relationship', 'Attendees_Count', 'Created_At', 'Updated_At']);
    sheet.appendRow(['0905123456', 'Cũ', 'khác...', 1, 'x', 'x']);
    const gas = createGasSandbox({ sheets: { RSVP_Responses: sheet } });
    expect(gas.post(FIRST).operation).toBe('UPDATED');
    expect(sheet.rows).toHaveLength(2);
  });

  it('accepts relationship enum keys and stores the Vietnamese label', () => {
    const gas = createGasSandbox();
    gas.post({ ...FIRST, relationship: 'bride_family' });
    expect(gas.sheets.RSVP_Responses.rows[1][2]).toBe('gia đình cô dâu');
  });

  it('acquires the script lock for 10s and always releases it', () => {
    const gas = createGasSandbox();
    gas.post(FIRST);
    gas.post({ ...FIRST, phone: 'bad' });
    expect(gas.lock.waits).toEqual([10000, 10000]);
    expect(gas.lock.released).toBe(2);
  });

  it.each([
    [{ ...FIRST, phone: '12345' }, /phone/i],
    [{ ...FIRST, fullName: '  ' }, /name/i],
    [{ ...FIRST, relationship: 'hàng xóm' }, /relationship/i],
    [{ ...FIRST, attendees: 0 }, /attendees/i],
    [{ ...FIRST, attendees: 2.5 }, /attendees/i],
  ])('rejects invalid submission %#', (payload, msg) => {
    const gas = createGasSandbox();
    const r = gas.post(payload);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(msg);
    expect(gas.sheets.RSVP_Responses?.rows.length ?? 1).toBe(1);
  });

  it('neutralizes spreadsheet formula injection in names', () => {
    const gas = createGasSandbox();
    gas.post({ ...FIRST, fullName: '=HYPERLINK("http://x")' });
    expect(gas.sheets.RSVP_Responses.rows[1][1]).toBe('\'=HYPERLINK("http://x")');
  });

  it('returns an error for malformed JSON bodies', () => {
    const gas = createGasSandbox();
    const out = JSON.parse((gas.call('doPost', { postData: { contents: '{oops' } }) as any).getContent());
    expect(out.ok).toBe(false);
  });

  it('normalizePhone_ in Code.gs matches the shared TypeScript normalizer', () => {
    const gas = createGasSandbox();
    for (const p of ['+84 905 123 456', '0905-123-456', '84905123456', '(090) 5123456', '8490512345', ' 0912.345.678 ', '+84-28-3822-1234']) {
      expect(gas.call('normalizePhone_', p)).toBe(normalizeVnPhone(p));
    }
  });
});

function invitationSheet(rows: unknown[][]) {
  const s = new MockSheet('Invitation_List', [...INVITATION_HEADERS]);
  rows.forEach((r) => s.appendRow(r));
  return s;
}

describe('Code.gs admin actions', () => {
  const sheet = () => invitationSheet([
    ['1', 'chú thím', 'vợ chồng chú Chín', 'gia đình cô dâu', 2, '0905 123 456', 'chin@example.com', '', '', 'PENDING'],
    ['2', 'anh', 'anh Tuấn', 'bạn bè chú rể', 1, '', '', '', '', ''],
  ]);

  it('refuses SYNC_INVITATION_LIST without the ADMIN_TOKEN script property match', () => {
    const gas = createGasSandbox({ adminToken: 'secret', sheets: { Invitation_List: sheet() } });
    expect(gas.post({ action: 'SYNC_INVITATION_LIST' })).toMatchObject({ ok: false });
    expect(gas.post({ action: 'SYNC_INVITATION_LIST', adminToken: 'wrong' })).toMatchObject({ ok: false });
    expect(createGasSandbox({ sheets: { Invitation_List: sheet() } }).post({ action: 'SYNC_INVITATION_LIST', adminToken: '' })).toMatchObject({ ok: false });
  });

  it('returns Invitation_List rows to the admin', () => {
    const gas = createGasSandbox({ adminToken: 'secret', sheets: { Invitation_List: sheet() } });
    const r = gas.post({ action: 'SYNC_INVITATION_LIST', adminToken: 'secret' });
    expect(r.ok).toBe(true);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ rowId: '1', salutation: 'chú thím', guestName: 'vợ chồng chú Chín', relationship: 'gia đình cô dâu', count: 2, phone: '0905 123 456', email: 'chin@example.com' });
  });

  it('writes Short_ID, Invite_URL and Card_JPG_Status back by Row_ID', () => {
    const s = sheet();
    const gas = createGasSandbox({ adminToken: 'secret', sheets: { Invitation_List: s } });
    const r = gas.post({ action: 'UPDATE_INVITATION_LINKS', adminToken: 'secret', rows: [{ rowId: '2', shortId: 'abc123', inviteUrl: 'https://x/invite.html?id=abc123', status: 'GENERATED' }, { rowId: '99', shortId: 'zzz' }] });
    expect(r).toMatchObject({ ok: true, updated: 1, missing: ['99'] });
    expect(s.rows[2].slice(7, 10)).toEqual(['abc123', 'https://x/invite.html?id=abc123', 'GENERATED']);
  });
});

describe('sheets-sync.ts', () => {
  it('SheetsClient posts text/plain JSON (CORS-safe) with the admin token', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, rows: [] })));
    const client = new SheetsClient({ webhookUrl: 'https://script.google.com/macros/s/X/exec', adminToken: 't0k', fetchImpl });
    await client.fetchInvitationList();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://script.google.com/macros/s/X/exec');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/plain;charset=utf-8');
    expect(JSON.parse(String(init.body))).toEqual({ action: 'SYNC_INVITATION_LIST', adminToken: 't0k' });
  });

  it('surfaces Apps Script errors', async () => {
    const client = new SheetsClient({ webhookUrl: 'u', adminToken: 'x', fetchImpl: async () => new Response(JSON.stringify({ ok: false, error: 'Unauthorized' })) });
    await expect(client.fetchInvitationList()).rejects.toThrow(/Unauthorized/);
  });

  it('synchronizes the roster into SQLite with deterministic short IDs and tokens', async () => {
    const gas = createGasSandbox({
      adminToken: 'secret',
      sheets: {
        Invitation_List: invitationSheet([
          ['1', 'chú thím', 'vợ chồng chú Chín', 'gia đình cô dâu', 2, '0905 123 456', 'chin@example.com', '', '', ''],
          ['2', 'anh', 'anh Tuấn', 'bạn bè chú rể', '1', '', '', '', '', ''],
          ['3', 'bác', 'hai bác Tư', 'hàng xóm', 2, '', '', '', '', ''],
          ['', '', '', '', '', '', '', '', '', ''],
        ]),
      },
    });
    const db = new WeddingDb(':memory:');
    const client = new SheetsClient({ webhookUrl: 'https://gas', adminToken: 'secret', fetchImpl: gas.fetchImpl });
    const result = await syncInvitationList(db, client);
    expect(result.guests.map((g) => g.rowId)).toEqual(['1', '2']);
    expect(result.skipped).toEqual([{ rowId: '3', reason: expect.stringMatching(/relationship/i) }]);
    const [chin, tuan] = db.listGuests();
    expect(chin.shortId).toBe(await computeShortId({ salutation: 'chú thím', name: 'vợ chồng chú Chín', relationship: 'bride_family', count: 2, phone: '0905123456' }));
    expect(chin.phone).toBe('0905123456');
    expect(decodeGuestToken(chin.token)).toEqual({ salutation: 'chú thím', name: 'vợ chồng chú Chín', relationship: 'bride_family', count: 2 });
    expect(tuan.count).toBe(1);
    expect(tuan.shortId).toMatch(/^[0-9a-f]{6}$/);
  });

  it('round-trips an RSVP through the client into Code.gs', async () => {
    const gas = createGasSandbox();
    const client = new SheetsClient({ webhookUrl: 'https://gas', fetchImpl: gas.fetchImpl });
    expect((await client.submitRsvp(FIRST)).operation).toBe('INSERTED');
    expect((await client.submitRsvp({ ...FIRST, phone: '0905123456', attendees: 3 })).operation).toBe('UPDATED');
  });
});
