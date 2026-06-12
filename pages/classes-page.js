// pages/classes-page.js — Classroom & Homeroom Teacher Management (Admin only)
import { getClassrooms, addClass, deleteClass, getHomeroomTeachers, assignHomeroomTeacher, removeHomeroomTeacher } from '../modules/classes.js';
import { getAllUsers } from '../modules/auth.js';
import { showToast, showConfirm, spinnerHTML, emptyHTML } from '../modules/utils.js';

export async function renderClassesPage(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">จัดการห้องเรียน</h1>
          <p class="text-sm text-gray-500 mt-0.5" id="class-count-label">กำลังโหลด...</p>
        </div>
        <button id="btn-add-class"
          class="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m7-7H5"/>
          </svg>
          เพิ่มห้องเรียน
        </button>
      </div>

      <!-- Add Class Panel -->
      <div id="add-class-panel" class="hidden bg-white rounded-2xl shadow-sm border border-indigo-200 p-5">
        <p class="text-sm font-semibold text-gray-700 mb-3">✏️ เพิ่มห้องเรียนใหม่</p>
        <div class="flex gap-3">
          <input id="new-class-input" type="text" placeholder="เช่น ม.7/1"
            class="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"/>
          <button id="btn-confirm-add"
            class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
            เพิ่ม
          </button>
          <button id="btn-cancel-add"
            class="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 text-sm hover:bg-gray-200 transition">
            ยกเลิก
          </button>
        </div>
      </div>

      <!-- Info Banner -->
      <div class="p-4 bg-blue-50 border border-blue-200 rounded-2xl text-sm text-blue-800 flex items-start gap-2.5">
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        <div>
          <strong>ครูประจำชั้น (ห้องละไม่เกิน 2 คน):</strong> ท่านสามารถระบุครูประจำชั้นได้สูงสุด 2 คนต่อ 1 ห้องเรียน 
          ครูทุกคนที่ถูกเลือกจะมองเห็นข้อมูลนักเรียนและเช็คชื่อเช้าในห้องนี้ได้เหมือนกัน
        </div>
      </div>

      <!-- Classrooms Grid -->
      <div id="classrooms-grid" class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        ${spinnerHTML('กำลังโหลดห้องเรียน...')}
      </div>
    </div>`;

  // Event handlers unchanged...
  document.getElementById('btn-add-class').onclick = () => {
    document.getElementById('add-class-panel').classList.remove('hidden');
    document.getElementById('new-class-input').focus();
  };
  document.getElementById('btn-cancel-add').onclick = () => {
    document.getElementById('add-class-panel').classList.add('hidden');
    document.getElementById('new-class-input').value = '';
  };
  document.getElementById('btn-confirm-add').onclick = async () => {
    const name = document.getElementById('new-class-input').value.trim();
    if (!name) return showToast('กรุณากรอกชื่อห้องเรียน', 'warning');
    const btn = document.getElementById('btn-confirm-add');
    btn.textContent = 'กำลังบันทึก...';
    btn.disabled = true;
    const ok = await addClass(name);
    btn.textContent = 'เพิ่ม';
    btn.disabled = false;
    if (!ok) return showToast(`"${name}" มีอยู่แล้วในระบบ`, 'warning');
    showToast(`เพิ่ม "${name}" เรียบร้อย ✓`, 'success');
    document.getElementById('add-class-panel').classList.add('hidden');
    document.getElementById('new-class-input').value = '';
    await loadClasses();
  };

  document.getElementById('new-class-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-confirm-add').click();
  });

  await loadClasses();
}

async function loadClasses() {
  const grid = document.getElementById('classrooms-grid');
  if (!grid) return;
  grid.innerHTML = spinnerHTML('กำลังโหลด...');

  const [classrooms, teacherMap, allUsers] = await Promise.all([
    getClassrooms(),
    getHomeroomTeachers(),
    getAllUsers(),
  ]);

  const countLabel = document.getElementById('class-count-label');
  if (countLabel) countLabel.textContent = `ทั้งหมด ${classrooms.length} ห้อง`;

  if (!classrooms.length) {
    if (grid) grid.innerHTML = emptyHTML('ยังไม่มีห้องเรียนในระบบ');
    return;
  }

  const eligibleTeachers = allUsers.filter(u =>
    u.role === 'homeroom_teacher' || u.role === 'subject_teacher' || u.role === 'admin'
  );

  if (grid) grid.innerHTML = classrooms.map(cls => {
    const teachers = teacherMap[cls] || []; // Array now
    const teacherOptions = eligibleTeachers.map(u => `
      <option value="${u.uid}">
        ${u.displayName || u.email || u.uid}
      </option>
    `).join('');

    return `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow">
              ${cls.replace('ม.', '')}
            </div>
            <div>
              <div class="font-bold text-gray-800">${cls}</div>
              <div class="text-xs text-gray-400">ห้องเรียน</div>
            </div>
          </div>
          <button data-delete="${cls}" class="p-2 rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600 transition">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>

        <div class="space-y-3">
          <label class="block text-xs font-semibold text-gray-500">ครูประจำชั้น (${teachers.length}/2)</label>
          
          <!-- Current Teachers List -->
          <div class="space-y-2">
            ${teachers.map(t => `
              <div class="flex items-center gap-2 p-2 bg-indigo-50 border border-indigo-100 rounded-xl group">
                <div class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                  ${(t.displayName || t.email || '?')[0].toUpperCase()}
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-xs font-semibold text-gray-800 truncate">${t.displayName || '(ไม่ระบุชื่อ)'}</div>
                  <div class="text-[10px] text-gray-400 truncate">${t.email}</div>
                </div>
                <button data-remove-uid="${t.uid}" data-class="${cls}" class="p-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition">
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
                </button>
              </div>
            `).join('')}
            ${teachers.length === 0 ? '<div class="text-[10px] text-gray-400 text-center py-2 border border-dashed border-gray-200 rounded-xl">ยังไม่มีครูประจำชั้น</div>' : ''}
          </div>

          <!-- Add Teacher Select -->
          ${teachers.length < 2 ? `
            <div class="pt-2 border-t border-gray-50">
              <select data-teacher-select="${cls}" class="w-full px-3 py-2 rounded-xl border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white mb-2">
                <option value="">+ เพิ่มครูประจำชั้น</option>
                ${teacherOptions}
              </select>
              <button data-assign="${cls}" class="w-full py-2 rounded-xl bg-indigo-600 text-white text-[10px] font-bold hover:bg-indigo-700 transition">
                เพิ่มครูคนที่ ${teachers.length + 1}
              </button>
            </div>
          ` : '<p class="text-[10px] text-center text-gray-400">ครบจำนวนสูงสุด 2 คนแล้ว</p>'}
        </div>
      </div>`;
  }).join('');

  const grid2 = document.getElementById('classrooms-grid');
  if (!grid2) return;

  grid2.querySelectorAll('[data-delete]').forEach(btn => {
    btn.onclick = async () => {
      const cls = btn.dataset.delete;
      const ok = await showConfirm(`ลบห้องเรียน "${cls}"`, `ต้องการลบห้องเรียน "${cls}"?`);
      if (ok) { await deleteClass(cls); loadClasses(); }
    };
  });

  grid2.querySelectorAll('[data-assign]').forEach(btn => {
    btn.onclick = async () => {
      const cls = btn.dataset.assign;
      const sel = grid2.querySelector(`[data-teacher-select="${cls}"]`);
      const uid = sel?.value;
      if (!uid) return showToast('กรุณาเลือกครู', 'warning');
      btn.disabled = true;
      await assignHomeroomTeacher(cls, uid);
      showToast('เพิ่มครูประจำชั้นเรียบร้อย', 'success');
      await loadClasses();
    };
  });

  grid2.querySelectorAll('[data-remove-uid]').forEach(btn => {
    btn.onclick = async () => {
      const uid = btn.dataset.removeUid;
      const ok = await showConfirm('ยืนยันถอนสิทธิ์', 'ต้องการถอนสิทธิ์ครูประจำชั้นท่านนี้ออกจากห้องนี้ใช่หรือไม่?');
      if (!ok) return;
      await removeHomeroomTeacher(uid);
      showToast('ถอนสิทธิ์เรียบร้อย', 'success');
      await loadClasses();
    };
  });
}

