// pages/scores-page.js — Manage Scores DataTable
import { db } from '../firebase-config.js';
import { getScoresByClass, saveScore, saveScoresBatch, calculateTotalScore, parseScoresFromClipboard, parseScoreCSV, makeScoreId } from '../modules/scores.js';
import { getScoreTemplate } from '../modules/score-templates.js';
import { getGradeRules, calculateGrade } from '../modules/grade-rules.js';
import { getStudents } from '../modules/students.js';
import { getSubjects, getSubjectsByTeacher } from '../modules/subjects.js';
import { getClassrooms } from '../modules/classes.js';
import { currentUser, hasRole } from '../modules/auth.js';
import { showToast, openModal, closeModal, spinnerHTML, emptyHTML } from '../modules/utils.js';

export async function renderScoresPage(container, userData) {
  const currentYear = new Date().getFullYear() + 543;
  
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex justify-between items-center">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">บันทึกคะแนน</h1>
          <p class="text-sm text-gray-500 mt-0.5">บันทึกคะแนนรายวิชาตามห้องเรียน</p>
        </div>
        <div id="save-status" class="hidden text-sm font-medium px-3 py-1.5 rounded-full bg-gray-100 text-gray-600">
          รอการบันทึก...
        </div>
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
        <div class="w-full sm:w-auto">
          <label class="block text-xs font-semibold text-gray-600 mb-1">ห้องเรียน</label>
          <select id="filter-class" class="w-full sm:w-32 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">-- เลือก --</option>
          </select>
        </div>
        <div class="w-full sm:w-auto flex-1 min-w-[200px]">
          <label class="block text-xs font-semibold text-gray-600 mb-1">รายวิชา</label>
          <select id="filter-subject" class="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300">
            <option value="">-- เลือกรายวิชา --</option>
          </select>
        </div>
        <button id="btn-load" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm w-full sm:w-auto">
          โหลดข้อมูล
        </button>
      </div>

      <div id="template-info" class="hidden p-4 bg-indigo-50 border border-indigo-200 rounded-2xl text-sm text-indigo-800 text-center font-medium"></div>

      <!-- Main Content -->
      <div id="scores-content">
        <div class="flex items-center justify-center h-48 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-2xl">
          กรุณาเลือก ปีการศึกษา ภาคเรียน ห้องเรียน รายวิชา แล้วกด "โหลดข้อมูล"
        </div>
      </div>
    </div>
  `;

  // Variables
  let template = null;
  let gradeRules = null;
  let students = [];
  let currentScores = [];
  let isReadOnly = false;

  // UI Elements
  const btnLoad = document.getElementById('btn-load');
  const selYear = document.getElementById('filter-year');
  const selTerm = document.getElementById('filter-term');
  const selClass = document.getElementById('filter-class');
  const selSubject = document.getElementById('filter-subject');
  const contentArea = document.getElementById('scores-content');
  const templateInfo = document.getElementById('template-info');
  const saveStatus = document.getElementById('save-status');

  // Load dropdowns
  try {
    const classes = await getClassrooms();
    
    // Homeroom teacher is locked to their class
    if (hasRole(userData, 'homeroom_teacher') && !hasRole(userData, 'admin') && userData.classRoom) {
      selClass.innerHTML = `<option value="${userData.classRoom}">${userData.classRoom}</option>`;
      selClass.disabled = true;
    } else {
      selClass.innerHTML = `<option value="">-- เลือก --</option>` + classes.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    let subjects = [];
    if (hasRole(userData, 'admin')) {
      subjects = await getSubjects();
    } else {
      subjects = await getSubjectsByTeacher(userData.uid);
      // If homeroom teacher, they might need to view other subjects, but for now we list what they teach
      // If they want to view everything for their class, they should use reports.
      // Or we load all subjects and mark read-only later. Let's load all subjects if homeroom.
      if (hasRole(userData, 'homeroom_teacher')) {
        subjects = await getSubjects(); // They can see all subjects for their class
      }
    }
    
    selSubject.innerHTML = `<option value="">-- เลือกรายวิชา --</option>` + 
      subjects.map(s => `<option value="${s.id}">${s.code} ${s.name}</option>`).join('');

  } catch (e) {
    showToast('โหลดข้อมูลตัวเลือกไม่สำเร็จ', 'error');
  }

  // Load Data
  btnLoad.onclick = async () => {
    const year = selYear.value;
    const term = selTerm.value;
    const classRoom = selClass.value;
    const subjectId = selSubject.value;

    if (!year || !term || !classRoom || !subjectId) {
      showToast('กรุณาเลือกข้อมูลให้ครบถ้วน', 'warning');
      return;
    }

    contentArea.innerHTML = spinnerHTML();
    templateInfo.classList.add('hidden');
    saveStatus.classList.add('hidden');

    try {
      // Check if user can edit
      isReadOnly = false;
      if (!hasRole(userData, 'admin')) {
        const mySubjects = await getSubjectsByTeacher(userData.uid);
        const teachesThis = mySubjects.some(s => s.id === subjectId);
        if (!teachesThis) {
          isReadOnly = true;
          showToast('คุณอยู่ในโหมดอ่านเท่านั้น (ไม่ใช่วิชาที่สอน)', 'info');
        }
      }

      // Fetch parallel
      const [tpl, gr, stus, scrs] = await Promise.all([
        getScoreTemplate(subjectId, year, term),
        getGradeRules(),
        getStudents(classRoom),
        getScoresByClass(subjectId, year, term, classRoom)
      ]);

      template = tpl;
      gradeRules = gr;
      students = stus;
      currentScores = scrs;

      if (!template) {
        contentArea.innerHTML = emptyHTML('ยังไม่ได้กำหนดโครงสร้างคะแนน<br><span class="text-xs">กรุณาไปที่เมนู "โครงสร้างคะแนน" ก่อน</span>');
        return;
      }

      if (students.length === 0) {
        contentArea.innerHTML = emptyHTML(`ไม่มีนักเรียนในห้อง ${classRoom}`);
        return;
      }

      renderTable();
      renderTemplateInfo();

    } catch (e) {
      contentArea.innerHTML = emptyHTML('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + e.message);
    }
  };

  function renderTemplateInfo() {
    const b = template.beforeMidterm || {};
    const a = template.afterMidterm || {};
    templateInfo.innerHTML = `
      โครงสร้างคะแนน: ก่อนกลางภาค (K:${b.K||0} P:${b.P||0} A:${b.A||0} T:${b.T||0}) | 
      กลางภาค (${template.midterm||0}) | 
      หลังกลางภาค (K:${a.K||0} P:${a.P||0} A:${a.A||0} T:${a.T||0}) | 
      ปลายภาค (${template.final||0}) | 
      รวม ${template.totalScore||100}
    `;
    templateInfo.classList.remove('hidden');
  }

  function getGradeColor(g) {
    const map = {
      '4': 'bg-emerald-100 text-emerald-700',
      '3.5': 'bg-teal-100 text-teal-700',
      '3': 'bg-cyan-100 text-cyan-700',
      '2.5': 'bg-blue-100 text-blue-700',
      '2': 'bg-amber-100 text-amber-700',
      '1.5': 'bg-orange-100 text-orange-700',
      '1': 'bg-rose-100 text-rose-700',
      '0': 'bg-red-100 text-red-700'
    };
    return map[g] || 'bg-gray-100 text-gray-700';
  }

  function renderTable() {
    // Generate Rows
    const rowsHtml = students.map((stu, i) => {
      // Find existing score
      const sc = currentScores.find(s => s.studentId === stu.id) || {};
      const b = sc.beforeMidterm || {};
      const a = sc.afterMidterm || {};
      const total = sc.totalScore || 0;
      const grade = sc.grade || '-';

      const cellParams = `data-sid="${stu.id}" ${isReadOnly ? 'disabled' : ''} class="w-14 text-center border border-gray-200 rounded-lg px-1 py-1.5 text-sm focus:ring-2 focus:ring-indigo-300 bg-white disabled:bg-gray-50" type="number" min="0" step="any"`;

      return `
        <tr class="even:bg-gray-50 hover:bg-indigo-50/30 transition group border-b border-gray-100" data-row-sid="${stu.id}">
          <td class="sticky left-0 bg-white group-even:bg-gray-50 px-3 py-2 text-center text-sm font-medium border-r border-gray-100 z-10">${stu.number}</td>
          <td class="sticky left-[3rem] bg-white group-even:bg-gray-50 px-3 py-2 text-center text-sm text-gray-500 z-10">${stu.studentCode}</td>
          <td class="sticky left-[7.5rem] bg-white group-even:bg-gray-50 px-3 py-2 text-sm whitespace-nowrap z-10">${stu.firstName} ${stu.lastName}</td>
          
          <td class="px-2 py-2 text-center"><input ${cellParams} data-field="bK" max="${template.beforeMidterm?.K||0}" value="${b.K ?? ''}"></td>
          <td class="px-2 py-2 text-center"><input ${cellParams} data-field="bP" max="${template.beforeMidterm?.P||0}" value="${b.P ?? ''}"></td>
          <td class="px-2 py-2 text-center"><input ${cellParams} data-field="bA" max="${template.beforeMidterm?.A||0}" value="${b.A ?? ''}"></td>
          <td class="px-2 py-2 text-center border-r border-gray-100"><input ${cellParams} data-field="bT" max="${template.beforeMidterm?.T||0}" value="${b.T ?? ''}"></td>
          
          <td class="px-2 py-2 text-center border-r border-gray-100 bg-indigo-50/30"><input ${cellParams} data-field="mid" max="${template.midterm||0}" value="${sc.midterm ?? ''}"></td>
          
          <td class="px-2 py-2 text-center"><input ${cellParams} data-field="aK" max="${template.afterMidterm?.K||0}" value="${a.K ?? ''}"></td>
          <td class="px-2 py-2 text-center"><input ${cellParams} data-field="aP" max="${template.afterMidterm?.P||0}" value="${a.P ?? ''}"></td>
          <td class="px-2 py-2 text-center"><input ${cellParams} data-field="aA" max="${template.afterMidterm?.A||0}" value="${a.A ?? ''}"></td>
          <td class="px-2 py-2 text-center border-r border-gray-100"><input ${cellParams} data-field="aT" max="${template.afterMidterm?.T||0}" value="${a.T ?? ''}"></td>
          
          <td class="px-2 py-2 text-center border-r border-gray-100 bg-pink-50/30"><input ${cellParams} data-field="fin" max="${template.final||0}" value="${sc.final ?? ''}"></td>
          
          <td class="px-3 py-2 text-center font-bold text-gray-800 border-r border-gray-100" data-sum="${stu.id}">${total}</td>
          <td class="px-3 py-2 text-center">
            <span data-grade="${stu.id}" class="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getGradeColor(grade)}">${grade}</span>
          </td>
        </tr>
      `;
    }).join('');

    contentArea.innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        ${!isReadOnly ? `
        <div class="p-3 bg-gray-50 border-b border-gray-100 flex justify-between items-center text-sm">
          <div class="text-gray-500">
            💡 กด <kbd class="bg-white border rounded px-1 text-xs">Ctrl</kbd> + <kbd class="bg-white border rounded px-1 text-xs">V</kbd> เพื่อวางข้อมูลจาก Excel ได้ (เรียงคอลัมน์ K,P,A,T, กลางภาค, ...)
          </div>
          <div class="flex items-center gap-2">
            <input type="file" id="csv-upload" accept=".csv" class="hidden">
            <button id="btn-upload-csv" class="px-4 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
              อัปโหลด CSV
            </button>
            <button id="btn-save-all" class="px-4 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition">
              บันทึกทั้งหมด
            </button>
          </div>
        </div>` : ''}
        
        <div class="overflow-x-auto">
          <table id="scores-table" class="min-w-full border-collapse">
            <thead>
              <tr class="bg-gray-800 text-white text-xs uppercase">
                <th rowspan="2" class="sticky left-0 bg-gray-800 px-3 py-3 font-semibold w-12 z-20 border-r border-gray-700">เลขที่</th>
                <th rowspan="2" class="sticky left-[3rem] bg-gray-800 px-3 py-3 font-semibold w-20 z-20">รหัส</th>
                <th rowspan="2" class="sticky left-[7.5rem] bg-gray-800 px-3 py-3 font-semibold text-left min-w-[150px] z-20 border-r border-gray-700">ชื่อ-สกุล</th>
                <th colspan="4" class="px-2 py-2 font-semibold text-center border-b border-r border-gray-700">ก่อนกลางภาค (${(template.beforeMidterm?.K||0)+(template.beforeMidterm?.P||0)+(template.beforeMidterm?.A||0)+(template.beforeMidterm?.T||0)})</th>
                <th rowspan="2" class="px-2 py-2 font-semibold text-center border-r border-gray-700 bg-gray-700">กลางภาค<br>(${template.midterm||0})</th>
                <th colspan="4" class="px-2 py-2 font-semibold text-center border-b border-r border-gray-700">หลังกลางภาค (${(template.afterMidterm?.K||0)+(template.afterMidterm?.P||0)+(template.afterMidterm?.A||0)+(template.afterMidterm?.T||0)})</th>
                <th rowspan="2" class="px-2 py-2 font-semibold text-center border-r border-gray-700 bg-gray-700">ปลายภาค<br>(${template.final||0})</th>
                <th rowspan="2" class="px-3 py-3 font-semibold text-center border-r border-gray-700 w-16">รวม<br>(100)</th>
                <th rowspan="2" class="px-3 py-3 font-semibold text-center w-16">เกรด</th>
              </tr>
              <tr class="bg-gray-800 text-white text-[10px] uppercase">
                <th class="px-1 py-1 font-medium text-center" title="ความรู้">K (${template.beforeMidterm?.K||0})</th>
                <th class="px-1 py-1 font-medium text-center" title="กระบวนการ">P (${template.beforeMidterm?.P||0})</th>
                <th class="px-1 py-1 font-medium text-center" title="คุณลักษณะ">A (${template.beforeMidterm?.A||0})</th>
                <th class="px-1 py-1 font-medium text-center border-r border-gray-700" title="ทักษะ">T (${template.beforeMidterm?.T||0})</th>
                
                <th class="px-1 py-1 font-medium text-center" title="ความรู้">K (${template.afterMidterm?.K||0})</th>
                <th class="px-1 py-1 font-medium text-center" title="กระบวนการ">P (${template.afterMidterm?.P||0})</th>
                <th class="px-1 py-1 font-medium text-center" title="คุณลักษณะ">A (${template.afterMidterm?.A||0})</th>
                <th class="px-1 py-1 font-medium text-center border-r border-gray-700" title="ทักษะ">T (${template.afterMidterm?.T||0})</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
      
      <!-- Grade distribution summary -->
      <div id="grade-summary" class="mt-6 flex flex-wrap gap-3"></div>
    `;

    bindEvents();
    updateGradeSummary();
  }

  function setSaveStatus(status) {
    saveStatus.classList.remove('hidden');
    if (status === 'saving') {
      saveStatus.innerHTML = '<span class="w-2 h-2 inline-block bg-yellow-400 rounded-full animate-pulse mr-2"></span>กำลังบันทึก...';
      saveStatus.className = 'text-sm font-medium px-3 py-1.5 rounded-full bg-yellow-50 text-yellow-700 border border-yellow-200 flex items-center';
    } else if (status === 'saved') {
      saveStatus.innerHTML = '✓ บันทึกแล้ว';
      saveStatus.className = 'text-sm font-medium px-3 py-1.5 rounded-full bg-green-50 text-green-700 border border-green-200 flex items-center';
      setTimeout(() => saveStatus.classList.add('hidden'), 2000);
    } else if (status === 'error') {
      saveStatus.innerHTML = '✗ เกิดข้อผิดพลาด';
      saveStatus.className = 'text-sm font-medium px-3 py-1.5 rounded-full bg-red-50 text-red-700 border border-red-200 flex items-center';
    }
  }

  // Bind Input Events
  function bindEvents() {
    if (isReadOnly) return;

    const table = document.getElementById('scores-table');
    
    // Validate Max Value & Auto-Calc
    table.addEventListener('input', (e) => {
      if (e.target.tagName === 'INPUT') {
        const inp = e.target;
        const max = parseFloat(inp.max) || 0;
        const val = parseFloat(inp.value);

        if (val > max) {
          inp.classList.add('border-red-500', 'bg-red-50', 'text-red-700');
        } else {
          inp.classList.remove('border-red-500', 'bg-red-50', 'text-red-700');
        }

        recalcRow(inp.dataset.sid);
      }
    });

    // Auto-Save on Blur
    table.addEventListener('change', async (e) => {
      if (e.target.tagName === 'INPUT') {
        const sid = e.target.dataset.sid;
        await saveSingleStudent(sid);
      }
    });

    // Excel Paste
    table.addEventListener('paste', (e) => {
      const activeEl = document.activeElement;
      if (!activeEl || activeEl.tagName !== 'INPUT') return;

      e.preventDefault();
      const clipboardData = e.clipboardData || window.clipboardData;
      const text = clipboardData.getData('Text');
      
      const colOrder = ['bK','bP','bA','bT','mid','aK','aP','aA','aT','fin'];
      const currentIdx = colOrder.indexOf(activeEl.dataset.field);
      if (currentIdx === -1) return;

      const orderToUse = colOrder.slice(currentIdx);
      const rows = parseScoresFromClipboard(text, orderToUse);
      
      const startTr = activeEl.closest('tr');
      let currentTr = startTr;

      rows.forEach(r => {
        if (!currentTr) return;
        
        Object.entries(r).forEach(([f, v]) => {
          const inp = currentTr.querySelector(`input[data-field="${f}"]`);
          if (inp && v) {
            inp.value = v;
            // validate
            if (parseFloat(v) > parseFloat(inp.max||0)) {
              inp.classList.add('border-red-500', 'bg-red-50', 'text-red-700');
            } else {
              inp.classList.remove('border-red-500', 'bg-red-50', 'text-red-700');
            }
          }
        });
        
        recalcRow(currentTr.dataset.rowSid);
        currentTr = currentTr.nextElementSibling;
      });

      showToast(`วางข้อมูล ${rows.length} แถว กด "บันทึกทั้งหมด" เมื่อตรวจสอบแล้ว`, 'info');
    });

    // CSV Upload
    const btnUploadCsv = document.getElementById('btn-upload-csv');
    const fileCsv = document.getElementById('csv-upload');
    if (btnUploadCsv && fileCsv) {
      btnUploadCsv.onclick = () => fileCsv.click();
      
      fileCsv.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const csvText = ev.target.result;
            const { headers, data } = parseScoreCSV(csvText, 1, 2);
            showCsvMappingModal(headers, data, csvText);
          } catch (err) {
            showToast('เกิดข้อผิดพลาดในการอ่านไฟล์ CSV: ' + err.message, 'error');
          }
          fileCsv.value = ''; // Reset
        };
        reader.readAsText(file);
      };
    }

    // Save All Button
    const btnSaveAll = document.getElementById('btn-save-all');
    if (btnSaveAll) {
      btnSaveAll.onclick = async () => {
        setSaveStatus('saving');
        btnSaveAll.disabled = true;
        
        const allData = [];
        students.forEach(stu => {
          allData.push(buildScoreData(stu.id));
        });

        try {
          await saveScoresBatch(allData);
          setSaveStatus('saved');
          updateGradeSummary();
        } catch (err) {
          setSaveStatus('error');
          showToast('บันทึกผิดพลาด: ' + err.message, 'error');
        }
        btnSaveAll.disabled = false;
      };
    }
  }

  function showCsvMappingModal(headers, initialData, rawCsvText) {
    const fields = [
      { id: 'bK', label: 'ก่อนกลางภาค K' }, { id: 'bP', label: 'ก่อนกลางภาค P' },
      { id: 'bA', label: 'ก่อนกลางภาค A' }, { id: 'bT', label: 'ก่อนกลางภาค T' },
      { id: 'mid', label: 'กลางภาค' },
      { id: 'aK', label: 'หลังกลางภาค K' }, { id: 'aP', label: 'หลังกลางภาค P' },
      { id: 'aA', label: 'หลังกลางภาค A' }, { id: 'aT', label: 'หลังกลางภาค T' },
      { id: 'fin', label: 'ปลายภาค' }
    ];

    const getColumnLetter = (colIndex) => {
      let letter = '';
      let temp = colIndex;
      while (temp >= 0) {
        letter = String.fromCharCode(65 + (temp % 26)) + letter;
        temp = Math.floor(temp / 26) - 1;
      }
      return letter;
    };

    const makeSelect = (fieldId) => `
      <select data-map-field="${fieldId}" class="w-full px-2 py-1.5 rounded-lg border border-gray-200 text-sm">
        <option value="">-- ไม่นำเข้า --</option>
        ${headers.map((h, i) => {
          const colLetter = getColumnLetter(i);
          const label = h ? `คอลัมน์ ${colLetter} (${h})` : `คอลัมน์ ${colLetter}`;
          return `<option value="${i}">${label}</option>`;
        }).join('')}
      </select>
    `;

    const body = `
      <div class="space-y-4">
        <div class="bg-blue-50 p-3 rounded-xl border border-blue-100 text-sm text-blue-800">
          กรุณาจับคู่คอลัมน์จากไฟล์ CSV ให้ตรงกับช่องคะแนนในระบบ <br>
          <span class="text-xs text-blue-600">(ระบบจะอ้างอิง "เลขที่" จากคอลัมน์แรกสุดของ CSV เสมอ)</span>
        </div>
        
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          ${fields.map(f => `
            <div class="flex items-center justify-between gap-2 border-b border-gray-100 pb-2">
              <span class="text-sm font-medium text-gray-700 whitespace-nowrap">${f.label}</span>
              <div class="w-32 sm:w-40">${makeSelect(f.id)}</div>
            </div>
          `).join('')}
        </div>
        
        <div class="pt-2 border-t border-gray-200">
          <label class="block text-xs font-semibold text-gray-600 mb-1">ข้อมูลเริ่มที่บรรทัด (เผื่อมี Header หลายบรรทัด)</label>
          <input type="number" id="csv-data-row" value="2" min="1" class="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm">
        </div>
      </div>
    `;

    const footer = `
      <button id="btn-cancel-csv" class="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition">ยกเลิก</button>
      <button id="btn-confirm-csv" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">นำเข้าข้อมูล</button>
    `;

    openModal('จับคู่คอลัมน์ CSV', body, footer);

    document.getElementById('btn-cancel-csv').onclick = closeModal;
    document.getElementById('btn-confirm-csv').onclick = () => {
      const dataRow = parseInt(document.getElementById('csv-data-row').value) || 2;
      let parsed;
      try {
        parsed = parseScoreCSV(rawCsvText, 1, dataRow);
      } catch (err) {
        showToast(err.message, 'error');
        return;
      }

      const mapEls = document.querySelectorAll('[data-map-field]');
      const mapping = {};
      let hasMapped = false;
      mapEls.forEach(el => {
        if (el.value !== '') {
          mapping[el.dataset.mapField] = parseInt(el.value);
          hasMapped = true;
        }
      });

      if (!hasMapped) {
        showToast('กรุณาเลือกอย่างน้อย 1 คอลัมน์ที่จะนำเข้า', 'warning');
        return;
      }

      let appliedCount = 0;
      parsed.data.forEach(row => {
        const studentNumber = parseInt(row[0]);
        if (!studentNumber || isNaN(studentNumber)) return;

        const stu = students.find(s => parseInt(s.number) === studentNumber);
        if (!stu) return;

        const tr = document.querySelector(`tr[data-row-sid="${stu.id}"]`);
        if (!tr) return;

        let rowUpdated = false;
        Object.entries(mapping).forEach(([field, colIdx]) => {
          const val = row[colIdx];
          if (val !== undefined && val !== '') {
            const inp = tr.querySelector(`input[data-field="${field}"]`);
            if (inp) {
              inp.value = val;
              if (parseFloat(val) > parseFloat(inp.max||0)) {
                inp.classList.add('border-red-500', 'bg-red-50', 'text-red-700');
              } else {
                inp.classList.remove('border-red-500', 'bg-red-50', 'text-red-700');
              }
              rowUpdated = true;
            }
          }
        });

        if (rowUpdated) {
          recalcRow(stu.id);
          appliedCount++;
        }
      });

      closeModal();
      showToast(`นำเข้าคะแนนสำเร็จ ${appliedCount} คน (อย่าลืมกด "บันทึกทั้งหมด")`, 'success');
    };
  }

  function recalcRow(sid) {
    const data = buildScoreData(sid);
    const total = calculateTotalScore(data, template);
    const grade = calculateGrade(total, gradeRules);
    
    // Update UI
    const sumEl = document.querySelector(`[data-sum="${sid}"]`);
    const grEl = document.querySelector(`[data-grade="${sid}"]`);
    
    if (sumEl) sumEl.textContent = total;
    if (grEl) {
      grEl.textContent = grade;
      grEl.className = `inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold ${getGradeColor(grade)}`;
    }
  }

  function buildScoreData(sid) {
    const getVal = (f) => {
      const el = document.querySelector(`input[data-sid="${sid}"][data-field="${f}"]`);
      return el && el.value !== '' ? parseFloat(el.value) : '';
    };

    const b = { K: getVal('bK'), P: getVal('bP'), A: getVal('bA'), T: getVal('bT') };
    const a = { K: getVal('aK'), P: getVal('aP'), A: getVal('aA'), T: getVal('aT') };
    const mid = getVal('mid');
    const fin = getVal('fin');

    const obj = {
      subjectId: selSubject.value,
      academicYear: selYear.value,
      term: selTerm.value,
      classRoom: selClass.value,
      studentId: sid,
      beforeMidterm: b,
      midterm: mid,
      afterMidterm: a,
      final: fin
    };
    
    obj.totalScore = calculateTotalScore(obj, template);
    obj.grade = calculateGrade(obj.totalScore, gradeRules);
    obj.updatedBy = currentUser().uid;

    return obj;
  }

  async function saveSingleStudent(sid) {
    setSaveStatus('saving');
    try {
      const data = buildScoreData(sid);
      await saveScore(data);
      setSaveStatus('saved');
      updateGradeSummary();
    } catch (e) {
      setSaveStatus('error');
    }
  }

  function updateGradeSummary() {
    const summary = { '4':0, '3.5':0, '3':0, '2.5':0, '2':0, '1.5':0, '1':0, '0':0, '-':0 };
    let hasScores = false;
    
    students.forEach(stu => {
      const el = document.querySelector(`[data-grade="${stu.id}"]`);
      if (el) {
        const g = el.textContent;
        if (summary[g] !== undefined) {
          summary[g]++;
          if (g !== '-') hasScores = true;
        }
      }
    });

    if (!hasScores) {
      document.getElementById('grade-summary').innerHTML = '';
      return;
    }

    const html = Object.entries(summary)
      .filter(([g, count]) => g !== '-' && count > 0)
      .sort((a,b) => parseFloat(b[0]) - parseFloat(a[0]))
      .map(([g, count]) => `
        <div class="px-4 py-2 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center gap-3">
          <span class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getGradeColor(g)}">${g}</span>
          <div class="text-sm">
            <span class="text-gray-500">จำนวน</span>
            <span class="font-bold text-gray-800 ml-1">${count}</span>
            <span class="text-gray-500 ml-1">คน</span>
          </div>
        </div>
      `).join('');

    document.getElementById('grade-summary').innerHTML = html;
  }
}
