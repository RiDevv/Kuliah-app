// ===== Storage =====

const STORAGE_KEY = 'kuliah_app_data';

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
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
  // Push current view onto stack before switching
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

// Dispatch rendering to the appropriate render function (wired up in later tasks)
function _renderView(view, params) {
  switch (view) {
    case 'view-home':
      if (typeof renderHome === 'function') renderHome();
      break;
    case 'view-mata-kuliah':
      if (typeof renderMataKuliah === 'function') renderMataKuliah(params.mkId, params.tab || 'tugas');
      break;
    case 'view-pertemuan-tugas':
      if (typeof renderPertemuanTugas === 'function') renderPertemuanTugas(params.mkId, params.ptmId);
      break;
    case 'view-pertemuan-catatan':
      if (typeof renderPertemuanCatatan === 'function') renderPertemuanCatatan(params.mkId, params.ptmId);
      break;
    case 'view-tugas-akhir':
      if (typeof renderTugasAkhir === 'function') renderTugasAkhir(params.mkId);
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
    mataKuliah.forEach((mk) => {
      const allTugas = mk.pertemuan.flatMap((p) => p.tugas);
      html += `
        <div class="card card-header" data-mk-id="${mk.id}">
          ${renderIndicator(allTugas)}
          <span class="list-item__label mk-name">${mk.nama}</span>
          <button class="btn btn--danger mk-delete-btn" data-mk-id="${mk.id}" aria-label="Hapus ${mk.nama}">&#10005;</button>
        </div>
      `;
    });
  }

  content.innerHTML = html;

  // Wire up add button and Enter key
  const input = document.getElementById('mk-input');
  document.getElementById('mk-add-btn').addEventListener('click', () => {
    addMataKuliah(input.value);
    input.value = '';
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addMataKuliah(input.value);
      input.value = '';
    }
  });

  // Wire up card click (navigate) and delete buttons
  content.querySelectorAll('.card[data-mk-id]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.mk-delete-btn')) return; // handled below
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
  const mk = state.data.mataKuliah.find((m) => m.id === mkId);
  if (!mk) return;

  // Update header title
  document.getElementById('mk-title').textContent = mk.nama;

  // Update tab bar active state
  document.getElementById('tab-tugas').classList.toggle('tab-btn--active', tab === 'tugas');
  document.getElementById('tab-catatan').classList.toggle('tab-btn--active', tab === 'catatan');

  // Wire up tab switching (replace listeners by cloning)
  const tabTugas = document.getElementById('tab-tugas');
  const tabCatatan = document.getElementById('tab-catatan');
  const newTabTugas = tabTugas.cloneNode(true);
  const newTabCatatan = tabCatatan.cloneNode(true);
  tabTugas.replaceWith(newTabTugas);
  tabCatatan.replaceWith(newTabCatatan);
  newTabTugas.addEventListener('click', () => {
    state.params = { ...state.params, tab: 'tugas' };
    renderMataKuliah(mkId, 'tugas');
  });
  newTabCatatan.addEventListener('click', () => {
    state.params = { ...state.params, tab: 'catatan' };
    renderMataKuliah(mkId, 'catatan');
  });

  const content = document.getElementById('mk-content');

  if (tab === 'tugas') {
    let html = `
      <div class="card card--amber tugas-akhir-card" id="ta-card-${mkId}" role="button" tabindex="0" aria-label="Buka Tugas Akhir">
        <div class="tugas-akhir-card__inner">
          <span class="tugas-akhir-card__icon">&#9733;</span>
          <span class="tugas-akhir-card__label">Tugas Akhir</span>
          <span class="list-item__chevron">&#8250;</span>
        </div>
      </div>
    `;

    mk.pertemuan.forEach((ptm) => {
      html += `
        <div class="list-item" data-ptm-id="${ptm.id}" role="button" tabindex="0" aria-label="Buka Pertemuan ${ptm.nomor}">
          ${renderIndicator(ptm.tugas)}
          <span class="list-item__label">Pertemuan ${ptm.nomor}</span>
          <span class="list-item__chevron">&#8250;</span>
        </div>
      `;
    });

    content.innerHTML = html;

    // Wire up Tugas Akhir card
    const taCard = document.getElementById(`ta-card-${mkId}`);
    taCard.addEventListener('click', () => navigate('view-tugas-akhir', { mkId }));
    taCard.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') navigate('view-tugas-akhir', { mkId }); });

    // Wire up pertemuan items
    content.querySelectorAll('.list-item[data-ptm-id]').forEach((item) => {
      item.addEventListener('click', () => navigate('view-pertemuan-tugas', { mkId, ptmId: item.dataset.ptmId }));
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') navigate('view-pertemuan-tugas', { mkId, ptmId: item.dataset.ptmId }); });
    });

  } else {
    let html = '';

    mk.pertemuan.forEach((ptm) => {
      html += `
        <div class="list-item" data-ptm-id="${ptm.id}" role="button" tabindex="0" aria-label="Buka Catatan Pertemuan ${ptm.nomor}">
          <span class="list-item__label">Pertemuan ${ptm.nomor}</span>
          <span class="list-item__chevron">&#8250;</span>
        </div>
      `;
    });

    content.innerHTML = html;

    // Wire up pertemuan items
    content.querySelectorAll('.list-item[data-ptm-id]').forEach((item) => {
      item.addEventListener('click', () => navigate('view-pertemuan-catatan', { mkId, ptmId: item.dataset.ptmId }));
      item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') navigate('view-pertemuan-catatan', { mkId, ptmId: item.dataset.ptmId }); });
    });
  }
}

// ===== Pertemuan Tugas =====

function formatTenggat(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function renderPertemuanTugas(mkId, ptmId) {
  const mk = state.data.mataKuliah.find((m) => m.id === mkId);
  if (!mk) return;
  const ptm = mk.pertemuan.find((p) => p.id === ptmId);
  if (!ptm) return;

  // Update header title
  document.getElementById('ptm-tugas-title').textContent = `Pertemuan ${ptm.nomor} — ${mk.nama}`;

  const content = document.getElementById('ptm-tugas-content');

  let html = `
    <div class="input-row">
      <input class="input" id="tugas-input" type="text" placeholder="Deskripsi tugas..." maxlength="200" />
      <button class="btn btn--primary" id="tugas-add-btn">Tambah</button>
    </div>
    <div class="input-row" style="margin-bottom:16px;">
      <input class="input" id="tugas-tenggat-input" type="datetime-local" aria-label="Tenggat waktu" />
    </div>
  `;

  if (ptm.tugas.length === 0) {
    html += `<div class="empty-state">Belum ada tugas.<br/>Tambahkan tugas untuk pertemuan ini!</div>`;
  } else {
    ptm.tugas.forEach((t) => {
      const strikeClass = t.selesai ? ' text-strike' : '';
      const tenggatHtml = t.tenggat
        ? `<span class="text-muted" style="margin-left:8px;">${formatTenggat(t.tenggat)}</span>`
        : '';
      html += `
        <div class="card card-header" data-tugas-id="${t.id}">
          <input class="checkbox" type="checkbox" data-tugas-id="${t.id}" ${t.selesai ? 'checked' : ''} aria-label="Tandai selesai" />
          <span class="list-item__label${strikeClass}">${t.deskripsi}${tenggatHtml}</span>
          <button class="btn btn--danger tugas-delete-btn" data-tugas-id="${t.id}" aria-label="Hapus tugas">&#10005;</button>
        </div>
      `;
    });
  }

  content.innerHTML = html;

  // Wire up add button and Enter key
  const descInput = document.getElementById('tugas-input');
  const tenggatInput = document.getElementById('tugas-tenggat-input');

  document.getElementById('tugas-add-btn').addEventListener('click', () => {
    addTugas(mkId, ptmId, descInput.value, tenggatInput.value);
    descInput.value = '';
    tenggatInput.value = '';
  });

  descInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addTugas(mkId, ptmId, descInput.value, tenggatInput.value);
      descInput.value = '';
      tenggatInput.value = '';
    }
  });

  // Wire up checkboxes and delete buttons via event delegation
  content.addEventListener('change', (e) => {
    if (e.target.classList.contains('checkbox') && e.target.dataset.tugasId) {
      toggleTugas(mkId, ptmId, e.target.dataset.tugasId);
    }
  });

  content.addEventListener('click', (e) => {
    const btn = e.target.closest('.tugas-delete-btn');
    if (btn) {
      deleteTugas(mkId, ptmId, btn.dataset.tugasId);
    }
  });
}

function addTugas(mkId, ptmId, deskripsi, tenggat) {
  const trimmed = (deskripsi || '').trim();
  if (!trimmed) return;

  const mk = state.data.mataKuliah.find((m) => m.id === mkId);
  if (!mk) return;
  const ptm = mk.pertemuan.find((p) => p.id === ptmId);
  if (!ptm) return;

  const tugas = {
    id: generateId(),
    deskripsi: trimmed,
    selesai: false,
    tenggat: tenggat || null,
  };

  ptm.tugas.push(tugas);
  saveData(state.data);
  renderPertemuanTugas(mkId, ptmId);
  refreshIndicators();
}

function toggleTugas(mkId, ptmId, tugasId) {
  const mk = state.data.mataKuliah.find((m) => m.id === mkId);
  if (!mk) return;
  const ptm = mk.pertemuan.find((p) => p.id === ptmId);
  if (!ptm) return;
  const tugas = ptm.tugas.find((t) => t.id === tugasId);
  if (!tugas) return;

  tugas.selesai = !tugas.selesai;
  saveData(state.data);
  renderPertemuanTugas(mkId, ptmId);
  // Immediately refresh indicators on any visible ancestor view
  refreshIndicators();
}

function deleteTugas(mkId, ptmId, tugasId) {
  const mk = state.data.mataKuliah.find((m) => m.id === mkId);
  if (!mk) return;
  const ptm = mk.pertemuan.find((p) => p.id === ptmId);
  if (!ptm) return;

  ptm.tugas = ptm.tugas.filter((t) => t.id !== tugasId);
  saveData(state.data);
  renderPertemuanTugas(mkId, ptmId);
  refreshIndicators();
}

// ===== Pertemuan Catatan =====

function renderPertemuanCatatan(mkId, ptmId) {
  const mk = state.data.mataKuliah.find((m) => m.id === mkId);
  if (!mk) return;
  const ptm = mk.pertemuan.find((p) => p.id === ptmId);
  if (!ptm) return;

  // Update header title
  document.getElementById('ptm-catatan-title').textContent = `Pertemuan ${ptm.nomor} — ${mk.nama}`;

  const content = document.getElementById('ptm-catatan-content');
  content.innerHTML = `
    <textarea
      class="textarea catatan-textarea"
      id="catatan-textarea"
      placeholder="Mulai mencatat materi kuliah di sini..."
      aria-label="Catatan pertemuan ${ptm.nomor}"
    >${ptm.catatan ? ptm.catatan.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}</textarea>
  `;

  const textarea = document.getElementById('catatan-textarea');
  const debouncedSave = debounce((text) => saveCatatan(mkId, ptmId, text), 500);
  textarea.addEventListener('input', (e) => debouncedSave(e.target.value));
}

function saveCatatan(mkId, ptmId, text) {
  const mk = state.data.mataKuliah.find((m) => m.id === mkId);
  if (!mk) return;
  const ptm = mk.pertemuan.find((p) => p.id === ptmId);
  if (!ptm) return;

  ptm.catatan = text;
  saveData(state.data);
}

// ===== Tugas Akhir =====

function renderTugasAkhir(mkId) {
  const mk = state.data.mataKuliah.find((m) => m.id === mkId);
  if (!mk) return;

  document.getElementById('ta-title').textContent = `Tugas Akhir — ${mk.nama}`;

  const { checklist, catatan } = mk.tugasAkhir;
  const content = document.getElementById('ta-content');

  let checklistItems = '';
  if (checklist.length === 0) {
    checklistItems = `<div class="empty-state">Belum ada item checklist.</div>`;
  } else {
    checklist.forEach((item) => {
      const strikeClass = item.selesai ? ' text-strike' : '';
      checklistItems += `
        <div class="card card-header" data-item-id="${item.id}">
          <input class="checkbox" type="checkbox" data-item-id="${item.id}" ${item.selesai ? 'checked' : ''} aria-label="Tandai selesai" />
          <span class="list-item__label${strikeClass}">${item.deskripsi}</span>
          <button class="btn btn--danger ta-item-delete-btn" data-item-id="${item.id}" aria-label="Hapus item">&#10005;</button>
        </div>
      `;
    });
  }

  const escapedCatatan = catatan ? catatan.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

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
      >${escapedCatatan}</textarea>
    </section>
  `;

  // Wire up add item
  const itemInput = document.getElementById('ta-item-input');
  document.getElementById('ta-item-add-btn').addEventListener('click', () => {
    addTugasAkhirItem(mkId, itemInput.value);
    itemInput.value = '';
  });
  itemInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addTugasAkhirItem(mkId, itemInput.value);
      itemInput.value = '';
    }
  });

  // Wire up checklist via event delegation
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

  // Wire up auto-save catatan
  const textarea = document.getElementById('ta-catatan-textarea');
  const debouncedSave = debounce((text) => saveTugasAkhirCatatan(mkId, text), 500);
  textarea.addEventListener('input', (e) => debouncedSave(e.target.value));
}

function addTugasAkhirItem(mkId, deskripsi) {
  const trimmed = (deskripsi || '').trim();
  if (!trimmed) return;

  const mk = state.data.mataKuliah.find((m) => m.id === mkId);
  if (!mk) return;

  mk.tugasAkhir.checklist.push({ id: generateId(), deskripsi: trimmed, selesai: false });
  saveData(state.data);
  renderTugasAkhir(mkId);
}

function toggleTugasAkhirItem(mkId, itemId) {
  const mk = state.data.mataKuliah.find((m) => m.id === mkId);
  if (!mk) return;
  const item = mk.tugasAkhir.checklist.find((i) => i.id === itemId);
  if (!item) return;

  item.selesai = !item.selesai;
  saveData(state.data);
  renderTugasAkhir(mkId);
}

function deleteTugasAkhirItem(mkId, itemId) {
  const mk = state.data.mataKuliah.find((m) => m.id === mkId);
  if (!mk) return;

  mk.tugasAkhir.checklist = mk.tugasAkhir.checklist.filter((i) => i.id !== itemId);
  saveData(state.data);
  renderTugasAkhir(mkId);
}

function saveTugasAkhirCatatan(mkId, text) {
  const mk = state.data.mataKuliah.find((m) => m.id === mkId);
  if (!mk) return;

  mk.tugasAkhir.catatan = text;
  saveData(state.data);
}

// ===== Deadline Checker =====

function refreshIndicators() {
  const view = state.currentView;
  if (!view) return;

  if (view === 'view-home') {
    // Re-render indicator span inside each MK card
    const { mataKuliah } = state.data;
    mataKuliah.forEach((mk) => {
      const card = document.querySelector(`.card[data-mk-id="${mk.id}"]`);
      if (!card) return;
      const indicatorEl = card.querySelector('.indicator');
      if (!indicatorEl) return;
      const allTugas = mk.pertemuan.flatMap((p) => p.tugas);
      const newIndicatorHtml = renderIndicator(allTugas);
      indicatorEl.outerHTML = newIndicatorHtml;
    });
  } else if (view === 'view-mata-kuliah') {
    // Re-render indicator spans for each pertemuan row (tugas tab only)
    const mk = state.data.mataKuliah.find((m) => m.id === state.params.mkId);
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
  // Wire up back buttons
  document.getElementById('mk-back-btn').addEventListener('click', goBack);
  document.getElementById('ptm-tugas-back-btn').addEventListener('click', goBack);
  document.getElementById('ptm-catatan-back-btn').addEventListener('click', goBack);
  document.getElementById('ta-back-btn').addEventListener('click', goBack);

  // Show home view on load
  _showView('view-home');
  if (typeof renderHome === 'function') renderHome();

  // Deadline checker — re-check Mendekati_Tenggat every 60 seconds
  setInterval(refreshIndicators, 60 * 1000);
});
