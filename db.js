const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const db = new DatabaseSync(path.join(__dirname, 'threepear.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON'); // needed so deleting an entry cascades to its legs

// node:sqlite's StatementSync doesn't have a .transaction() helper like
// better-sqlite3 did, so wrap BEGIN/COMMIT/ROLLBACK manually.
function transaction(fn) {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
}

db.exec(`
CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT UNIQUE NOT NULL,
  stake REAL NOT NULL,
  result TEXT NOT NULL DEFAULT 'pending', -- pending | win | loss
  is_draft INTEGER NOT NULL DEFAULT 1,    -- 1 = draft (editable, not yet locked in), 0 = confirmed
  payout REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS legs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  player TEXT NOT NULL,
  team TEXT,
  opponent TEXT,
  line TEXT DEFAULT 'Over 1.5 H+R+RBI',
  odds TEXT,
  reasoning TEXT,
  hit TEXT DEFAULT 'pending' -- pending | yes | no
);
`);

// --- Staking logic: paroli progression ---
// $10 base. Win -> next stake = last stake + $10 (10 -> 20 -> 30 -> ...), loss -> reset to $10.
// Drafts are ignored entirely -- only confirmed (is_draft = 0) entries count.
function nextStake() {
  const rows = db
    .prepare(
      `SELECT stake, result FROM entries WHERE is_draft = 0 ORDER BY date DESC LIMIT 1`
    )
    .all();
  if (rows.length === 0) return 10;
  const last = rows[0];
  if (last.result === 'win') return last.stake + 10;
  if (last.result === 'loss') return 10;
  return last.stake; // confirmed but still pending: same stake, hasn't resolved yet
}

function createEntry({ date, stake, legs, notes, isDraft = true }) {
  const insertEntry = db.prepare(
    `INSERT INTO entries (date, stake, notes, is_draft) VALUES (?, ?, ?, ?)`
  );
  const insertLeg = db.prepare(
    `INSERT INTO legs (entry_id, player, team, opponent, line, odds, reasoning)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const tx = transaction(() => {
    const info = insertEntry.run(date, stake, notes || null, isDraft ? 1 : 0);
    const entryId = info.lastInsertRowid;
    for (const leg of legs) {
      insertLeg.run(
        entryId,
        leg.player,
        leg.team || null,
        leg.opponent || null,
        leg.line || 'Over 1.5 H+R+RBI',
        leg.odds || null,
        leg.reasoning || null
      );
    }
    return entryId;
  });
  return tx();
}

function updateEntry(id, { date, stake, notes }) {
  const entry = db.prepare(`SELECT is_draft FROM entries WHERE id = ?`).get(id);
  if (!entry) throw new Error('entry not found');
  if (!entry.is_draft) throw new Error('cannot edit a confirmed entry');
  db.prepare(
    `UPDATE entries SET date = COALESCE(?, date), stake = COALESCE(?, stake), notes = ? WHERE id = ?`
  ).run(date || null, stake ?? null, notes ?? null, id);
}

function updateLegFull(legId, { player, team, opponent, line, odds, reasoning }) {
  const leg = db
    .prepare(
      `SELECT entries.is_draft FROM legs JOIN entries ON entries.id = legs.entry_id WHERE legs.id = ?`
    )
    .get(legId);
  if (!leg) throw new Error('leg not found');
  if (!leg.is_draft) throw new Error('cannot edit a leg on a confirmed entry');
  db.prepare(
    `UPDATE legs SET player = ?, team = ?, opponent = ?, line = ?, odds = ?, reasoning = ? WHERE id = ?`
  ).run(
    player,
    team || null,
    opponent || null,
    line || 'Over 1.5 H+R+RBI',
    odds || null,
    reasoning || null,
    legId
  );
}

function confirmEntry(id) {
  const entry = getEntry(id);
  if (!entry) throw new Error('entry not found');
  if (entry.legs.length !== 3 || entry.legs.some((l) => !l.player)) {
    throw new Error('all 3 legs need a player before confirming');
  }
  db.prepare(`UPDATE entries SET is_draft = 0 WHERE id = ?`).run(id);
}

function deleteEntry(id) {
  db.prepare(`DELETE FROM entries WHERE id = ?`).run(id); // legs cascade via FK
}

function getAllEntries() {
  const entries = db
    .prepare(`SELECT * FROM entries WHERE is_draft = 0 ORDER BY date DESC`)
    .all();
  const legStmt = db.prepare(`SELECT * FROM legs WHERE entry_id = ?`);
  return entries.map((e) => ({ ...e, legs: legStmt.all(e.id) }));
}

function getDrafts() {
  const entries = db
    .prepare(`SELECT * FROM entries WHERE is_draft = 1 ORDER BY date ASC`)
    .all();
  const legStmt = db.prepare(`SELECT * FROM legs WHERE entry_id = ?`);
  return entries.map((e) => ({ ...e, legs: legStmt.all(e.id) }));
}

function getEntry(id) {
  const entry = db.prepare(`SELECT * FROM entries WHERE id = ?`).get(id);
  if (!entry) return null;
  entry.legs = db.prepare(`SELECT * FROM legs WHERE entry_id = ?`).all(id);
  return entry;
}

function updateLegResult(legId, hit) {
  db.prepare(`UPDATE legs SET hit = ? WHERE id = ?`).run(hit, legId);
}

function finalizeEntry(entryId, { result, payout }) {
  db.prepare(`UPDATE entries SET result = ?, payout = ? WHERE id = ?`).run(
    result,
    payout ?? null,
    entryId
  );
}

function getStats() {
  const entries = db.prepare(`SELECT * FROM entries WHERE result != 'pending'`).all();
  const wins = entries.filter((e) => e.result === 'win').length;
  const losses = entries.filter((e) => e.result === 'loss').length;
  const wagered = entries.reduce((sum, e) => sum + e.stake, 0);
  const returned = entries.reduce((sum, e) => sum + (e.payout || 0), 0);
  return {
    totalDays: entries.length,
    wins,
    losses,
    winRate: entries.length ? (wins / entries.length) * 100 : 0,
    totalWagered: wagered,
    totalReturned: returned,
    netProfit: returned - wagered,
    nextStake: nextStake(),
  };
}

module.exports = {
  db,
  nextStake,
  createEntry,
  updateEntry,
  updateLegFull,
  confirmEntry,
  deleteEntry,
  getAllEntries,
  getDrafts,
  getEntry,
  updateLegResult,
  finalizeEntry,
  getStats,
};
