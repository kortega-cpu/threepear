const legsContainer = document.getElementById('legsContainer');
const entryForm = document.getElementById('entryForm');
const historyList = document.getElementById('historyList');
const draftsList = document.getElementById('draftsList');
const editingHint = document.getElementById('editingHint');
const saveDraftBtn = document.getElementById('saveDraftBtn');

let editingEntryId = null;
let editingLegIds = []; // leg ids in slot order [leg1, leg2, leg3], only set while editing

function buildLegBlocks(prefill = null) {
  legsContainer.innerHTML = '';
  for (let i = 1; i <= 3; i++) {
    const leg = prefill ? prefill[i - 1] : null;
    const block = document.createElement('div');
    block.className = 'leg-block';
    block.innerHTML = `
      <div class="leg-title">Leg ${i}</div>
      <div class="leg-grid">
        <input name="player${i}" placeholder="Player" value="${leg?.player ?? ''}" required />
        <input name="team${i}" placeholder="Team" value="${leg?.team ?? ''}" />
        <input name="opponent${i}" placeholder="Opponent" value="${leg?.opponent ?? ''}" />
        <input name="odds${i}" placeholder="Odds (e.g. -135)" value="${leg?.odds ?? ''}" />
      </div>
      <input name="reasoning${i}" placeholder="Why (matchup, streak, weather...)" value="${leg?.reasoning ?? ''}" />
    `;
    legsContainer.appendChild(block);
  }
}

async function loadStake() {
  const res = await fetch('/api/next-stake');
  const { nextStake } = await res.json();
  document.getElementById('nextStake').textContent = `$${nextStake}`;
  if (!editingEntryId) entryForm.stake.value = nextStake;
}

async function loadStats() {
  const res = await fetch('/api/stats');
  const s = await res.json();
  document.getElementById('statDays').textContent = s.totalDays;
  document.getElementById('statWinRate').textContent = s.totalDays
    ? `${s.winRate.toFixed(0)}%`
    : '--';
  const net = s.netProfit || 0;
  const netEl = document.getElementById('statNet');
  netEl.textContent = `${net >= 0 ? '+' : ''}$${net.toFixed(0)}`;
  netEl.style.color = net >= 0 ? 'var(--pear)' : 'var(--red)';
  document.getElementById('streakNote').textContent = s.totalDays
    ? `${s.wins}W - ${s.losses}L confirmed so far`
    : 'Confirm your first pick to start tracking';
}

async function loadHistory() {
  const res = await fetch('/api/entries');
  const entries = await res.json();
  if (entries.length === 0) {
    historyList.innerHTML =
      '<p class="empty">No confirmed picks yet — confirm a draft below to start the run.</p>';
    return;
  }
  historyList.innerHTML = '';
  for (const entry of entries) {
    historyList.appendChild(renderEntry(entry));
  }
}

async function loadDrafts() {
  const res = await fetch('/api/drafts');
  const drafts = await res.json();
  if (drafts.length === 0) {
    draftsList.innerHTML = '<p class="empty">No drafts yet.</p>';
    return;
  }
  draftsList.innerHTML = '';
  for (const entry of drafts) {
    draftsList.appendChild(renderDraft(entry));
  }
}

function renderEntry(entry) {
  const card = document.createElement('div');
  card.className = 'entry-card';

  const pillClass =
    entry.result === 'win'
      ? 'pill-win'
      : entry.result === 'loss'
      ? 'pill-loss'
      : 'pill-pending';

  card.innerHTML = `
    <div class="entry-head">
      <div class="entry-date">${entry.date} · $${entry.stake}</div>
      <div class="pill ${pillClass}">${entry.result}</div>
    </div>
    ${entry.legs
      .map(
        (leg) => `
      <div class="leg-row">
        <span>${leg.player}${leg.opponent ? ' vs ' + leg.opponent : ''} · ${leg.line}</span>
        <span class="leg-hit-${leg.hit}">${
          leg.hit === 'yes' ? '✓ hit' : leg.hit === 'no' ? '✗ miss' : 'pending'
        }</span>
      </div>`
      )
      .join('')}
    ${entry.notes ? `<div class="leg-row"><em>${entry.notes}</em></div>` : ''}
    ${
      entry.result === 'pending'
        ? `<div class="leg-actions" data-entry="${entry.id}"></div>
           <button class="finalize-btn" data-finalize="${entry.id}">Finalize day</button>`
        : ''
    }
  `;

  if (entry.result === 'pending') {
    const actionsEl = card.querySelector('.leg-actions');
    entry.legs.forEach((leg) => {
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.gap = '0.3rem';
      wrap.style.flex = '1';
      wrap.innerHTML = `
        <button data-leg="${leg.id}" data-hit="yes" class="${leg.hit === 'yes' ? 'active-yes' : ''}">${leg.player} ✓</button>
        <button data-leg="${leg.id}" data-hit="no" class="${leg.hit === 'no' ? 'active-no' : ''}">${leg.player} ✗</button>
      `;
      actionsEl.appendChild(wrap);
    });

    actionsEl.addEventListener('click', async (e) => {
      const btn = e.target.closest('button[data-leg]');
      if (!btn) return;
      await fetch(`/api/legs/${btn.dataset.leg}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hit: btn.dataset.hit }),
      });
      await loadHistory();
    });

    card.querySelector('[data-finalize]').addEventListener('click', async () => {
      const res = await fetch(`/api/entries/${entry.id}/finalize`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Could not finalize — mark all 3 legs first.');
        return;
      }
      await Promise.all([loadHistory(), loadStats(), loadStake()]);
    });
  }

  return card;
}

function renderDraft(entry) {
  const card = document.createElement('div');
  card.className = 'entry-card';

  card.innerHTML = `
    <div class="entry-head">
      <div class="entry-date">${entry.date} · $${entry.stake}</div>
      <div class="pill pill-draft">draft</div>
    </div>
    ${entry.legs
      .map(
        (leg) => `
      <div class="leg-row">
        <span>${leg.player || '(player TBD)'}${leg.opponent ? ' vs ' + leg.opponent : ''} · ${leg.line}</span>
        <span class="leg-hit-pending">${leg.odds || ''}</span>
      </div>`
      )
      .join('')}
    ${entry.notes ? `<div class="leg-row"><em>${entry.notes}</em></div>` : ''}
    <div class="draft-actions">
      <button class="btn-edit" data-edit="${entry.id}">Edit</button>
      <button class="btn-confirm" data-confirm="${entry.id}">Confirm & lock stake</button>
      <button class="btn-delete" data-delete="${entry.id}">Discard</button>
    </div>
  `;

  card.querySelector('[data-edit]').addEventListener('click', () => startEditing(entry));

  card.querySelector('[data-confirm]').addEventListener('click', async () => {
    const res = await fetch(`/api/entries/${entry.id}/confirm`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Could not confirm — fill in all 3 players first.');
      return;
    }
    await Promise.all([loadDrafts(), loadHistory(), loadStats(), loadStake()]);
  });

  card.querySelector('[data-delete]').addEventListener('click', async () => {
    if (!confirm(`Discard the draft for ${entry.date}?`)) return;
    await fetch(`/api/entries/${entry.id}`, { method: 'DELETE' });
    if (editingEntryId === entry.id) cancelEditing();
    await loadDrafts();
  });

  return card;
}

function startEditing(entry) {
  editingEntryId = entry.id;
  editingLegIds = entry.legs.map((l) => l.id);
  entryForm.date.value = entry.date;
  entryForm.stake.value = entry.stake;
  entryForm.notes.value = entry.notes || '';
  buildLegBlocks(entry.legs);
  editingHint.hidden = false;
  saveDraftBtn.textContent = 'Update draft';
  entryForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cancelEditing() {
  editingEntryId = null;
  editingLegIds = [];
  entryForm.reset();
  buildLegBlocks();
  entryForm.date.value = new Date().toISOString().slice(0, 10);
  editingHint.hidden = true;
  saveDraftBtn.textContent = 'Save as draft';
  loadStake();
}

document.getElementById('cancelEditBtn').addEventListener('click', cancelEditing);

entryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const fd = new FormData(entryForm);
  const legs = [1, 2, 3].map((i) => ({
    player: fd.get(`player${i}`),
    team: fd.get(`team${i}`),
    opponent: fd.get(`opponent${i}`),
    odds: fd.get(`odds${i}`),
    reasoning: fd.get(`reasoning${i}`),
    line: 'Over 1.5 H+R+RBI',
  }));

  if (editingEntryId) {
    // Update the draft's entry-level fields, then each leg individually.
    await fetch(`/api/entries/${editingEntryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: fd.get('date'),
        stake: Number(fd.get('stake')),
        notes: fd.get('notes'),
      }),
    });
    await Promise.all(
      legs.map((leg, idx) =>
        fetch(`/api/legs/${editingLegIds[idx]}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(leg),
        })
      )
    );
    cancelEditing();
    await Promise.all([loadDrafts(), loadStats(), loadStake()]);
    return;
  }

  const body = {
    date: fd.get('date'),
    stake: Number(fd.get('stake')),
    notes: fd.get('notes'),
    legs,
    isDraft: true,
  };

  const res = await fetch('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    alert(err.error || 'Could not save draft');
    return;
  }

  entryForm.reset();
  buildLegBlocks();
  entryForm.date.value = new Date().toISOString().slice(0, 10);
  await Promise.all([loadDrafts(), loadStake()]);
});

// init
buildLegBlocks();
entryForm.date.value = new Date().toISOString().slice(0, 10);
loadStake();
loadStats();
loadHistory();
loadDrafts();
