const state = { browsePage: 1 };

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
  });
  if (res.status === 401) {
    showLogin();
    throw new Error('Not authenticated');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');
  refreshStats();
  loadBrowse();
  loadHistory();
}

async function checkSession() {
  const { authenticated } = await api('/api/auth/session');
  if (authenticated) showApp();
  else showLogin();
}

document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  try {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) });
    document.getElementById('login-password').value = '';
    showApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('logout-btn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  showLogin();
});

// --- Tabs ---
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
  });
});

// --- Stats ---
async function refreshStats() {
  const stats = await api('/api/suppressions/stats');
  document.getElementById('stats-bar').innerHTML = `
    <span>Bounced: <b>${stats.bounced}</b></span>
    <span>Unsubscribed: <b>${stats.unsubscribed}</b></span>
    <span>Total: <b>${stats.total}</b></span>
  `;
}

// --- Lookup ---
function renderLookupResults(results) {
  if (results.length === 0) {
    document.getElementById('lookup-results').innerHTML = '<p class="muted">No results.</p>';
    return;
  }
  const rows = results.map((r) => {
    const validBadge = r.validSyntax && r.hasMailServer
      ? '<span class="badge badge-ok">Valid</span>'
      : `<span class="badge badge-bad">${!r.validSyntax ? 'Invalid syntax' : 'Domain not found'}</span>`;
    const suppressedParts = [];
    if (r.bounced) suppressedParts.push('Bounced');
    if (r.unsubscribed) suppressedParts.push('Unsubscribed');
    const suppressedBadge = suppressedParts.length
      ? `<span class="badge badge-warn">${suppressedParts.join(' + ')}</span>`
      : '<span class="badge badge-ok">Clean</span>';
    return `<tr><td>${escapeHtml(r.email)}</td><td>${validBadge}</td><td>${suppressedBadge}</td></tr>`;
  }).join('');

  document.getElementById('lookup-results').innerHTML = `
    <table>
      <thead><tr><th>Email</th><th>Validity</th><th>Suppression status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

document.getElementById('lookup-btn').addEventListener('click', async () => {
  const statusEl = document.getElementById('lookup-status');
  const fileInput = document.getElementById('lookup-file');
  const text = document.getElementById('lookup-textarea').value.trim();

  if (!text && (!fileInput.files || fileInput.files.length === 0)) {
    statusEl.textContent = 'Paste some emails or choose a file first.';
    return;
  }

  statusEl.textContent = 'Checking...';
  try {
    let data;
    if (fileInput.files && fileInput.files.length > 0) {
      const fd = new FormData();
      fd.append('file', fileInput.files[0]);
      data = await api('/api/lookup/upload', { method: 'POST', body: fd });
    } else {
      data = await api('/api/lookup', { method: 'POST', body: JSON.stringify({ text }) });
    }
    statusEl.textContent = `Checked ${data.checked} unique email(s).${data.truncated ? ' (list truncated to size limit)' : ''}`;
    renderLookupResults(data.results);
  } catch (err) {
    statusEl.textContent = err.message;
  }
});

// --- Upload lists ---
document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = document.getElementById('upload-type').value;
  const source = document.getElementById('upload-source').value;
  const fileInput = document.getElementById('upload-file');
  const resultEl = document.getElementById('upload-result');

  if (!fileInput.files || fileInput.files.length === 0) return;

  const fd = new FormData();
  fd.append('file', fileInput.files[0]);
  fd.append('type', type);
  fd.append('source', source);

  resultEl.innerHTML = '<p class="muted">Uploading...</p>';
  try {
    const summary = await api('/api/suppressions/upload', { method: 'POST', body: fd });
    resultEl.innerHTML = `
      <div class="summary-box">
        <p><b>${summary.added}</b> added, <b>${summary.duplicates}</b> already on the list (refreshed), <b>${summary.invalid}</b> skipped as invalid, out of <b>${summary.total}</b> rows.</p>
      </div>
    `;
    fileInput.value = '';
    refreshStats();
    loadHistory();
    loadBrowse();
  } catch (err) {
    resultEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
});

document.getElementById('single-add-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('single-email').value;
  const type = document.getElementById('single-type').value;
  const reason = document.getElementById('single-reason').value || null;
  const resultEl = document.getElementById('single-add-result');

  try {
    await api('/api/suppressions', { method: 'POST', body: JSON.stringify({ email, type, source: 'manual', reason }) });
    resultEl.innerHTML = `<p class="muted">Added ${escapeHtml(email)} to the ${type} list.</p>`;
    document.getElementById('single-email').value = '';
    document.getElementById('single-reason').value = '';
    refreshStats();
    loadBrowse();
  } catch (err) {
    resultEl.innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
  }
});

// --- Browse ---
async function loadBrowse() {
  const search = document.getElementById('browse-search').value.trim();
  const type = document.getElementById('browse-type').value;
  const data = await api(`/api/suppressions?${new URLSearchParams({ search, type, page: state.browsePage, pageSize: 50 })}`);

  if (data.rows.length === 0) {
    document.getElementById('browse-results').innerHTML = '<p class="muted">No entries found.</p>';
  } else {
    const rows = data.rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.email)}</td>
        <td><span class="badge ${r.type === 'bounced' ? 'badge-bad' : 'badge-warn'}">${r.type}</span></td>
        <td>${escapeHtml(r.source)}</td>
        <td>${escapeHtml(r.reason || '')}</td>
        <td>${new Date(r.updated_at).toLocaleString()}</td>
        <td><button class="link-btn" data-id="${r.id}">Remove</button></td>
      </tr>
    `).join('');
    document.getElementById('browse-results').innerHTML = `
      <table>
        <thead><tr><th>Email</th><th>Type</th><th>Source</th><th>Reason</th><th>Updated</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    document.querySelectorAll('#browse-results .link-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api(`/api/suppressions/${btn.dataset.id}`, { method: 'DELETE' });
        refreshStats();
        loadBrowse();
      });
    });
  }

  const totalPages = Math.max(Math.ceil(data.total / data.pageSize), 1);
  document.getElementById('browse-pagination').innerHTML = `
    <button id="browse-prev" ${state.browsePage <= 1 ? 'disabled' : ''}>Prev</button>
    <span class="muted">Page ${state.browsePage} of ${totalPages} (${data.total} total)</span>
    <button id="browse-next" ${state.browsePage >= totalPages ? 'disabled' : ''}>Next</button>
  `;
  document.getElementById('browse-prev')?.addEventListener('click', () => { state.browsePage -= 1; loadBrowse(); });
  document.getElementById('browse-next')?.addEventListener('click', () => { state.browsePage += 1; loadBrowse(); });
}

document.getElementById('browse-search-btn').addEventListener('click', () => { state.browsePage = 1; loadBrowse(); });

// --- History ---
async function loadHistory() {
  const data = await api('/api/suppressions/imports');
  if (data.rows.length === 0) {
    document.getElementById('history-results').innerHTML = '<p class="muted">No imports yet.</p>';
    return;
  }
  const rows = data.rows.map((r) => `
    <tr>
      <td>${new Date(r.created_at).toLocaleString()}</td>
      <td>${escapeHtml(r.filename || '')}</td>
      <td>${r.type}</td>
      <td>${escapeHtml(r.source)}</td>
      <td>${r.total_rows}</td>
      <td>${r.added_count}</td>
      <td>${r.duplicate_count}</td>
      <td>${r.invalid_count}</td>
    </tr>
  `).join('');
  document.getElementById('history-results').innerHTML = `
    <table>
      <thead><tr><th>When</th><th>File</th><th>Type</th><th>Source</th><th>Rows</th><th>Added</th><th>Dupes</th><th>Invalid</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

checkSession();
