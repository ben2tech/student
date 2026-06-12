// modules/attendance.js — Attendance System (Morning + Subject)
import { db } from '../firebase-config.js';
import {
  doc, getDoc, setDoc, deleteDoc, getDocs, collection, query, where,
  Timestamp, orderBy, limit,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const MORNING_COL = 'attendance';        // เช็คชื่อเช้า
const SUBJECT_COL = 'subjectAttendance'; // เช็คชื่อรายวิชา

// ─── Morning Attendance ───────────────────────────────────────────────────────

/** Key สำหรับ Document เช็คชื่อเช้า */
function morningKey(date, classRoom) {
  return `${date}_${classRoom.replace('/', '-')}`;
}

/** บันทึกเช็คชื่อเช้า (ทั้งห้อง) */
export async function saveMorningAttendance(date, classRoom, records, recordedBy) {
  const key = morningKey(date, classRoom);
  await setDoc(doc(db, MORNING_COL, key), {
    date,
    classRoom,
    records, // { [studentId]: 'present'|'late'|'absent'|'leave' }
    recordedBy,
    recordedAt: Timestamp.now(),
  });
}

/** ดึงเช็คชื่อเช้าของห้องในวันที่กำหนด */
export async function getMorningAttendance(date, classRoom) {
  const snap = await getDoc(doc(db, MORNING_COL, morningKey(date, classRoom)));
  if (!snap.exists()) return null;
  return snap.data();
}

/** ดึงเช็คชื่อเช้ารายช่วงวันที่ */
export async function getMorningAttendanceRange(classRoom, startDate, endDate) {
  const q = query(
    collection(db, MORNING_COL),
    where('classRoom', '==', classRoom),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── Subject Attendance ───────────────────────────────────────────────────────

function subjectKey(subjectId, date) {
  return `${subjectId}_${date}`;
}

/** บันทึกเช็คชื่อรายวิชา */
export async function saveSubjectAttendance(subjectId, date, records, recordedBy) {
  const key = subjectKey(subjectId, date);
  await setDoc(doc(db, SUBJECT_COL, key), {
    subjectId,
    date,
    records,
    recordedBy,
    recordedAt: Timestamp.now(),
  });
}

/** ดึงเช็คชื่อรายวิชาวันที่กำหนด */
export async function getSubjectAttendance(subjectId, date) {
  const snap = await getDoc(doc(db, SUBJECT_COL, subjectKey(subjectId, date)));
  if (!snap.exists()) return null;
  return snap.data();
}

/** ดึงเช็คชื่อรายวิชาทั้งหมดของ subject */
export async function getSubjectAttendanceAll(subjectId) {
  const q = query(
    collection(db, SUBJECT_COL),
    where('subjectId', '==', subjectId),
    orderBy('date')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/**
 * คำนวณ % เข้าเรียนของนักเรียนในรายวิชา
 * (นับ present + late เป็นเข้าเรียน)
 */
export async function calcAttendancePercent(studentId, subjectId, startDate = null, endDate = null) {
  let records = await getSubjectAttendanceAll(subjectId);
  if (startDate && endDate) {
    records = records.filter(rec => rec.date >= startDate && rec.date <= endDate);
  }
  let total = 0, attended = 0;
  records.forEach(rec => {
    const status = rec.records?.[studentId];
    if (status) {
      total++;
      if (status === 'present' || status === 'late') attended++;
    }
  });
  if (total === 0) return null; // ยังไม่มีการเช็ค
  return Math.round((attended / total) * 100);
}

/**
 * ดึงสรุปสถิติเช็คชื่อเช้าของห้องสำหรับวันที่กำหนด
 */
export async function getDailyMorningStats(date, classRoom) {
  const data = await getMorningAttendance(date, classRoom);
  if (!data) return { present: 0, late: 0, absent: 0, leave: 0, total: 0 };
  const stats = { present: 0, late: 0, absent: 0, leave: 0, total: 0 };
  Object.values(data.records || {}).forEach(s => {
    if (stats[s] !== undefined) stats[s]++;
    stats.total++;
  });
  return stats;
}

/** ดึงรายการนักเรียนที่ขาดเรียนเยอะ (>= minAbsent วัน) ใน range */
export async function getFrequentAbsentees(classRoom, startDate, endDate, minAbsent = 3) {
  const records = await getMorningAttendanceRange(classRoom, startDate, endDate);
  const absentCount = {};
  records.forEach(r => {
    Object.entries(r.records || {}).forEach(([sid, status]) => {
      if (status === 'absent') {
        absentCount[sid] = (absentCount[sid] || 0) + 1;
      }
    });
  });
  return Object.entries(absentCount)
    .filter(([, count]) => count >= minAbsent)
    .map(([studentId, count]) => ({ studentId, absentDays: count }));
}
/** ดึงรายการวันที่เคยเช็คชื่อเช้าของห้อง */
export async function getMorningAttendanceDates(classRoom) {
  if (!classRoom) return [];
  const q = query(
    collection(db, MORNING_COL),
    where('classRoom', '==', classRoom),
    orderBy('date', 'desc'),
    limit(30)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data().date);
}

/** ดึงรายการวันที่เคยเช็คชื่อรายวิชา */
export async function getSubjectAttendanceDates(subjectId) {
  if (!subjectId) return [];
  const q = query(
    collection(db, SUBJECT_COL),
    where('subjectId', '==', subjectId),
    orderBy('date', 'desc'),
    limit(30)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data().date);
}

/** ลบเช็คชื่อเช้า */
export async function deleteMorningAttendance(date, classRoom) {
  const key = morningKey(date, classRoom);
  await deleteDoc(doc(db, MORNING_COL, key));
}

/** ลบเช็คชื่อรายวิชา */
export async function deleteSubjectAttendance(subjectId, date) {
  const key = subjectKey(subjectId, date);
  await deleteDoc(doc(db, SUBJECT_COL, key));
}
