import * as Crypto from 'expo-crypto';
import { getDb } from './database';
import { MAX_SYNC_ATTEMPTS } from '../config';

// All reads and writes to the phone's database go through this file.
// Every write also queues an "outbox" entry that the sync engine sends later.

const now = () => new Date().toISOString();
const n = (v) => (v === undefined || v === '' ? null : v);
export const newId = () => Crypto.randomUUID();

// ── meta (small key/value settings) ─────────────────────────
export async function getMeta(key) {
  const db = await getDb();
  const row = await db.getFirstAsync('SELECT value FROM meta WHERE key = ?', key);
  return row ? row.value : null;
}

export async function setMeta(key, value) {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value == null ? null : String(value)
  );
}

async function enqueue(db, entity, op, entityId, payload) {
  await db.runAsync(
    'INSERT INTO outbox (id, entity, op, entity_id, payload, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    newId(), entity, op, String(entityId), JSON.stringify(payload), now()
  );
}

async function enqueueVoterState(db, voterId) {
  const v = await db.getFirstAsync('SELECT id, mobile_number, household_id FROM voters WHERE id = ?', voterId);
  if (!v) return;
  await enqueue(db, 'voter_mobile', 'upsert', v.id, {
    voter_id: v.id,
    mobile_number: v.mobile_number,
    household_id: v.household_id,
  });
}

// ── dashboard ────────────────────────────────────────────────
export async function getDashboardStats() {
  const db = await getDb();
  const v = await db.getFirstAsync(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN household_id IS NOT NULL THEN 1 ELSE 0 END) AS mapped,
      SUM(CASE WHEN mobile_number IS NOT NULL AND mobile_number <> '' THEN 1 ELSE 0 END) AS with_phone,
      SUM(CASE WHEN survey_count > 0 THEN 1 ELSE 0 END) AS surveyed,
      SUM(is_voted) AS voted
    FROM voters`);
  const h = await db.getFirstAsync('SELECT COUNT(*) AS c FROM households');
  const u = await db.getFirstAsync('SELECT COUNT(*) AS c FROM notifications WHERE is_read = 0');
  return {
    total: v.total || 0,
    mapped: v.mapped || 0,
    withPhone: v.with_phone || 0,
    surveyed: v.surveyed || 0,
    voted: v.voted || 0,
    families: h.c || 0,
    unread: u.c || 0,
  };
}

// ── voters ───────────────────────────────────────────────────
export const VOTER_FILTERS = {
  all: null,
  no_family: 'v.household_id IS NULL',
  no_phone: "(v.mobile_number IS NULL OR v.mobile_number = '')",
  not_surveyed: 'v.survey_count = 0',
  not_voted: 'v.is_voted = 0',
  voted: 'v.is_voted = 1',
};

export async function listVoters({ search = '', filter = 'all', limit = 300 } = {}) {
  const db = await getDb();
  const where = [];
  const params = [];
  const s = search.trim();
  if (s) {
    if (/^\d+$/.test(s)) {
      where.push('(v.serial_no = ? OR v.house_no LIKE ? OR v.mobile_number LIKE ?)');
      params.push(Number(s), `${s}%`, `%${s}%`);
    } else {
      const like = `%${s}%`;
      where.push('(v.name LIKE ? OR v.epic_no LIKE ? OR v.relation_name LIKE ? OR v.house_no LIKE ?)');
      params.push(like, like, like, `${s}%`);
    }
  }
  if (VOTER_FILTERS[filter]) where.push(VOTER_FILTERS[filter]);
  params.push(limit);
  return db.getAllAsync(
    `SELECT v.*, h.family_code FROM voters v
     LEFT JOIN households h ON h.id = v.household_id
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY v.serial_no LIMIT ?`,
    params
  );
}

export async function getVoter(id) {
  const db = await getDb();
  return db.getFirstAsync(
    `SELECT v.*, h.family_code FROM voters v
     LEFT JOIN households h ON h.id = v.household_id WHERE v.id = ?`,
    id
  );
}

export async function updateVoterPhone(voterId, mobileNumber) {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('UPDATE voters SET mobile_number = ? WHERE id = ?', n(mobileNumber), voterId);
    await enqueueVoterState(txn, voterId);
  });
}

// ── households / Family IDs ──────────────────────────────────
export async function listHouseholds(search = '') {
  const db = await getDb();
  const s = search.trim();
  const like = `%${s}%`;
  return db.getAllAsync(
    `SELECT h.*, hv.name AS head_name,
       (SELECT COUNT(*) FROM voters m WHERE m.household_id = h.id) AS member_count
     FROM households h
     LEFT JOIN voters hv ON hv.id = h.head_voter_id
     WHERE (? = '' OR h.family_code LIKE ? OR h.house_no LIKE ? OR hv.name LIKE ?)
     ORDER BY h.family_code`,
    s, like, like, like
  );
}

export async function getHousehold(id) {
  const db = await getDb();
  const household = await db.getFirstAsync('SELECT * FROM households WHERE id = ?', id);
  if (!household) return null;
  const members = await db.getAllAsync(
    'SELECT * FROM voters WHERE household_id = ? ORDER BY age DESC, serial_no',
    id
  );
  return { ...household, members };
}

// Voters not yet in a family. Voters whose house number matches come first.
export async function listCandidateMembers({ houseNo = '', search = '', householdId = null }) {
  const db = await getDb();
  const s = search.trim();
  const like = `%${s}%`;
  return db.getAllAsync(
    `SELECT v.*, h.family_code FROM voters v
     LEFT JOIN households h ON h.id = v.household_id
     WHERE (v.household_id IS NULL OR v.household_id = ?)
       AND (? = '' OR v.name LIKE ? OR v.epic_no LIKE ? OR v.house_no LIKE ? OR CAST(v.serial_no AS TEXT) = ?)
     ORDER BY CASE WHEN ? <> '' AND v.house_no = ? THEN 0 ELSE 1 END, v.house_no, v.serial_no
     LIMIT 200`,
    householdId, s, like, like, like, s, houseNo.trim(), houseNo.trim()
  );
}

async function nextFamilyCode(db, boothNo) {
  // One operator per booth, so "F-<booth>-<number>" stays unique without internet.
  // The highest number ever used is remembered, so a removed family's ID is never reused.
  const prefix = `F-${boothNo}-`;
  const rows = await db.getAllAsync('SELECT family_code FROM households WHERE family_code LIKE ?', `${prefix}%`);
  const saved = await db.getFirstAsync("SELECT value FROM meta WHERE key = 'family_seq'");
  let max = saved ? parseInt(saved.value, 10) || 0 : 0;
  for (const r of rows) {
    const num = parseInt(r.family_code.slice(prefix.length), 10);
    if (!Number.isNaN(num) && num > max) max = num;
  }
  const next = max + 1;
  await db.runAsync(
    "INSERT INTO meta (key, value) VALUES ('family_seq', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    String(next)
  );
  return prefix + String(next).padStart(3, '0');
}

export async function saveHousehold({ id, boothNo, houseNo, address, headVoterId, memberIds }) {
  const db = await getDb();
  let householdId = id;
  await db.withExclusiveTransactionAsync(async (txn) => {
    if (householdId) {
      await txn.runAsync(
        'UPDATE households SET house_no = ?, address = ?, head_voter_id = ?, updated_at = ? WHERE id = ?',
        n(houseNo), n(address), n(headVoterId), now(), householdId
      );
    } else {
      householdId = newId();
      const code = await nextFamilyCode(txn, boothNo);
      await txn.runAsync(
        'INSERT INTO households (id, family_code, house_no, address, head_voter_id, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        householdId, code, n(houseNo), n(address), n(headVoterId), now()
      );
    }
    const h = await txn.getFirstAsync('SELECT * FROM households WHERE id = ?', householdId);
    // Household must reach the server before the voters that point to it.
    await enqueue(txn, 'household', 'upsert', householdId, {
      id: h.id,
      family_code: h.family_code,
      house_no: h.house_no,
      address: h.address,
      head_voter_id: h.head_voter_id,
    });

    const current = await txn.getAllAsync('SELECT id FROM voters WHERE household_id = ?', householdId);
    const currentIds = new Set(current.map((r) => r.id));
    const nextIds = new Set(memberIds.map(String));
    for (const vid of currentIds) {
      if (!nextIds.has(vid)) {
        await txn.runAsync('UPDATE voters SET household_id = NULL WHERE id = ?', vid);
        await enqueueVoterState(txn, vid);
      }
    }
    for (const vid of nextIds) {
      if (!currentIds.has(vid)) {
        await txn.runAsync('UPDATE voters SET household_id = ? WHERE id = ?', householdId, vid);
        await enqueueVoterState(txn, vid);
      }
    }
  });
  return householdId;
}

export async function deleteHousehold(id) {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const members = await txn.getAllAsync('SELECT id FROM voters WHERE household_id = ?', id);
    for (const m of members) {
      await txn.runAsync('UPDATE voters SET household_id = NULL WHERE id = ?', m.id);
      await enqueueVoterState(txn, m.id);
    }
    await txn.runAsync('DELETE FROM households WHERE id = ?', id);
    await enqueue(txn, 'household', 'delete', id, { id });
  });
}

// ── surveys ──────────────────────────────────────────────────
const parseSurvey = (s) => (s ? { ...s, questions: JSON.parse(s.questions) } : null);

export async function listSurveys() {
  const db = await getDb();
  const rows = await db.getAllAsync('SELECT * FROM surveys ORDER BY title');
  return rows.map(parseSurvey);
}

export async function getSurvey(id) {
  const db = await getDb();
  return parseSurvey(await db.getFirstAsync('SELECT * FROM surveys WHERE id = ?', id));
}

export async function listResponsesForVoter(voterId) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT r.id, r.collected_at, r.synced, s.title FROM survey_responses r
     LEFT JOIN surveys s ON s.id = r.survey_id
     WHERE r.voter_id = ? ORDER BY r.collected_at DESC`,
    voterId
  );
}

export async function saveSurveyResponse({ surveyId, voterId, householdId, answers }) {
  const db = await getDb();
  const id = newId();
  const collectedAt = now();
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'INSERT INTO survey_responses (id, survey_id, voter_id, household_id, answers, collected_at) VALUES (?, ?, ?, ?, ?, ?)',
      id, String(surveyId), n(voterId), n(householdId), JSON.stringify(answers), collectedAt
    );
    if (voterId) await txn.runAsync('UPDATE voters SET survey_count = survey_count + 1 WHERE id = ?', voterId);
    await enqueue(txn, 'survey_response', 'create', id, {
      id,
      survey_id: surveyId,
      voter_id: n(voterId),
      household_id: n(householdId),
      answers,
      collected_at: collectedAt,
    });
  });
  return id;
}

// ── poll-day turnout ─────────────────────────────────────────
// party is the operator's own guess of which party the voter supports —
// ballots are secret, so this is never a confirmed vote.
export async function setVoted(voterId, voted, party = null) {
  const db = await getDb();
  const votedAt = voted ? now() : null;
  const votedParty = voted ? n(party) : null;
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      'UPDATE voters SET is_voted = ?, voted_at = ?, voted_party = ? WHERE id = ?',
      voted ? 1 : 0, votedAt, votedParty, voterId
    );
    await enqueue(txn, 'turnout', voted ? 'mark' : 'unmark', voterId, { voter_id: voterId, voted_at: votedAt, party: votedParty });
  });
}

// Change the guessed party for a voter already marked as voted, without touching voted_at.
export async function setVotedParty(voterId, party) {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const v = await txn.getFirstAsync('SELECT voted_at FROM voters WHERE id = ?', voterId);
    if (!v || !v.voted_at) return;
    await txn.runAsync('UPDATE voters SET voted_party = ? WHERE id = ?', n(party), voterId);
    await enqueue(txn, 'turnout', 'mark', voterId, { voter_id: voterId, voted_at: v.voted_at, party: n(party) });
  });
}

// Counts by the operator's guessed party, for voters marked as voted.
export async function getPartyCounts() {
  const db = await getDb();
  const rows = await db.getAllAsync(
    `SELECT voted_party AS party, COUNT(*) AS c FROM voters WHERE is_voted = 1 AND voted_party IS NOT NULL GROUP BY voted_party`
  );
  const out = {};
  for (const r of rows) out[r.party] = r.c;
  return out;
}

// ── notifications ────────────────────────────────────────────
export async function listNotifications() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM notifications ORDER BY created_at DESC LIMIT 200');
}

export async function markAllNotificationsRead() {
  const db = await getDb();
  await db.runAsync('UPDATE notifications SET is_read = 1 WHERE is_read = 0');
}

// ── outbox (used by the sync engine) ─────────────────────────
export async function getOutboxSummary() {
  const db = await getDb();
  const r = await db.getFirstAsync(
    'SELECT COUNT(*) AS total, SUM(CASE WHEN attempts >= ? THEN 1 ELSE 0 END) AS failed FROM outbox',
    MAX_SYNC_ATTEMPTS
  );
  return { pending: r.total || 0, failed: r.failed || 0 };
}

export async function takeOutboxBatch(limit, excludeIds) {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT * FROM outbox
     WHERE attempts < ? AND id NOT IN (SELECT value FROM json_each(?))
     ORDER BY created_at, rowid LIMIT ?`,
    MAX_SYNC_ATTEMPTS, JSON.stringify(excludeIds), limit
  );
}

export async function completeOutbox(appliedIds) {
  if (!appliedIds.length) return;
  const db = await getDb();
  const ids = JSON.stringify(appliedIds);
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync(
      `UPDATE survey_responses SET synced = 1 WHERE id IN (
         SELECT entity_id FROM outbox WHERE entity = 'survey_response' AND id IN (SELECT value FROM json_each(?)))`,
      ids
    );
    await txn.runAsync('DELETE FROM outbox WHERE id IN (SELECT value FROM json_each(?))', ids);
  });
}

export async function failOutbox(failed) {
  if (!failed.length) return;
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const f of failed) {
      await txn.runAsync(
        'UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?',
        String(f.error || 'Rejected by server'), f.id
      );
    }
  });
}

export async function listFailedOutbox() {
  const db = await getDb();
  return db.getAllAsync('SELECT * FROM outbox WHERE attempts >= ? ORDER BY created_at', MAX_SYNC_ATTEMPTS);
}

export async function discardFailedOutbox() {
  const db = await getDb();
  await db.runAsync('DELETE FROM outbox WHERE attempts >= ?', MAX_SYNC_ATTEMPTS);
}

// ── apply data downloaded from the server ────────────────────
// Server data wins, EXCEPT for records that still have unsent changes on
// this phone — those keep the phone's version until they are sent.
export async function applyPull(data) {
  const db = await getDb();
  await db.withExclusiveTransactionAsync(async (txn) => {
    const pending = await txn.getAllAsync('SELECT DISTINCT entity, entity_id FROM outbox');
    const pendingMobile = new Set();
    const pendingTurnout = new Set();
    const pendingHouse = new Set();
    for (const p of pending) {
      if (p.entity === 'voter_mobile') pendingMobile.add(p.entity_id);
      else if (p.entity === 'turnout') pendingTurnout.add(p.entity_id);
      else if (p.entity === 'household') pendingHouse.add(p.entity_id);
    }

    // Voters: full list for the booth
    const upsertMaster = await txn.prepareAsync(`
      INSERT INTO voters (id, serial_no, epic_no, name, relation_type, relation_name, gender, age, house_no, section,
                          mobile_number, household_id, is_voted, voted_at, voted_party, survey_count)
      VALUES ($id, $serial_no, $epic_no, $name, $relation_type, $relation_name, $gender, $age, $house_no, $section,
              $mobile_number, $household_id, $is_voted, $voted_at, $voted_party, $survey_count)
      ON CONFLICT(id) DO UPDATE SET
        serial_no = excluded.serial_no, epic_no = excluded.epic_no, name = excluded.name,
        relation_type = excluded.relation_type, relation_name = excluded.relation_name,
        gender = excluded.gender, age = excluded.age, house_no = excluded.house_no,
        section = excluded.section, survey_count = excluded.survey_count`);
    const setMobile = await txn.prepareAsync('UPDATE voters SET mobile_number = ?, household_id = ? WHERE id = ?');
    const setTurnout = await txn.prepareAsync('UPDATE voters SET is_voted = ?, voted_at = ?, voted_party = ? WHERE id = ?');
    const serverVoterIds = [];
    try {
      for (const v of data.voters || []) {
        const id = String(v.id);
        serverVoterIds.push(id);
        await upsertMaster.executeAsync({
          $id: id,
          $serial_no: n(v.serial_no),
          $epic_no: n(v.epic_no),
          $name: v.name || '',
          $relation_type: n(v.relation_type),
          $relation_name: n(v.relation_name),
          $gender: n(v.gender),
          $age: n(v.age),
          $house_no: n(v.house_no),
          $section: n(v.section),
          $mobile_number: n(v.mobile_number),
          $household_id: n(v.household_id),
          $is_voted: v.is_voted ? 1 : 0,
          $voted_at: n(v.voted_at),
          $voted_party: n(v.voted_party),
          $survey_count: v.survey_count || 0,
        });
        if (!pendingMobile.has(id)) await setMobile.executeAsync(n(v.mobile_number), n(v.household_id), id);
        if (!pendingTurnout.has(id)) await setTurnout.executeAsync(v.is_voted ? 1 : 0, n(v.voted_at), n(v.voted_party), id);
      }
    } finally {
      await upsertMaster.finalizeAsync();
      await setMobile.finalizeAsync();
      await setTurnout.finalizeAsync();
    }
    if (data.voters) {
      // Remove voters no longer in this booth
      await txn.runAsync('DELETE FROM voters WHERE id NOT IN (SELECT value FROM json_each(?))', JSON.stringify(serverVoterIds));
      // Add back surveys collected on this phone that the server hasn't counted yet
      await txn.runAsync(`UPDATE voters SET survey_count = survey_count +
        (SELECT COUNT(*) FROM survey_responses r WHERE r.voter_id = voters.id AND r.synced = 0)`);
    }

    // Households: full list for the booth
    if (data.households) {
      const serverIds = [];
      for (const h of data.households) {
        const id = String(h.id);
        serverIds.push(id);
        if (pendingHouse.has(id)) continue;
        await txn.runAsync(
          `INSERT INTO households (id, family_code, house_no, address, head_voter_id, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET family_code = excluded.family_code, house_no = excluded.house_no,
             address = excluded.address, head_voter_id = excluded.head_voter_id, updated_at = excluded.updated_at`,
          id, h.family_code, n(h.house_no), n(h.address), n(h.head_voter_id != null ? String(h.head_voter_id) : null), n(h.updated_at)
        );
      }
      const keep = JSON.stringify([...serverIds, ...pendingHouse]);
      await txn.runAsync('DELETE FROM households WHERE id NOT IN (SELECT value FROM json_each(?))', keep);
    }

    // Surveys: replace with the active list
    if (data.surveys) {
      await txn.runAsync('DELETE FROM surveys');
      for (const s of data.surveys) {
        await txn.runAsync(
          'INSERT INTO surveys (id, title, description, questions) VALUES (?, ?, ?, ?)',
          String(s.id), s.title, n(s.description), JSON.stringify(s.questions || [])
        );
      }
    }

    // Notifications: only new ones arrive
    for (const nt of data.notifications || []) {
      await txn.runAsync(
        'INSERT OR IGNORE INTO notifications (id, title, body, created_at) VALUES (?, ?, ?, ?)',
        String(nt.id), nt.title, n(nt.body), nt.created_at
      );
    }
  });

  const latest = (data.notifications || []).reduce((m, x) => (x.created_at > m ? x.created_at : m), '');
  if (latest) await setMeta('notifications_since', latest);
  await setMeta('last_sync_at', now());
}

export async function clearAllData() {
  const db = await getDb();
  await db.execAsync(`
    DELETE FROM voters; DELETE FROM households; DELETE FROM surveys;
    DELETE FROM survey_responses; DELETE FROM notifications; DELETE FROM outbox; DELETE FROM meta;
  `);
}
