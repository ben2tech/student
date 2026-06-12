// pages/behavior-page.js — Behavior Recording & Approval
import { getStudents, getStudent } from '../modules/students.js';
import { getCriteria, recordBehavior, getStudentBehaviorRecords, deleteBehaviorRecord, getStudentBehaviorScore, getPendingBehaviorRecords, approveBehaviorRecord, rejectBehaviorRecord } from '../modules/behavior.js';
import { showToast, showConfirm, formatThaiDate, spinnerHTML, emptyHTML, roleLabel } from '../modules/utils.js';
import { currentUser, hasRole } from '../modules/auth.js';
import { getClassrooms } from '../modules/classes.js';

export async function renderBehaviorPage(container, userData) {
  const isStudentAffairs = hasRole(userData, 'student_affairs') || hasRole(userData, 'admin');
  const classrooms = await getClassrooms();

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">ระบบพฤติกรรม</h1>
          <p class="text-sm text-gray-500 mt-0.5">บันทึกและตรวจสอบคะแนนความประพฤติ</p>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        <button id="tab-record" class="beh-tab px-5 py-2 rounded-lg text-sm font-medium transition bg-white shadow text-indigo-700">บันทึกพฤติกรรม</button>
        ${isStudentAffairs ? `<button id="tab-approve" class="beh-tab px-5 py-2 rounded-lg text-sm font-medium transition text-gray-500 hover:text-gray-700 flex items-center gap-2">
          อนุมัติคะแนน
          <span id="pending-count" class="hidden px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-bold">0</span>
        </button>` : ''}
      </div>

      <div id="behavior-content"></div>
    </div>`;

  let activeTab = 'record';
  
  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.beh-tab').forEach(b => {
      b.classList.remove('bg-white', 'shadow', 'text-indigo-700');
      b.classList.add('text-gray-500', 'hover:text-gray-700');
    });
    document.getElementById(`tab-${tab}`).classList.add('bg-white', 'shadow', 'text-indigo-700');
    document.getElementById(`tab-${tab}`).classList.remove('text-gray-500', 'hover:text-gray-700');

    if (tab === 'record') renderRecordView();
    else renderApproveView();
  }

  document.getElementById('tab-record').onclick = () => switchTab('record');
  if (isStudentAffairs) {
    document.getElementById('tab-approve').onclick = () => switchTab('approve');
    updatePendingCount();
  }

  async function updatePendingCount() {
    const pending = await getPendingBehaviorRecords();
    const badge = document.getElementById('pending-count');
    if (badge) {
      badge.textContent = pending.length;
      badge.classList.toggle('hidden', pending.length === 0);
    }
  }

  // ───────────────────────── RECORD VIEW ───────────────────────────────────────
  async function renderRecordView() {
    const content = document.getElementById('behavior-content');
    content.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div class="lg:col-span-2 space-y-4">
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h2 class="font-semibold text-gray-700">เลือกนักเรียน</h2>
            ${hasRole(userData, 'admin') ? `
              <select id="behavior-class" class="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                <option value="">เลือกห้องเรียน</option>
                ${classrooms.map(c => `<option value="${c}">${c}</option>`).join('')}
              </select>` : `<div class="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-700 text-sm font-medium">${userData.classRoom || 'ไม่ระบุห้อง'}</div>`}
            <input id="student-search" type="text" placeholder="ค้นหาชื่อ..." class="w-full px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
            <div id="student-list" class="max-h-64 overflow-y-auto space-y-1.5 pr-1">${emptyHTML('โปรดเลือกห้องเรียน')}</div>
          </div>
        </div>
        <div class="lg:col-span-3 space-y-4">
          <div id="selected-student-card" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hidden">
             <div class="flex items-start justify-between">
               <div>
                 <h2 id="sel-student-name" class="text-lg font-bold text-gray-800"></h2>
                 <p id="sel-student-info" class="text-sm text-gray-500 mt-0.5"></p>
               </div>
               <div class="text-right"><div class="text-2xl font-bold" id="sel-behavior-score">0</div><div class="text-xs text-gray-400">คะแนนสะสม</div></div>
             </div>
          </div>
          <div id="criteria-panel" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hidden space-y-3">
            <h2 class="font-semibold text-gray-700">เลือกพฤติกรรม</h2>
            <div id="criteria-list" class="grid grid-cols-1 sm:grid-cols-2 gap-2"></div>
            <input id="behavior-note" type="text" placeholder="หมายเหตุ (ไม่บังคับ)..." class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
            <button id="btn-record-behavior" disabled class="w-full py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-40 shadow-sm">บันทึก (รออนุมัติ)</button>
          </div>
          <div id="behavior-history" class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hidden">
            <h2 class="font-semibold text-gray-700 mb-3">ประวัติพฤติกรรมล่าสุด</h2>
            <div id="behavior-history-list"></div>
          </div>
        </div>
      </div>`;

    let allStudents = [];
    let selectedStudent = null;
    let selectedCriteriaId = null;
    const allCriteria = await getCriteria();

    async function loadStudents(cls) {
      if (!cls) return;
      document.getElementById('student-list').innerHTML = spinnerHTML();
      allStudents = await getStudents(cls);
      renderStudentList(allStudents);
    }

    function renderStudentList(students) {
      const el = document.getElementById('student-list');
      if (!students.length) { el.innerHTML = emptyHTML('ไม่พบนักเรียน'); return; }
      el.innerHTML = students.map(s => `
        <button data-sid="${s.id}" class="student-pick-btn w-full text-left px-3.5 py-2.5 rounded-xl border border-gray-50 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50 transition flex items-center gap-2.5">
          <div class="w-7 h-7 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">${s.number || '?'}</div>
          <div class="text-sm font-semibold text-gray-800">${s.firstName} ${s.lastName}</div>
        </button>`).join('');
      el.querySelectorAll('.student-pick-btn').forEach(btn => {
        btn.onclick = () => selectStudent(allStudents.find(s => s.id === btn.dataset.sid));
      });
    }

    async function selectStudent(student) {
      selectedStudent = student; selectedCriteriaId = null;
      document.getElementById('selected-student-card').classList.remove('hidden');
      document.getElementById('criteria-panel').classList.remove('hidden');
      document.getElementById('behavior-history').classList.remove('hidden');
      document.getElementById('sel-student-name').textContent = `${student.firstName} ${student.lastName}`;
      document.getElementById('sel-student-info').textContent = `รหัส ${student.studentCode} · ห้อง ${student.classRoom}`;
      
      const score = await getStudentBehaviorScore(student.id);
      const scoreEl = document.getElementById('sel-behavior-score');
      scoreEl.textContent = (score >= 0 ? '+' : '') + score;
      scoreEl.className = `text-2xl font-bold ${score < 0 ? 'text-red-600' : 'text-green-600'}`;
      
      renderCriteriaButtons();
      loadHistory(student.id);
    }

    function renderCriteriaButtons() {
      const el = document.getElementById('criteria-list');
      el.innerHTML = allCriteria.map(c => `
        <button data-cid="${c.id}" class="criteria-btn text-left p-3 rounded-xl border-2 transition 
          ${c.category === 'positive' ? 'border-green-100 bg-green-50/50 hover:border-green-300' : 'border-red-100 bg-red-50/50 hover:border-red-300'}
          ${selectedCriteriaId === c.id ? (c.category === 'positive' ? 'border-green-500 bg-green-100' : 'border-red-500 bg-red-100') : ''}">
          <div class="text-xs font-bold text-gray-800">${c.name}</div>
          <div class="text-[11px] font-bold ${c.category === 'positive' ? 'text-green-700' : 'text-red-700'}">${c.score > 0 ? '+' : ''}${c.score}</div>
        </button>`).join('');
      el.querySelectorAll('.criteria-btn').forEach(btn => {
        btn.onclick = () => { selectedCriteriaId = btn.dataset.cid; document.getElementById('btn-record-behavior').disabled = false; renderCriteriaButtons(); };
      });
    }

    async function loadHistory(sid) {
      const el = document.getElementById('behavior-history-list');
      el.innerHTML = spinnerHTML();
      const records = await getStudentBehaviorRecords(sid);
      if (!records.length) { el.innerHTML = emptyHTML('ไม่มีประวัติ'); return; }
      el.innerHTML = `<div class="space-y-2">${records.map(r => `
        <div class="flex items-center gap-3 p-3 rounded-xl ${r.category === 'positive' ? 'bg-green-50' : 'bg-red-50'} relative">
          <div class="flex-1 min-w-0">
            <div class="text-sm font-semibold">${r.criteriaName}</div>
            <div class="text-[10px] text-gray-400">${formatThaiDate(r.date)} · ${r.status === 'pending' ? '⏳ รออนุมัติ' : r.status === 'approved' ? '✅ อนุมัติแล้ว' : '❌ ปฏิเสธ'}</div>
          </div>
          <div class="font-bold ${r.category === 'positive' ? 'text-green-700' : 'text-red-700'}">${r.score > 0 ? '+' : ''}${r.score}</div>
          ${r.status === 'pending' ? `<button data-rid="${r.id}" class="del-record text-red-400 hover:text-red-600 text-lg leading-none ml-2">&times;</button>` : ''}
        </div>`).join('')}</div>`;
      el.querySelectorAll('.del-record').forEach(b => {
        b.onclick = async () => { if (await showConfirm('ลบ', 'ลบบันทึกที่รออนุมัติ?')) { await deleteBehaviorRecord(b.dataset.rid); selectStudent(selectedStudent); } };
      });
    }

    document.getElementById('btn-record-behavior').onclick = async () => {
      const note = document.getElementById('behavior-note').value;
      await recordBehavior(selectedStudent.id, selectedCriteriaId, currentUser().uid, note);
      showToast('ส่งคำขออนุมัติเรียบร้อย', 'success');
      document.getElementById('behavior-note').value = '';
      selectStudent(selectedStudent);
      if (isStudentAffairs) updatePendingCount();
    };

    if (hasRole(userData, 'admin')) {
      document.getElementById('behavior-class').onchange = (e) => loadStudents(e.target.value);
    } else if (userData.classRoom) {
      loadStudents(userData.classRoom);
    }
  }

  // ───────────────────────── APPROVE VIEW ──────────────────────────────────────
  async function renderApproveView() {
    const content = document.getElementById('behavior-content');
    content.innerHTML = `<div id="approve-list">${spinnerHTML()}</div>`;
    const pending = await getPendingBehaviorRecords();
    if (!pending.length) { content.innerHTML = emptyHTML('ไม่มีรายการรออนุมัติ'); return; }

    // Fetch student info for each record
    const recordsWithStudent = await Promise.all(pending.map(async r => {
      const s = await getStudent(r.studentId);
      return { ...r, student: s };
    }));

    content.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th class="px-5 py-3">นักเรียน/ห้อง</th>
              <th class="px-5 py-3">พฤติกรรม</th>
              <th class="px-5 py-3 text-center">คะแนน</th>
              <th class="px-5 py-3 text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-100">
            ${recordsWithStudent.map(r => `
              <tr class="hover:bg-gray-50/50 transition">
                <td class="px-5 py-4">
                  <div class="font-bold text-gray-800">${r.student?.firstName} ${r.student?.lastName}</div>
                  <div class="text-[11px] text-gray-400">ห้อง ${r.student?.classRoom || '-'}</div>
                </td>
                <td class="px-5 py-4">
                  <div class="font-medium text-gray-700">${r.criteriaName}</div>
                  <div class="text-[10px] text-gray-400">${formatThaiDate(r.date)} ${r.note ? `· ${r.note}` : ''}</div>
                </td>
                <td class="px-5 py-4 text-center">
                  <span class="px-2 py-1 rounded-lg font-bold ${r.score > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                    ${r.score > 0 ? '+' : ''}${r.score}
                  </span>
                </td>
                <td class="px-5 py-4 text-right">
                  <div class="flex justify-end gap-2">
                    <button data-action="reject" data-rid="${r.id}" class="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-bold transition">ปฏิเสธ</button>
                    <button data-action="approve" data-rid="${r.id}" class="px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 text-xs font-bold transition">อนุมัติ</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    content.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.rid;
        if (btn.dataset.action === 'approve') {
          await approveBehaviorRecord(id);
          showToast('อนุมัติเรียบร้อย', 'success');
        } else {
          await rejectBehaviorRecord(id);
          showToast('ปฏิเสธรายการเรียบร้อย', 'info');
        }
        renderApproveView();
        updatePendingCount();
      };
    });
  }

  switchTab(activeTab);
}
