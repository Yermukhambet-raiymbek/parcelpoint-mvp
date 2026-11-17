/* ParcelPoint MVP prototype — client-side demo, no backend.
   Data is persisted in localStorage so the flow survives a page refresh. */
'use strict';

const STORE_KEY = 'parcelpoint_state_v3';

const DORMS = [
  { id: 'd1', name: 'AITU Dormitory 1', address: 'Astana, Kabanbay batyr ave. 44A' },
  { id: 'd2', name: 'AITU Dormitory 2', address: 'Astana, Kabanbay batyr ave. 44B' },
  { id: 'd3', name: 'AITU Dormitory 3', address: 'Astana, Turan ave. 12' }
];

const CARRIERS = ['Kaspi.kz Post', 'Wildberries', 'Choco', 'Yandex Delivery', 'Other carrier'];

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const now = () => Date.now();
const rand = (n) => Math.random().toString(36).slice(2, 2 + n).toUpperCase();
const uid = () => 'PP-' + rand(4);
const pickupCode = () => Array.from({ length: 5 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('');

const escapeHtml = (value) => String(value == null ? '' : value)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const dormName = (id) => (DORMS.find((d) => d.id === id) || { name: 'Unknown hub' }).name;

function fmtTime(ts) {
  return new Date(ts).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function relTime(ts) {
  const diff = Math.max(0, now() - ts);
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return min + ' min ago';
  const h = Math.round(min / 60);
  if (h < 24) return h + ' h ago';
  const d = Math.round(h / 24);
  return d + (d === 1 ? ' day ago' : ' days ago');
}

function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag(5, 2);
}

/* ------------------------------------------------------------------ state */

function seedState() {
  const t = now();
  const parcels = [
    {
      id: 'PP-7K2M', dormId: 'd1', carrier: 'Kaspi.kz Post', room: '214', student: 'Bekzat E.',
      phone: '0417', code: '4F9K2', status: 'in_hub', createdAt: t - 2 * 3600e3, pickedAt: null
    },
    {
      id: 'PP-3Q8Z', dormId: 'd1', carrier: 'Wildberries', room: '214', student: 'Bekzat E.',
      phone: '0417', code: '8M3QT', status: 'picked_up', createdAt: t - 26 * 3600e3, pickedAt: t - 20 * 3600e3
    },
    {
      id: 'PP-9T4R', dormId: 'd2', carrier: 'Choco', room: '317', student: 'Aruzhan S.',
      phone: '0913', code: '7X2NP', status: 'in_hub', createdAt: t - 5 * 3600e3, pickedAt: null
    }
  ];

  const audit = [
    { id: 1, ts: t - 26 * 3600e3, actor: 'Courier', action: 'Check-in', parcelId: 'PP-3Q8Z', dormId: 'd1', detail: 'Wildberries · room 214' },
    { id: 2, ts: t - 20 * 3600e3, actor: 'Student', action: 'Pickup', parcelId: 'PP-3Q8Z', dormId: 'd1', detail: 'One-time QR scanned at hub · code used' },
    { id: 3, ts: t - 5 * 3600e3, actor: 'Courier', action: 'Check-in', parcelId: 'PP-9T4R', dormId: 'd2', detail: 'Choco · room 317' },
    { id: 4, ts: t - 2 * 3600e3, actor: 'Courier', action: 'Check-in', parcelId: 'PP-7K2M', dormId: 'd1', detail: 'Kaspi.kz Post · room 214' },
    { id: 5, ts: t - 2 * 3600e3 + 60e3, actor: 'System', action: 'Notification', parcelId: 'PP-7K2M', dormId: 'd1', detail: 'Telegram / SMS sent to room 214' }
  ];

  const notifications = [
    { id: 3, ts: t - 2 * 3600e3 + 60e3, dormId: 'd1', room: '214', parcelId: 'PP-7K2M', text: 'Kaspi.kz Post parcel PP-7K2M is waiting in the hub. Open your one-time QR.' },
    { id: 2, ts: t - 20 * 3600e3, dormId: 'd1', room: '214', parcelId: 'PP-3Q8Z', text: 'Parcel PP-3Q8Z picked up at the hub. Thank you!' },
    { id: 1, ts: t - 26 * 3600e3 + 45e3, dormId: 'd1', room: '214', parcelId: 'PP-3Q8Z', text: 'Wildberries parcel PP-3Q8Z is waiting in the hub. Open your one-time QR.' }
  ];

  return { parcels, audit, notifications, nextId: 6, currentStudent: { room: '214', phone: '0417' } };
}

let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.parcels) && Array.isArray(parsed.audit)) return parsed;
    }
  } catch (err) { /* localStorage unavailable — fall back to a fresh demo */ }
  return seedState();
}

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (err) { /* ignore */ }
}

function logEvent(actor, action, parcel, detail) {
  state.audit.push({ id: state.nextId++, ts: now(), actor, action, parcelId: parcel.id, dormId: parcel.dormId, detail });
}

function notify(parcel, text) {
  state.notifications.push({ id: state.nextId++, ts: now(), dormId: parcel.dormId, room: parcel.room, parcelId: parcel.id, text });
}

/* ------------------------------------------------------------------ toast */

let toastTimer = null;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3400);
}

/* ------------------------------------------------------------------ routing */

const VIEWS = ['overview', 'courier', 'student', 'audit'];

function showView(name) {
  if (!VIEWS.includes(name)) name = 'overview';
  VIEWS.forEach((view) => {
    $('#view-' + view).classList.toggle('hidden', view !== name);
  });
  $$('.nav-btn').forEach((btn) => btn.classList.toggle('is-active', btn.dataset.view === name));
  if (window.location.hash !== '#' + name) history.replaceState(null, '', '#' + name);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-view]');
  if (!trigger) return;
  event.preventDefault();
  showView(trigger.dataset.view);
});

window.addEventListener('hashchange', () => showView((window.location.hash || '#overview').slice(1)));

/* ------------------------------------------------------------------ forms */

function markInvalid(wrapperId, invalid) {
  const wrapper = $('#' + wrapperId);
  if (wrapper) wrapper.classList.toggle('invalid', invalid);
}

function digitsOnly(value) { return String(value || '').replace(/\D/g, ''); }

/* ------------------------------------------------------------------ courier */

function initCourierForm() {
  const dormSelect = $('#dorm');
  DORMS.forEach((dorm) => {
    const option = document.createElement('option');
    option.value = dorm.id;
    option.textContent = dorm.name + ' · ' + dorm.address;
    dormSelect.appendChild(option);
  });

  CARRIERS.forEach((carrier) => {
    const option = document.createElement('option');
    option.value = carrier;
    option.textContent = carrier;
    $('#carrier').appendChild(option);
  });

  $('#courierForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const dormId = dormSelect.value;
    const carrier = $('#carrier').value;
    const room = digitsOnly($('#room').value).slice(0, 4);
    const phone = digitsOnly($('#phone').value).slice(-4);
    const student = $('#student').value.trim();
    const count = Math.min(5, Math.max(1, parseInt($('#count').value, 10) || 1));

    markInvalid('f-dorm', !dormId);
    markInvalid('f-carrier', !carrier);
    markInvalid('f-room', room.length < 2);
    markInvalid('f-phone', phone.length !== 4);
    markInvalid('f-student', student.length < 2);

    const firstInvalid = $('.field.invalid input, .field.invalid select');
    if (firstInvalid) { firstInvalid.focus(); return; }

    const created = [];
    for (let i = 0; i < count; i++) {
      const parcel = {
        id: uid(),
        dormId,
        carrier,
        room,
        student,
        phone,
        code: pickupCode(),
        status: 'in_hub',
        createdAt: now(),
        pickedAt: null
      };
      state.parcels.push(parcel);
      created.push(parcel);
      logEvent('Courier', 'Check-in', parcel, carrier + ' · room ' + room + (count > 1 ? ' · batch ' + (i + 1) + '/' + count : ''));
      notify(parcel, carrier + ' parcel ' + parcel.id + ' is waiting in the hub. Open your one-time QR.');
      logEvent('System', 'Notification', parcel, 'Telegram / SMS sent to room ' + room);
    }

    saveState();
    renderAll();
    renderCheckinResult(created);
    toast('Checked in ' + created.length + (created.length === 1 ? ' parcel' : ' parcels') + ' for room ' + room + '.');
    $('#courierForm').reset();
    $$('#courierForm .field').forEach((field) => field.classList.remove('invalid'));
  });
}

function renderCheckinResult(created) {
  const box = $('#checkinResult');
  const latest = created[created.length - 1];
  const codeRows = created.map((p) => '<li><span>' + escapeHtml(p.id) + '</span><span class="mono">' + escapeHtml(p.code) + '</span></li>').join('');
  box.innerHTML = `
    <div class="qr-box">${qrSvg('PARCELPOINT|' + latest.id + '|' + latest.code)}</div>
    <div>
      <h3>${escapeHtml(latest.id)} checked in</h3>
      <p class="card-sub" style="margin-bottom:4px">${escapeHtml(latest.carrier)} · ${escapeHtml(dormName(latest.dormId))} · room ${escapeHtml(latest.room)}</p>
      <div class="code-line">ONE-TIME CODE ${escapeHtml(latest.code)}</div>
      <p class="card-sub" style="margin-bottom:0">A one-time pickup QR was sent to the student's Telegram / SMS (phone ••${escapeHtml(latest.phone)}).</p>
      <ul class="result-list">${codeRows}</ul>
      <div class="parcel-actions" style="margin-top:14px">
        <button class="btn small secondary" type="button" data-view="student">Open student view</button>
        <button class="btn small secondary" type="button" id="clearResult">Check in another</button>
      </div>
    </div>`;
  box.classList.remove('hidden');
  const clear = $('#clearResult');
  if (clear) clear.addEventListener('click', () => box.classList.add('hidden'));
}

/* ------------------------------------------------------------------ student */

function initStudentForm() {
  const roomInput = $('#s-room');
  const phoneInput = $('#s-phone');
  roomInput.value = state.currentStudent && state.currentStudent.room ? state.currentStudent.room : '214';
  phoneInput.value = state.currentStudent && state.currentStudent.phone ? state.currentStudent.phone : '0417';

  $('#studentForm').addEventListener('submit', (event) => {
    event.preventDefault();
    const room = digitsOnly(roomInput.value).slice(0, 4);
    const phone = digitsOnly(phoneInput.value).slice(-4);

    markInvalid('s-f-room', room.length < 2);
    markInvalid('s-f-phone', phone.length !== 4);
    const firstInvalid = $('.field.invalid input');
    if (firstInvalid) { firstInvalid.focus(); return; }

    state.currentStudent = { room, phone };
    saveState();
    const found = renderStudentParcelList(room, phone);
    renderNotificationFeed(room);
    if (found) toast('Found ' + found + (found === 1 ? ' parcel' : ' parcels') + ' for room ' + room + '.');
    else toast('No parcels in the hub for room ' + room + '.');
  });
}

function studentParcels(room, phone) {
  return state.parcels
    .filter((p) => p.room === room && p.phone === phone)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function renderStudentParcelList(room, phone) {
  const parcels = studentParcels(room, phone);
  const holder = $('#studentResults');
  const empty = $('#studentEmpty');
  holder.innerHTML = '';
  empty.classList.toggle('hidden', parcels.length > 0);
  holder.classList.toggle('hidden', parcels.length === 0);

  parcels.forEach((parcel) => {
    const inHub = parcel.status === 'in_hub';
    const article = document.createElement('article');
    article.className = 'parcel';
    article.innerHTML = `
      <div class="parcel-top">
        <span class="parcel-id">${escapeHtml(parcel.id)}</span>
        <span class="badge ${inHub ? 'hub' : 'done'}">${inHub ? 'In hub · awaiting pickup' : 'Picked up'}</span>
      </div>
      <dl>
        <dt>Carrier</dt><dd>${escapeHtml(parcel.carrier)}</dd>
        <dt>Dormitory</dt><dd>${escapeHtml(dormName(parcel.dormId))}</dd>
        <dt>Checked in</dt><dd>${escapeHtml(fmtTime(parcel.createdAt))} · ${escapeHtml(relTime(parcel.createdAt))}</dd>
        ${inHub ? '<dt>Pickup</dt><dd>One-time QR · single use</dd>' : '<dt>Picked up</dt><dd>' + escapeHtml(fmtTime(parcel.pickedAt)) + '</dd>'}
      </dl>
      <div class="parcel-actions">
        ${inHub
          ? '<button class="btn small primary" type="button" data-qr="' + escapeHtml(parcel.id) + '">Show pickup QR</button>' +
            '<button class="btn small secondary" type="button" data-resend="' + escapeHtml(parcel.id) + '">Resend notification</button>'
          : '<p class="note">This parcel has already been picked up. The hand-off is in the audit log.</p>'}
      </div>`;
    holder.appendChild(article);
  });

  $$('[data-qr]', holder).forEach((btn) => btn.addEventListener('click', () => openQr(btn.dataset.qr)));
  $$('[data-resend]', holder).forEach((btn) => btn.addEventListener('click', () => resendNotification(btn.dataset.resend)));
  return parcels.length;
}

function resendNotification(parcelId) {
  const parcel = state.parcels.find((p) => p.id === parcelId);
  if (!parcel) return;
  notify(parcel, parcel.carrier + ' parcel ' + parcel.id + ' is still waiting in the hub. Open your one-time QR.');
  logEvent('System', 'Notification', parcel, 'Reminder sent to room ' + parcel.room);
  saveState();
  renderAll();
  toast('Notification resent to room ' + parcel.room + '.');
}

/* ------------------------------------------------------------------ QR dialog */

let activeParcelId = null;

function openQr(parcelId) {
  const parcel = state.parcels.find((p) => p.id === parcelId);
  if (!parcel) return;
  activeParcelId = parcelId;
  const dialog = $('#qrDialog');
  const inHub = parcel.status === 'in_hub';

  $('#qrHolder').innerHTML = qrSvg('PARCELPOINT|' + parcel.id + '|' + parcel.code);
  $('#qrTitle').textContent = parcel.carrier + ' · ' + dormName(parcel.dormId);
  $('#qrCodeText').textContent = parcel.code;
  const scan = $('#scanBtn');
  scan.disabled = !inHub;
  scan.textContent = inHub ? 'Simulate scan at hub' : 'Already picked up';

  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function closeQr() {
  const dialog = $('#qrDialog');
  if (typeof dialog.close === 'function') dialog.close();
  else dialog.removeAttribute('open');
  activeParcelId = null;
}

function scanActiveParcel() {
  const parcel = state.parcels.find((p) => p.id === activeParcelId);
  if (!parcel || parcel.status !== 'in_hub') return;
  parcel.status = 'picked_up';
  parcel.pickedAt = now();
  logEvent('Student', 'Pickup', parcel, 'One-time QR scanned at hub · code used');
  notify(parcel, 'Parcel ' + parcel.id + ' picked up at the hub. Thank you!');
  saveState();
  closeQr();
  renderAll();
  toast('Parcel ' + parcel.id + ' picked up. Hand-off recorded in the audit log.');
}

/* ------------------------------------------------------------------ audit + feeds */

function auditorStats() {
  const inHub = state.parcels.filter((p) => p.status === 'in_hub').length;
  const picked = state.parcels.filter((p) => p.status === 'picked_up').length;
  return [
    { label: 'Parcels in hub', value: inHub },
    { label: 'Parcels picked up', value: picked },
    { label: 'Audit events recorded', value: state.audit.length }
  ];
}

function renderAuditStats() {
  const holder = $('#auditStats');
  holder.innerHTML = auditorStats().map((stat, index) =>
    '<div class="stat' + (index === 0 ? ' lime' : '') + '"><b>' + stat.value + '</b><span>' + escaped(stat.label) + '</span></div>'
  ).join('');
}

function escaped(text) { return escapeHtml(text); }

function renderAudit() {
  const filter = $('#auditDormFilter').value || 'all';
  const events = state.audit
    .filter((event) => filter === 'all' || event.dormId === filter)
    .slice()
    .sort((a, b) => b.ts - a.ts);

  $('#auditBody').innerHTML = events.map((event) =>
    '<tr>' +
      '<td class="mono">' + escapeHtml(fmtTime(event.ts)) + '</td>' +
      '<td>' + escapeHtml(event.actor) + '</td>' +
      '<td>' + escapeHtml(event.action) + '</td>' +
      '<td class="mono">' + escapeHtml(event.parcelId) + '</td>' +
      '<td>' + escapeHtml(dormName(event.dormId)) + '</td>' +
      '<td class="audit-detail">' + escapeHtml(event.detail) + '</td>' +
    '</tr>'
  ).join('');

  if (!events.length) {
    $('#auditBody').innerHTML = '<tr><td colspan="6" class="audit-detail" style="text-align:center;padding:24px">No events yet for this hub.</td></tr>';
  }
  renderAuditStats();
}

function renderCourierFeed() {
  const events = state.audit.slice().sort((a, b) => b.ts - a.ts).slice(0, 6);
  $('#courierFeed').innerHTML = events.length ? events.map((event) =>
    '<li>' +
      '<span class="bullet ' + (event.actor === 'Student' ? 'coral' : '') + '"></span>' +
      '<span class="feed-main"><strong>' + escapeHtml(event.parcelId) + ' · ' + escapeHtml(event.action) + '</strong>' +
      '<span>' + escapeHtml(dormName(event.dormId)) + ' · ' + escapeHtml(relTime(event.ts)) + '</span></span>' +
    '</li>'
  ).join('') : '<li class="empty">No hub activity yet.</li>';
}

function renderNotificationFeed(room) {
  const targetRoom = room || (state.currentStudent && state.currentStudent.room);
  const items = state.notifications
    .filter((item) => !targetRoom || item.room === targetRoom)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 6);

  $('#notificationFeed').innerHTML = items.length ? items.map((item) =>
    '<li><span class="bullet coral"></span><span class="feed-main"><strong>' + escapeHtml(item.text) + '</strong>' +
    '<span>' + escapeHtml(dormName(item.dormId)) + ' · ' + escapeHtml(relTime(item.ts)) + '</span></span></li>'
  ).join('') : '<li class="empty">No notifications for this student yet.</li>';
}

/* ------------------------------------------------------------------ render */

function renderAll() {
  renderCourierFeed();
  const room = state.currentStudent && state.currentStudent.room;
  if (room) {
    const phone = state.currentStudent.phone;
    renderStudentParcelList(room, phone);
  }
  renderNotificationFeed(room);
  renderAudit();
}

/* ------------------------------------------------------------------ misc */

function initAuditFilter() {
  const select = $('#auditDormFilter');
  const all = document.createElement('option');
  all.value = 'all';
  all.textContent = 'All dormitories';
  select.appendChild(all);
  DORMS.forEach((dorm) => {
    const option = document.createElement('option');
    option.value = dorm.id;
    option.textContent = dorm.name;
    select.appendChild(option);
  });
  select.addEventListener('change', renderAudit);
}

function downloadAudit() {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), audit: state.audit }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'parcelpoint-audit-log.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  toast('Audit log exported as JSON.');
}

function resetDemo() {
  if (!window.confirm('Reset the demo data? All check-ins and pickups made in this browser will be removed.')) return;
  state = seedState();
  saveState();
  $('#checkinResult').classList.add('hidden');
  $('#courierForm').reset();
  const room = $('#s-room');
  const phone = $('#s-phone');
  if (room) room.value = '214';
  if (phone) phone.value = '0417';
  renderAll();
  toast('Demo data restored.');
}

function initHeroQr() {
  const holder = $('#heroQr');
  if (holder) holder.outerHTML = qrSvg('PARCELPOINT|DEMO|PP-7K2M|4F9K2');
}

/* ------------------------------------------------------------------ boot */

function boot() {
  initCourierForm();
  initStudentForm();
  initAuditFilter();
  initHeroQr();
  renderAll();

  $('#scanBtn').addEventListener('click', scanActiveParcel);
  $('#closeQr').addEventListener('click', closeQr);
  $('#closeQr2').addEventListener('click', closeQr);
  $('#resetBtn').addEventListener('click', resetDemo);
  $('#downloadAudit').addEventListener('click', downloadAudit);
  $('#qrDialog').addEventListener('cancel', () => { activeParcelId = null; });

  showView((window.location.hash || '#overview').slice(1));
}

document.addEventListener('DOMContentLoaded', boot);
