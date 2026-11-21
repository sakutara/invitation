/**
 * Google Apps Script Web App bound to the wedding Google Spreadsheet.
 * See okf/google_sheets_and_bulk_playbook.md.
 *
 * Deploy: Extensions > Apps Script > paste this file > Project Settings > Script Properties:
 *   ADMIN_TOKEN = <long random string, also set as SHEETS_ADMIN_TOKEN in the local CMS>
 * Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone.
 *
 * Public action (no token):  RSVP upsert  { fullName, phone, relationship, attendees }
 * Admin actions (token):     SYNC_INVITATION_LIST, UPDATE_INVITATION_LINKS
 */

var SHEET_RSVP = 'RSVP_Responses';
var SHEET_INVITES = 'Invitation_List';
var RSVP_HEADERS = ['Phone_Unique', 'Full_Name', 'Relationship', 'Attendees_Count', 'Created_At', 'Updated_At'];
var INVITE_HEADERS = ['Row_ID', 'Salutation', 'Guest_Name', 'Relationship', 'Count', 'Phone', 'Email', 'Short_ID', 'Invite_URL', 'Card_JPG_Status'];
var RELATIONSHIPS = {
  groom_family: 'gia đình chú rể',
  bride_family: 'gia đình cô dâu',
  groom_friends: 'bạn bè chú rể',
  bride_friends: 'bạn bè cô dâu',
  groom_parents_friends: 'bạn bè gia đình chú rể',
  bride_parents_friends: 'bạn bè gia đình cô dâu',
  other: 'khác...'
};
var VN_PHONE_REGEX = /^0[235789][0-9]{8}$/;

/** Mirror of src/shared/phone-normalizer.ts (okf/invitation_and_seating_rules.md §2). */
function normalizePhone_(input) {
  if (input === null || input === undefined) return '';
  var p = String(input).trim().replace(/[\s\-.()]/g, '');
  if (p.indexOf('+84') === 0) p = '0' + p.slice(3);
  else if (p.indexOf('84') === 0 && p.length === 11) p = '0' + p.slice(2);
  return p;
}

function stripApostrophe_(v) {
  return String(v === null || v === undefined ? '' : v).replace(/^'/, '');
}

/** Prevent user input from being interpreted as a spreadsheet formula. */
function safeCell_(s) {
  var v = String(s);
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function resolveRelationshipLabel_(input) {
  var v = String(input || '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
  if (RELATIONSHIPS[v]) return RELATIONSHIPS[v];
  for (var k in RELATIONSHIPS) {
    var label = RELATIONSHIPS[k];
    if (v === label || v === label.replace(/\.+$/, '')) return label;
  }
  return null;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateSheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function upsertRsvp_(payload) {
  var fullName = String(payload.fullName || '').trim().replace(/\s+/g, ' ');
  if (!fullName || fullName.length > 120) throw new Error('Invalid fullName');
  var phone = normalizePhone_(payload.phone);
  if (!VN_PHONE_REGEX.test(phone)) throw new Error('Invalid phone number');
  var relationship = resolveRelationshipLabel_(payload.relationship);
  if (!relationship) throw new Error('Invalid relationship');
  var attendees = Number(payload.attendees);
  if (!(attendees >= 1 && attendees <= 20 && Math.floor(attendees) === attendees)) throw new Error('Invalid attendees (1..20)');

  var sheet = getOrCreateSheet_(SHEET_RSVP, RSVP_HEADERS);
  var now = new Date().toISOString();
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    var phones = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < phones.length; i++) {
      if (stripApostrophe_(phones[i][0]) === phone) {
        var row = i + 2;
        sheet.getRange(row, 2, 1, 3).setValues([[safeCell_(fullName), relationship, attendees]]);
        sheet.getRange(row, 6).setValue(now);
        return { operation: 'UPDATED', phone: phone, row: row };
      }
    }
  }
  sheet.getRange(lastRow + 1, 1).setNumberFormat('@');
  sheet.appendRow(["'" + phone, safeCell_(fullName), relationship, attendees, now, now]);
  return { operation: 'INSERTED', phone: phone, row: lastRow + 1 };
}

function requireAdmin_(payload) {
  var expected = PropertiesService.getScriptProperties().getProperty('ADMIN_TOKEN');
  if (!expected || !payload.adminToken || String(payload.adminToken) !== expected) throw new Error('Unauthorized');
}

function listInvitations_() {
  var sheet = getOrCreateSheet_(SHEET_INVITES, INVITE_HEADERS);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(2, 1, last - 1, INVITE_HEADERS.length).getValues();
  var rows = [];
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (!String(v[0]).trim() && !String(v[2]).trim()) continue;
    rows.push({
      rowId: String(v[0]).trim(),
      salutation: String(v[1]).trim(),
      guestName: String(v[2]).trim(),
      relationship: String(v[3]).trim(),
      count: Number(v[4]),
      phone: stripApostrophe_(v[5]).trim(),
      email: String(v[6]).trim(),
      shortId: String(v[7]).trim(),
      inviteUrl: String(v[8]).trim(),
      status: String(v[9]).trim() || 'PENDING'
    });
  }
  return rows;
}

function updateInvitationLinks_(rows) {
  var sheet = getOrCreateSheet_(SHEET_INVITES, INVITE_HEADERS);
  var last = sheet.getLastRow();
  var ids = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues() : [];
  var index = {};
  for (var i = 0; i < ids.length; i++) index[String(ids[i][0]).trim()] = i + 2;
  var updated = 0;
  var missing = [];
  for (var j = 0; j < (rows || []).length; j++) {
    var r = rows[j];
    var rowNum = index[String(r.rowId)];
    if (!rowNum) { missing.push(String(r.rowId)); continue; }
    sheet.getRange(rowNum, 8, 1, 3).setValues([[r.shortId || '', r.inviteUrl || '', r.status || 'GENERATED']]);
    updated++;
  }
  return { updated: updated, missing: missing };
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var locked = false;
  try {
    lock.waitLock(10000);
    locked = true;
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var action = payload.action || 'RSVP_UPSERT';
    var result;
    if (action === 'RSVP_UPSERT') {
      result = upsertRsvp_(payload);
    } else if (action === 'SYNC_INVITATION_LIST') {
      requireAdmin_(payload);
      result = { rows: listInvitations_() };
    } else if (action === 'UPDATE_INVITATION_LINKS') {
      requireAdmin_(payload);
      result = updateInvitationLinks_(payload.rows);
    } else {
      throw new Error('Unknown action');
    }
    result.ok = true;
    return json_(result);
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    if (locked) lock.releaseLock();
  }
}

function doGet() {
  return json_({ ok: true, service: 'wedding-rsvp' });
}
