// pages/subjects-page.js — Subject Management
import { getSubjects, addSubject, updateSubject, deleteSubject, grantSubjectPermission, revokeSubjectPermission, canManageSubject } from '../modules/subjects.js';
import { getUsersByRole, hasRole } from '../modules/auth.js';
import { showToast, showConfirm, openModal, closeModal, spinnerHTML, emptyHTML } from '../modules/utils.js';
import { currentUser } from '../modules/auth.js';
import { getClassrooms } from '../modules/classes.js';

export async function renderSubjectsPage(container, userData) {
  const isAdmin = hasRole(userData, 'admin');
  const canAddSubject = isAdmin || hasRole(userData, 'subject_teacher');
  const classroomsList = await getClassrooms();

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">จัดการรายวิชา</h1>
          <p class="text-sm text-gray-500 mt-0.5">${isAdmin ? 'จัดการรายวิชาทั้งหมดและมอบสิทธิ์ครู' : 'รายวิชาที่คุณดูแล'}</p>
        </div>
        ${canAddSubject ? `
          <button id="btn-add-subject" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m7-7H5"/></svg>
            เพิ่มรายวิชา
          </button>` : ''}
      </div>
      <div id="subjects-container">${spinnerHTML()}</div>
    </div>`;

  let subjects = [];
  let teachers = [];

  async function loadSubjects() {
    subjects = await getSubjects();
    if (isAdmin) teachers = await getUsersByRole('subject_teacher');
    renderSubjects();
  }

  function renderSubjects() {
    const el = document.getElementById('subjects-container');
    const manageable = isAdmin ? subjects : subjects.filter(s => canManageSubject(s, userData.roles || [userData.role], currentUser().uid));

    if (!manageable.length) {
      el.innerHTML = emptyHTML('ไม่มีรายวิชาที่แสดง');
      return;
    }

    el.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        ${manageable.map(s => {
          const canEdit = canManageSubject(s, userData.roles || [userData.role], currentUser().uid);
          const teacherNames = s.canManage?.map(uid => {
            const t = teachers.find(t => t.uid === uid);
            return t ? t.displayName : uid.slice(0, 8) + '...';
          }) || [];
          return `
            <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow group">
              <div class="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span class="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">${s.code}</span>
                  <h3 class="font-bold text-gray-800 mt-1.5">${s.name}</h3>
                </div>
                ${canEdit ? `
                  <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
                    <button data-action="edit" data-sid="${s.id}" class="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-700 transition">
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    ${(isAdmin || s.teacherId === currentUser().uid) ? `
                      <button data-action="delete" data-sid="${s.id}" class="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-600 transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>` : ''}
                  </div>` : ''}
              </div>

              <!-- Classes -->
              <div class="flex flex-wrap gap-1.5 mb-3">
                ${(s.classRooms || []).map(cr => `<span class="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">${cr}</span>`).join('') || '<span class="text-xs text-gray-400">ไม่ระบุห้อง</span>'}
              </div>

              <!-- Teachers with access -->
              ${isAdmin && teacherNames.length ? `
                <div class="mt-2 pt-2 border-t border-gray-50">
                  <div class="text-xs text-gray-400 mb-1">ครูที่มีสิทธิ์จัดการ:</div>
                  <div class="flex flex-wrap gap-1">
                    ${teacherNames.map(n => `<span class="px-2 py-0.5 rounded-full text-xs bg-teal-100 text-teal-700">${n}</span>`).join('')}
                  </div>
                </div>` : ''}

              ${isAdmin ? `
                <button data-action="permissions" data-sid="${s.id}" class="mt-3 w-full py-1.5 rounded-lg text-xs font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 transition">
                  จัดการสิทธิ์ครู
                </button>` : ''}
            </div>`;
        }).join('')}
      </div>`;

    document.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.onclick = () => openSubjectModal(subjects.find(s => s.id === btn.dataset.sid));
    });
    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.onclick = async () => {
        const s = subjects.find(s => s.id === btn.dataset.sid);
        const ok = await showConfirm('ลบรายวิชา', `ต้องการลบ "${s.name}" ใช่หรือไม่?`);
        if (ok) { await deleteSubject(s.id); showToast('ลบเรียบร้อย', 'success'); loadSubjects(); }
      };
    });
    document.querySelectorAll('[data-action="permissions"]').forEach(btn => {
      btn.onclick = () => openPermissionsModal(subjects.find(s => s.id === btn.dataset.sid));
    });
  }

  function openSubjectModal(subject = null) {
    const isEdit = !!subject;
    const body = `
      <form id="subject-form" class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">รหัสวิชา *</label>
            <input name="code" value="${subject?.code || ''}" required placeholder="เช่น MATH101"
              class="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">ชื่อวิชา *</label>
            <input name="name" value="${subject?.name || ''}" required placeholder="เช่น คณิตศาสตร์พื้นฐาน"
              class="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">ห้องเรียนที่สอน (เลือกได้หลายห้อง)</label>
          <div class="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
            ${classroomsList.map(c => `
              <label class="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" name="classRoom" value="${c}" class="rounded"
                  ${(subject?.classRooms || []).includes(c) ? 'checked' : ''}/>
                ${c}
              </label>`).join('')}
          </div>
        </div>
      </form>`;

    const footer = `
      <button id="modal-cancel" class="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">ยกเลิก</button>
      <button id="modal-save" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">${isEdit ? 'บันทึก' : 'เพิ่มวิชา'}</button>`;

    openModal(isEdit ? 'แก้ไขรายวิชา' : 'เพิ่มรายวิชาใหม่', body, footer);
    document.getElementById('modal-cancel').onclick = closeModal;
    document.getElementById('modal-save').onclick = async () => {
      const form = document.getElementById('subject-form');
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const classRooms = fd.getAll('classRoom');
      const data = { code: fd.get('code'), name: fd.get('name'), classRooms };
      try {
        if (isEdit) await updateSubject(subject.id, data);
        else        await addSubject({ ...data, canManage: [currentUser().uid], teacherId: currentUser().uid });
        showToast(isEdit ? 'บันทึกเรียบร้อย' : 'เพิ่มวิชาเรียบร้อย', 'success');
        closeModal(); loadSubjects();
      } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    };
  }

  async function openPermissionsModal(subject) {
    const body = `
      <div class="space-y-3">
        <p class="text-sm text-gray-600">เลือกครูที่มีสิทธิ์เช็คชื่อและจัดการวิชา <strong>${subject.name}</strong></p>
        <div id="teacher-perms-list" class="space-y-2 max-h-72 overflow-y-auto">
          ${teachers.length ? teachers.map(t => `
            <label class="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" value="${t.uid}" class="teacher-perm-check rounded"
                ${(subject.canManage || []).includes(t.uid) ? 'checked' : ''}/>
              <div>
                <div class="font-medium text-sm text-gray-800">${t.displayName || 'ไม่ระบุชื่อ'}</div>
                <div class="text-xs text-gray-400">${t.email}</div>
              </div>
            </label>`).join('') : '<div class="text-center py-4 text-gray-400 text-sm">ไม่มีครูประจำวิชาในระบบ</div>'}
        </div>
      </div>`;

    const footer = `
      <button id="modal-cancel" class="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">ปิด</button>
      <button id="modal-save-perms" class="px-5 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition shadow-sm">บันทึกสิทธิ์</button>`;

    openModal('จัดการสิทธิ์ครู', body, footer);
    document.getElementById('modal-cancel').onclick = closeModal;
    document.getElementById('modal-save-perms').onclick = async () => {
      const checked = [...document.querySelectorAll('.teacher-perm-check:checked')].map(c => c.value);
      await updateSubject(subject.id, { canManage: checked });
      showToast('บันทึกสิทธิ์เรียบร้อย', 'success');
      closeModal(); loadSubjects();
    };
  }

  if (canAddSubject) document.getElementById('btn-add-subject').onclick = () => openSubjectModal();
  await loadSubjects();
}
