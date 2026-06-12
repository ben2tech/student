// pages/reports-page.js — Reports & Analytics
import { buildMonthlyReport, exportMonthlyCSV, buildSubjectAttendanceReport, buildBehaviorSummaryReport } from '../modules/reports.js';
import { getSubjects, getSubjectsByTeacher } from '../modules/subjects.js';
import { getStudents } from '../modules/students.js';
import { showToast, formatThaiDate, spinnerHTML, emptyHTML, downloadCSV } from '../modules/utils.js';
import { getClassrooms } from '../modules/classes.js';
import { hasRole, currentUser } from '../modules/auth.js';
import { getSubjectAttendanceAll } from '../modules/attendance.js';

export async function renderReportsPage(container, userData) {
  const isAdmin = hasRole(userData, 'admin');
  const classrooms = await getClassrooms();
  const defaultClass = userData.classRoom || classrooms[0] || '';
  
  // Load subjects for subject report
  const subjects = isAdmin ? await getSubjects() : await getSubjectsByTeacher(currentUser().uid);

  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div>
          <h1 class="text-2xl font-bold text-gray-800">รายงานและสถิติ</h1>
          <p class="text-sm text-gray-500 mt-0.5">สรุปผลการเช็คชื่อรายห้อง รายวิชา และพฤติกรรม</p>
        </div>
      </div>

      <!-- Main Tabs -->
      <div class="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit no-print">
        <button id="tab-morning" class="report-tab px-5 py-2 rounded-lg text-sm font-medium transition bg-white shadow text-indigo-700">เช็คชื่อเช้า</button>
        <button id="tab-subject" class="report-tab px-5 py-2 rounded-lg text-sm font-medium transition text-gray-500 hover:text-gray-700">รายวิชา</button>
        <button id="tab-behavior" class="report-tab px-5 py-2 rounded-lg text-sm font-medium transition text-gray-500 hover:text-gray-700">พฤติกรรม</button>
      </div>

      <!-- Filter Bar -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 no-print">
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <!-- Room selector (visible for morning/behavior) -->
          <div id="filter-room-group">
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">ห้องเรียน</label>
            ${isAdmin ? `
              <select id="report-class" class="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white">
                ${classrooms.map(c => `<option value="${c}" ${c === defaultClass ? 'selected' : ''}>${c}</option>`).join('')}
              </select>` : `
              <div class="px-3 py-2 rounded-xl bg-gray-50 border border-gray-100 text-gray-700 text-sm font-medium">${userData.classRoom || 'ไม่ระบุห้อง'}</div>`}
          </div>

          <!-- Subject selector (visible for subject tab) -->
          <div id="filter-subject-group" class="hidden">
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">เลือกรายวิชา</label>
            <select id="report-subject" class="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white font-medium">
              <option value="">-- เลือกวิชา --</option>
              ${subjects.map(s => `<option value="${s.id}">${s.code} ${s.name}</option>`).join('')}
            </select>
          </div>

          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">วันที่เริ่มต้น</label>
            <input type="date" id="report-start" class="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
          <div>
            <label class="block text-xs font-semibold text-gray-600 mb-1.5">วันที่สิ้นสุด</label>
            <input type="date" id="report-end" class="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"/>
          </div>
          <div class="flex flex-col justify-end">
            <button id="btn-load-report" class="w-full px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition shadow-sm">
              🔍 ดูรายงาน
            </button>
          </div>
        </div>
      </div>

      <div id="report-content">${emptyHTML('เลือกเงื่อนไขแล้วกด "ดูรายงาน"')}</div>
    </div>`;

  let activeTab = 'morning';
  const now = new Date();
  document.getElementById('report-start').value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  document.getElementById('report-end').value   = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll('.report-tab').forEach(b => {
      b.classList.remove('bg-white', 'shadow', 'text-indigo-700');
      b.classList.add('text-gray-500', 'hover:text-gray-700');
    });
    const active = document.getElementById(`tab-${tab}`);
    active.classList.add('bg-white', 'shadow', 'text-indigo-700');
    active.classList.remove('text-gray-500', 'hover:text-gray-700');

    // Toggle filter visibility
    if (tab === 'subject') {
      document.getElementById('filter-room-group').classList.add('hidden');
      document.getElementById('filter-subject-group').classList.remove('hidden');
    } else {
      document.getElementById('filter-room-group').classList.remove('hidden');
      document.getElementById('filter-subject-group').classList.add('hidden');
    }
    document.getElementById('report-content').innerHTML = emptyHTML('เลือกเงื่อนไขแล้วกด "ดูรายงาน"');
  }

  document.getElementById('tab-morning').onclick  = () => switchTab('morning');
  document.getElementById('tab-subject').onclick  = () => switchTab('subject');
  document.getElementById('tab-behavior').onclick = () => switchTab('behavior');

  async function loadReport() {
    const classRoom = isAdmin ? document.getElementById('report-class')?.value : userData.classRoom;
    const subjectId = document.getElementById('report-subject').value;
    const start = document.getElementById('report-start').value;
    const end   = document.getElementById('report-end').value;

    if (activeTab === 'subject' && !subjectId) return showToast('กรุณาเลือกรายวิชา', 'warning');
    if (activeTab !== 'subject' && !classRoom) return showToast('กรุณาเลือกห้องเรียน', 'warning');

    const el = document.getElementById('report-content');
    el.innerHTML = spinnerHTML('กำลังดึงข้อมูลรายงาน...');

    try {
      if (activeTab === 'morning') {
        const rows = await buildMonthlyReport(classRoom, start, end);
        renderMorningReport(rows, classRoom);
      } else if (activeTab === 'subject') {
        const subject = subjects.find(s => s.id === subjectId);
        let students = [];
        if (subject.classRooms?.length) {
          const arr = await Promise.all(subject.classRooms.map(cr => getStudents(cr)));
          students = arr.flat();
        } else { students = await getStudents(); }
        const rows = await buildSubjectAttendanceReport(subjectId, students, start, end);
        const allRecords = await getSubjectAttendanceAll(subjectId);
        const records = (start && end)
          ? allRecords.filter(rec => rec.date >= start && rec.date <= end)
          : allRecords;
        renderSubjectReportContainer(rows, subject, students, records, allRecords);
      } else if (activeTab === 'behavior') {
        const rows = await buildBehaviorSummaryReport(classRoom, start, end);
        renderBehaviorReport(rows, classRoom);
      }
    } catch (e) {
      el.innerHTML = `<div class="text-center py-8 text-red-500 text-sm">เกิดข้อผิดพลาด: ${e.message}</div>`;
    }
  }

  function renderMorningReport(rows, classRoom) {
    const totalPresent = rows.reduce((s, r) => s + r.stats.present, 0);
    const totalAbsent  = rows.reduce((s, r) => s + r.stats.absent, 0);
    const failedCount  = rows.filter(r => r.attendPct !== '-' && r.attendPct < 80).length;

    document.getElementById('report-content').innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div class="text-xl font-bold text-green-600">${totalPresent}</div>
          <div class="text-xs text-gray-500">มาเรียน (วัน)</div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div class="text-xl font-bold text-red-600">${totalAbsent}</div>
          <div class="text-xs text-gray-500">ขาดเรียน (วัน)</div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div class="text-xl font-bold text-red-700">${failedCount}</div>
          <div class="text-xs text-gray-500">หมดสิทธิ์สอบ (คน)</div>
        </div>
        <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <button id="btn-export-csv" class="w-full h-full text-sm font-medium text-indigo-700 hover:bg-indigo-50 rounded-xl transition">Export CSV</button>
        </div>
      </div>
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th class="px-4 py-3">เลขที่</th>
              <th class="px-4 py-3">ชื่อ-นามสกุล</th>
              <th class="px-4 py-3 text-center">มา</th>
              <th class="px-4 py-3 text-center">สาย</th>
              <th class="px-4 py-3 text-center">ขาด</th>
              <th class="px-4 py-3 text-center">% เข้าเรียน</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            ${rows.map(r => `
              <tr class="hover:bg-gray-50 transition">
                <td class="px-4 py-3 text-gray-400 font-mono">${r.student.number || '-'}</td>
                <td class="px-4 py-3 font-medium">${r.student.firstName} ${r.student.lastName}</td>
                <td class="px-4 py-3 text-center text-green-600">${r.stats.present}</td>
                <td class="px-4 py-3 text-center text-yellow-600">${r.stats.late}</td>
                <td class="px-4 py-3 text-center text-red-600">${r.stats.absent}</td>
                <td class="px-4 py-3 text-center">
                  <span class="px-2 py-0.5 rounded font-bold ${r.attendPct < 80 ? 'text-red-600' : 'text-green-600'}">${r.attendPct}%</span>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    document.getElementById('btn-export-csv').onclick = () => {
      const start = document.getElementById('report-start').value;
      const end   = document.getElementById('report-end').value;
      exportMonthlyCSV(classRoom, start, end);
    };
  }

  function renderSubjectReportContainer(rows, subject, students, records, allRecords) {
    const el = document.getElementById('report-content');
    el.innerHTML = `
      <div class="space-y-6 animate-fade-in">
        <!-- Sub-tabs -->
        <div class="flex gap-2 border-b border-gray-200 no-print">
          <button id="subtab-summary" class="px-4 py-2 text-sm font-medium border-b-2 border-indigo-600 text-indigo-600 transition-colors">
            📊 สรุปเปอร์เซ็นต์เข้าเรียน
          </button>
          <button id="subtab-grid" class="px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors">
            📅 ตารางเวลาเรียน (แบบบันทึก)
          </button>
        </div>

        <!-- Sub-tab Content -->
        <div id="subject-tab-content"></div>
      </div>
    `;

    document.getElementById('subtab-summary').onclick = () => {
      setActiveSubTab('summary');
    };
    document.getElementById('subtab-grid').onclick = () => {
      setActiveSubTab('grid');
    };

    function setActiveSubTab(subTab) {
      const summaryBtn = document.getElementById('subtab-summary');
      const gridBtn = document.getElementById('subtab-grid');
      
      if (subTab === 'summary') {
        summaryBtn.className = "px-4 py-2 text-sm font-medium border-b-2 border-indigo-600 text-indigo-600 transition-colors";
        gridBtn.className = "px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors";
        renderSubjectSummaryView(rows, subject);
      } else {
        gridBtn.className = "px-4 py-2 text-sm font-medium border-b-2 border-indigo-600 text-indigo-600 transition-colors";
        summaryBtn.className = "px-4 py-2 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors";
        renderSubjectGridView(subject, students, records, allRecords);
      }
    }

    // Default to summary view
    setActiveSubTab('summary');
  }

  function renderSubjectSummaryView(rows, subject) {
    const container = document.getElementById('subject-tab-content');
    container.innerHTML = `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-fade-in">
        <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
          <h3 class="font-bold text-gray-800">สถิติเข้าเรียน: ${subject.name} (${subject.code})</h3>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th class="px-4 py-3">เลขที่</th>
              <th class="px-4 py-3">ชื่อ-นามสกุล</th>
              <th class="px-4 py-3 text-center">เปอร์เซ็นต์เข้าเรียน</th>
              <th class="px-4 py-3 text-center">สถานะ</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            ${rows.map(r => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-gray-400 font-mono">${r.student.number || '-'}</td>
                <td class="px-4 py-3 font-medium">${r.student.firstName} ${r.student.lastName}</td>
                <td class="px-4 py-3 text-center">
                  <div class="w-full bg-gray-100 rounded-full h-2 max-w-[100px] mx-auto mt-1">
                    <div class="h-2 rounded-full ${r.failed ? 'bg-red-500' : 'bg-green-500'}" style="width: ${r.percent || 0}%"></div>
                  </div>
                  <span class="text-[10px] font-bold ${r.failed ? 'text-red-600' : 'text-green-600'}">${r.percent !== null ? r.percent + '%' : 'ยังไม่เช็ค'}</span>
                </td>
                <td class="px-4 py-3 text-center">
                  ${r.failed ? '<span class="text-xs text-red-600 font-bold">หมดสิทธิ์สอบ</span>' : (r.percent === null ? '<span class="text-gray-400">-</span>' : '<span class="text-xs text-green-600">ปกติ</span>')}
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderSubjectGridView(subject, students, records, allRecords = []) {
    const container = document.getElementById('subject-tab-content');
    
    // Sort students by number ascending
    const sortedStudents = [...students].sort((a, b) => (a.number || 999) - (b.number || 999));
    
    const thYear = new Date().getFullYear() + 543;
    const defaultRoom = subject.classRooms?.[0] || 'ม.2/4';

    container.innerHTML = `
      <div class="space-y-6 animate-fade-in">
        <!-- Configuration Panel -->
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 no-print">
          <h4 class="font-bold text-gray-800 text-sm mb-4">ตั้งค่าหัวเอกสารและการคำนวณ</h4>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">ชื่อโรงเรียน</label>
              <input type="text" id="grid-school-name" value="โรงเรียนเบญจมราชรังสฤษฎิ์ ๒" 
                class="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white font-medium"/>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">ปีการศึกษา</label>
              <input type="text" id="grid-year" value="${thYear}" 
                class="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white font-medium"/>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">ระดับชั้น/ห้อง</label>
              <input type="text" id="grid-classroom" value="${defaultRoom}" 
                class="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white font-medium"/>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">จำนวนคาบต่อครั้ง</label>
              <select id="grid-periods-per-session" 
                class="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white font-medium">
                <option value="1">1 คาบต่อวัน</option>
                <option value="2" selected>2 คาบต่อวัน (คาบคู่)</option>
                <option value="3">3 คาบต่อวัน</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-semibold text-gray-600 mb-1.5">จำนวนคาบทั้งหมด</label>
              <input type="number" id="grid-total-periods" value="40" min="1" max="100"
                class="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white font-medium"/>
            </div>
          </div>
          
          <div class="flex gap-2 justify-end mt-4 pt-4 border-t border-gray-100">
            <button id="btn-export-grid-csv" class="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition shadow-sm flex items-center gap-1.5">
              📄 ดาวน์โหลด Excel (CSV)
            </button>
            <button id="btn-print-grid" class="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition shadow-sm flex items-center gap-1.5">
              🖨️ พิมพ์รายงาน (A4 แนวตั้ง)
            </button>
          </div>
        </div>

        <!-- Print-friendly Grid Container -->
        <div id="grid-report-container" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden">
          <style id="grid-print-styles">
            /* Dynamic Print Styles */
            @media print {
              html, body {
                background: white !important;
                color: black !important;
                margin: 0 !important;
                padding: 0 !important;
                height: 100% !important;
                overflow: hidden !important;
              }
              /* Hide navigation and top bars */
              aside, header, #sidebar-overlay {
                display: none !important;
              }
              /* Hide all components marked as no-print */
              .no-print, button, input, select {
                display: none !important;
              }
              /* Remove margins/paddings from parent containers for printing */
              #layout-app, #layout-app > div, #app-content {
                display: block !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: transparent !important;
                width: 100% !important;
                max-width: 100% !important;
              }
              #grid-report-container {
                display: block !important;
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                max-width: 100% !important;
                padding: 1.2cm !important; /* เว้นระยะขอบทุกด้านเท่ากับด้านบน */
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                overflow: visible !important;
                box-sizing: border-box !important;
              }
              @page {
                size: portrait;
                margin: 0.5cm !important;
              }
              /* ปรับขนาดหัวข้อและระยะห่างของส่วนหัวรายงานให้สวยงามสมดุลขึ้น */
              #grid-table-content > div.text-center {
                margin-bottom: 12px !important;
              }
              #grid-table-content h2 {
                font-size: 16px !important;
                margin: 0 !important;
                line-height: 1.2 !important;
              }
              #grid-table-content h3 {
                font-size: 12px !important;
                margin: 4px 0 0 0 !important;
                line-height: 1.2 !important;
              }
              #grid-table-content p {
                font-size: 10px !important;
                margin-top: 4px !important;
                margin-bottom: 0 !important;
              }
              table {
                border-collapse: collapse !important;
                width: 100% !important;
                margin-left: auto !important;
                margin-right: auto !important;
              }
              th, td {
                border: 1px solid #000000 !important;
                color: #000000 !important;
                font-size: 7.5px !important;
                padding: 3px 2px !important;
                text-align: center !important;
                background-color: transparent !important;
                line-height: 1.2 !important;
                white-space: nowrap !important;
              }
              th {
                font-weight: bold !important;
              }
              .text-left-print {
                text-align: left !important;
              }
              tr {
                page-break-inside: avoid !important;
              }
            }
          </style>

          <div id="grid-table-content"></div>
        </div>
      </div>
    `;

    // Listen to changes in settings
    document.getElementById('grid-school-name').oninput = updateGrid;
    document.getElementById('grid-year').oninput = updateGrid;
    document.getElementById('grid-classroom').oninput = updateGrid;
    document.getElementById('grid-periods-per-session').onchange = updateGrid;
    document.getElementById('grid-total-periods').oninput = updateGrid;

    // Print button
    document.getElementById('btn-print-grid').onclick = () => {
      window.print();
    };

    // Export CSV button
    document.getElementById('btn-export-grid-csv').onclick = exportGridCSV;

    function getShortThaiMonth(date) {
      const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
      return months[date.getMonth()];
    }

    function getSpans(arr) {
      const spans = [];
      if (arr.length === 0) return spans;
      let curVal = arr[0];
      let curSpan = 1;
      for (let i = 1; i < arr.length; i++) {
        if (arr[i] === curVal) {
          curSpan++;
        } else {
          spans.push({ value: curVal, span: curSpan });
          curVal = arr[i];
          curSpan = 1;
        }
      }
      spans.push({ value: curVal, span: curSpan });
      return spans;
    }

    function extrapolateDates(recordsList, allRecordsList, numSessions, periodsPerSession) {
      const sessionDates = [];
      
      // 1. Gather all active days of the week from allRecords (or records if allRecords is empty)
      const activeDays = new Set();
      const recordsToUse = allRecordsList.length ? allRecordsList : recordsList;
      
      recordsToUse.forEach(rec => {
        if (!rec.date) return;
        const parts = rec.date.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        activeDays.add(d.getDay());
      });

      // If activeDays is empty, default to the day of the week of the start date (or today)
      if (activeDays.size === 0) {
        const startVal = document.getElementById('report-start')?.value;
        let startDate;
        if (startVal) {
          const parts = startVal.split('-');
          startDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          startDate = new Date();
        }
        activeDays.add(startDate.getDay());
      }

      // Helper to format Date to YYYY-MM-DD
      function formatDateISO(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }

      let lastDateObj = null;
      for (let sessionIdx = 0; sessionIdx < numSessions; sessionIdx++) {
        if (sessionIdx < recordsList.length) {
          sessionDates.push(recordsList[sessionIdx].date);
          const parts = recordsList[sessionIdx].date.split('-');
          lastDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        } else {
          if (!lastDateObj) {
            // Fallback starting date if no records exist
            const startVal = document.getElementById('report-start')?.value;
            if (startVal) {
              const parts = startVal.split('-');
              lastDateObj = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
            } else {
              lastDateObj = new Date();
            }
            sessionDates.push(formatDateISO(lastDateObj));
          } else {
            // Find next date matching one of the active days
            let nextDate = new Date(lastDateObj.getTime());
            let found = false;
            for (let k = 1; k <= 7; k++) {
              nextDate.setDate(nextDate.getDate() + 1);
              if (activeDays.has(nextDate.getDay())) {
                lastDateObj = nextDate;
                sessionDates.push(formatDateISO(nextDate));
                found = true;
                break;
              }
            }
            if (!found) {
              nextDate = new Date(lastDateObj.getTime());
              nextDate.setDate(nextDate.getDate() + 7);
              lastDateObj = nextDate;
              sessionDates.push(formatDateISO(nextDate));
            }
          }
        }
      }
      return sessionDates;
    }

    function getStudentStatusForPeriod(studentId, periodNum, periodsPerSession) {
      const sessionIndex = Math.floor((periodNum - 1) / periodsPerSession);
      if (sessionIndex < records.length) {
        return records[sessionIndex].records?.[studentId];
      }
      return undefined;
    }

    function getStatusSymbol(status) {
      if (status === 'present') return '/';
      if (status === 'late') return 'ส';
      if (status === 'absent') return 'ข';
      if (status === 'leave') return 'ล';
      return '';
    }

    function getStatusStyle(status) {
      if (status === 'present') return 'text-gray-500';
      if (status === 'late') return 'text-yellow-600 font-bold bg-yellow-50';
      if (status === 'absent') return 'text-red-600 font-bold bg-red-50';
      if (status === 'leave') return 'text-blue-600 font-bold bg-blue-50';
      return '';
    }

    function updateGrid() {
      const schoolName = document.getElementById('grid-school-name').value;
      const classRoom = document.getElementById('grid-classroom').value;
      const schoolYear = document.getElementById('grid-year').value;
      const periodsPerSession = parseInt(document.getElementById('grid-periods-per-session').value) || 2;
      const totalPeriodsSetting = parseInt(document.getElementById('grid-total-periods').value) || 40;

      const numCheckedCols = records.length * periodsPerSession;
      const C = Math.max(totalPeriodsSetting, numCheckedCols);

      const months = [];
      const dates = [];
      const periodNumbers = [];

      const numSessions = Math.ceil(C / periodsPerSession);
      const sessionDates = extrapolateDates(records, allRecords, numSessions, periodsPerSession);

      for (let i = 1; i <= C; i++) {
        periodNumbers.push(i);
        const sessionIdx = Math.floor((i - 1) / periodsPerSession);
        const sessionDateStr = sessionDates[sessionIdx];
        if (sessionDateStr) {
          const parts = sessionDateStr.split('-');
          const recDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          months.push(getShortThaiMonth(recDate));
          dates.push(recDate.getDate());
        } else {
          months.push('');
          dates.push('');
        }
      }

      const monthSpans = getSpans(months);
      const dateSpans = getSpans(dates);

      // Render the table HTML
      const tableContent = document.getElementById('grid-table-content');
      
      tableContent.innerHTML = `
        <!-- Title Header -->
        <div class="text-center mb-6">
          <h2 class="text-xl font-bold text-gray-800 leading-normal">แบบบันทึกเวลาเรียน</h2>
          <h3 class="text-base font-bold text-gray-700">
            ชั้นมัธยมศึกษาปีที่ ${classRoom} ปีการศึกษา ${schoolYear} ${schoolName}
          </h3>
          <p class="text-xs text-gray-500 mt-1 no-print">
            รายวิชา: <span class="font-semibold text-gray-700">${subject.code} - ${subject.name}</span>
          </p>
        </div>

        <!-- Scroll container for web, no scroll for print -->
        <div class="overflow-x-auto custom-scrollbar -mx-6 px-6">
          <table class="w-max border-collapse border border-gray-300 text-xs">
            <thead>
              <!-- Row 1: Month -->
              <tr class="bg-gray-50/70 text-gray-700 font-bold border-b border-gray-300">
                <th rowspan="3" class="border border-gray-300 px-1 py-2 text-center align-middle text-[11px] font-bold whitespace-nowrap" style="width: 1%;">เลขที่</th>
                <th rowspan="3" class="border border-gray-300 px-1 py-2 text-center align-middle text-[11px] font-bold" style="width: 1%; white-space: nowrap;">เลข<br>ประจำตัว</th>
                <th rowspan="3" class="border border-gray-300 px-3 py-2 text-left align-middle text-[11px] font-bold whitespace-nowrap" style="width: 1%;">ชื่อ-สกุล</th>
                <th class="border border-gray-300 px-0 py-1 text-center text-[10px] font-bold whitespace-nowrap" style="width: 1%;">เดือน</th>
                ${monthSpans.map(m => `<th colspan="${m.span}" class="border border-gray-300 px-1 py-1 text-center text-[10px] font-bold">${m.value || ''}</th>`).join('')}
                <th rowspan="3" class="border border-gray-300 px-1 py-2 text-center align-middle text-[11px] font-bold whitespace-nowrap" style="width: 1%;">รวม<br><span class="text-[9px] font-normal">${C}</span></th>
              </tr>
              <!-- Row 2: Date -->
              <tr class="bg-gray-50/70 text-gray-700 font-bold border-b border-gray-300">
                <th class="border border-gray-300 px-0 py-1 text-center text-[10px] font-bold whitespace-nowrap" style="width: 1%;">วันที่</th>
                ${dateSpans.map(d => `<th colspan="${d.span}" class="border border-gray-300 px-1 py-1 text-center text-[10px] font-bold">${d.value || ''}</th>`).join('')}
              </tr>
              <!-- Row 3: Period -->
              <tr class="bg-gray-50/70 text-gray-700 font-bold border-b border-gray-300">
                <th class="border border-gray-300 px-0 py-1 text-center text-[10px] font-bold whitespace-nowrap" style="width: 1%;">คาบ</th>
                ${periodNumbers.map(p => `<th class="border border-gray-300 px-0 py-1 text-center text-[9px] font-mono font-medium" style="width: 18px; min-width: 18px; max-width: 18px;">${p}</th>`).join('')}
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-200">
              ${sortedStudents.map((s, sIdx) => {
                let studentPresentCount = 0;
                const cellHTMLs = [];

                for (let p = 1; p <= C; p++) {
                  const status = getStudentStatusForPeriod(s.id, p, periodsPerSession);
                  if (status === 'present' || status === 'late') {
                    studentPresentCount++;
                  }
                  const symbol = getStatusSymbol(status);
                  const cellStyle = getStatusStyle(status);
                  cellHTMLs.push(`<td class="border border-gray-300 p-0 text-center font-mono text-[10px] ${cellStyle}" style="width: 18px; min-width: 18px; max-width: 18px;">${symbol}</td>`);
                }

                return `
                  <tr class="hover:bg-gray-50/50 text-gray-700">
                    <td class="border border-gray-300 px-1 py-1.5 text-center font-mono text-[10px]">${s.number || sIdx + 1}</td>
                    <td class="border border-gray-300 px-1 py-1.5 text-center font-mono text-[10px] text-gray-500">${s.studentCode || '-'}</td>
                    <td colspan="2" class="border border-gray-300 px-3 py-1.5 text-left font-medium text-[11px] text-gray-800 text-left-print whitespace-nowrap">${s.prefix ? s.prefix : ''}${s.firstName} ${s.lastName}</td>
                    ${cellHTMLs.join('')}
                    <td class="border border-gray-300 px-1 py-1.5 text-center font-bold text-[10px] bg-gray-50/50">${studentPresentCount}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
            <tfoot>
              <!-- Bottom Row: Totals for each period -->
              <tr class="bg-gray-50/70 font-bold text-gray-700">
                <td colspan="4" class="border border-gray-300 px-3 py-2 text-center text-[10px] font-bold">รวม</td>
                ${periodNumbers.map(p => {
                  const hasRecord = Math.floor((p - 1) / periodsPerSession) < records.length;
                  let sum = 0;
                  if (hasRecord) {
                    sortedStudents.forEach(s => {
                      const status = getStudentStatusForPeriod(s.id, p, periodsPerSession);
                      if (status === 'present' || status === 'late') sum++;
                    });
                  }
                  return `<td class="border border-gray-300 px-0 py-2 text-center font-mono text-[10px]" style="width: 18px; min-width: 18px; max-width: 18px;">${hasRecord ? sum : ''}</td>`;
                }).join('')}
                <!-- Bottom right cell -->
                <td class="border border-gray-300 px-1 py-2 text-center font-bold bg-gray-50/70"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      `;
    }

    function exportGridCSV() {
      const schoolName = document.getElementById('grid-school-name').value;
      const classRoom = document.getElementById('grid-classroom').value;
      const schoolYear = document.getElementById('grid-year').value;
      const periodsPerSession = parseInt(document.getElementById('grid-periods-per-session').value) || 2;
      const totalPeriodsSetting = parseInt(document.getElementById('grid-total-periods').value) || 40;

      const numCheckedCols = records.length * periodsPerSession;
      const C = Math.max(totalPeriodsSetting, numCheckedCols);

      const months = [];
      const dates = [];
      const periodNumbers = [];

      const numSessions = Math.ceil(C / periodsPerSession);
      const sessionDates = extrapolateDates(records, allRecords, numSessions, periodsPerSession);

      for (let i = 1; i <= C; i++) {
        periodNumbers.push(i);
        const sessionIdx = Math.floor((i - 1) / periodsPerSession);
        const sessionDateStr = sessionDates[sessionIdx];
        if (sessionDateStr) {
          const parts = sessionDateStr.split('-');
          const recDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          months.push(getShortThaiMonth(recDate));
          dates.push(recDate.getDate());
        } else {
          months.push('');
          dates.push('');
        }
      }

      // Build CSV rows
      const csvRows = [
        ['แบบบันทึกเวลาเรียน'],
        [`ชั้นมัธยมศึกษาปีที่ ${classRoom}`, `ปีการศึกษา ${schoolYear}`, schoolName],
        [`รายวิชา: ${subject.code} - ${subject.name}`],
        [], // empty line
      ];

      // Header row 1
      const headerRow1 = ['เลขที่', 'เลขประจำตัว', 'ชื่อ-สกุล', 'เดือน'];
      months.forEach(m => headerRow1.push(m));
      headerRow1.push('รวม');
      csvRows.push(headerRow1);

      // Header row 2
      const headerRow2 = ['', '', '', 'วันที่'];
      dates.forEach(d => headerRow2.push(d));
      headerRow2.push(C);
      csvRows.push(headerRow2);

      // Header row 3
      const headerRow3 = ['', '', '', 'คาบ'];
      periodNumbers.forEach(p => headerRow3.push(p));
      headerRow3.push('');
      csvRows.push(headerRow3);

      // Student rows
      sortedStudents.forEach((s, sIdx) => {
        let studentPresentCount = 0;
        const row = [
          s.number || sIdx + 1,
          s.studentCode || '',
          `${s.prefix || ''} ${s.firstName} ${s.lastName}`.trim(),
          '', // Spacer col under คาบ
        ];

        for (let p = 1; p <= C; p++) {
          const status = getStudentStatusForPeriod(s.id, p, periodsPerSession);
          if (status === 'present' || status === 'late') {
            studentPresentCount++;
          }
          row.push(getStatusSymbol(status));
        }
        row.push(studentPresentCount);
        csvRows.push(row);
      });

      // Bottom Row
      const footerRow = ['รวม', '', '', ''];
      periodNumbers.forEach(p => {
        const hasRecord = Math.floor((p - 1) / periodsPerSession) < records.length;
        let sum = 0;
        if (hasRecord) {
          sortedStudents.forEach(s => {
            const status = getStudentStatusForPeriod(s.id, p, periodsPerSession);
            if (status === 'present' || status === 'late') sum++;
          });
        }
        footerRow.push(hasRecord ? sum : '');
      });
      footerRow.push(''); 
      csvRows.push(footerRow);

      const filename = `แบบบันทึกเวลาเรียน_${classRoom.replace('/', '-')}_${subject.code}.csv`;
      downloadCSV(csvRows, filename);
    }

    // Initialize grid
    updateGrid();
  }

  function renderBehaviorReport(rows, classRoom) {
    document.getElementById('report-content').innerHTML = `
      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div class="px-6 py-4 border-b border-gray-100">
          <h3 class="font-bold text-gray-800">สรุปคะแนนพฤติกรรม: ห้อง ${classRoom}</h3>
        </div>
        <table class="w-full text-sm">
          <thead class="bg-gray-50 text-gray-500 text-left">
            <tr>
              <th class="px-4 py-3">เลขที่</th>
              <th class="px-4 py-3">ชื่อ-นามสกุล</th>
              <th class="px-4 py-3 text-center text-green-600">คะแนนบวก</th>
              <th class="px-4 py-3 text-center text-red-600">คะแนนลบ</th>
              <th class="px-4 py-3 text-center">คะแนนรวม (ช่วงเวลา)</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-gray-50">
            ${rows.map(r => `
              <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-gray-400 font-mono">${r.student.number || '-'}</td>
                <td class="px-4 py-3 font-medium">${r.student.firstName} ${r.student.lastName}</td>
                <td class="px-4 py-3 text-center font-bold text-green-600">${r.positive > 0 ? '+' + r.positive : '0'}</td>
                <td class="px-4 py-3 text-center font-bold text-red-600">${r.negative < 0 ? r.negative : '0'}</td>
                <td class="px-4 py-3 text-center">
                  <span class="px-2 py-1 rounded-lg font-bold ${r.total < 0 ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}">
                    ${r.total > 0 ? '+' : ''}${r.total}
                  </span>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  }

  document.getElementById('btn-load-report').onclick = loadReport;
}
