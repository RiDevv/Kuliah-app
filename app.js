// ===== Storage =====

const STORAGE_KEY = 'kuliah_app_data';

function _migrateCatatanTugas(data) {
  let changed = false;
  (data.mataKuliah || []).forEach(mk => {
    (mk.pertemuan || []).forEach(ptm => {
      (ptm.tugas || []).forEach(t => {
        if (t.catatan === undefined) {
          t.catatan = '';
          changed = true;
        }
        if (t.tenggat === undefined) {
          t.tenggat = null;
          changed = true;
        }
      });
    });
  });
  return { data, changed };
}

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const { data, changed } = _migrateCatatanTugas(parsed);
      if (changed) saveData(data);
      return data;
    }
  } catch (e) {
    // localStorage unavailable or parse error — fall through to empty data
  }
  return { mataKuliah: [] };
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage unavailable — silently ignore
  }
}

// ===== Utility =====

function generateId() {
  // Simple UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function findMk(mkId) {
  return state.data.mataKuliah.find(m => m.id === mkId);
}

function findPtm(mk, ptmId) {
  return mk.pertemuan.find(p => p.id === ptmId);
}

function escapeHtml(str) {
  return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ===== State =====

let state = {
  data: loadData(),
  currentView: 'view-home',
  navigationStack: [],
  params: {},
};

// ===== Navigation =====

const ALL_VIEWS = [
  'view-home',
  'view-mata-kuliah',
  'view-pertemuan-tugas',
  'view-pertemuan-catatan',
  'view-tugas-akhir',
];

function navigate(view, params = {}) {
  state.navigationStack.push({ view: state.currentView, params: state.params });
  state.currentView = view;
  state.params = params;
  _showView(view);
  _renderView(view, params);
}

function goBack() {
  if (state.navigationStack.length === 0) return;
  const prev = state.navigationStack.pop();
  state.currentView = prev.view;
  state.params = prev.params;
  _showView(prev.view);
  _renderView(prev.view, prev.params);
}

function _showView(viewId) {
  ALL_VIEWS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== viewId);
  });
}

function _renderView(view, params) {
  switch (view) {
    case 'view-home':
      renderHome();
      break;
    case 'view-mata-kuliah':
      renderMataKuliah(params.mkId, params.tab || 'tugas');
      break;
    case 'view-pertemuan-tugas':
      renderPertemuanTugas(params.mkId, params.ptmId);
      break;
    case 'view-pertemuan-catatan':
      renderPertemuanCatatan(params.mkId, params.ptmId);
      break;
    case 'view-tugas-akhir':
      renderTugasAkhir(params.mkId);
      break;
  }
}

// ===== Indicator =====

function getIndicator(tugas) {
  const now = Date.now();
  const belumSelesai = tugas.filter((t) => !t.selesai);
  if (belumSelesai.length === 0) return 'clear';
  const urgent = belumSelesai.some(
    (t) => t.tenggat && new Date(t.tenggat).getTime() - now <= 24 * 60 * 60 * 1000
  );
  return urgent ? 'urgent' : 'active';
}

function renderIndicator(tugas) {
  const status = getIndicator(tugas);
  if (status === 'urgent') return '<span class="indicator indicator--urgent">!</span>';
  if (status === 'active') return '<span class="indicator indicator--active"></span>';
  return '<span class="indicator indicator--clear"></span>';
}

// ===== Home =====

function buildMkCardHtml(mk) {
  const allTugas = mk.pertemuan.flatMap((p) => p.tugas);
  return `
    <div class="card card-header" data-mk-id="${mk.id}">
      ${renderIndicator(allTugas)}
      <span class="list-item__label mk-name">${mk.nama}</span>
      <button class="btn btn--danger mk-delete-btn" data-mk-id="${mk.id}" aria-label="Hapus ${mk.nama}">&#10005;</button>
    </div>
  `;
}

function renderHome() {
  const content = document.getElementById('home-content');
  const { mataKuliah } = state.data;

  let html = `
    <div class="input-row">
      <input class="input" id="mk-input" type="text" placeholder="Nama mata kuliah..." maxlength="60" />
      <button class="btn btn--primary" id="mk-add-btn">Tambah</button>
    </div>
  `;

  if (mataKuliah.length === 0) {
    html += `<div class="empty-state">Belum ada mata kuliah.<br/>Tambahkan mata kuliah pertamamu!</div>`;
  } else {
    html += mataKuliah.map(buildMkCardHtml).join('');
  }

  content.innerHTML = html;

  const input = document.getElementById('mk-input');

  const submitAddMk = () => {
    addMataKuliah(input.value);
    input.value = '';
  };

  document.getElementById('mk-add-btn').addEventListener('click', submitAddMk);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAddMk(); });

  content.querySelectorAll('.card[data-mk-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.mk-delete-btn')) return;
      navigate('view-mata-kuliah', { mkId: card.dataset.mkId });
    });
  });

  content.querySelectorAll('.mk-delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteMataKuliah(btn.dataset.mkId);
    });
  });
}

// ===== Mata Kuliah Management =====

function addMataKuliah(nama) {
  const trimmed = nama.trim();
  if (!trimmed) return;

  const pertemuan = Array.from({ length: 14 }, (_, i) => ({
    id: generateId(),
    nomor: i + 1,
    tugas: [],
    catatan: '',
  }));

  const mk = {
    id: generateId(),
    nama: trimmed,
    pertemuan,
    tugasAkhir: { checklist: [], catatan: '' },
  };

  state.data.mataKuliah.push(mk);
  saveData(state.data);
  renderHome();
}

function deleteMataKuliah(id) {
  state.data.mataKuliah = state.data.mataKuliah.filter((mk) => mk.id !== id);
  saveData(state.data);
  renderHome();
}

// ===== Mata Kuliah Detail =====

function renderMataKuliah(mkId, tab = 'tugas') {
  const mk = findMk(mkId);
  if (!mk) return;

  document.getElementById('mk-title').textContent = mk.nama;
  document.getElementById('tab-tugas').classList.toggle('tab-btn--active', tab === 'tugas');
  document.getElementById('tab-catatan').classList.toggle('tab-btn--active', tab === 'catatan');

  // Replace nodes to clear old listeners
  ['tab-tugas', 'tab-catatan'].forEach((id) => {
    const el = document.getElementById(id);
    const clone = el.cloneNode(true);
    el.replaceWith(clone);
  });

  document.getElementById('tab-tugas').addEventListener('click', () => {
    state.params = { ...state.params, tab: 'tugas' };
    renderMataKuliah(mkId, 'tugas');
  });
  document.getElementById('tab-catatan').addEventListener('click', () => {
    state.params = { ...state.params, tab: 'catatan' };
    renderMataKuliah(mkId, 'catatan');
  });

  if (tab === 'tugas') {
    renderMataKuliahTabTugas(mkId, mk);
  } else {
    renderMataKuliahTabCatatan(mkId, mk);
  }
}

function renderMataKuliahTabTugas(mkId, mk) {
  const content = document.getElementById('mk-content');

  let html = `
    <div class="card card--amber tugas-akhir-card" id="ta-card-${mkId}" role="button" tabindex="0" aria-label="Buka Tugas Akhir">
      <div class="tugas-akhir-card__inner">
        <span class="tugas-akhir-card__icon">&#9733;</span>
        <span class="tugas-akhir-card__label">Tugas Akhir</span>
        <span class="list-item__chevron">&#8250;</span>
      </div>
    </div>
  `;

  html += mk.pertemuan.map((ptm) => `
    <div class="list-item" data-ptm-id="${ptm.id}" role="button" tabindex="0" aria-label="Buka Pertemuan ${ptm.nomor}">
      ${renderIndicator(ptm.tugas)}
      <span class="list-item__label">Pertemuan ${ptm.nomor}</span>
      <span class="list-item__chevron">&#8250;</span>
    </div>
  `).join('');

  content.innerHTML = html;

  const taCard = document.getElementById(`ta-card-${mkId}`);
  taCard.addEventListener('click', () => navigate('view-tugas-akhir', { mkId }));
  taCard.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') navigate('view-tugas-akhir', { mkId });
  });

  content.querySelectorAll('.list-item[data-ptm-id]').forEach((item) => {
    item.addEventListener('click', () => navigate('view-pertemuan-tugas', { mkId, ptmId: item.dataset.ptmId }));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') navigate('view-pertemuan-tugas', { mkId, ptmId: item.dataset.ptmId });
    });
  });
}

function renderMataKuliahTabCatatan(mkId, mk) {
  const content = document.getElementById('mk-content');

  content.innerHTML = mk.pertemuan.map((ptm) => `
    <div class="list-item" data-ptm-id="${ptm.id}" role="button" tabindex="0" aria-label="Buka Catatan Pertemuan ${ptm.nomor}">
      <span class="list-item__label">Pertemuan ${ptm.nomor}</span>
      <span class="list-item__chevron">&#8250;</span>
    </div>
  `).join('');

  content.querySelectorAll('.list-item[data-ptm-id]').forEach((item) => {
    item.addEventListener('click', () => navigate('view-pertemuan-catatan', { mkId, ptmId: item.dataset.ptmId }));
    item.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') navigate('view-pertemuan-catatan', { mkId, ptmId: item.dataset.ptmId });
    });
  });
}

// ===== Pertemuan Tugas =====

function formatTenggat(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return ''; // guard untuk string tidak valid
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function buildTugasCardHtml(t) {
  const strikeClass = t.selesai ? ' text-strike' : '';
  const tenggatHtml = t.tenggat
    ? `<span class="text-muted tenggat-label">${formatTenggat(t.tenggat)}</span>`
    : '';
  return `
    <div class="card card-header" data-tugas-id="${t.id}">
      <input class="checkbox" type="checkbox" data-tugas-id="${t.id}" ${t.selesai ? 'checked' : ''} aria-label="Tandai selesai" />
      <span class="list-item__label${strikeClass}">${t.deskripsi}${tenggatHtml}</span>
      <button class="btn btn--danger tugas-delete-btn" data-tugas-id="${t.id}" aria-label="Hapus tugas">&#10005;</button>
    </div>
    <textarea
      class="textarea tugas-catatan-textarea"
      data-tugas-id="${t.id}"
      placeholder="Tambahkan catatan..."
      aria-label="Catatan untuk tugas: ${t.deskripsi}"
    >${escapeHtml(t.catatan)}</textarea>
  `;
}

function renderPertemuanTugas(mkId, ptmId) {
  const mk = findMk(mkId);
  if (!mk) return;
  const ptm = findPtm(mk, ptmId);
  if (!ptm) return;

  document.getElementById('ptm-tugas-title').textContent = `Pertemuan ${ptm.nomor} — ${mk.nama}`;

  const content = document.getElementById('ptm-tugas-content');

  const emptyState = ptm.tugas.length === 0
    ? `<div class="empty-state">Belum ada tugas.<br/>Tambahkan tugas untuk pertemuan ini!</div>`
    : ptm.tugas.map(buildTugasCardHtml).join('');

  content.innerHTML = `
    <div class="input-row">
      <input class="input" id="tugas-input" type="text" placeholder="Deskripsi tugas..." maxlength="200" />
      <button class="btn btn--primary" id="tugas-add-btn">Tambah</button>
    </div>
    <div class="input-row tenggat-row">
      <input class="input" id="tugas-tenggat-input" type="datetime-local" aria-label="Tenggat waktu" />
    </div>
    ${emptyState}
  `;

  const descInput = document.getElementById('tugas-input');
  const tenggatInput = document.getElementById('tugas-tenggat-input');

  const submitAddTugas = () => {
    addTugas(mkId, ptmId, descInput.value, tenggatInput.value);
    descInput.value = '';
    tenggatInput.value = '';
  };

  document.getElementById('tugas-add-btn').addEventListener('click', submitAddTugas);
  descInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAddTugas(); });

  content.addEventListener('change', (e) => {
    if (e.target.classList.contains('checkbox') && e.target.dataset.tugasId) {
      toggleTugas(mkId, ptmId, e.target.dataset.tugasId);
    }
  });

  content.addEventListener('click', (e) => {
    const btn = e.target.closest('.tugas-delete-btn');
    if (btn) deleteTugas(mkId, ptmId, btn.dataset.tugasId);
  });

  const debouncedSaveCatatanTugas = debounce((tugasId, text) => {
    saveCatatanTugas(mkId, ptmId, tugasId, text);
  }, 500);

  content.addEventListener('input', (e) => {
    if (e.target.classList.contains('tugas-catatan-textarea')) {
      debouncedSaveCatatanTugas(e.target.dataset.tugasId, e.target.value);
    }
  });
}

function addTugas(mkId, ptmId, deskripsi, tenggat) {
  const trimmed = (deskripsi || '').trim();
  if (!trimmed) return;

  const mk = findMk(mkId);
  if (!mk) return;
  const ptm = findPtm(mk, ptmId);
  if (!ptm) return;

  ptm.tugas.push({
    id: generateId(),
    deskripsi: trimmed,
    selesai: false,
    tenggat: tenggat || null,
    catatan: '',
  });

  saveData(state.data);
  renderPertemuanTugas(mkId, ptmId);
  refreshIndicators();
}

function toggleTugas(mkId, ptmId, tugasId) {
  const mk = findMk(mkId);
  if (!mk) return;
  const ptm = findPtm(mk, ptmId);
  if (!ptm) return;
  const tugas = ptm.tugas.find((t) => t.id === tugasId);
  if (!tugas) return;

  tugas.selesai = !tugas.selesai;
  saveData(state.data);
  renderPertemuanTugas(mkId, ptmId);
  refreshIndicators();
}

function deleteTugas(mkId, ptmId, tugasId) {
  const mk = findMk(mkId);
  if (!mk) return;
  const ptm = findPtm(mk, ptmId);
  if (!ptm) return;

  ptm.tugas = ptm.tugas.filter((t) => t.id !== tugasId);
  saveData(state.data);
  renderPertemuanTugas(mkId, ptmId);
  refreshIndicators();
}

// ===== Pertemuan Catatan =====

function renderPertemuanCatatan(mkId, ptmId) {
  const mk = findMk(mkId);
  if (!mk) return;
  const ptm = findPtm(mk, ptmId);
  if (!ptm) return;

  document.getElementById('ptm-catatan-title').textContent = `Pertemuan ${ptm.nomor} — ${mk.nama}`;

  const content = document.getElementById('ptm-catatan-content');
  content.innerHTML = `
    <textarea
      class="textarea catatan-textarea"
      id="catatan-textarea"
      placeholder="Mulai mencatat materi kuliah di sini..."
      aria-label="Catatan pertemuan ${ptm.nomor}"
    >${escapeHtml(ptm.catatan)}</textarea>
  `;

  const textarea = document.getElementById('catatan-textarea');
  const debouncedSave = debounce((text) => saveCatatan(mkId, ptmId, text), 500);
  textarea.addEventListener('input', (e) => debouncedSave(e.target.value));
}

function saveCatatanTugas(mkId, ptmId, tugasId, text) {
  const mk = findMk(mkId);
  if (!mk) return;
  const ptm = findPtm(mk, ptmId);
  if (!ptm) return;
  const tugas = ptm.tugas.find(t => t.id === tugasId);
  if (!tugas) return;

  tugas.catatan = text;
  saveData(state.data);
}

function saveCatatan(mkId, ptmId, text) {
  const mk = findMk(mkId);
  if (!mk) return;
  const ptm = findPtm(mk, ptmId);
  if (!ptm) return;

  ptm.catatan = text;
  saveData(state.data);
}

// ===== Tugas Akhir =====

function buildTugasAkhirItemHtml(item) {
  const strikeClass = item.selesai ? ' text-strike' : '';
  return `
    <div class="card card-header" data-item-id="${item.id}">
      <input class="checkbox" type="checkbox" data-item-id="${item.id}" ${item.selesai ? 'checked' : ''} aria-label="Tandai selesai" />
      <span class="list-item__label${strikeClass}">${item.deskripsi}</span>
      <button class="btn btn--danger ta-item-delete-btn" data-item-id="${item.id}" aria-label="Hapus item">&#10005;</button>
    </div>
  `;
}

function renderTugasAkhir(mkId) {
  const mk = findMk(mkId);
  if (!mk) return;

  document.getElementById('ta-title').textContent = `Tugas Akhir — ${mk.nama}`;

  const { checklist, catatan } = mk.tugasAkhir;
  const content = document.getElementById('ta-content');

  const checklistItems = checklist.length === 0
    ? `<div class="empty-state">Belum ada item checklist.</div>`
    : checklist.map(buildTugasAkhirItemHtml).join('');

  content.innerHTML = `
    <section class="ta-section">
      <h3 class="ta-section__title">Checklist</h3>
      <div class="input-row">
        <input class="input" id="ta-item-input" type="text" placeholder="Deskripsi item..." maxlength="200" />
        <button class="btn btn--primary" id="ta-item-add-btn">Tambah</button>
      </div>
      <div id="ta-checklist">${checklistItems}</div>
    </section>
    <section class="ta-section">
      <h3 class="ta-section__title">Catatan</h3>
      <textarea
        class="textarea catatan-textarea"
        id="ta-catatan-textarea"
        placeholder="Tulis catatan, referensi, atau deskripsi tugas akhir di sini..."
        aria-label="Catatan tugas akhir"
      >${escapeHtml(catatan)}</textarea>
    </section>
  `;

  const itemInput = document.getElementById('ta-item-input');

  const submitAddItem = () => {
    addTugasAkhirItem(mkId, itemInput.value);
    itemInput.value = '';
  };

  document.getElementById('ta-item-add-btn').addEventListener('click', submitAddItem);
  itemInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAddItem(); });

  const checklistEl = document.getElementById('ta-checklist');
  checklistEl.addEventListener('change', (e) => {
    if (e.target.classList.contains('checkbox') && e.target.dataset.itemId) {
      toggleTugasAkhirItem(mkId, e.target.dataset.itemId);
    }
  });
  checklistEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.ta-item-delete-btn');
    if (btn) deleteTugasAkhirItem(mkId, btn.dataset.itemId);
  });

  const textarea = document.getElementById('ta-catatan-textarea');
  const debouncedSave = debounce((text) => saveTugasAkhirCatatan(mkId, text), 500);
  textarea.addEventListener('input', (e) => debouncedSave(e.target.value));
}

function addTugasAkhirItem(mkId, deskripsi) {
  const trimmed = (deskripsi || '').trim();
  if (!trimmed) return;

  const mk = findMk(mkId);
  if (!mk) return;

  mk.tugasAkhir.checklist.push({ id: generateId(), deskripsi: trimmed, selesai: false });
  saveData(state.data);
  renderTugasAkhir(mkId);
}

function toggleTugasAkhirItem(mkId, itemId) {
  const mk = findMk(mkId);
  if (!mk) return;
  const item = mk.tugasAkhir.checklist.find((i) => i.id === itemId);
  if (!item) return;

  item.selesai = !item.selesai;
  saveData(state.data);
  renderTugasAkhir(mkId);
}

function deleteTugasAkhirItem(mkId, itemId) {
  const mk = findMk(mkId);
  if (!mk) return;

  mk.tugasAkhir.checklist = mk.tugasAkhir.checklist.filter((i) => i.id !== itemId);
  saveData(state.data);
  renderTugasAkhir(mkId);
}

function saveTugasAkhirCatatan(mkId, text) {
  const mk = findMk(mkId);
  if (!mk) return;

  mk.tugasAkhir.catatan = text;
  saveData(state.data);
}

// ===== Deadline Checker =====

function refreshIndicators() {
  const view = state.currentView;
  if (!view) return;

  if (view === 'view-home') {
    state.data.mataKuliah.forEach((mk) => {
      const card = document.querySelector(`.card[data-mk-id="${mk.id}"]`);
      if (!card) return;
      const indicatorEl = card.querySelector('.indicator');
      if (!indicatorEl) return;
      const allTugas = mk.pertemuan.flatMap((p) => p.tugas);
      indicatorEl.outerHTML = renderIndicator(allTugas);
    });
  } else if (view === 'view-mata-kuliah') {
    const mk = findMk(state.params.mkId);
    if (!mk) return;
    mk.pertemuan.forEach((ptm) => {
      const row = document.querySelector(`.list-item[data-ptm-id="${ptm.id}"]`);
      if (!row) return;
      const indicatorEl = row.querySelector('.indicator');
      if (!indicatorEl) return;
      indicatorEl.outerHTML = renderIndicator(ptm.tugas);
    });
  }
}

// ===== Init =====

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('mk-back-btn').addEventListener('click', goBack);
  document.getElementById('ptm-tugas-back-btn').addEventListener('click', goBack);
  document.getElementById('ptm-catatan-back-btn').addEventListener('click', goBack);
  document.getElementById('ta-back-btn').addEventListener('click', goBack);

  _showView('view-home');
  renderHome();

  setInterval(refreshIndicators, 60 * 1000);
});
