// pages/attendance-page.js — Attendance Page (Morning + Subject)
import { getStudents } from '../modules/students.js';
import { saveMorningAttendance, getMorningAttendance, saveSubjectAttendance, getSubjectAttendance, calcAttendancePercent, getMorningAttendanceDates, getSubjectAttendanceDates, deleteMorningAttendance, deleteSubjectAttendance } from '../modules/attendance.js';
import { getSubjects, getSubjectsByTeacher, getSubjectsByClassRoom } from '../modules/subjects.js';
import { showToast, toDateKey, formatThaiDate, getStatusClasses, getStatusLabel, spinnerHTML, emptyHTML } from '../modules/utils.js';
import { currentUser, hasRole } from '../modules/auth.js';
import { getClassrooms } from '../modules/classes.js';

const STATUSES = ['present', 'late', 'absent', 'leave'];
const STATUS_LABELS = { present: 'มา', late: 'สาย', absent: 'ขาด', leave: 'ลา' };
const STATUS_BG = {
  present: 'bg-green-100 text-green-800 border-green-300 ring-green-400',
  late:    'bg-yellow-100 text-yellow-800 border-yellow-300 ring-yellow-400',
  absent:  'bg-red-100 text-red-800 border-red-300 ring-red-400',
  leave:   'bg-blue-100 text-blue-800 border-blue-300 ring-blue-400',
};

export async function renderAttendancePage(container, userData) {
  const isHomeroom = hasRole(userData, 'homeroom_teacher') || hasRole(userData, 'admin');
  const isSubjectTeacher = hasRole(userData, 'subject_teacher') || hasRole(userData, 'admin');

  container.innerHTML = `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">ระบบเช็คชื่อ</h1>
        <p class="text-sm text-gray-500 mt-0.5">วันที่ ${formatThaiDate(new Date())}</p>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        ${isHomeroom ? `<button id="tab-morning" class="tab-btn px-5 py-2 rounded-lg text-sm font-medium transition bg-white shadow text-indigo-700">เช็คชื่อเช้า</button>` : ''}
        ${isSubjectTeacher ? `<button id="tab-subject" class="tab-btn px-5 py-2 rounded-lg text-sm font-medium transition text-gray-500 hover:text-gray-700">เช็คชื่อรายวิชา</button>` : ''}
      </div>

      <div id="attendance-content">${spinnerHTML()}</div>
    </div>`;

  const classrooms = await getClassrooms();
  let activeTab = isHomeroom ? 'morning' : 'subject';
  
  if (isHomeroom)       document.getElementById('tab-morning')?.addEventListener('click', () => switchTab('morning'));
  if (isSubjectTeacher) document.getElementById('tab-subject')?.addEventListener('click', () => switchTab('subject'));

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.remove('bg-white', 'shadow', 'text-indigo-700');
      b.classList.add('text-gray-500', 'hover:text-gray-700');
    });
    const active = document.getElementById(`tab-${tab}`);
    if (active) {
      active.classList.add('bg-white', 'shadow', 'text-indigo-700');
      active.classList.remove('text-gray-500', 'hover:text-gray-700');
    }
    if (tab === 'morning') renderMorning();
    else renderSubject();
  }

  // ───────────────────────── MORNING ──────────────────────────────────────────
  async function renderMorning() {
    const content = document.getElementById('attendance-content');
    content.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div class="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div class="flex-1 flex gap-3 flex-wrap">
            ${hasRole(userData, 'admin') ? `
              <select id="morning-class" class="px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="">เลือกห้อง</option>
                ${classrooms.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>` : `<div class="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-medium">${userData.classRoom}</div>`}
            <input type="date" id="morning-date" value="${toDateKey()}"
              class="px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
          <div class="flex gap-2">
            <button id="btn-all-present" class="px-4 py-2 rounded-xl bg-green-500 text-white text-sm font-medium hover:bg-green-600 transition shadow-sm flex items-center gap-1.5">✓ มาทุกคน</button>
            <button id="btn-save-morning" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm flex items-center gap-1.5">💾 บันทึก</button>
            <button id="btn-delete-morning" class="hidden px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition shadow-sm flex items-center gap-1.5">🗑️ ลบข้อมูล</button>
          </div>
        </div>
        <div id="morning-history" class="mb-4"></div>
        <div id="morning-list">${emptyHTML('เลือกห้องเรียนเพื่อแสดงรายชื่อ')}</div>
      </div>`;

    let students = [];
    let statusMap = {};

    async function loadMorningStudents() {
      const cls = hasRole(userData, 'admin') ? document.getElementById('morning-class')?.value : userData.classRoom;
      const date = document.getElementById('morning-date').value;
      if (!cls) return;

      document.getElementById('morning-list').innerHTML = spinnerHTML();
      loadHistory('morning', cls);

      students = await getStudents(cls);
      const existing = await getMorningAttendance(date, cls);
      statusMap = {};
      students.forEach(s => { statusMap[s.id] = existing?.records?.[s.id] || 'present'; });
      renderMorningList();

      const deleteBtn = document.getElementById('btn-delete-morning');
      if (deleteBtn) {
        if (existing) deleteBtn.classList.remove('hidden');
        else deleteBtn.classList.add('hidden');
      }
    }

    function renderMorningList() {
      const el = document.getElementById('morning-list');
      if (!students.length) { el.innerHTML = emptyHTML('ไม่พบนักเรียนในห้องนี้'); return; }
      el.innerHTML = `
        <div class="space-y-2">
          ${students.map(s => `
            <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group overflow-x-auto custom-scrollbar">
              <div class="flex-shrink-0 text-xs text-gray-400 font-mono w-6 text-center">${s.number || '?'}</div>
              <div class="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                ${s.photoUrl ? `<img src="${s.photoUrl}" class="w-full h-full object-cover" alt=""/>` : 
                  `<div class="w-full h-full flex items-center justify-center text-gray-300">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                  </div>`}
              </div>
              <div class="flex-shrink-0 min-w-[140px]">
                <div class="font-semibold text-gray-800 truncate">${s.firstName} ${s.lastName}</div>
                <div class="text-xs text-gray-400">รหัส ${s.studentCode}</div>
              </div>
              <div class="flex gap-1.5 ml-auto pl-4">
                ${STATUSES.map(st => `
                  <button data-status="${st}" data-sid="${s.id}"
                    class="status-btn px-3 py-1.5 rounded-lg border text-xs font-medium transition
                    ${statusMap[s.id] === st ? STATUS_BG[st] + ' ring-2' : 'bg-gray-50 text-gray-500 border-gray-200'}">
                    ${STATUS_LABELS[st]}
                  </button>`).join('')}
              </div>
            </div>`).join('')}
        </div>`;

      el.querySelectorAll('.status-btn').forEach(btn => {
        btn.onclick = () => {
          const sid = btn.dataset.sid;
          const st  = btn.dataset.status;
          statusMap[sid] = st;
          el.querySelectorAll(`[data-sid="${sid}"]`).forEach(b => {
            const isActive = b.dataset.status === st;
            b.className = `status-btn px-3 py-1.5 rounded-lg border text-xs font-medium transition ${isActive ? STATUS_BG[b.dataset.status] + ' ring-2' : 'bg-gray-50 text-gray-500 border-gray-200'}`;
          });
        };
      });
    }

    document.getElementById('btn-all-present').onclick = () => {
      students.forEach(s => { statusMap[s.id] = 'present'; });
      renderMorningList();
    };

    document.getElementById('btn-save-morning').onclick = async () => {
      const cls  = hasRole(userData, 'admin') ? document.getElementById('morning-class')?.value : userData.classRoom;
      const date = document.getElementById('morning-date').value;
      try {
        await saveMorningAttendance(date, cls, statusMap, currentUser().uid);
        showToast('บันทึกเรียบร้อย ✓', 'success');
        loadHistory('morning', cls);
        loadMorningStudents();
      } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    };

    document.getElementById('btn-delete-morning').onclick = async () => {
      const cls  = hasRole(userData, 'admin') ? document.getElementById('morning-class')?.value : userData.classRoom;
      const date = document.getElementById('morning-date').value;
      if (!confirm(`คุณต้องการลบข้อมูลการเช็คชื่อเช้าของวันที่ ${formatThaiDate(new Date(date))} หรือไม่?`)) return;
      try {
        await deleteMorningAttendance(date, cls);
        showToast('ลบข้อมูลเช็คชื่อเช้าเรียบร้อย ✓', 'success');
        loadMorningStudents();
      } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    };

    const clsEl = document.getElementById('morning-class');
    if (clsEl) clsEl.onchange = loadMorningStudents;
    document.getElementById('morning-date').onchange = loadMorningStudents;
    loadMorningStudents();
  }

  // ───────────────────────── SUBJECT ──────────────────────────────────────────
  async function renderSubject() {
    const content = document.getElementById('attendance-content');
    content.innerHTML = `
      <div class="space-y-4">
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <select id="subject-select" class="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
            <option value="">-- เลือกรายวิชา --</option>
          </select>
          <input type="date" id="subject-date" value="${toDateKey()}"
            class="px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          <button id="btn-save-subject" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">💾 บันทึก</button>
          <button id="btn-delete-subject" class="hidden px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition shadow-sm flex items-center gap-1.5">🗑️ ลบข้อมูล</button>
        </div>
        <div id="subject-history" class="mb-4"></div>
        <div id="subject-list" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">${spinnerHTML('กำลังโหลดรายวิชา...')}</div>
      </div>`;

    let subjects = hasRole(userData, 'admin') ? await getSubjects() : await getSubjectsByTeacher(currentUser().uid);
    const sel = document.getElementById('subject-select');
    subjects.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id; opt.textContent = `${s.code} - ${s.name}`;
      sel.appendChild(opt);
    });
    document.getElementById('subject-list').innerHTML = emptyHTML('เลือกรายวิชาเพื่อแสดงรายชื่อ');

    let subjStatusMap = {};

    async function loadSubjectStudents() {
      const sid = sel.value;
      const date = document.getElementById('subject-date').value;
      if (!sid) return;
      
      const el = document.getElementById('subject-list');
      el.innerHTML = spinnerHTML();
      loadHistory('subject', sid);

      const subject = subjects.find(s => s.id === sid);
      let students = [];
      if (subject.classRooms?.length) {
        const arr = await Promise.all(subject.classRooms.map(cr => getStudents(cr)));
        students = arr.flat();
      } else {
        students = await getStudents();
      }

      // Fetch morning attendance for classrooms of this subject
      const morningDataMap = {}; // { classRoom: { records } }
      if (subject.classRooms?.length) {
        const morningSnaps = await Promise.all(subject.classRooms.map(cr => getMorningAttendance(date, cr)));
        subject.classRooms.forEach((cr, i) => {
          if (morningSnaps[i]) morningDataMap[cr] = morningSnaps[i];
        });
      }

      const existing = await getSubjectAttendance(sid, date);
      subjStatusMap = {};
      students.forEach(s => { subjStatusMap[s.id] = existing?.records?.[s.id] || 'present'; });
      const percents = await Promise.all(students.map(s => calcAttendancePercent(s.id, sid)));

      const deleteBtn = document.getElementById('btn-delete-subject');
      if (deleteBtn) {
        if (existing) deleteBtn.classList.remove('hidden');
        else deleteBtn.classList.add('hidden');
      }

      el.innerHTML = `
        <div class="space-y-2">
          ${students.map((s, idx) => {
            const pct = percents[idx];
            const failed = pct !== null && pct < 80;
            const morningStatus = morningDataMap[s.classRoom]?.records?.[s.id];

            return `
              <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition group overflow-x-auto custom-scrollbar
                ${failed ? 'bg-red-50 border border-red-200' : ''}">
                <div class="flex-shrink-0 text-xs text-gray-400 font-mono w-6 text-center">${s.number || idx + 1}</div>
                <div class="flex-shrink-0 w-9 h-9 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                  ${s.photoUrl ? `<img src="${s.photoUrl}" class="w-full h-full object-cover" alt=""/>` : 
                    `<div class="w-full h-full flex items-center justify-center text-gray-300">
                      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                    </div>`}
                </div>
                <div class="flex-shrink-0 min-w-[140px]">
                  <div class="font-semibold text-gray-800 truncate">${s.firstName} ${s.lastName}</div>
                  <div class="flex items-center gap-2 mt-0.5">
                    <span class="text-xs text-gray-400">รหัส ${s.studentCode}</span>
                    ${morningStatus ? `
                      <span class="text-[10px] px-1.5 py-0.5 rounded-full border ${getStatusClasses(morningStatus)}">
                        เช้า: ${getStatusLabel(morningStatus)}
                      </span>` : ''}
                    ${pct !== null ? `<span class="text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${failed ? 'bg-red-600 text-white' : 'bg-green-100 text-green-700'}">${failed ? '❌ หมดสิทธิ์' : `${pct}%`}</span>` : ''}
                  </div>
                </div>
                <div class="flex gap-1.5 ml-auto pl-4">
                  ${STATUSES.map(st => `
                    <button data-status="${st}" data-sid="${s.id}"
                      class="subj-status-btn px-3 py-1.5 rounded-lg border text-xs font-medium transition
                      ${subjStatusMap[s.id] === st ? STATUS_BG[st] + ' ring-2' : 'bg-gray-50 text-gray-500 border-gray-200'}">
                      ${STATUS_LABELS[st]}
                    </button>`).join('')}
                </div>
              </div>`;
          }).join('')}
        </div>`;

      el.querySelectorAll('.subj-status-btn').forEach(btn => {
        btn.onclick = () => {
          const sid2 = btn.dataset.sid;
          const st   = btn.dataset.status;
          subjStatusMap[sid2] = st;
          el.querySelectorAll(`[data-sid="${sid2}"]`).forEach(b => {
            const isActive = b.dataset.status === st;
            b.className = `subj-status-btn px-3 py-1.5 rounded-lg border text-xs font-medium transition ${isActive ? STATUS_BG[b.dataset.status] + ' ring-2' : 'bg-gray-50 text-gray-500 border-gray-200'}`;
          });
        };
      });
    }

    sel.onchange = loadSubjectStudents;
    document.getElementById('subject-date').onchange = loadSubjectStudents;
    document.getElementById('btn-save-subject').onclick = async () => {
      const sid  = sel.value;
      const date = document.getElementById('subject-date').value;
      try {
        await saveSubjectAttendance(sid, date, subjStatusMap, currentUser().uid);
        showToast('บันทึกเรียบร้อย ✓', 'success');
        loadHistory('subject', sid); // Refresh history list
        loadSubjectStudents();
      } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    };

    document.getElementById('btn-delete-subject').onclick = async () => {
      const sid  = sel.value;
      const date = document.getElementById('subject-date').value;
      if (!confirm(`คุณต้องการลบข้อมูลการเช็คชื่อวิชาของวันที่ ${formatThaiDate(new Date(date))} หรือไม่?`)) return;
      try {
        await deleteSubjectAttendance(sid, date);
        showToast('ลบข้อมูลเช็คชื่อรายวิชาเรียบร้อย ✓', 'success');
        loadSubjectStudents();
      } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    };
  }

  // ───────────────────────── HISTORY HELPER ────────────────────────────────────
  async function loadHistory(type, id) {
    const histEl = document.getElementById(`${type}-history`);
    if (!id) { histEl.innerHTML = ''; return; }
    
    histEl.innerHTML = `<div class="text-[10px] text-gray-400 animate-pulse">กำลังโหลดประวัติ...</div>`;
    try {
      const dates = type === 'morning' ? await getMorningAttendanceDates(id) : await getSubjectAttendanceDates(id);
      
      if (!dates.length) { 
        histEl.innerHTML = `
          <div class="text-[10px] text-gray-400 py-2 border-b border-gray-50 flex items-center gap-2">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            ยังไม่มีประวัติการเช็คชื่อในห้อง/วิชานี้
          </div>`;
        return; 
      }

      histEl.innerHTML = `
        <div class="bg-gray-50/50 rounded-xl p-3 mb-4 border border-gray-100">
          <div class="flex items-center gap-2 mb-2 text-indigo-700">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            <span class="text-xs font-bold uppercase tracking-wider">ประวัติการเช็คชื่อ (30 วันล่าสุด)</span>
          </div>
          <div class="flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
            ${dates.map(d => `
              <div class="flex-shrink-0 inline-flex items-center bg-white border border-gray-200 rounded-xl shadow-sm hover:border-indigo-400 overflow-hidden">
                <button class="hist-date-btn px-3 py-1.5 text-xs text-gray-600 hover:text-indigo-700 transition font-medium" data-date="${d}">
                  ${formatThaiDate(new Date(d))}
                </button>
                <button class="hist-delete-btn p-1.5 text-gray-400 hover:text-red-600 border-l border-gray-100 transition" data-date="${d}">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>`).join('')}
          </div>
          <p class="text-[10px] text-gray-400 mt-2">* คลิกวันที่ด้านบนเพื่อดู/แก้ไข หรือคลิกถังขยะเพื่อลบประวัติ</p>
        </div>`;
    } catch (e) {
      console.error(e);
      histEl.innerHTML = `<div class="text-[10px] text-red-400 py-2">ไม่สามารถโหลดประวัติได้: ${e.message}</div>`;
    }
    
    histEl.querySelectorAll('.hist-date-btn').forEach(btn => {
      btn.onclick = () => {
        const dateInput = document.getElementById(`${type}-date`);
        dateInput.value = btn.dataset.date;
        dateInput.dispatchEvent(new Event('change'));
      };
    });

    histEl.querySelectorAll('.hist-delete-btn').forEach(btn => {
      btn.onclick = async () => {
        const date = btn.dataset.date;
        if (!confirm(`คุณต้องการลบข้อมูลการเช็คชื่อวันที่ ${formatThaiDate(new Date(date))} หรือไม่?`)) return;
        try {
          if (type === 'morning') {
            await deleteMorningAttendance(date, id);
            showToast('ลบข้อมูลเช็คชื่อเช้าเรียบร้อย ✓', 'success');
            document.getElementById('morning-date').dispatchEvent(new Event('change'));
          } else {
            await deleteSubjectAttendance(id, date);
            showToast('ลบข้อมูลเช็คชื่อรายวิชาเรียบร้อย ✓', 'success');
            document.getElementById('subject-date').dispatchEvent(new Event('change'));
          }
        } catch (e) {
          showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
        }
      };
    });
  }

  switchTab(activeTab);
}
