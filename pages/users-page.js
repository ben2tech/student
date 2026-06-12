// pages/users-page.js — User Management (Admin only)
import { getAllUsers, updateUserData, deleteUserData, hasRole, parseUserCSV, importUsersFromCSV, downloadUserCSVTemplate } from '../modules/auth.js';
import { showToast, showConfirm, openModal, closeModal, spinnerHTML, emptyHTML, roleLabel, roleBadge, classSelectOptions } from '../modules/utils.js';
import { getClassrooms } from '../modules/classes.js';

export async function renderUsersPage(container, userData) {
  const classrooms = await getClassrooms();
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">จัดการสมาชิก</h1>
          <p class="text-sm text-gray-500 mt-0.5" id="users-count-label">กำลังโหลด...</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          <button id="btn-import-csv" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition shadow-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            นำเข้า CSV
          </button>
          <button id="btn-add-user" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m7-7H5"/></svg>
            เพิ่มสมาชิก
          </button>
        </div>
      </div>

      <!-- Filter -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
        <input id="user-search" type="text" placeholder="ค้นหาชื่อ, อีเมล..."
          class="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"/>
        <select id="role-filter" class="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
          <option value="">ทุก Role</option>
          <option value="admin">Admin</option>
          <option value="homeroom_teacher">ครูประจำชั้น</option>
          <option value="subject_teacher">ครูประจำวิชา</option>
          <option value="parent">ผู้ปกครอง</option>
        </select>
      </div>

      <!-- Info Banner -->
      <div class="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm text-amber-800 flex items-start gap-2.5">
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        <div>
          <strong>การสร้างบัญชีผู้ใช้ใหม่:</strong> ให้ผู้ใช้เปิดหน้า <code class="bg-amber-100 px-1 rounded font-mono">setup.html</code> เพื่อสมัครด้วย Email/Password ก่อน
          จากนั้น Admin กลับมาแก้ไข Role และข้อมูลที่หน้านี้
        </div>
      </div>

      <!-- Users Table -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div id="users-table-container">${spinnerHTML()}</div>
      </div>
    </div>`;

  let allUsers = [];

  async function loadUsers() {
    document.getElementById('users-table-container').innerHTML = spinnerHTML();
    allUsers = await getAllUsers();
    renderTable(allUsers);
  }

  function renderTable(users) {
    const countLabel = document.getElementById('users-count-label');
    const tableContainer = document.getElementById('users-table-container');

    if (countLabel) countLabel.textContent = `ทั้งหมด ${users.length} คน`;
    if (!tableContainer) return; // Protected against race condition navigation

    if (!users.length) {
      tableContainer.innerHTML = emptyHTML('ไม่พบข้อมูลสมาชิก');
      return;
    }
    tableContainer.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr class="text-left text-gray-500">
              <th class="px-5 py-3.5 font-semibold">สมาชิก</th>
              <th class="px-5 py-3.5 font-semibold">Role</th>
              <th class="px-5 py-3.5 font-semibold hidden sm:table-cell">ห้องเรียน</th>
              <th class="px-5 py-3.5 font-semibold hidden md:table-cell">UID</th>
              <th class="px-5 py-3.5 font-semibold text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            ${users.map(u => `
              <tr class="hover:bg-indigo-50/30 transition-colors group" data-uid="${u.uid}">
                <td class="px-5 py-4">
                  <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0
                      ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                        u.role === 'homeroom_teacher' ? 'bg-indigo-100 text-indigo-700' :
                        u.role === 'subject_teacher' ? 'bg-teal-100 text-teal-700' : 'bg-orange-100 text-orange-700'}">
                      ${(u.displayName || u.email || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <div class="font-semibold text-gray-800">${u.displayName || '(ไม่ระบุชื่อ)'}</div>
                      <div class="text-xs text-gray-400">${u.email || ''}</div>
                    </div>
                  </div>
                </td>
                <td class="px-5 py-4">
                  <div class="flex flex-wrap gap-1">
                    ${(u.roles || [u.role]).map(r => roleBadge(r)).join('')}
                  </div>
                </td>
                <td class="px-5 py-4 hidden sm:table-cell text-gray-600 text-xs">${u.classRoom || '-'}</td>
                <td class="px-5 py-4 hidden md:table-cell">
                  <span class="text-xs font-mono text-gray-400">${u.uid?.slice(0, 12)}...</span>
                </td>
                <td class="px-5 py-4 text-right">
                  <div class="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition">
                    <button data-action="edit" data-uid="${u.uid}" class="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-medium transition">แก้ไข</button>
                    ${u.uid !== userData.uid ? `<button data-action="delete" data-uid="${u.uid}" class="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition">ลบ</button>` : ''}
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    document.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.onclick = () => openEditModal(allUsers.find(u => u.uid === btn.dataset.uid));
    });
    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.onclick = async () => {
        const u = allUsers.find(u => u.uid === btn.dataset.uid);
        const ok = await showConfirm('ลบสมาชิก', `ต้องการลบ ${u.displayName || u.email} ออกจากระบบ? (จะลบเฉพาะข้อมูลใน Firestore เท่านั้น)`);
        if (ok) {
          await deleteUserData(u.uid);
          showToast('ลบสมาชิกเรียบร้อย', 'success');
          loadUsers();
        }
      };
    });
  }

  // Search + Filter
  function filterAndRender() {
    const q    = document.getElementById('user-search').value.toLowerCase();
    const role = document.getElementById('role-filter').value;
    const filtered = allUsers.filter(u =>
      (!q || `${u.displayName} ${u.email}`.toLowerCase().includes(q)) &&
      (!role || u.role === role)
    );
    renderTable(filtered);
  }
  document.getElementById('user-search').oninput = filterAndRender;
  document.getElementById('role-filter').onchange = filterAndRender;

  // ─── Edit Modal ───────────────────────────────────────────────────────────────
  function openEditModal(user) {
    if (!user) return;
    const body = `
      <form id="user-edit-form" class="space-y-4">
        <div class="p-3 bg-gray-50 rounded-xl text-xs font-mono text-gray-500 break-all">UID: ${user.uid}</div>

        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">ชื่อแสดง</label>
          <input name="displayName" value="${user.displayName || ''}"
            class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
        </div>

        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-2">สิทธิ์การใช้งาน (เลือกได้หลายอย่าง) *</label>
          <div class="grid grid-cols-2 gap-2">
            ${['admin', 'homeroom_teacher', 'subject_teacher', 'student_affairs', 'parent'].map(r => `
              <label class="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer text-xs">
                <input type="checkbox" name="roles" value="${r}" class="role-check rounded"
                  ${(user.roles || [user.role] || []).includes(r) ? 'checked' : ''}/>
                ${roleLabel(r)}
              </label>`).join('')}
          </div>
        </div>

        <div id="classroom-field" class="${(user.roles || [user.role]).includes('homeroom_teacher') ? '' : 'hidden'}">
          <label class="block text-xs font-semibold text-gray-600 mb-1">ห้องเรียนที่ดูแล</label>
          <select name="classRoom" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
            <option value="">-- ไม่ระบุ --</option>
            ${classSelectOptions(user.classRoom, classrooms)}
          </select>
        </div>

        <div id="linked-student-field" class="${(user.roles || [user.role]).includes('parent') ? '' : 'hidden'}">
          <label class="block text-xs font-semibold text-gray-600 mb-1">UID ผู้ใช้ (สำหรับ Link กับนักเรียน)</label>
          <input name="linkedStudentId" value="${user.linkedStudentId || ''}" placeholder="ID นักเรียนในระบบ"
            class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"/>
        </div>
      </form>`;

    const footer = `
      <button id="modal-cancel" class="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">ยกเลิก</button>
      <button id="modal-save" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">บันทึกการแก้ไข</button>`;

    openModal('แก้ไขข้อมูลสมาชิก', body, footer);
    document.getElementById('modal-cancel').onclick = closeModal;

    // Toggle extra fields based on role checkboxes
    document.querySelectorAll('.role-check').forEach(ck => {
      ck.addEventListener('change', () => {
        const checked = [...document.querySelectorAll('.role-check:checked')].map(c => c.value);
        document.getElementById('classroom-field').classList.toggle('hidden', !checked.includes('homeroom_teacher'));
        document.getElementById('linked-student-field').classList.toggle('hidden', !checked.includes('parent'));
      });
    });

    document.getElementById('modal-save').onclick = async () => {
      const form = document.getElementById('user-edit-form');
      const fd = new FormData(form);
      const roles = fd.getAll('roles');
      if (!roles.length) return showToast('กรุณาเลือกอย่างน้อย 1 สิทธิ์', 'warning');

      const data = {
        displayName: fd.get('displayName'),
        roles:       roles,
        role:        roles[0], // Set primary role for backward compatibility
      };
      if (roles.includes('homeroom_teacher')) data.classRoom = fd.get('classRoom') || '';
      if (roles.includes('parent')) data.linkedStudentId = fd.get('linkedStudentId') || '';

      try {
        await updateUserData(user.uid, data);
        showToast('บันทึกสำเร็จ ✓', 'success');
        closeModal();
        loadUsers();
      } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    };
  }

  // ─── Add User Modal (Pre-register doc) ───────────────────────────────────────
  document.getElementById('btn-add-user').onclick = () => {
    const body = `
      <div class="space-y-4">
        <div class="p-4 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800 space-y-2">
          <p class="font-semibold">📋 วิธีเพิ่มสมาชิกใหม่:</p>
          <ol class="list-decimal list-inside space-y-1 text-blue-700">
            <li>ส่ง link <strong>setup.html</strong> ให้ผู้ใช้ Login ครั้งแรก (ระบบสร้าง account อัตโนมัติ)</li>
            <li>กลับมาหน้านี้แล้วกด <strong>แก้ไข</strong> เพื่อกำหนด Role</li>
          </ol>
          <p class="mt-2 text-xs">หรือ Copy UID ของผู้ใช้จาก Firebase Auth Console แล้วสร้าง Firestore doc ด้านล่าง</p>
        </div>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">Firebase Auth UID *</label>
            <input id="new-uid" placeholder="วาง UID จาก Firebase Auth Console..."
              class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">ชื่อแสดง *</label>
            <input id="new-name" placeholder="ชื่อ-นามสกุล"
              class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">อีเมล</label>
            <input id="new-email" type="email" placeholder="email@example.com"
              class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-2">สิทธิ์การใช้งาน (เลือกได้หลายอย่าง) *</label>
            <div class="grid grid-cols-2 gap-2">
              ${['homeroom_teacher', 'subject_teacher', 'student_affairs', 'parent', 'admin'].map(r => `
                <label class="flex items-center gap-2 p-2 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer text-xs">
                  <input type="checkbox" name="new-roles" value="${r}" class="new-role-check rounded"/>
                  ${roleLabel(r)}
                </label>`).join('')}
            </div>
          </div>
          <div id="new-classroom-field">
            <label class="block text-xs font-semibold text-gray-600 mb-1">ห้องเรียน (ถ้าเป็นครูประจำชั้น)</label>
            <select id="new-classroom" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              <option value="">-- ไม่ระบุ --</option>
              ${classrooms.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>`;

    const footer = `
      <button id="modal-cancel" class="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">ยกเลิก</button>
      <button id="modal-save" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">สร้าง Document</button>`;

    openModal('เพิ่มสมาชิกใหม่', body, footer);
    document.getElementById('modal-cancel').onclick = closeModal;

    document.getElementById('modal-save').onclick = async () => {
      const uid   = document.getElementById('new-uid').value.trim();
      const name  = document.getElementById('new-name').value.trim();
      const email = document.getElementById('new-email').value.trim();
      const roles = [...document.querySelectorAll('.new-role-check:checked')].map(c => c.value);
      const cls   = document.getElementById('new-classroom').value;
      if (!uid || !name) return showToast('กรุณากรอก UID และชื่อ', 'warning');

      try {
        const { db } = await import('../firebase-config.js');
        const { doc, setDoc, Timestamp } = await import('https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js');
        const data = { displayName: name, email, roles, role: roles[0] || 'parent', createdAt: Timestamp.now() };
        if (roles.includes('homeroom_teacher') && cls) data.classRoom = cls;
        await setDoc(doc(db, 'users', uid), data, { merge: false });
        showToast('สร้าง Document เรียบร้อย ✓', 'success');
        closeModal();
        loadUsers();
      } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    };
  };

  // ─── CSV Import Modal ───────────────────────────────────────────────────────
  document.getElementById('btn-import-csv').onclick = () => {
    const body = `
      <div class="space-y-4">
        <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
          <p class="text-sm font-semibold text-indigo-800">รูปแบบ CSV:</p>
          <code class="text-xs text-indigo-700 block">UID, ชื่อ, อีเมล, สิทธิ์(คั่นด้วย |), ห้องเรียน</code>
          <button id="btn-dl-user-template" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition">
            ⬇️ ดาวน์โหลด Template
          </button>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">เลือกไฟล์ CSV *</label>
          <div class="relative border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-300 transition cursor-pointer">
            <input type="file" id="csv-file-input" accept=".csv,.tsv,.txt" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
            <div>
              <div class="text-3xl mb-2">📄</div>
              <p class="text-sm text-gray-600">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวาง</p>
              <p class="text-xs text-gray-400 mt-1">รองรับ Excel CSV (ภาษาไทย)</p>
            </div>
          </div>
          <div id="csv-filename" class="text-xs text-gray-500 mt-1 hidden"></div>
        </div>
        <div id="csv-preview" class="hidden"></div>
      </div>`;

    const footer = `
      <button id="modal-cancel" class="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">ยกเลิก</button>
      <button id="btn-do-import" disabled class="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-40 shadow-sm">
        ✅ นำเข้าสมาชิก
      </button>`;

    openModal('นำเข้าสมาชิกด้วย CSV', body, footer);
    document.getElementById('modal-cancel').onclick = closeModal;
    document.getElementById('btn-dl-user-template').onclick = downloadUserCSVTemplate;

    let parsedUsers = [];
    document.getElementById('csv-file-input').onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById('csv-filename').textContent = `📄 ${file.name}`;
      document.getElementById('csv-filename').classList.remove('hidden');

      try {
        const buffer = await file.arrayBuffer();
        let text = new TextDecoder('utf-8').decode(buffer);
        if (text.includes('เธ') || text.includes('เน') || text.includes('')) {
          text = new TextDecoder('windows-874').decode(buffer);
        }

        const { users, errors } = parseUserCSV(text);
        parsedUsers = users;
        renderPreview(users, errors);
        document.getElementById('btn-do-import').disabled = users.length === 0;
      } catch (err) {
        document.getElementById('csv-preview').innerHTML = `<div class="p-3 bg-red-50 text-red-700 rounded-xl text-sm">❌ ${err.message}</div>`;
        document.getElementById('csv-preview').classList.remove('hidden');
      }
    };

    function renderPreview(users, errors) {
      const el = document.getElementById('csv-preview');
      el.classList.remove('hidden');
      el.innerHTML = `
        <div class="space-y-3">
          <div class="p-3 bg-green-50 border border-green-200 rounded-xl text-center">
            <div class="text-xl font-bold text-green-700">${users.length} คน</div>
            <div class="text-xs text-green-600">พร้อมนำเข้า</div>
          </div>
          ${errors.length ? `<div class="p-3 bg-red-50 text-red-600 text-xs rounded-xl">${errors.join('<br>')}</div>` : ''}
          <div class="max-h-40 overflow-y-auto rounded-xl border border-gray-100">
            <table class="w-full text-xs">
              <thead class="bg-gray-50 sticky top-0">
                <tr class="text-left text-gray-500"><th class="p-2">ชื่อ</th><th class="p-2">สิทธิ์</th></tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                ${users.map(u => `<tr><td class="p-2 font-medium">${u.displayName}</td><td class="p-2">${u.roles.join(', ')}</td></tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    }

    document.getElementById('btn-do-import').onclick = async () => {
      const btn = document.getElementById('btn-do-import');
      btn.disabled = true; btn.textContent = 'กำลังนำเข้า...';
      try {
        await importUsersFromCSV(parsedUsers);
        showToast('นำเข้าสำเร็จ ✓', 'success');
        closeModal(); loadUsers();
      } catch (e) { showToast(e.message, 'error'); btn.disabled = false; btn.textContent = '✅ นำเข้าสมาชิก'; }
    };
  };

  await loadUsers();
}
