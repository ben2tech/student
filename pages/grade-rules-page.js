// pages/grade-rules-page.js — Admin: Manage Grade Rules
import { db } from '../firebase-config.js';
import { getGradeRules, saveGradeRules } from '../modules/grade-rules.js';
import { currentUser } from '../modules/auth.js';
import { showToast, showConfirm, spinnerHTML } from '../modules/utils.js';

export async function renderGradeRulesPage(container, userData) {
  container.innerHTML = `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">เกณฑ์ตัดเกรด</h1>
        <p class="text-sm text-gray-500 mt-0.5">กำหนดเกณฑ์การตัดเกรดสำหรับทุกรายวิชา</p>
      </div>

      <!-- Info banner -->
      <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-sm text-indigo-800 flex items-start gap-2.5">
        <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        เกณฑ์ตัดเกรดนี้ใช้ร่วมกันทั้งโรงเรียน สามารถปรับแก้ได้ตามนโยบายสถานศึกษา
      </div>

      <!-- Main Content -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div id="rules-container" class="space-y-4">
          ${spinnerHTML()}
        </div>
        
        <div id="validation-error" class="hidden mt-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-200"></div>

        <div class="mt-6 flex flex-wrap gap-3 justify-end items-center pt-4 border-t border-gray-100">
          <button id="btn-add" class="mr-auto px-4 py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition flex items-center gap-2">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
            เพิ่มเกณฑ์
          </button>
          
          <button id="btn-reset" class="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">
            รีเซ็ตเป็นค่าเริ่มต้น
          </button>
          
          <button id="btn-save" class="px-8 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm flex items-center gap-2">
            บันทึก
          </button>
        </div>
      </div>
    </div>
  `;

  const containerEl = document.getElementById('rules-container');
  const errorEl = document.getElementById('validation-error');
  let currentRules = [];

  const gradeColors = {
    '4': 'bg-emerald-100 text-emerald-700',
    '3.5': 'bg-teal-100 text-teal-700',
    '3': 'bg-cyan-100 text-cyan-700',
    '2.5': 'bg-blue-100 text-blue-700',
    '2': 'bg-amber-100 text-amber-700',
    '1.5': 'bg-orange-100 text-orange-700',
    '1': 'bg-rose-100 text-rose-700',
    '0': 'bg-red-100 text-red-700'
  };

  async function loadRules() {
    try {
      currentRules = await getGradeRules();
      renderTable();
    } catch (err) {
      containerEl.innerHTML = `<div class="text-red-500">Error loading rules: ${err.message}</div>`;
    }
  }

  function renderTable() {
    // Sort by minScore descending
    currentRules.sort((a, b) => b.minScore - a.minScore);

    const rows = currentRules.map((rule, index) => {
      const color = gradeColors[rule.grade] || 'bg-gray-100 text-gray-700';
      return `
        <div class="flex items-center gap-4 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition group" data-index="${index}">
          <div class="w-24">
            <input type="text" data-field="grade" value="${rule.grade}" placeholder="เกรด" class="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-300 text-center font-semibold">
          </div>
          <div class="flex-1 flex items-center gap-3">
            <span class="text-sm text-gray-500 w-24 text-right">คะแนนต่ำสุด</span>
            <input type="number" data-field="minScore" value="${rule.minScore}" min="0" max="100" class="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-300 text-center">
            <span class="text-sm text-gray-400">-</span>
            <input type="number" data-field="maxScore" value="${rule.maxScore}" min="0" max="100" class="w-20 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-300 text-center">
            <span class="text-sm text-gray-500">คะแนนสูงสุด</span>
          </div>
          <div class="w-16 flex justify-center">
             <span class="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-bold ${color}">${rule.grade}</span>
          </div>
          <button type="button" class="btn-del p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="ลบ">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      `;
    }).join('');

    containerEl.innerHTML = rows || `<div class="text-center text-gray-500 py-8">ไม่มีเกณฑ์ตัดเกรด</div>`;

    // Bind inputs to array
    containerEl.querySelectorAll('div[data-index]').forEach(row => {
      const idx = parseInt(row.dataset.index);
      
      row.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', () => {
          const field = inp.dataset.field;
          const val = field === 'grade' ? inp.value : parseFloat(inp.value) || 0;
          currentRules[idx][field] = val;
          errorEl.classList.add('hidden'); // clear error on type
        });
      });

      row.querySelector('.btn-del').addEventListener('click', () => {
        currentRules.splice(idx, 1);
        renderTable();
      });
    });
  }

  document.getElementById('btn-add').addEventListener('click', () => {
    currentRules.push({ grade: "", minScore: 0, maxScore: 0 });
    renderTable();
  });

  document.getElementById('btn-reset').addEventListener('click', async () => {
    const ok = await showConfirm('รีเซ็ตเป็นค่าเริ่มต้น', 'ต้องการล้างค่าและกลับไปใช้เกณฑ์ตัดเกรดเริ่มต้น 8 ระดับ (4 ถึง 0) ใช่หรือไม่?');
    if (ok) {
      currentRules = [
        { minScore: 80, maxScore: 100, grade: "4" },
        { minScore: 75, maxScore: 79, grade: "3.5" },
        { minScore: 70, maxScore: 74, grade: "3" },
        { minScore: 65, maxScore: 69, grade: "2.5" },
        { minScore: 60, maxScore: 64, grade: "2" },
        { minScore: 55, maxScore: 59, grade: "1.5" },
        { minScore: 50, maxScore: 54, grade: "1" },
        { minScore: 0, maxScore: 49, grade: "0" }
      ];
      renderTable();
      errorEl.classList.add('hidden');
    }
  });

  document.getElementById('btn-save').addEventListener('click', async () => {
    // Validation
    const errors = [];
    if (currentRules.length === 0) errors.push("ต้องมีเกณฑ์ตัดเกรดอย่างน้อย 1 รายการ");
    
    currentRules.forEach((r, i) => {
      if (!r.grade) errors.push(`บรรทัดที่ ${i+1}: กรุณาระบุเกรด`);
      if (r.minScore > r.maxScore) errors.push(`บรรทัดที่ ${i+1}: คะแนนต่ำสุด ต้องไม่เกิน คะแนนสูงสุด`);
    });

    if (errors.length > 0) {
      errorEl.innerHTML = errors.join('<br>');
      errorEl.classList.remove('hidden');
      return;
    }

    try {
      const btn = document.getElementById('btn-save');
      btn.innerHTML = `<svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path></svg> กำลังบันทึก...`;
      btn.disabled = true;

      await saveGradeRules(currentRules, currentUser().uid);
      showToast('บันทึกเกณฑ์ตัดเกรดเรียบร้อย', 'success');
      
      // Reload to clean up state
      await loadRules();
      
      btn.innerHTML = `บันทึก`;
      btn.disabled = false;
    } catch (err) {
      errorEl.innerHTML = `เกิดข้อผิดพลาด: ${err.message}`;
      errorEl.classList.remove('hidden');
      document.getElementById('btn-save').innerHTML = `บันทึก`;
      document.getElementById('btn-save').disabled = false;
    }
  });

  await loadRules();
}
