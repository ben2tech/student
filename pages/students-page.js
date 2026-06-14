// pages/students-page.js — Student Management Page
import { getStudents, addStudent, updateStudent, deleteStudent, promoteStudents, parseStudentCSV, importStudentsFromCSV, downloadStudentCSVTemplate, uploadStudentPhoto } from '../modules/students.js';
import { getStudentBehaviorScore } from '../modules/behavior.js';
import { showToast, showConfirm, openModal, closeModal, formatThaiDate, classSelectOptions, spinnerHTML, emptyHTML, compressImage } from '../modules/utils.js?v=1.4';
import { currentUser, hasRole } from '../modules/auth.js';
import { getClassrooms } from '../modules/classes.js';

export async function renderStudentsPage(container, userData) {
  const isAdmin = hasRole(userData, 'admin');
  const filterClass = hasRole(userData, 'homeroom_teacher') && !isAdmin ? userData.classRoom : null;

  // Load classrooms dynamically
  const classrooms = await getClassrooms();

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">ฐานข้อมูลนักเรียน</h1>
          <p class="text-sm text-gray-500 mt-0.5" id="student-count-label">กำลังโหลด...</p>
        </div>
        <div class="flex gap-2 flex-wrap">
          ${isAdmin ? `
            <button id="btn-promote" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition shadow-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
              เลื่อนชั้น
            </button>
            <button id="btn-import-csv" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition shadow-sm">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              นำเข้า CSV
            </button>` : ''}
          <button id="btn-add-student" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m7-7H5"/></svg>
            เพิ่มนักเรียน
          </button>
        </div>
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-3">
        <div class="flex-1">
          <input id="search-input" type="text" placeholder="ค้นหาชื่อ, รหัสนักเรียน..." 
            class="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"/>
        </div>
        ${isAdmin ? `
          <select id="class-filter" class="px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
            <option value="">ทุกห้อง</option>
            ${classrooms.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>` : ''}
      </div>

      <!-- Table -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div id="students-table-container">${spinnerHTML()}</div>
      </div>
    </div>
  `;

  let allStudents = [];
  let displayClass = filterClass;

  async function loadStudents() {
    document.getElementById('students-table-container').innerHTML = spinnerHTML();
    allStudents = await getStudents(displayClass);
    renderTable(allStudents);
  }

  function renderTable(students) {
    const countLabel = document.getElementById('student-count-label');
    const tableContainer = document.getElementById('students-table-container');

    if (countLabel) countLabel.textContent = `ทั้งหมด ${students.length} คน`;
    if (!tableContainer) return; // Prevent race condition crashes

    if (!students.length) {
      tableContainer.innerHTML = emptyHTML('ไม่พบข้อมูลนักเรียน');
      return;
    }
    tableContainer.innerHTML = `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 border-b border-gray-100">
            <tr class="text-left text-gray-500">
              <th class="px-5 py-3.5 font-semibold">เลขที่</th>
              <th class="px-5 py-3.5 font-semibold">รหัส</th>
              <th class="px-5 py-3.5 font-semibold">ชื่อ-นามสกุล</th>
              <th class="px-5 py-3.5 font-semibold hidden sm:table-cell">ห้อง</th>
              <th class="px-5 py-3.5 font-semibold hidden md:table-cell">ผู้ปกครอง</th>
              <th class="px-5 py-3.5 font-semibold hidden md:table-cell">เบอร์ผู้ปกครอง</th>
              <th class="px-5 py-3.5 font-semibold text-center">คะแนนพฤติกรรม</th>
              <th class="px-5 py-3.5 font-semibold text-right">จัดการ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            ${students.map(s => `
              <tr class="hover:bg-indigo-50/30 transition-colors" data-id="${s.id}">
                <td class="px-5 py-3.5 text-gray-500 font-mono">${s.number || '-'}</td>
                <td class="px-5 py-3.5 font-mono text-gray-600">${s.studentCode || '-'}</td>
                <td class="px-5 py-3.5">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full overflow-hidden bg-gray-100 flex-shrink-0 border border-gray-200">
                      ${s.photoUrl ? `<img src="${s.photoUrl}" class="w-full h-full object-cover" alt=""/>` : 
                        `<div class="w-full h-full flex items-center justify-center text-gray-400">
                          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                        </div>`}
                    </div>
                    <div>
                      <div class="font-semibold text-gray-800">${s.prefix ? `<span class="text-gray-500 font-normal">${s.prefix}</span> ` : ''}${s.firstName} ${s.lastName}</div>
                    </div>
                  </div>
                </td>
                <td class="px-5 py-3.5 hidden sm:table-cell">
                  <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700">${s.classRoom || '-'}</span>
                </td>
                <td class="px-5 py-3.5 hidden md:table-cell text-gray-600">${s.parentName || '-'}</td>
                <td class="px-5 py-3.5 hidden md:table-cell text-gray-500 font-mono text-xs">${s.parentPhone || '-'}</td>
                <td class="px-5 py-3.5 text-center">
                   <div id="score-${s.id}" class="font-bold text-sm text-gray-400">...</div>
                </td>
                <td class="px-5 py-3.5 text-right">
                  <div class="flex justify-end gap-1.5">
                    <button data-action="view" data-id="${s.id}" class="px-3 py-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 text-xs font-medium transition">ดูข้อมูล</button>
                    <button data-action="edit" data-id="${s.id}" class="px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 text-xs font-medium transition">แก้ไข</button>
                    ${isAdmin ? `<button data-action="delete" data-id="${s.id}" class="px-3 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition">ลบ</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>`;

    // Row actions
    students.forEach(async s => {
      const score = await getStudentBehaviorScore(s.id);
      const el = document.getElementById(`score-${s.id}`);
      if (el) {
        el.textContent = (score > 0 ? '+' : '') + score;
        el.className = `font-bold text-sm ${score < 0 ? 'text-red-600' : (score > 0 ? 'text-green-600' : 'text-gray-400')}`;
      }
    });

    document.querySelectorAll('[data-action]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const action = btn.dataset.action;
        if (action === 'view') openStudentModal(students.find(s => s.id === id), true);
        if (action === 'edit') openStudentModal(students.find(s => s.id === id), false);
        if (action === 'delete') {
          const ok = await showConfirm('ลบนักเรียน', 'ต้องการลบนักเรียนคนนี้ใช่หรือไม่? ข้อมูลจะหายถาวร');
          if (ok) { await deleteStudent(id); showToast('ลบเรียบร้อย', 'success'); loadStudents(); }
        }
      };
    });
  }

  // Search
  document.getElementById('search-input').oninput = (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = allStudents.filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
      (s.studentCode || '').toLowerCase().includes(q)
    );
    renderTable(filtered);
  };

  // Class filter (admin)
  if (isAdmin) {
    document.getElementById('class-filter').onchange = async (e) => {
      displayClass = e.target.value || null;
      await loadStudents();
    };
  }

  // Add button
  document.getElementById('btn-add-student').onclick = () => openStudentModal(null);

  // Promote button
  if (isAdmin) {
    document.getElementById('btn-promote').onclick = () => openPromoteModal();
  }

  async function openStudentModal(student, isViewOnly = false) {
    const isEdit = !!student;
    const currentScore = isEdit ? await getStudentBehaviorScore(student.id) : 100;
    let selectedFile = null;

    const body = `
      <form id="student-form" class="space-y-4">
        <!-- Photo Upload -->
        <div class="flex flex-col items-center gap-3 pb-4">
          <div class="relative group">
            <div id="photo-preview-container" class="w-24 h-24 rounded-2xl overflow-hidden bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center transition group-hover:border-indigo-400">
              ${student?.photoUrl ? `<img src="${student.photoUrl}" class="w-full h-full object-cover" id="img-preview"/>` : 
                `<svg id="img-placeholder" class="w-10 h-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>`}
            </div>
            <label class="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg cursor-pointer hover:bg-indigo-700 transition">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              <input type="file" id="photo-input" accept="image/*" class="hidden"/>
            </label>
          </div>
          <div class="text-[10px] text-gray-400">คลิกที่กล้องเพื่อ${isEdit ? 'เปลี่ยนรูป' : 'เพิ่มรูป'}</div>
        </div>

        <!-- Behavior Score Display -->
        ${isEdit ? `
        <div class="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center justify-between mb-2">
          <div class="text-xs font-bold text-indigo-700 uppercase tracking-wider">คะแนนพฤติกรรมสะสม</div>
          <div class="text-2xl font-black ${currentScore < 0 ? 'text-red-600' : (currentScore > 0 ? 'text-green-600' : 'text-gray-600')}">
            ${currentScore > 0 ? '+' : ''}${currentScore}
          </div>
        </div>` : ''}

        <div class="grid grid-cols-3 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">คำนำหน้า</label>
            <select name="prefix"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              ${['', 'เด็กชาย', 'เด็กหญิง', 'นาย', 'นางสาว', 'นาง'].map(p =>
                `<option value="${p}"${(student?.prefix || '') === p ? ' selected' : ''}>${p || '-- เลือก --'}</option>`
              ).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">ชื่อ *</label>
            <input name="firstName" value="${student?.firstName || ''}" required
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">นามสกุล *</label>
            <input name="lastName" value="${student?.lastName || ''}" required
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">รหัสนักเรียน *</label>
            <input name="studentCode" value="${student?.studentCode || ''}" required
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">เลขที่</label>
            <input name="number" type="number" value="${student?.number || ''}"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">วันเกิด</label>
            <input name="birthDate" type="date" value="${student?.birthDate || ''}"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">เบอร์โทรนักเรียน</label>
            <input name="phone" value="${student?.phone || ''}"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">ชั้น/ห้อง *</label>
            <select name="classRoom" required
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              <option value="">เลือกห้อง</option>
              ${classSelectOptions(student?.classRoom, classrooms)}
            </select>
          </div>
          <div></div>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">ชื่อผู้ปกครอง</label>
            <input name="parentName" value="${student?.parentName || ''}"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">เบอร์โทรผู้ปกครอง</label>
            <input name="parentPhone" value="${student?.parentPhone || ''}"
              class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">UID ผู้ปกครอง (เชื่อมบัญชี)</label>
          <input name="parentUid" value="${student?.parentUid || ''}" placeholder="UID ของ account ผู้ปกครองใน Firebase"
            class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 font-mono"/>
        </div>
      </form>`;

    const footer = `
      <button id="modal-cancel" class="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">ยกเลิก</button>
      <button id="modal-save"   class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
        ${isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มนักเรียน'}
      </button>`;

    const title = isViewOnly ? 'ข้อมูลนักเรียน' : (isEdit ? 'แก้ไขข้อมูลนักเรียน' : 'เพิ่มนักเรียนใหม่');
    openModal(title, body, footer);
    
    if (isViewOnly) {
      const form = document.getElementById('student-form');
      Array.from(form.elements).forEach(el => el.disabled = true);
      document.getElementById('modal-save').classList.add('hidden');
      document.getElementById('photo-input').parentElement.classList.add('hidden');
    }

    // Photo preview logic
    const photoInput = document.getElementById('photo-input');
    const previewContainer = document.getElementById('photo-preview-container');
    photoInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      selectedFile = file;
      const reader = new FileReader();
      reader.onload = (ev) => {
        previewContainer.innerHTML = `<img src="${ev.target.result}" class="w-full h-full object-cover" id="img-preview"/>`;
        previewContainer.classList.remove('border-dashed');
        previewContainer.classList.add('border-solid', 'border-indigo-200');
      };
      reader.readAsDataURL(file);
    };

    document.getElementById('modal-cancel').onclick = closeModal;
    document.getElementById('modal-save').onclick = async () => {
      const form = document.getElementById('student-form');
      if (!form.reportValidity()) return;
      const btnSave = document.getElementById('modal-save');
      
      const fd = new FormData(form);
      const data = Object.fromEntries(fd.entries());
      data.number = parseInt(data.number) || 0;

      btnSave.disabled = true;
      btnSave.textContent = 'กำลังบันทึก...';

      try {
        let studentId = student?.id;
        
        // 1. Save/Update Basic Data
        if (isEdit) {
          await updateStudent(studentId, data);
        } else {
          studentId = await addStudent(data);
        }

        // 2. Handle Photo Upload (if selected)
        if (selectedFile && studentId) {
          try {
            // Compress image client-side to save quota/bandwidth (default max 400x400, quality 0.7)
            const { compressedFile, dataUrl } = await compressImage(selectedFile);
            
            try {
              // Try uploading the small compressed file to Firebase Storage
              const photoUrl = await uploadStudentPhoto(studentId, compressedFile);
              await updateStudent(studentId, { photoUrl });
            } catch (storageErr) {
              console.warn('Firebase Storage upload failed (possibly quota exceeded). Falling back to base64 in Firestore:', storageErr);
              // Fallback: save compressed base64 directly to Firestore (under 1MB, typically ~20-50KB)
              await updateStudent(studentId, { photoUrl: dataUrl });
            }
          } catch (compressErr) {
            console.error('Image compression failed, trying original file:', compressErr);
            // Fallback: try original file if compression failed
            try {
              const photoUrl = await uploadStudentPhoto(studentId, selectedFile);
              await updateStudent(studentId, { photoUrl });
            } catch (storageErr) {
              showToast('ไม่สามารถอัปโหลดรูปภาพได้ เนื่องจากพื้นที่เก็บข้อมูลเต็ม', 'error');
              throw storageErr;
            }
          }
        }

        showToast(isEdit ? 'บันทึกเรียบร้อย' : 'เพิ่มนักเรียนเรียบร้อย', 'success');
        closeModal();
        loadStudents();
      } catch (err) { 
        showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
        btnSave.disabled = false;
        btnSave.textContent = isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มนักเรียน';
      }
    };
  }

  function openPromoteModal() {
    const body = `
      <div class="space-y-4">
        <div class="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          ⚠️ ระบบจะ <strong>Backup ข้อมูลนักเรียนทั้งหมดก่อน</strong> จึงทำการเลื่อนชั้น
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">ห้องต้นทาง (ย้ายออก)</label>
            <select id="from-class" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
              <option value="">เลือกห้อง</option>
              ${classrooms.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">ห้องปลายทาง (ย้ายเข้า)</label>
            <select id="to-class" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 bg-white">
              <option value="">เลือกห้อง</option>
              ${classrooms.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="promote-preview" class="hidden p-3 bg-gray-50 rounded-xl text-sm text-gray-600"></div>
      </div>`;

    const footer = `
      <button id="modal-cancel" class="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">ยกเลิก</button>
      <button id="btn-do-promote" class="px-5 py-2.5 rounded-xl bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 transition shadow-sm">ยืนยันเลื่อนชั้น</button>`;

    openModal('เลื่อนชั้นนักเรียน', body, footer);
    document.getElementById('modal-cancel').onclick = closeModal;

    async function updatePreview() {
      const from = document.getElementById('from-class').value;
      const preview = document.getElementById('promote-preview');
      if (from) {
        const list = await getStudents(from);
        preview.innerHTML = `พบนักเรียน <strong>${list.length} คน</strong> ในห้อง <strong>${from}</strong>`;
        preview.classList.remove('hidden');
      }
    }
    document.getElementById('from-class').onchange = updatePreview;

    document.getElementById('btn-do-promote').onclick = async () => {
      const from = document.getElementById('from-class').value;
      const to   = document.getElementById('to-class').value;
      if (!from || !to) return showToast('กรุณาเลือกห้องต้นทางและปลายทาง', 'warning');
      if (from === to) return showToast('ห้องต้นทางและปลายทางต้องต่างกัน', 'warning');
      const ok = await showConfirm('ยืนยันเลื่อนชั้น', `เลื่อนนักเรียนจาก ${from} ไปยัง ${to}\n(จะ Backup ข้อมูลก่อนอัตโนมัติ)`);
      if (!ok) return;
      try {
        document.getElementById('btn-do-promote').disabled = true;
        document.getElementById('btn-do-promote').textContent = 'กำลังดำเนินการ...';
        const { count } = await promoteStudents(from, to, currentUser().uid);
        showToast(`เลื่อนชั้นสำเร็จ ${count} คน`, 'success');
        closeModal();
        loadStudents();
      } catch (err) { showToast('เกิดข้อผิดพลาด: ' + err.message, 'error'); }
    };
  }

  // CSV Import button (admin)
  if (isAdmin) {
    document.getElementById('btn-import-csv')?.addEventListener('click', openCsvImportModal);
  }

  function openCsvImportModal() {
    const body = `
      <div class="space-y-4">
        <!-- Step 1: Download template -->
        <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
          <p class="text-sm font-semibold text-indigo-800">รูปแบบ CSV ที่รองรับ:</p>
          <code class="text-xs text-indigo-700 block">เลขที่, รหัสนักเรียน, ชื่อ, นามสกุล, วันเกิด, เบอร์นักเรียน, ห้องเรียน, ชื่อผู้ปกครอง, เบอร์ผู้ปกครอง</code>
          <button id="btn-dl-template" class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition">
            ⬇️ ดาวนโหลด Template CSV
          </button>
        </div>

        <!-- Step 2: File picker -->
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1.5">เลือกไฟล์ CSV *</label>
          <div class="relative border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:border-indigo-300 transition cursor-pointer" id="csv-drop-zone">
            <input type="file" id="csv-file-input" accept=".csv,.tsv,.txt" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
            <div class="pointer-events-none">
              <div class="text-3xl mb-2">📄</div>
              <p class="text-sm text-gray-600 font-medium">คลิกเพื่อเลือกไฟล์ หรือลากไฟล์มาวางที่นี่</p>
              <p class="text-xs text-gray-400 mt-1">รองรับ .csv, .tsv, .txt (UTF-8)</p>
            </div>
          </div>
          <div id="csv-filename" class="text-xs text-gray-500 mt-1 hidden"></div>
        </div>

        <!-- Preview / Errors -->
        <div id="csv-preview" class="hidden"></div>
      </div>`;

    const footer = `
      <button id="modal-cancel" class="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">ยกเลิก</button>
      <button id="btn-do-import" disabled class="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
        ✅ นำเข้าข้อมูล
      </button>`;

    openModal('นำเข้านักเรียนด้วย CSV', body, footer);
    document.getElementById('modal-cancel').onclick = closeModal;
    document.getElementById('btn-dl-template').onclick = (e) => {
      e.stopPropagation(); downloadStudentCSVTemplate();
    };

    let parsedStudents = [];

    document.getElementById('csv-file-input').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      document.getElementById('csv-filename').textContent = `📄 ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
      document.getElementById('csv-filename').classList.remove('hidden');

      try {
        const buffer = await file.arrayBuffer();
        let text = new TextDecoder('utf-8').decode(buffer);
        
        // Check if it's likely Windows-874 (contains garbled Thai characters like เธเธ)
        // Or check if the decoded text has a lot of replacement characters
        if (text.includes('เธ') || text.includes('เน') || text.includes('เถ') || text.includes('')) {
           text = new TextDecoder('windows-874').decode(buffer);
        }

        const { students, errors } = parseStudentCSV(text);
        parsedStudents = students;
        renderCsvPreview(students, errors);
        document.getElementById('btn-do-import').disabled = students.length === 0;
      } catch (err) {
        document.getElementById('csv-preview').innerHTML = `<div class="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">❌ ${err.message}</div>`;
        document.getElementById('csv-preview').classList.remove('hidden');
      }
    });

    function renderCsvPreview(students, errors) {
      const el = document.getElementById('csv-preview');
      el.classList.remove('hidden');
      el.innerHTML = `
        <div class="space-y-3">
          <!-- Summary -->
          <div class="flex gap-3">
            <div class="flex-1 p-3 bg-green-50 border border-green-200 rounded-xl text-center">
              <div class="text-2xl font-bold text-green-700">${students.length}</div>
              <div class="text-xs text-green-600">พร้อมนำเข้า</div>
            </div>
            ${errors.length ? `<div class="flex-1 p-3 bg-red-50 border border-red-200 rounded-xl text-center">
              <div class="text-2xl font-bold text-red-700">${errors.length}</div>
              <div class="text-xs text-red-600">พบข้อผิดพลาด</div>
            </div>` : ''}
          </div>

          ${errors.length ? `
            <div class="p-3 bg-red-50 border border-red-200 rounded-xl">
              <p class="text-xs font-semibold text-red-700 mb-1">รายการพบข้อผิดพลาด:</p>
              <ul class="space-y-0.5">${errors.slice(0,5).map(e => `<li class="text-xs text-red-600">• ${e}</li>`).join('')}
                ${errors.length > 5 ? `<li class="text-xs text-red-400">… และอีก ${errors.length-5} รายการ</li>` : ''}
              </ul>
            </div>` : ''}

          ${students.length ? `
            <!-- Preview table -->
            <div class="overflow-x-auto max-h-52 overflow-y-auto rounded-xl border border-gray-200">
              <table class="w-full text-xs">
                <thead class="bg-gray-50 sticky top-0">
                  <tr class="text-left text-gray-500">
                    <th class="px-3 py-2 font-semibold">เลขที่</th>
                    <th class="px-3 py-2 font-semibold">ชื่อ-นามสกุล</th>
                    <th class="px-3 py-2 font-semibold">รหัส</th>
                    <th class="px-3 py-2 font-semibold">ห้อง</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                  ${students.slice(0, 20).map(s => `
                    <tr class="hover:bg-gray-50">
                      <td class="px-3 py-2 font-mono text-gray-500">${s.number}</td>
                      <td class="px-3 py-2 font-semibold text-gray-800">${s.firstName} ${s.lastName}</td>
                      <td class="px-3 py-2 text-gray-500">${s.studentCode || '-'}</td>
                      <td class="px-3 py-2"><span class="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 font-semibold">${s.classRoom}</span></td>
                    </tr>`).join('')}
                  ${students.length > 20 ? `<tr><td colspan="4" class="px-3 py-2 text-center text-gray-400">… และอีก ${students.length-20} คน</td></tr>` : ''}
                </tbody>
              </table>
            </div>` : ''}
        </div>`;
    }

    document.getElementById('btn-do-import').onclick = async () => {
      if (!parsedStudents.length) return;
      const btn = document.getElementById('btn-do-import');
      btn.disabled = true;
      btn.textContent = `⏳ กำลังนำเข้า ${parsedStudents.length} คน...`;
      try {
        const count = await importStudentsFromCSV(parsedStudents);
        showToast(`นำเข้าสำเร็จ ${count} คน ✓`, 'success');
        closeModal();
        loadStudents();
      } catch (e) {
        showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
        btn.disabled = false;
        btn.textContent = '✅ นำเข้าข้อมูล';
      }
    };
  }

  await loadStudents();
}
