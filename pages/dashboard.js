// pages/dashboard.js — Dashboard Page
import { getStudents } from '../modules/students.js';
import { getTodayStats, getAtRiskStudents } from '../modules/reports.js';
import { toDateKey, formatThaiDate, spinnerHTML, emptyHTML, getStatusBadge, roleBadge } from '../modules/utils.js';
import { hasRole } from '../modules/auth.js';

export async function renderDashboard(container, userData) {
  const today = toDateKey();
  const classRoom = userData.classRoom || null;

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">แดชบอร์ด</h1>
          <p class="text-sm text-gray-500 mt-0.5">ข้อมูล ณ วันที่ ${formatThaiDate(new Date())}</p>
        </div>
        <div class="flex flex-wrap gap-1">
          ${(userData.roles || [userData.role] || []).map(r => roleBadge(r)).join('')}
        </div>
      </div>

      <!-- Stat Cards -->
      <div id="stat-cards" class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        ${spinnerHTML('กำลังโหลดสถิติ...')}
      </div>

      <!-- Charts row -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Weekly Bar Chart -->
        <div class="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 class="text-base font-semibold text-gray-700 mb-4">สถิติเช็คชื่อ 7 วันล่าสุด</h2>
          <div id="weekly-chart" class="h-40 flex items-end gap-2">
            ${spinnerHTML()}
          </div>
          <div class="flex gap-4 mt-4 flex-wrap text-xs text-gray-500">
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-green-400 inline-block"></span>มา</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-yellow-400 inline-block"></span>สาย</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-red-400 inline-block"></span>ขาด</span>
            <span class="flex items-center gap-1.5"><span class="w-3 h-3 rounded bg-blue-400 inline-block"></span>ลา</span>
          </div>
        </div>

        <!-- Donut -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center">
          <h2 class="text-base font-semibold text-gray-700 mb-4 self-start">วันนี้</h2>
          <div id="donut-chart" class="flex flex-col items-center gap-2">${spinnerHTML()}</div>
        </div>
      </div>

      <!-- At-Risk Students -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 class="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-red-500 inline-block animate-pulse"></span>
          นักเรียนกลุ่มเสี่ยง
        </h2>
        <div id="at-risk-list">${spinnerHTML()}</div>
      </div>
    </div>
  `;

  // Load data
  await loadDashboardData(userData, today, classRoom);
}

async function loadDashboardData(userData, today, classRoom) {
  try {
    // Load today stats
    const stats = await getTodayStats(classRoom || 'ม.1/1', today);
    renderStatCards(stats);
    renderDonut(stats);

    // Load 7-day chart
    await renderWeeklyChart(classRoom || 'ม.1/1');

    // At-risk students
    await renderAtRisk(classRoom || 'ม.1/1');
  } catch (e) {
    console.error('Dashboard load error:', e);
  }
}

function renderStatCards(stats) {
  const cards = [
    { label: 'มา', value: stats.present, color: 'from-green-400 to-green-600', icon: '✓', bg: 'bg-green-50' },
    { label: 'สาย', value: stats.late,    color: 'from-yellow-400 to-yellow-600', icon: '⏱', bg: 'bg-yellow-50' },
    { label: 'ขาด', value: stats.absent,  color: 'from-red-400 to-red-600', icon: '✗', bg: 'bg-red-50' },
    { label: 'ลา',  value: stats.leave,   color: 'from-blue-400 to-blue-600', icon: '📋', bg: 'bg-blue-50' },
  ];
  const el = document.getElementById('stat-cards');
  if (el) el.innerHTML = cards.map(c => `
    <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div class="w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white text-xl shadow">
        ${c.icon}
      </div>
      <div>
        <p class="text-3xl font-bold text-gray-800">${c.value}</p>
        <p class="text-sm text-gray-500">${c.label}วันนี้</p>
      </div>
    </div>
  `).join('');
}

function renderDonut(stats) {
  const total = stats.present + stats.late + stats.absent + stats.leave || 1;
  const items = [
    { label: 'มา',   value: stats.present, color: '#4ade80' },
    { label: 'สาย',  value: stats.late,    color: '#facc15' },
    { label: 'ขาด',  value: stats.absent,  color: '#f87171' },
    { label: 'ลา',   value: stats.leave,   color: '#60a5fa' },
  ];
  const pct = v => Math.round((v / total) * 100);
  const el = document.getElementById('donut-chart');
  if (el) el.innerHTML = `
    <div class="relative w-32 h-32">
      <svg viewBox="0 0 36 36" class="w-32 h-32 -rotate-90">
        ${buildDonutSegments(items, total)}
      </svg>
      <div class="absolute inset-0 flex items-center justify-center flex-col">
        <span class="text-2xl font-bold text-gray-800">${total}</span>
        <span class="text-xs text-gray-400">คน</span>
      </div>
    </div>
    <div class="grid grid-cols-2 gap-2 mt-2 w-full">
      ${items.map(i => `
        <div class="flex items-center gap-1.5 text-xs text-gray-600">
          <span class="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style="background:${i.color}"></span>
          ${i.label}: <strong>${pct(i.value)}%</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function buildDonutSegments(items, total) {
  const colors = items.map(i => i.color);
  let offset = 0;
  return items.map((item, idx) => {
    const pct = total > 0 ? (item.value / total) * 100 : 0;
    const seg = `<circle cx="18" cy="18" r="15.9155"
      fill="none" stroke="${colors[idx]}" stroke-width="3.5"
      stroke-dasharray="${pct} ${100 - pct}"
      stroke-dashoffset="${-offset}" />`;
    offset += pct;
    return seg;
  }).join('');
}

async function renderWeeklyChart(classRoom) {
  const { getMorningAttendanceRange } = await import('../modules/attendance.js');
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  const [start, end] = [days[0], days[days.length - 1]];
  const records = await getMorningAttendanceRange(classRoom, start, end);
  const byDate = {};
  records.forEach(r => { byDate[r.date] = r; });

  const dayStats = days.map(d => {
    const r = byDate[d];
    if (!r) return { d, present: 0, late: 0, absent: 0, leave: 0, total: 0 };
    const stats = { present: 0, late: 0, absent: 0, leave: 0 };
    Object.values(r.records || {}).forEach(s => { if (stats[s] !== undefined) stats[s]++; });
    return { d, ...stats, total: stats.present + stats.late + stats.absent + stats.leave };
  });

  const maxVal = Math.max(...dayStats.map(s => s.total), 1);
  const thLabels = ['อา','จ','อ','พ','พฤ','ศ','ส'];

  const el = document.getElementById('weekly-chart');
  if (el) el.innerHTML = `
    <div class="flex items-end gap-1.5 w-full h-full">
      ${dayStats.map(s => {
        const dayName = thLabels[new Date(s.d).getDay()];
        const hPresent = (s.present / maxVal) * 100;
        const hLate    = (s.late    / maxVal) * 100;
        const hAbsent  = (s.absent  / maxVal) * 100;
        const hLeave   = (s.leave   / maxVal) * 100;
        const isToday  = s.d === toDateKey();
        return `
          <div class="flex-1 flex flex-col items-center gap-1">
            <div class="w-full flex flex-col-reverse rounded overflow-hidden" style="height:120px">
              <div class="w-full bg-green-400 transition-all" style="height:${hPresent}%"></div>
              <div class="w-full bg-yellow-400 transition-all" style="height:${hLate}%"></div>
              <div class="w-full bg-red-400 transition-all" style="height:${hAbsent}%"></div>
              <div class="w-full bg-blue-400 transition-all" style="height:${hLeave}%"></div>
            </div>
            <span class="text-xs ${isToday ? 'font-bold text-indigo-600' : 'text-gray-400'}">${dayName}</span>
          </div>`;
      }).join('')}
    </div>`;
}

async function renderAtRisk(classRoom) {
  const risks = await getAtRiskStudents(classRoom);
  const el = document.getElementById('at-risk-list');
  if (!el) return;
  if (!risks.length) { el.innerHTML = `<div class="text-center py-8 text-gray-400 text-sm">🎉 ไม่มีนักเรียนกลุ่มเสี่ยงในขณะนี้</div>`; return; }
  el.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-gray-500 border-b border-gray-100">
            <th class="pb-3 font-semibold">นักเรียน</th>
            <th class="pb-3 font-semibold">ห้อง</th>
            <th class="pb-3 font-semibold">สาเหตุ</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-50">
          ${risks.map(r => `
            <tr class="hover:bg-red-50 transition-colors">
              <td class="py-3">
                <div class="font-medium text-gray-800">${r.student.firstName} ${r.student.lastName}</div>
                <div class="text-xs text-gray-400">รหัส ${r.student.studentCode}</div>
              </td>
              <td class="py-3 text-gray-600">${r.student.classRoom}</td>
              <td class="py-3">
                ${r.reasons.map(reason => `<span class="inline-block px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700 mr-1 mb-1">${reason}</span>`).join('')}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>`;
}
