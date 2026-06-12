// pages/behavior-criteria-page.js — Admin: Manage Behavior Criteria
import { getCriteria, addCriteria, updateCriteria, deleteCriteria } from '../modules/behavior.js';
import { showToast, showConfirm, openModal, closeModal, spinnerHTML, emptyHTML } from '../modules/utils.js';

export async function renderBehaviorCriteriaPage(container, userData) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">เกณฑ์คะแนนพฤติกรรม</h1>
          <p class="text-sm text-gray-500 mt-0.5">กำหนดมาตรฐานคะแนนพฤติกรรมสำหรับครูทุกคน</p>
        </div>
        <button id="btn-add-criteria" class="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v14m7-7H5"/></svg>
          เพิ่มเกณฑ์ใหม่
        </button>
      </div>

      <!-- Info banner -->
      <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-sm text-indigo-800 flex items-start gap-2.5">
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        ครูทุกคนจะเลือกพฤติกรรมจากเกณฑ์นี้เท่านั้น ไม่สามารถกรอกคะแนนเองได้ เพื่อรักษามาตรฐาน
      </div>

      <!-- Criteria lists -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Positive -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 class="font-semibold text-green-700 flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-green-400 inline-block"></span>
            พฤติกรรมที่ดี
          </h2>
          <div id="positive-list">${spinnerHTML()}</div>
        </div>

        <!-- Negative -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
          <h2 class="font-semibold text-red-700 flex items-center gap-2">
            <span class="w-3 h-3 rounded-full bg-red-400 inline-block"></span>
            พฤติกรรมที่ไม่พึงประสงค์
          </h2>
          <div id="negative-list">${spinnerHTML()}</div>
        </div>
      </div>
    </div>`;

  let allCriteria = [];

  async function loadCriteria() {
    allCriteria = await getCriteria();
    const pos = allCriteria.filter(c => c.category === 'positive');
    const neg = allCriteria.filter(c => c.category === 'negative');

    document.getElementById('positive-list').innerHTML = pos.length
      ? renderCriteriaItems(pos)
      : emptyHTML('ยังไม่มีเกณฑ์พฤติกรรมที่ดี');

    document.getElementById('negative-list').innerHTML = neg.length
      ? renderCriteriaItems(neg)
      : emptyHTML('ยังไม่มีเกณฑ์พฤติกรรมที่ไม่พึงประสงค์');

    bindActions();
  }

  function renderCriteriaItems(list) {
    return `<div class="space-y-2">
      ${list.map(c => `
        <div class="flex items-center gap-3 p-3.5 rounded-xl border ${c.category === 'positive' ? 'border-green-100 bg-green-50/50' : 'border-red-100 bg-red-50/50'} group">
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-gray-800">${c.name}</div>
            <div class="text-xs text-gray-500 mt-0.5">${c.category === 'positive' ? 'พฤติกรรมที่ดี' : 'พฤติกรรมไม่พึงประสงค์'}</div>
          </div>
          <div class="font-bold text-lg ${c.category === 'positive' ? 'text-green-700' : 'text-red-700'}">
            ${c.score > 0 ? '+' : ''}${c.score}
          </div>
          <div class="flex gap-1.5 opacity-0 group-hover:opacity-100 transition">
            <button data-action="edit" data-cid="${c.id}" class="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 text-xs font-medium transition">แก้ไข</button>
            <button data-action="delete" data-cid="${c.id}" class="px-2.5 py-1 rounded-lg bg-white border border-gray-200 text-red-500 hover:bg-red-50 text-xs font-medium transition">ลบ</button>
          </div>
        </div>`).join('')}
    </div>`;
  }

  function bindActions() {
    document.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.onclick = () => {
        const c = allCriteria.find(x => x.id === btn.dataset.cid);
        openCriteriaModal(c);
      };
    });
    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.onclick = async () => {
        const c = allCriteria.find(x => x.id === btn.dataset.cid);
        const ok = await showConfirm('ลบเกณฑ์พฤติกรรม', `ต้องการลบ "${c.name}" ใช่หรือไม่?`);
        if (ok) {
          await deleteCriteria(c.id);
          showToast('ลบเรียบร้อย', 'success');
          loadCriteria();
        }
      };
    });
  }

  function openCriteriaModal(criteria = null) {
    const isEdit = !!criteria;
    const body = `
      <form id="criteria-form" class="space-y-4">
        <div>
          <label class="block text-xs font-semibold text-gray-600 mb-1">ชื่อพฤติกรรม *</label>
          <input name="name" value="${criteria?.name || ''}" required placeholder="เช่น จิตอาสา, ทะเลาะวิวาท"
            class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">หมวดหมู่ *</label>
            <select name="category" required class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
              <option value="positive" ${criteria?.category === 'positive' ? 'selected' : ''}>✅ พฤติกรรมที่ดี</option>
              <option value="negative" ${criteria?.category === 'negative' ? 'selected' : ''}>❌ พฤติกรรมไม่พึงประสงค์</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1">คะแนน * (+ หรือ -)</label>
            <input name="score" type="number" value="${criteria?.score ?? ''}" required placeholder="เช่น 10, -20"
              class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
        </div>
      </form>`;

    const footer = `
      <button id="modal-cancel" class="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">ยกเลิก</button>
      <button id="modal-save" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
        ${isEdit ? 'บันทึกการแก้ไข' : 'เพิ่มเกณฑ์'}
      </button>`;

    openModal(isEdit ? 'แก้ไขเกณฑ์พฤติกรรม' : 'เพิ่มเกณฑ์พฤติกรรมใหม่', body, footer);
    document.getElementById('modal-cancel').onclick = closeModal;
    document.getElementById('modal-save').onclick = async () => {
      const form = document.getElementById('criteria-form');
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const data = {
        name: fd.get('name'),
        category: fd.get('category'),
        score: parseInt(fd.get('score')) || 0,
      };
      // Auto-adjust sign based on category
      if (data.category === 'negative' && data.score > 0) data.score = -data.score;
      if (data.category === 'positive' && data.score < 0) data.score = -data.score;

      try {
        if (isEdit) await updateCriteria(criteria.id, data);
        else        await addCriteria(data);
        showToast(isEdit ? 'บันทึกเรียบร้อย' : 'เพิ่มเกณฑ์เรียบร้อย', 'success');
        closeModal();
        loadCriteria();
      } catch (e) { showToast('เกิดข้อผิดพลาด: ' + e.message, 'error'); }
    };
  }

  document.getElementById('btn-add-criteria').onclick = () => openCriteriaModal();
  await loadCriteria();
}
