// modules/behavior.js — Behavior Criteria & Records
import { db } from '../firebase-config.js';
import { getStudent } from './students.js';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp, getDoc,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const CRITERIA_COL = 'behaviorCriteria';
const RECORDS_COL  = 'behaviorRecords';

// ─── Criteria (Admin) ─────────────────────────────────────────────────────────

export async function getCriteria() {
  const q = query(collection(db, CRITERIA_COL), orderBy('category'), orderBy('name'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addCriteria(data) {
  const ref = await addDoc(collection(db, CRITERIA_COL), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateCriteria(id, data) {
  await updateDoc(doc(db, CRITERIA_COL, id), { ...data, updatedAt: Timestamp.now() });
}

export async function deleteCriteria(id) {
  await deleteDoc(doc(db, CRITERIA_COL, id));
}

// ─── Records (Teacher) ────────────────────────────────────────────────────────

/** บันทึกพฤติกรรมนักเรียน โดยเลือกจากเกณฑ์ที่ Admin กำหนดเท่านั้น */
export async function recordBehavior(studentId, criteriaId, teacherId, note = '') {
  const criteriaSnap = await getDoc(doc(db, CRITERIA_COL, criteriaId));
  if (!criteriaSnap.exists()) throw new Error('ไม่พบเกณฑ์พฤติกรรมที่ระบุ');
  const criteria = criteriaSnap.data();

  const ref = await addDoc(collection(db, RECORDS_COL), {
    studentId,
    criteriaId,
    criteriaName: criteria.name,
    category: criteria.category,
    score: criteria.score,
    teacherId,
    note,
    status: 'pending', // 'pending' | 'approved' | 'rejected'
    date: Timestamp.now(),
  });
  return ref.id;
}

/** ดึงประวัติพฤติกรรมของนักเรียน */
export async function getStudentBehaviorRecords(studentId) {
  const q = query(
    collection(db, RECORDS_COL),
    where('studentId', '==', studentId),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** คำนวณคะแนนพฤติกรรมสะสมของนักเรียน (คะแนนพื้นฐาน + คะแนนจาก record) */
export async function getStudentBehaviorScore(studentId) {
  const [student, records] = await Promise.all([
    getStudent(studentId),
    getStudentBehaviorRecords(studentId)
  ]);
  const baseScore = student?.behaviorScore || 0;
  const recordSum = records
    .filter(r => r.status === 'approved')
    .reduce((sum, r) => sum + (r.score || 0), 0);
  return baseScore + recordSum;
}

/** ดึงนักเรียนที่มีคะแนนพฤติกรรมต่ำ */
export async function getLowBehaviorStudents(threshold = -20) {
  const snap = await getDocs(collection(db, RECORDS_COL));
  const scoreMap = {};
  snap.docs.forEach(d => {
    const r = d.data();
    scoreMap[r.studentId] = (scoreMap[r.studentId] || 0) + (r.score || 0);
  });
  return Object.entries(scoreMap)
    .filter(([, score]) => score <= threshold)
    .map(([studentId, score]) => ({ studentId, score }));
}

/** ดึงประวัติพฤติกรรมรายห้องตามช่วงเวลา */
export async function getBehaviorRecordsByRange(studentIds, startDate, endDate) {
  const start = Timestamp.fromDate(new Date(startDate));
  const end = Timestamp.fromDate(new Date(endDate + 'T23:59:59'));
  
  const q = query(
    collection(db, RECORDS_COL),
    where('date', '>=', start),
    where('date', '<=', end),
    orderBy('date', 'desc')
  );
  const snap = await getDocs(q);
  const allRecords = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  
  return allRecords.filter(r => studentIds.includes(r.studentId));
}

/** ดึงรายการที่รออนุมัติ */
export async function getPendingBehaviorRecords() {
  const q = query(collection(db, RECORDS_COL), where('status', '==', 'pending'), orderBy('date', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** อนุมัติพฤติกรรม */
export async function approveBehaviorRecord(id) {
  await updateDoc(doc(db, RECORDS_COL, id), { status: 'approved', approvedAt: Timestamp.now() });
}

/** ปฏิเสธการบันทึก */
export async function rejectBehaviorRecord(id) {
  await updateDoc(doc(db, RECORDS_COL, id), { status: 'rejected', rejectedAt: Timestamp.now() });
}

/** ลบ record พฤติกรรม */
export async function deleteBehaviorRecord(id) {
  await deleteDoc(doc(db, RECORDS_COL, id));
}
