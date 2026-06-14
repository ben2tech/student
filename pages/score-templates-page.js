// pages/score-templates-page.js — Manage Score Templates
import { db } from '../firebase-config.js';
import { getScoreTemplate, getScoreTemplates, saveScoreTemplate, deleteScoreTemplate, validateTemplate } from '../modules/score-templates.js';
import { getSubjects, getSubjectsByTeacher } from '../modules/subjects.js';
import { currentUser, hasRole } from '../modules/auth.js';
import { showToast, showConfirm, spinnerHTML, emptyHTML } from '../modules/utils.js';

export async function renderScoreTemplatesPage(container, userData) {
  const currentYear = new Date().getFullYear() + 543;
  
  container.innerHTML = `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">โครงสร้างคะแนน</h1>
        <p class="text-sm text-gray-500 mt-0.5">กำหนดสัดส่วนคะแนนสำหรับแต่ละรายวิชา (รวมต้องได้ 100 คะแนน)</p>
      </div>

      <!-- Filter Bar -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-wrap gap-4 items-end">
        <div class="w-full sm:w-auto">
          <label class="block text-xs font-semibold text-gray-600 mb-1">ปีการศึกษา</label>
          <select id="filter-year" class="w-full sm:w-32 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            ${[currentYear+1, currentYear, currentYear-1, currentYear-2].map(y => `<option value="${y}" ${y===currentYear?'selected':''}>${y}</option>`).join('')}
          </select>
        </div>
        <div class="w-full sm:w-auto">
          <label class="block text-xs font-semibold text-gray-600 mb-1">ภาคเรียน</label>
          <select id="filter-term" class="w-full sm:w-24 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="1">1</option>
            <option value="2">2</option>
          </select>
        </div>
        <div class="w-full sm:w-auto flex-1 min-w-[200px]">
          <label class="block text-xs font-semibold text-gray-600 mb-1">รายวิชา</label>
          <select id="filter-subject" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">-- เลือกรายวิชา --</option>
          </select>
        </div>
      </div>

      <!-- Main Content Area -->
      <div id="template-content"></div>
    </div>
  `;

  const yearSelect = document.getElementById('filter-year');
  const termSelect = document.getElementById('filter-term');
  const subjectSelect = document.getElementById('filter-subject');
  const contentArea = document.getElementById('template-content');

  // Load Subjects
  let subjects = [];
  try {
    if (hasRole(userData, 'admin')) {
      subjects = await getSubjects();
    } else {
      subjects = await getSubjectsByTeacher(currentUser().uid);
    }
    
    if (subjects.length > 0) {
      subjectSelect.innerHTML = `<option value="">-- เลือกรายวิชา --</option>` + 
        subjects.map(s => `<option value="${s.id}">${s.code} ${s.name}</option>`).join('');
    } else {
      subjectSelect.innerHTML = `<option value="">-- ไม่มีรายวิชาที่สอน --</option>`;
    }
  } catch (err) {
    showToast('ไม่สามารถดึงข้อมูลรายวิชาได้', 'error');
  }

  // Handle changes
  const reloadContent = () => {
    if (subjectSelect.value) {
      renderTemplateForm();
    } else {
      renderTemplateList();
    }
  };

  yearSelect.onchange = reloadContent;
  termSelect.onchange = reloadContent;
  subjectSelect.onchange = reloadContent;

  // Render Form for selected subject
  async function renderTemplateForm() {
    const subjectId = subjectSelect.value;
    const year = yearSelect.value;
    const term = termSelect.value;
    
    contentArea.innerHTML = spinnerHTML();
    
    const template = await getScoreTemplate(subjectId, year, term);
    
    const def = {
      b: template?.beforeMidterm || {K:'', P:'', A:'', T:''},
      m: template?.midterm ?? '',
      a: template?.afterMidterm || {K:'', P:'', A:'', T:''},
      f: template?.final ?? '',
      total: template?.totalScore ?? 100
    };

    contentArea.innerHTML = `
      <form id="template-form" class="space-y-6 animate-scale-in">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <!-- ก่อนกลางภาค -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h3 class="font-bold text-gray-800 border-b pb-2 text-center">ก่อนกลางภาค</h3>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] text-gray-500 text-center mb-1">K (ความรู้)</label>
                <input type="number" min="0" step="any" data-part="bK" value="${def.b.K}" class="score-input w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-300 text-center">
              </div>
              <div>
                <label class="block text-[10px] text-gray-500 text-center mb-1">P (กระบวนการ)</label>
                <input type="number" min="0" step="any" data-part="bP" value="${def.b.P}" class="score-input w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-300 text-center">
              </div>
              <div>
                <label class="block text-[10px] text-gray-500 text-center mb-1">A (คุณลักษณะ)</label>
                <input type="number" min="0" step="any" data-part="bA" value="${def.b.A}" class="score-input w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-300 text-center">
              </div>
            </div>
          </div>
          
          <!-- กลางภาค -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3 flex flex-col justify-center items-center">
            <h3 class="font-bold text-gray-800 text-center">กลางภาค</h3>
            <div class="w-24">
              <input type="number" min="0" step="any" data-part="mid" value="${def.m}" class="score-input w-full px-3 py-3 rounded-xl border border-gray-200 text-lg font-semibold focus:ring-2 focus:ring-indigo-300 text-center bg-indigo-50 text-indigo-700">
            </div>
          </div>
          
          <!-- หลังกลางภาค -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
            <h3 class="font-bold text-gray-800 border-b pb-2 text-center">หลังกลางภาค</h3>
            <div class="grid grid-cols-3 gap-2">
              <div>
                <label class="block text-[10px] text-gray-500 text-center mb-1">K (ความรู้)</label>
                <input type="number" min="0" step="any" data-part="aK" value="${def.a.K}" class="score-input w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-300 text-center">
              </div>
              <div>
                <label class="block text-[10px] text-gray-500 text-center mb-1">P (กระบวนการ)</label>
                <input type="number" min="0" step="any" data-part="aP" value="${def.a.P}" class="score-input w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-300 text-center">
              </div>
              <div>
                <label class="block text-[10px] text-gray-500 text-center mb-1">A (คุณลักษณะ)</label>
                <input type="number" min="0" step="any" data-part="aA" value="${def.a.A}" class="score-input w-full px-2 py-2 rounded-lg border border-gray-200 text-sm focus:ring-2 focus:ring-indigo-300 text-center">
              </div>
            </div>
          </div>
          
          <!-- ปลายภาค -->
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3 flex flex-col justify-center items-center">
            <h3 class="font-bold text-gray-800 text-center">ปลายภาค</h3>
            <div class="w-24">
              <input type="number" min="0" step="any" data-part="fin" value="${def.f}" class="score-input w-full px-3 py-3 rounded-xl border border-gray-200 text-lg font-semibold focus:ring-2 focus:ring-indigo-300 text-center bg-pink-50 text-pink-700">
            </div>
          </div>
        </div>

        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-200">
          <div class="text-center sm:text-left">
            <div class="text-gray-500 text-sm">คะแนนรวมทั้งหมด</div>
            <div id="total-display" class="text-3xl font-black ${def.total === 100 ? 'text-green-600' : 'text-red-600'}">0 / 100</div>
          </div>
          
          <div class="flex gap-3 w-full sm:w-auto">
            ${template ? `<button type="button" id="btn-delete" class="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-white border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition">ลบโครงสร้าง</button>` : ''}
            <button type="submit" id="btn-save" class="flex-1 sm:flex-none px-8 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
              บันทึกโครงสร้างคะแนน
            </button>
          </div>
        </div>
      </form>
    `;

    // Calculation logic
    const inputs = document.querySelectorAll('.score-input');
    const totalDisplay = document.getElementById('total-display');

    function calculateSum() {
      let sum = 0;
      inputs.forEach(inp => {
        sum += parseFloat(inp.value) || 0;
      });
      totalDisplay.textContent = `${sum} / 100`;
      
      if (sum === 100) {
        totalDisplay.className = 'text-3xl font-black text-green-600';
      } else {
        totalDisplay.className = 'text-3xl font-black text-red-600';
      }
      return sum;
    }

    inputs.forEach(inp => inp.addEventListener('input', calculateSum));
    calculateSum();

    // Save
    document.getElementById('template-form').onsubmit = async (e) => {
      e.preventDefault();
      
      const sum = calculateSum();
      if (sum !== 100) {
        showToast('กรุณากำหนดสัดส่วนคะแนนให้รวมได้ 100 คะแนนพอดี', 'error');
        return;
      }

      const getVal = (part) => parseFloat(document.querySelector(`[data-part="${part}"]`).value) || 0;

      const data = {
        subjectId: subjectId,
        academicYear: parseInt(year),
        term: parseInt(term),
        beforeMidterm: { K: getVal('bK'), P: getVal('bP'), A: getVal('bA'), T: 0 },
        midterm: getVal('mid'),
        afterMidterm: { K: getVal('aK'), P: getVal('aP'), A: getVal('aA'), T: 0 },
        final: getVal('fin'),
        totalScore: 100,
        createdBy: currentUser().uid
      };

      try {
        document.getElementById('btn-save').textContent = 'กำลังบันทึก...';
        document.getElementById('btn-save').disabled = true;
        
        await saveScoreTemplate(data);
        showToast('บันทึกโครงสร้างคะแนนเรียบร้อย', 'success');
        
        document.getElementById('btn-save').textContent = 'บันทึกโครงสร้างคะแนน';
        document.getElementById('btn-save').disabled = false;
        
        renderTemplateForm(); // Re-render to show delete button
      } catch (err) {
        showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
      }
    };

    // Delete
    const btnDelete = document.getElementById('btn-delete');
    if (btnDelete) {
      btnDelete.onclick = async () => {
        const ok = await showConfirm('ลบโครงสร้างคะแนน', 'คุณแน่ใจหรือไม่ว่าจะลบโครงสร้างคะแนนนี้? การกระทำนี้ไม่ส่งผลต่อคะแนนของนักเรียนที่กรอกไปแล้ว');
        if (ok) {
          try {
            await deleteScoreTemplate(template.id);
            showToast('ลบเรียบร้อย', 'success');
            renderTemplateForm();
          } catch (err) {
            showToast('ลบไม่สำเร็จ: ' + err.message, 'error');
          }
        }
      };
    }
  }

  // Render List of existing templates
  async function renderTemplateList() {
    const year = yearSelect.value;
    const term = termSelect.value;
    contentArea.innerHTML = spinnerHTML();

    try {
      const templates = await getScoreTemplates(year, term);
      
      if (templates.length === 0) {
        contentArea.innerHTML = emptyHTML(`ยังไม่มีโครงสร้างคะแนนในปีการศึกษา ${year} ภาคเรียนที่ ${term}<br><span class="text-xs">เลือกรายวิชาด้านบนเพื่อสร้างโครงสร้างใหม่</span>`);
        return;
      }

      // Map subject names
      const templateCards = templates.map(t => {
        const subject = subjects.find(s => s.id === t.subjectId);
        const subjName = subject ? `${subject.code} ${subject.name}` : `รหัสวิชา: ${t.subjectId}`;
        
        const sumBefore = (t.beforeMidterm?.K||0) + (t.beforeMidterm?.P||0) + (t.beforeMidterm?.A||0);
        const sumAfter = (t.afterMidterm?.K||0) + (t.afterMidterm?.P||0) + (t.afterMidterm?.A||0);
        
        return `
          <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:border-indigo-200 transition cursor-pointer" onclick="document.getElementById('filter-subject').value='${t.subjectId}'; document.getElementById('filter-subject').dispatchEvent(new Event('change'))">
            <h3 class="font-bold text-gray-800 mb-3">${subjName}</h3>
            <div class="flex justify-between items-center text-xs text-gray-500 mb-2">
              <span>ก่อนกลางภาค: <span class="font-semibold text-gray-700">${sumBefore}</span></span>
              <span>กลางภาค: <span class="font-semibold text-gray-700">${t.midterm||0}</span></span>
            </div>
            <div class="flex justify-between items-center text-xs text-gray-500 mb-3">
              <span>หลังกลางภาค: <span class="font-semibold text-gray-700">${sumAfter}</span></span>
              <span>ปลายภาค: <span class="font-semibold text-gray-700">${t.final||0}</span></span>
            </div>
            <div class="pt-3 border-t border-gray-100 flex justify-between items-center">
              <span class="text-xs text-gray-400">รวม</span>
              <span class="font-bold text-lg ${t.totalScore === 100 ? 'text-green-600' : 'text-red-600'}">${t.totalScore || 100}</span>
            </div>
          </div>
        `;
      }).join('');

      contentArea.innerHTML = `
        <h3 class="font-semibold text-gray-700 mb-4 px-1">โครงสร้างคะแนนที่มีอยู่ (${templates.length} วิชา)</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          ${templateCards}
        </div>
      `;
    } catch (err) {
      contentArea.innerHTML = emptyHTML('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    }
  }

  // Initial load
  renderTemplateList();
}
