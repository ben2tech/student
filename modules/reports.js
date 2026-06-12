// modules/reports.js — Analytics & CSV Export
import { getMorningAttendanceRange, getDailyMorningStats, getFrequentAbsentees, calcAttendancePercent } from './attendance.js';
import { getStudents } from './students.js';
import { getLowBehaviorStudents, getStudentBehaviorScore, getBehaviorRecordsByRange } from './behavior.js';
import { getSubjects } from './subjects.js';
import { downloadCSV, formatThaiDate, getStatusLabel } from './utils.js';

/**
 * สร้าง Report รายเดือน/รายเทอมสำหรับห้องเรียน
 * คืนค่า: array ของแถวข้อมูลนักเรียนพร้อมสถิติ
 */
export async function buildMonthlyReport(classRoom, startDate, endDate) {
  const students = await getStudents(classRoom);
  const records  = await getMorningAttendanceRange(classRoom, startDate, endDate);

  // นับสถานะรายคน
  const statMap = {}; // { studentId: { present, late, absent, leave } }
  students.forEach(s => { statMap[s.id] = { present: 0, late: 0, absent: 0, leave: 0 }; });
  records.forEach(r => {
    Object.entries(r.records || {}).forEach(([sid, status]) => {
      if (statMap[sid] && statMap[sid][status] !== undefined) statMap[sid][status]++;
    });
  });

  // ดึงคะแนนพฤติกรรม
  const rows = await Promise.all(students.map(async s => {
    const stats = statMap[s.id] || { present: 0, late: 0, absent: 0, leave: 0 };
    const totalDays = stats.present + stats.late + stats.absent + stats.leave;
    const attendPct = totalDays > 0 ? Math.round(((stats.present + stats.late) / totalDays) * 100) : '-';
    const behaviorScore = await getStudentBehaviorScore(s.id);
    return {
      student: s,
      stats,
      totalDays,
      attendPct,
      behaviorScore,
    };
  }));
  return rows;
}

/**
 * Export CSV รายเดือน/รายเทอม
 */
export async function exportMonthlyCSV(classRoom, startDate, endDate) {
  const rows = await buildMonthlyReport(classRoom, startDate, endDate);
  const header = [
    'เลขที่', 'รหัสนักเรียน', 'ชื่อ-นามสกุล', 'ห้องเรียน',
    'จำนวนวัน(มา)', 'จำนวนวัน(สาย)', 'จำนวนวัน(ขาด)', 'จำนวนวัน(ลา)',
    '% เข้าเรียน', 'คะแนนพฤติกรรม', 'สถานะ'
  ];
  const csvRows = [header];
  rows.forEach(r => {
    const { student: s, stats, attendPct, behaviorScore } = r;
    const status = attendPct !== '-' && attendPct < 80 ? 'หมดสิทธิ์สอบ' : 'ปกติ';
    csvRows.push([
      s.number, s.studentCode, `${s.firstName} ${s.lastName}`, s.classRoom,
      stats.present, stats.late, stats.absent, stats.leave,
      attendPct, behaviorScore, status,
    ]);
  });
  const filename = `รายงาน_${classRoom.replace('/', '-')}_${startDate}_${endDate}.csv`;
  downloadCSV(csvRows, filename);
  return rows.length;
}

/**
 * ดึงนักเรียนกลุ่มเสี่ยง (ขาด >= 3 วัน หรือ คะแนนพฤติกรรม <= -20)
 */
export async function getAtRiskStudents(classRoom) {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];

  const [absentees, lowBehavior, students] = await Promise.all([
    getFrequentAbsentees(classRoom, startOfMonth, endDate, 3),
    getLowBehaviorStudents(-20),
    getStudents(classRoom),
  ]);

  const studentMap = {};
  students.forEach(s => { studentMap[s.id] = s; });

  const riskMap = {};
  absentees.forEach(({ studentId, absentDays }) => {
    riskMap[studentId] = riskMap[studentId] || { studentId, reasons: [] };
    riskMap[studentId].reasons.push(`ขาดเรียน ${absentDays} วัน (เดือนนี้)`);
    riskMap[studentId].absentDays = absentDays;
  });
  lowBehavior.forEach(({ studentId, score }) => {
    if (studentMap[studentId]) { // เฉพาะห้องนี้
      riskMap[studentId] = riskMap[studentId] || { studentId, reasons: [] };
      riskMap[studentId].reasons.push(`คะแนนพฤติกรรม ${score} คะแนน`);
      riskMap[studentId].behaviorScore = score;
    }
  });

  return Object.values(riskMap)
    .filter(r => studentMap[r.studentId])
    .map(r => ({ ...r, student: studentMap[r.studentId] }));
}

/**
 * build ข้อมูล dashboard สถิติวันนี้
 */
export async function getTodayStats(classRoom, dateStr) {
  return getDailyMorningStats(dateStr, classRoom);
}

/**
 * สร้างข้อมูล % เข้าเรียนรายวิชาสำหรับนักเรียนทั้งห้อง
 */
export async function buildSubjectAttendanceReport(subjectId, students, startDate = null, endDate = null) {
  const results = await Promise.all(students.map(async s => {
    const pct = await calcAttendancePercent(s.id, subjectId, startDate, endDate);
    return { student: s, percent: pct, failed: pct !== null && pct < 80 };
  }));
  return results;
}
/**
 * สรุปพฤติกรรมรายห้อง
 */
export async function buildBehaviorSummaryReport(classRoom, startDate, endDate) {
  const students = await getStudents(classRoom);
  const sids = students.map(s => s.id);
  const records = await getBehaviorRecordsByRange(sids, startDate, endDate);

  const summary = {}; // { studentId: { positive: 0, negative: 0, total: 0 } }
  students.forEach(s => { summary[s.id] = { positive: 0, negative: 0, total: 0 }; });

  records.forEach(r => {
    if (summary[r.studentId]) {
      if (r.score > 0) summary[r.studentId].positive += r.score;
      else             summary[r.studentId].negative += r.score;
      summary[r.studentId].total += r.score;
    }
  });

  return students.map(s => ({
    student: s,
    ...summary[s.id]
  }));
}
