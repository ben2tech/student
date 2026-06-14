// pages/pp5-report-page.js — PP5 Report Print Preview
import { db } from '../firebase-config.js';
import { getScoresByClass } from '../modules/scores.js';
import { getScoreTemplate } from '../modules/score-templates.js';
import { getGradeRules } from '../modules/grade-rules.js';
import { getStudents } from '../modules/students.js';
import { getSubjects, getSubjectsByTeacher } from '../modules/subjects.js';
import { getClassrooms } from '../modules/classes.js';
import { hasRole } from '../modules/auth.js';
import { showToast, spinnerHTML, emptyHTML } from '../modules/utils.js';

export async function renderPp5ReportPage(container, userData) {
  const currentYear = new Date().getFullYear() + 543;

  container.innerHTML = `
    <style id="pp5-print-style">
      /* Screen Styles */
      #pp5-preview { 
        font-family: 'Sarabun', 'TH SarabunPSK', sans-serif;
        background: white;
        color: black;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        border: 1px solid #e5e7eb;
        max-width: 210mm;
        margin: 0 auto;
        padding: 15mm 10mm;
        box-sizing: border-box;
      }
      #pp5-preview table { 
        width: 100%; 
        border-collapse: collapse; 
        table-layout: fixed;
      }
      #pp5-preview th, #pp5-preview td { 
        border: 1px solid black !important; 
        padding: 4px 2px; 
        text-align: center;
        font-size: 10px;
        line-height: 1.2;
        word-wrap: break-word;
      }
      #pp5-preview .text-left { text-align: left; }
      
      @media print {
        html, body {
          background: white !important;
          color: black !important;
          margin: 0 !important;
          padding: 0 !important;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
        }
        
        /* ซ่อนส่วนประกอบที่ไม่ต้องการพิมพ์ */
        aside, header, #sidebar-overlay, .no-print {
          display: none !important;
        }
        
        #layout-app, #layout-app > div.flex-1, #app-content { 
          display: block !important; 
          padding: 0 !important; 
          margin: 0 !important;
          background: white !important;
          border: none !important;
          box-shadow: none !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        
        @page { 
          size: A4 portrait; 
          margin: 5mm;
        }
        
        #pp5-preview { 
          font-family: 'Sarabun', 'TH SarabunPSK', serif, sans-serif !important;
          font-size: 9px !important; 
          color: black !important;
          width: 100% !important;
          background: white !important;
          box-shadow: none !important;
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        
        #pp5-preview table { 
          width: 100% !important; 
          border-collapse: collapse !important; 
          table-layout: fixed !important;
        }
        
        #pp5-preview th, #pp5-preview td { 
          border: 1px solid black !important; 
          padding: 2px 1px !important; 
          text-align: center !important;
          font-size: 8px !important;
          line-height: 1.1 !important;
          word-wrap: break-word !important;
        }
        
        #pp5-preview .text-left { text-align: left !important; }
      }
    </style>

    <div class="space-y-6">
      <div class="no-print">
        <h1 class="text-2xl font-bold text-gray-800">พิมพ์ ปพ.5</h1>
        <p class="text-sm text-gray-500 mt-0.5">แบบบันทึกผลการเรียนรายวิชา (แนวตั้ง)</p>
      </div>

      <!-- Filter Bar -->
      <div class="no-print bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex flex-wrap gap-4 items-end">
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
        <button id="btn-preview" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm w-full sm:w-auto">
          Preview ปพ.5
        </button>
      </div>

      <!-- Actions Bar (Hidden until preview loaded) -->
      <div id="actions-bar" class="no-print hidden flex gap-3 justify-end">
        <button id="btn-print" class="px-6 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-medium hover:bg-gray-900 transition shadow-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
          พิมพ์ / ส่งออก PDF
        </button>
      </div>

      <!-- Preview Area -->
      <div id="preview-container">
        <div class="flex items-center justify-center h-48 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-2xl no-print">
          กรุณาเลือกข้อมูลแล้วกด "Preview ปพ.5"
        </div>
      </div>
    </div>
  `;

  // UI Elements
  const btnPreview = document.getElementById('btn-preview');
  const selYear = document.getElementById('filter-year');
  const selTerm = document.getElementById('filter-term');
  const selClass = document.getElementById('filter-class');
  const selSubject = document.getElementById('filter-subject');
  const previewContainer = document.getElementById('preview-container');
  const actionsBar = document.getElementById('actions-bar');

  // Load dropdowns
  try {
    const classes = await getClassrooms();
    
    if (hasRole(userData, 'homeroom_teacher') && !hasRole(userData, 'admin') && userData.classRoom) {
      selClass.innerHTML = `<option value="${userData.classRoom}">${userData.classRoom}</option>`;
      selClass.disabled = true;
    } else {
      selClass.innerHTML = `<option value="">-- เลือก --</option>` + classes.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    let subjects = [];
    if (hasRole(userData, 'admin') || hasRole(userData, 'homeroom_teacher')) {
      subjects = await getSubjects();
    } else {
      subjects = await getSubjectsByTeacher(userData.uid);
    }
    
    selSubject.innerHTML = `<option value="">-- เลือกรายวิชา --</option>` + 
      subjects.map(s => `<option value="${s.id}" data-name="${s.name}" data-code="${s.code}">${s.code} ${s.name}</option>`).join('');

  } catch (e) {
    showToast('โหลดข้อมูลตัวเลือกไม่สำเร็จ', 'error');
  }

  // Preview Logic
  btnPreview.onclick = async () => {
    const year = selYear.value;
    const term = selTerm.value;
    const classRoom = selClass.value;
    const subjectId = selSubject.value;
    
    const subjectOption = selSubject.options[selSubject.selectedIndex];
    const subjCode = subjectOption?.dataset.code || '';
    const subjName = subjectOption?.dataset.name || '';

    if (!year || !term || !classRoom || !subjectId) {
      showToast('กรุณาเลือกข้อมูลให้ครบถ้วน', 'warning');
      return;
    }

    previewContainer.innerHTML = spinnerHTML();
    actionsBar.classList.add('hidden');

    try {
      const [template, gradeRules, students, scores] = await Promise.all([
        getScoreTemplate(subjectId, year, term),
        getGradeRules(),
        getStudents(classRoom),
        getScoresByClass(subjectId, year, term, classRoom)
      ]);

      if (!template) {
        previewContainer.innerHTML = emptyHTML('ยังไม่ได้กำหนดโครงสร้างคะแนนวิชานี้');
        return;
      }

      if (students.length === 0) {
        previewContainer.innerHTML = emptyHTML(`ไม่มีนักเรียนในห้อง ${classRoom}`);
        return;
      }

      renderDocument(template, gradeRules, students, scores, year, term, classRoom, subjCode, subjName);
      actionsBar.classList.remove('hidden');

    } catch (e) {
      previewContainer.innerHTML = emptyHTML('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + e.message);
    }
  };

  // Print Logic
  document.getElementById('btn-print').onclick = () => {
    window.print();
  };

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
    return map[g] || '';
  }

  function formatClassRoom(classRoom) {
    let clean = classRoom.replace('ม.', '').replace('ม', '').trim();
    return `ชั้นมัธยมศึกษาปีที่ ${clean}`;
  }

  function renderDocument(template, gradeRules, students, scores, year, term, classRoom, subjCode, subjName) {
    const b = template.beforeMidterm || {};
    const a = template.afterMidterm || {};

    const v = (val) => val !== undefined && val !== '' && val !== null ? parseFloat(val) : 0;
    
    // Calculate ratio text values
    const beforeSum = v(b.K) + v(b.P) + v(b.A) + v(b.T);
    const midMax = v(template.midterm);
    const afterSum = v(a.K) + v(a.P) + v(a.A) + v(a.T);
    const finalMax = v(template.final);

    let sums = {
      bK:0, bP:0, bA:0, bT:0, mid:0,
      aK:0, aP:0, aA:0, aT:0, fin:0, totalBefore:0, total:0
    };
    let count = students.length;

    const rowsHtml = students.map(stu => {
      const sc = scores.find(s => s.studentId === stu.id) || {};
      const sb = sc.beforeMidterm || {};
      const sa = sc.afterMidterm || {};
      
      const hasScores = sc.totalScore !== undefined && sc.totalScore !== null && sc.totalScore !== '';
      
      const bK = v(sb.K); const bP = v(sb.P); const bA = v(sb.A); const bT = v(sb.T);
      const mid = v(sc.midterm);
      const aK = v(sa.K); const aP = v(sa.P); const aA = v(sa.A); const aT = v(sa.T);
      const fin = v(sc.final);
      const totalBefore = hasScores ? (bK + bP + bA + bT + mid + aK + aP + aA + aT) : 0;
      const total = v(sc.totalScore);
      const grade = sc.grade || '-';

      sums.bK += bK; sums.bP += bP; sums.bA += bA; sums.bT += bT;
      sums.mid += mid;
      sums.aK += aK; sums.aP += aP; sums.aA += aA; sums.aT += aT;
      sums.fin += fin;
      sums.totalBefore += totalBefore;
      sums.total += total;

      const p = (val) => !hasScores ? '-' : val;

      return `
        <tr>
          <td>${stu.number}</td>
          <td>${stu.studentCode}</td>
          <td class="text-left whitespace-nowrap">${stu.firstName} ${stu.lastName}</td>
          <td></td> <!-- คอลัมน์คะแนนเปล่า -->
          <td>${p(bK)}</td><td>${p(bP)}</td><td>${p(bA)}</td><td>${p(bT)}</td>
          <td>${p(mid)}</td>
          <td>${p(aK)}</td><td>${p(aP)}</td><td>${p(aA)}</td><td>${p(aT)}</td>
          <td>${p(totalBefore)}</td>
          <td>${p(fin)}</td>
          <td class="font-bold">${p(total)}</td>
          <td class="font-bold">${grade}</td>
        </tr>
      `;
    }).join('');

    // Extract all valid grades
    const gradesArray = students.map(stu => {
      const sc = scores.find(s => s.studentId === stu.id) || {};
      return sc.grade;
    }).filter(g => g !== undefined && g !== null && g !== '-' && g !== '');

    // Helper to calculate Mode (ฐานนิยม)
    const calculateMode = (arr) => {
      if (arr.length === 0) return '-';
      const counts = {};
      let maxCount = 0;
      let mode = '-';
      const gradeWeights = { '4': 8, '3.5': 7, '3': 6, '2.5': 5, '2': 4, '1.5': 3, '1': 2, '0': 1 };
      
      for (const val of arr) {
        counts[val] = (counts[val] || 0) + 1;
        if (counts[val] > maxCount) {
          maxCount = counts[val];
          mode = val;
        } else if (counts[val] === maxCount) {
          if (gradeWeights[val] > gradeWeights[mode]) {
            mode = val;
          }
        }
      }
      return mode;
    };

    const gradeMode = calculateMode(gradesArray);
    const avg = (sum) => count > 0 ? (sum / count).toFixed(2) : '-';

    const tableHtml = `
      <table>
        <colgroup>
          <col style="width: 4%;">
          <col style="width: 8%;">
          <col style="width: 27%;">
          <col style="width: 4%;">
          <col style="width: 4%;">
          <col style="width: 4%;">
          <col style="width: 4%;">
          <col style="width: 4%;">
          <col style="width: 5%;">
          <col style="width: 4%;">
          <col style="width: 4%;">
          <col style="width: 4%;">
          <col style="width: 4%;">
          <col style="width: 5%;">
          <col style="width: 5%;">
          <col style="width: 5%;">
          <col style="width: 5%;">
        </colgroup>
        <thead>
          <tr>
            <th rowspan="2">เลขที่</th>
            <th rowspan="2">เลข<br>ประจำตัว</th>
            <th rowspan="2">ชื่อ-สกุล</th>
            <th rowspan="2">คะ<br>แนน</th>
            <th colspan="4">ก่อนกลางภาค</th>
            <th rowspan="2">กลาง<br>ภาค</th>
            <th colspan="4">หลังกลางภาค</th>
            <th rowspan="2">รวม</th>
            <th rowspan="2">ปลาย<br>ภาค</th>
            <th>รวม</th>
            <th rowspan="2">เกรด</th>
          </tr>
          <tr>
            <th>K</th><th>P</th><th>A</th><th>T</th>
            <th>K</th><th>P</th><th>A</th><th>T</th>
            <th class="text-[9px] font-normal">100</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr class="font-semibold">
            <td colspan="3" class="text-right pr-2">คะแนนเฉลี่ย/ฐานนิยม</td>
            <td></td>
            <td></td><td></td><td></td><td></td>
            <td></td>
            <td></td><td></td><td></td><td></td>
            <td></td>
            <td></td>
            <td class="font-bold">${avg(sums.total)}</td>
            <td class="font-bold">${gradeMode}</td>
          </tr>
        </tfoot>
      </table>
    `;

    previewContainer.innerHTML = `
      <div id="pp5-preview">
        
        <div class="text-center mb-4 text-black">
          <h2 class="text-base font-bold mb-0.5">แบบบันทึกคะแนน ปพ.5</h2>
          <h3 class="text-xs font-semibold mb-1">
            ${formatClassRoom(classRoom)} &nbsp; ปีการศึกษา ${year} &nbsp; โรงเรียนเบญจมราชรังสฤษฎิ์ ๒
          </h3>
          <div class="text-[10px] font-normal">
            อัตราส่วนคะแนน &nbsp; ${beforeSum} : ${midMax} : ${afterSum} : ${finalMax}
          </div>
        </div>
 
        ${tableHtml}
 
      </div>
    `;
  }
}
