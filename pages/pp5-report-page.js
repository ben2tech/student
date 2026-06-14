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

  // Print CSS injected if not exists
  if (!document.getElementById('pp5-print-style')) {
    const style = document.createElement('style');
    style.id = 'pp5-print-style';
    style.innerHTML = `
      @media print {
        body > *:not(#layout-app) { display: none !important; }
        #layout-app > aside { display: none !important; }
        #layout-app > div > header { display: none !important; }
        .no-print { display: none !important; }
        
        #layout-app, #layout-app > div, #app-content { 
          display: block !important; 
          padding: 0 !important; 
          margin: 0 !important;
          background: white !important;
        }
        
        @page { 
          size: A4 landscape; 
          margin: 10mm;
        }
        
        #pp5-preview { 
          font-family: 'Sarabun', 'TH SarabunPSK', serif, sans-serif !important;
          font-size: 11pt !important; 
          color: black !important;
          width: 100% !important;
          background: white !important;
          box-shadow: none !important;
          border: none !important;
        }
        
        #pp5-preview table { 
          width: 100%; 
          border-collapse: collapse; 
        }
        
        #pp5-preview th, #pp5-preview td { 
          border: 1px solid black !important; 
          padding: 3px 5px !important; 
          text-align: center;
        }
        
        #pp5-preview .text-left { text-align: left !important; }
        
        /* Remove background colors and badges for print */
        #pp5-preview .bg-emerald-100, #pp5-preview .bg-teal-100, 
        #pp5-preview .bg-cyan-100, #pp5-preview .bg-blue-100, 
        #pp5-preview .bg-amber-100, #pp5-preview .bg-orange-100, 
        #pp5-preview .bg-rose-100, #pp5-preview .bg-red-100,
        #pp5-preview .bg-gray-100, #pp5-preview .bg-indigo-50, #pp5-preview .bg-pink-50 {
          background-color: transparent !important;
          color: black !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  container.innerHTML = `
    <div class="space-y-6">
      <div class="no-print">
        <h1 class="text-2xl font-bold text-gray-800">พิมพ์ ปพ.5</h1>
        <p class="text-sm text-gray-500 mt-0.5">แบบบันทึกผลการเรียนรายวิชา</p>
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

  function renderDocument(template, gradeRules, students, scores, year, term, classRoom, subjCode, subjName) {
    const b = template.beforeMidterm || {};
    const a = template.afterMidterm || {};

    let sums = {
      bK:0, bP:0, bA:0, bT:0, mid:0,
      aK:0, aP:0, aA:0, aT:0, fin:0, total:0
    };
    let count = students.length;
    let gradeCounts = { '4':0, '3.5':0, '3':0, '2.5':0, '2':0, '1.5':0, '1':0, '0':0 };

    const rowsHtml = students.map(stu => {
      const sc = scores.find(s => s.studentId === stu.id) || {};
      const sb = sc.beforeMidterm || {};
      const sa = sc.afterMidterm || {};
      
      const v = (val) => val !== undefined && val !== '' && val !== null ? parseFloat(val) : 0;
      
      const bK = v(sb.K); const bP = v(sb.P); const bA = v(sb.A); const bT = v(sb.T);
      const mid = v(sc.midterm);
      const aK = v(sa.K); const aP = v(sa.P); const aA = v(sa.A); const aT = v(sa.T);
      const fin = v(sc.final);
      const total = v(sc.totalScore);
      const grade = sc.grade || '-';

      sums.bK += bK; sums.bP += bP; sums.bA += bA; sums.bT += bT;
      sums.mid += mid;
      sums.aK += aK; sums.aP += aP; sums.aA += aA; sums.aT += aT;
      sums.fin += fin;
      sums.total += total;

      if (grade !== '-' && gradeCounts[grade] !== undefined) {
        gradeCounts[grade]++;
      }

      const p = (val) => val === 0 && !sc.totalScore ? '-' : val;

      return `
        <tr>
          <td>${stu.number}</td>
          <td>${stu.studentCode}</td>
          <td class="text-left whitespace-nowrap">${stu.firstName} ${stu.lastName}</td>
          <td>${p(bK)}</td><td>${p(bP)}</td><td>${p(bA)}</td><td>${p(bT)}</td>
          <td class="bg-indigo-50/50 font-medium">${p(mid)}</td>
          <td>${p(aK)}</td><td>${p(aP)}</td><td>${p(aA)}</td><td>${p(aT)}</td>
          <td class="bg-pink-50/50 font-medium">${p(fin)}</td>
          <td class="font-bold">${p(total)}</td>
          <td class="font-bold"><span class="inline-block px-2 rounded-md ${getGradeColor(grade)}">${grade}</span></td>
        </tr>
      `;
    }).join('');

    const avg = (sum) => count > 0 ? (sum / count).toFixed(2) : '-';

    const tableHtml = `
      <table class="w-full text-sm border-collapse border border-gray-400">
        <thead>
          <tr class="bg-gray-100">
            <th rowspan="2" class="w-10">เลขที่</th>
            <th rowspan="2" class="w-16">รหัส</th>
            <th rowspan="2" class="text-left w-48">ชื่อ-สกุล</th>
            <th colspan="4">คะแนนก่อนกลางภาค</th>
            <th rowspan="2" class="w-12 bg-gray-200">กลางภาค</th>
            <th colspan="4">คะแนนหลังกลางภาค</th>
            <th rowspan="2" class="w-12 bg-gray-200">ปลายภาค</th>
            <th rowspan="2" class="w-12 font-bold">รวม</th>
            <th rowspan="2" class="w-16 font-bold">ผลการเรียน</th>
          </tr>
          <tr class="bg-gray-50 text-[11px]">
            <th class="w-8">K</th><th class="w-8">P</th><th class="w-8">A</th><th class="w-8">T</th>
            <th class="w-8">K</th><th class="w-8">P</th><th class="w-8">A</th><th class="w-8">T</th>
          </tr>
          <tr class="bg-yellow-50 text-xs font-semibold text-gray-700">
            <td colspan="3" class="text-right pr-2">คะแนนเต็ม</td>
            <td>(${b.K||0})</td><td>(${b.P||0})</td><td>(${b.A||0})</td><td>(${b.T||0})</td>
            <td class="bg-yellow-100">(${template.midterm||0})</td>
            <td>(${a.K||0})</td><td>(${a.P||0})</td><td>(${a.A||0})</td><td>(${a.T||0})</td>
            <td class="bg-yellow-100">(${template.final||0})</td>
            <td>(100)</td>
            <td>-</td>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-300">
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr class="bg-gray-100 font-semibold text-xs">
            <td colspan="3" class="text-right pr-2">คะแนนเฉลี่ย</td>
            <td>${avg(sums.bK)}</td><td>${avg(sums.bP)}</td><td>${avg(sums.bA)}</td><td>${avg(sums.bT)}</td>
            <td>${avg(sums.mid)}</td>
            <td>${avg(sums.aK)}</td><td>${avg(sums.aP)}</td><td>${avg(sums.aA)}</td><td>${avg(sums.aT)}</td>
            <td>${avg(sums.fin)}</td>
            <td class="text-indigo-700">${avg(sums.total)}</td>
            <td>-</td>
          </tr>
        </tfoot>
      </table>
    `;

    // Summary box
    let summaryHtml = '<div class="flex gap-4 mb-2">';
    ['4', '3.5', '3', '2.5', '2', '1.5', '1', '0'].forEach(g => {
      summaryHtml += `<div>เกรด ${g}: <span class="font-bold">${gradeCounts[g]}</span> คน</div>`;
    });
    summaryHtml += '</div>';
    
    summaryHtml += `
      <div class="mt-2 text-gray-700">
        จำนวนนักเรียนทั้งหมด: <span class="font-bold">${count}</span> คน &nbsp;&nbsp;|&nbsp;&nbsp; 
        คะแนนเฉลี่ยรายวิชา: <span class="font-bold">${avg(sums.total)}</span>
      </div>
    `;

    previewContainer.innerHTML = `
      <div id="pp5-preview" class="bg-white p-8 rounded-2xl shadow-md border border-gray-200 overflow-x-auto max-w-5xl mx-auto" style="font-family: 'Sarabun', 'TH SarabunPSK', sans-serif;">
        
        <div class="text-center mb-6">
          <h2 class="text-xl font-bold mb-1">แบบบันทึกผลการเรียนรายวิชา (ปพ.5)</h2>
          <h3 class="text-lg font-bold mb-3">โรงเรียนเบญจมราชรังสฤษฎิ์ ๒</h3>
          <div class="flex justify-center gap-6 text-sm">
            <span>ชั้น <span class="font-bold">${classRoom}</span></span>
            <span>วิชา <span class="font-bold">${subjCode} ${subjName}</span></span>
            <span>ภาคเรียนที่ <span class="font-bold">${term}</span> ปีการศึกษา <span class="font-bold">${year}</span></span>
          </div>
        </div>

        ${tableHtml}

        <div class="mt-8 border border-gray-400 p-4 rounded bg-gray-50 text-sm">
          <div class="font-bold mb-2 underline">สรุปผลการเรียน</div>
          ${summaryHtml}
        </div>
        
        <div class="mt-12 flex justify-around text-sm text-center">
          <div>
            <div>ลงชื่อ .............................................................. ครูผู้สอน</div>
            <div class="mt-2">( .............................................................. )</div>
          </div>
          <div>
            <div>ลงชื่อ .............................................................. หัวหน้ากลุ่มสาระฯ</div>
            <div class="mt-2">( .............................................................. )</div>
          </div>
        </div>

      </div>
    `;
  }
}
