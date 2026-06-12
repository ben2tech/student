// pages/parent-page.js — Parent-only read-only view
import { getStudentByParentUid, getStudent } from '../modules/students.js';
import { getMorningAttendanceRange, calcAttendancePercent } from '../modules/attendance.js';
import { getStudentBehaviorRecords, getStudentBehaviorScore } from '../modules/behavior.js';
import { getSubjects } from '../modules/subjects.js';
import { formatThaiDate, toDateKey, spinnerHTML, emptyHTML, getStatusBadge } from '../modules/utils.js';
import { currentUser } from '../modules/auth.js';

export async function renderParentPage(container, userData) {
  container.innerHTML = `
    <div class="space-y-6">
      <div>
        <h1 class="text-2xl font-bold text-gray-800">ข้อมูลบุตรหลาน</h1>
        <p class="text-sm text-gray-500 mt-0.5">ดูข้อมูลการเช็คชื่อและคะแนนพฤติกรรม (อ่านอย่างเดียว)</p>
      </div>
      <div id="parent-content">${spinnerHTML('กำลังโหลดข้อมูล...')}</div>
    </div>`;

  const uid = currentUser().uid;
  const students = await getStudentByParentUid(uid);

  if (!students.length) {
    document.getElementById('parent-content').innerHTML = `
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center space-y-3">
        <div class="text-5xl">👨‍👧</div>
        <h2 class="font-semibold text-gray-700">ไม่พบข้อมูลนักเรียน</h2>
        <p class="text-sm text-gray-500">กรุณาติดต่อผู้ดูแลระบบเพื่อเชื่อมโยงบัญชีกับนักเรียน<br/>
          (Admin จะต้องกรอก UID ของคุณในข้อมูลนักเรียน)</p>
        <div class="inline-block bg-gray-100 rounded-lg px-4 py-2 text-xs font-mono text-gray-600 mt-2">UID ของคุณ: ${uid}</div>
      </div>`;
    return;
  }

  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];

  // Render each student
  const sections = await Promise.all(students.map(async s => {
    const [attendanceRecs, behaviorRecs, behaviorScore, subjects] = await Promise.all([
      getMorningAttendanceRange(s.classRoom, startDate, endDate),
      getStudentBehaviorRecords(s.id),
      getStudentBehaviorScore(s.id),
      getSubjects(),
    ]);

    // Build attendance summary
    const stats = { present: 0, late: 0, absent: 0, leave: 0 };
    const attendanceRows = [];
    attendanceRecs.forEach(rec => {
      const status = rec.records?.[s.id];
      if (status) {
        stats[status]++;
        attendanceRows.push({ date: rec.date, status });
      }
    });
    const total = stats.present + stats.late + stats.absent + stats.leave;
    const pct = total > 0 ? Math.round(((stats.present + stats.late) / total) * 100) : null;

    // Subject attendance percents
    const subjectAttendance = await Promise.all(
      subjects.filter(sub => (sub.classRooms || []).includes(s.classRoom)).map(async sub => ({
        subject: sub,
        percent: await calcAttendancePercent(s.id, sub.id),
      }))
    );

    return `
      <!-- Student Card -->
      <div class="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl shadow-lg p-6 text-white mb-6">
        <div class="flex items-center gap-4">
          <div class="w-16 h-16 rounded-full overflow-hidden bg-white/20 flex-shrink-0 border-2 border-white/30">
            ${s.photoUrl ? `<img src="${s.photoUrl}" class="w-full h-full object-cover" alt=""/>` : 
              `<div class="w-full h-full flex items-center justify-center text-2xl font-bold">${s.firstName[0]}</div>`}
          </div>
          <div>
            <h2 class="text-xl font-bold">${s.firstName} ${s.lastName}</h2>
            <p class="text-indigo-200 text-sm">รหัส ${s.studentCode} · ห้อง ${s.classRoom} · เลขที่ ${s.number}</p>
          </div>
        </div>

        <!-- Attendance overview -->
        <div class="grid grid-cols-4 gap-3 mt-5">
          ${[
            { label: 'มา', value: stats.present, col: 'bg-green-400/30' },
            { label: 'สาย', value: stats.late,    col: 'bg-yellow-400/30' },
            { label: 'ขาด', value: stats.absent,  col: 'bg-red-400/30' },
            { label: 'ลา',  value: stats.leave,   col: 'bg-blue-400/30' },
          ].map(c => `
            <div class="${c.col} rounded-xl p-3 text-center">
              <div class="text-2xl font-bold">${c.value}</div>
              <div class="text-xs text-white/80">${c.label}</div>
            </div>`).join('')}
        </div>

        ${pct !== null ? `
          <div class="mt-4 flex items-center gap-3">
            <div class="flex-1 h-2 rounded-full bg-white/20">
              <div class="h-full rounded-full ${pct < 80 ? 'bg-red-400' : 'bg-green-400'}" style="width:${pct}%"></div>
            </div>
            <span class="text-sm font-bold ${pct < 80 ? 'text-red-300' : 'text-green-300'}">เข้าเรียน ${pct}%</span>
          </div>
          ${pct < 80 ? `<div class="mt-2 text-center font-bold text-red-300 text-sm">⚠️ ระวัง! เข้าเรียนต่ำกว่า 80% อาจหมดสิทธิ์สอบ</div>` : ''}
        ` : ''}
      </div>

      <!-- Subject Attendance -->
      ${subjectAttendance.length > 0 ? `
        <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
          <h3 class="font-semibold text-gray-700 mb-4">% เข้าเรียนรายวิชา (เดือนนี้)</h3>
          <div class="space-y-3">
            ${subjectAttendance.map(({ subject, percent }) => {
              if (percent === null) return '';
              const failed = percent < 80;
              return `
                <div class="flex items-center gap-3">
                  <div class="flex-1 min-w-0">
                    <div class="flex justify-between mb-1">
                      <span class="text-sm font-medium text-gray-700 truncate">${subject.code} ${subject.name}</span>
                      <span class="text-sm font-bold ml-2 whitespace-nowrap ${failed ? 'text-red-600' : 'text-green-600'}">${percent}%</span>
                    </div>
                    <div class="h-2 rounded-full bg-gray-100">
                      <div class="h-full rounded-full ${failed ? 'bg-red-500' : 'bg-green-500'}" style="width:${percent}%"></div>
                    </div>
                    ${failed ? `<div class="text-xs text-red-600 font-bold mt-1">❌ หมดสิทธิ์สอบ</div>` : ''}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>` : ''}

      <!-- Recent Attendance -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-4">
        <h3 class="font-semibold text-gray-700 mb-4">ประวัติการเช็คชื่อเช้า 30 วันล่าสุด</h3>
        ${attendanceRows.length ? `
          <div class="flex flex-wrap gap-1.5">
            ${attendanceRows.slice(-30).reverse().map(r => `
              <div class="flex flex-col items-center gap-0.5 w-10">
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                  ${r.status === 'present' ? 'bg-green-100 text-green-700' : ''}
                  ${r.status === 'late'    ? 'bg-yellow-100 text-yellow-700' : ''}
                  ${r.status === 'absent'  ? 'bg-red-100 text-red-700' : ''}
                  ${r.status === 'leave'   ? 'bg-blue-100 text-blue-700' : ''}">
                  ${r.status === 'present' ? '✓' : r.status === 'late' ? 'ส' : r.status === 'absent' ? '✗' : 'ล'}
                </div>
                <div class="text-xs text-gray-400">${new Date(r.date).getDate()}</div>
              </div>`).join('')}
          </div>
          <div class="flex gap-4 mt-3 flex-wrap text-xs text-gray-500">
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-green-200"></span>มา</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-yellow-200"></span>สาย</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-red-200"></span>ขาด</span>
            <span class="flex items-center gap-1"><span class="w-3 h-3 rounded-full bg-blue-200"></span>ลา</span>
          </div>` : emptyHTML('ยังไม่มีข้อมูลการเช็คชื่อ')}
      </div>

      <!-- Behavior -->
      <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-8">
        <div class="flex items-center justify-between mb-4">
          <h3 class="font-semibold text-gray-700">คะแนนพฤติกรรม</h3>
          <div class="text-2xl font-bold ${behaviorScore < 0 ? 'text-red-600' : 'text-green-600'}">
            ${behaviorScore > 0 ? '+' : ''}${behaviorScore} คะแนน
          </div>
        </div>
        ${behaviorRecs.length ? `
          <div class="space-y-2">
            ${behaviorRecs.slice(0, 10).map(r => `
              <div class="flex items-center gap-3 p-3 rounded-xl ${r.category === 'positive' ? 'bg-green-50' : 'bg-red-50'}">
                <div class="flex-1">
                  <div class="text-sm font-medium text-gray-800">${r.criteriaName}</div>
                  ${r.note ? `<div class="text-xs text-gray-500">${r.note}</div>` : ''}
                  <div class="text-xs text-gray-400 mt-0.5">${formatThaiDate(r.date?.toDate?.() || r.date)}</div>
                </div>
                <div class="font-bold ${r.category === 'positive' ? 'text-green-700' : 'text-red-700'} text-sm">
                  ${r.score > 0 ? '+' : ''}${r.score}
                </div>
              </div>`).join('')}
          </div>` : emptyHTML('ยังไม่มีบันทึกพฤติกรรม')}
      </div>`;
  }));

  document.getElementById('parent-content').innerHTML = sections.join('');
}
