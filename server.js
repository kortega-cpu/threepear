const express = require('express');
const path = require('path');
const {
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
  nextStake,
} = require('./db');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Suggested stake for the next entry (based on paroli progression)
app.get('/api/next-stake', (req, res) => {
  res.json({ nextStake: nextStake() });
});

// Create a new day's 3-leg pick. Saved as a draft by default (editable, doesn't
// touch the stake progression) until explicitly confirmed.
app.post('/api/entries', (req, res) => {
  const { date, stake, legs, notes, isDraft } = req.body;
  if (!date || !stake || !Array.isArray(legs) || legs.length !== 3) {
    return res
      .status(400)
      .json({ error: 'date, stake, and exactly 3 legs are required' });
  }
  try {
    const id = createEntry({
      date,
      stake,
      legs,
      notes,
      isDraft: isDraft !== false, // default true
    });
    res.json(getEntry(id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Edit a draft entry's date / stake / notes (confirmed entries are locked)
app.put('/api/entries/:id', (req, res) => {
  try {
    updateEntry(req.params.id, req.body);
    res.json(getEntry(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Edit a single leg on a draft entry
app.put('/api/legs/:id', (req, res) => {
  try {
    updateLegFull(req.params.id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Lock a draft in: stake becomes fixed and it now counts toward the streak
app.post('/api/entries/:id/confirm', (req, res) => {
  try {
    confirmEntry(req.params.id);
    res.json(getEntry(req.params.id));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Discard a draft (or delete a confirmed entry if you made a mistake)
app.delete('/api/entries/:id', (req, res) => {
  deleteEntry(req.params.id);
  res.json({ ok: true });
});

// List confirmed entries (most recent first) -- this is the "History" list
app.get('/api/entries', (req, res) => {
  res.json(getAllEntries());
});

// List drafts (oldest first, so tomorrow's draft appears before later placeholders)
app.get('/api/drafts', (req, res) => {
  res.json(getDrafts());
});

app.get('/api/entries/:id', (req, res) => {
  const entry = getEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: 'not found' });
  res.json(entry);
});

// Mark an individual leg as hit / missed
app.patch('/api/legs/:id', (req, res) => {
  const { hit } = req.body; // 'yes' | 'no'
  if (!['yes', 'no', 'pending'].includes(hit)) {
    return res.status(400).json({ error: 'hit must be yes, no, or pending' });
  }
  updateLegResult(req.params.id, hit);
  res.json({ ok: true });
});

// Finalize the whole day: win = all 3 legs hit, loss = any leg missed
app.post('/api/entries/:id/finalize', (req, res) => {
  const entry = getEntry(req.params.id);
  if (!entry) return res.status(404).json({ error: 'not found' });
  if (entry.is_draft) {
    return res.status(400).json({ error: 'confirm this entry before finalizing it' });
  }

  const allHit = entry.legs.every((l) => l.hit === 'yes');
  const anyMiss = entry.legs.some((l) => l.hit === 'no');

  if (!allHit && !anyMiss) {
    return res
      .status(400)
      .json({ error: 'mark all 3 legs yes/no before finalizing' });
  }

  const result = allHit ? 'win' : 'loss';
  // Rough 3-leg parlay payout estimate at -150/leg average (~2.5x); adjust as needed
  const payout = result === 'win' ? Math.round(entry.stake * 2.5 * 100) / 100 : 0;

  finalizeEntry(entry.id, { result, payout });
  res.json(getEntry(entry.id));
});

app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

const PORT = process.env.PORT || 3737;
app.listen(PORT, () => {
  console.log(`ThreePear running at http://localhost:${PORT}`);
});
