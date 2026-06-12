// modules/classes.js — Classroom & Homeroom Teacher Management
import { db } from '../firebase-config.js';
import {
  doc, getDoc, setDoc, getDocs, collection, query, where,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const SETTINGS_DOC = 'settings/school';   // ข้อมูลโรงเรียนส่วนกลาง
const USERS_COL    = 'users';

// ── Default classrooms (ใช้สำหรับ seed ครั้งแรกเท่านั้น) ──────────────────
const DEFAULT_CLASSROOMS = [
  'ม.1/1','ม.1/2','ม.1/3',
  'ม.2/1','ม.2/2','ม.2/3',
  'ม.3/1','ม.3/2','ม.3/3',
  'ม.4/1','ม.4/2','ม.4/3',
  'ม.5/1','ม.5/2','ม.5/3',
  'ม.6/1','ม.6/2','ม.6/3',
];

/**
 * ดึงรายชื่อห้องเรียนทั้งหมดจาก Firestore
 * ถ้าไม่เคยมี document ใน settings/school จะ seed ค่า default แล้วคืนกลับ
 */
export async function getClassrooms() {
  const ref  = doc(db, SETTINGS_DOC);
  const snap = await getDoc(ref);
  if (snap.exists() && Array.isArray(snap.data().classrooms)) {
    return snap.data().classrooms;
  }
  // Seed ครั้งแรก
  await setDoc(ref, { classrooms: DEFAULT_CLASSROOMS }, { merge: true });
  return DEFAULT_CLASSROOMS;
}

/**
 * บันทึกรายชื่อห้องเรียนทั้งหมด (Admin เท่านั้น)
 * @param {string[]} classrooms - array ชื่อห้องเรียนที่ต้องการบันทึก
 */
export async function saveClassrooms(classrooms) {
  await setDoc(doc(db, SETTINGS_DOC), { classrooms }, { merge: true });
}

/**
 * เพิ่มห้องเรียนใหม่ (จะตรวจสอบซ้ำก่อน)
 * @param {string} name - ชื่อห้องเรียนใหม่ เช่น "ม.7/1"
 * @returns {boolean} - true = เพิ่มสำเร็จ, false = ซ้ำ
 */
export async function addClass(name) {
  const list = await getClassrooms();
  if (list.includes(name)) return false;
  await saveClassrooms([...list, name]);
  return true;
}

/**
 * ลบห้องเรียน
 * @param {string} name - ชื่อห้องเรียนที่ต้องการลบ
 */
export async function deleteClass(name) {
  const list = await getClassrooms();
  await saveClassrooms(list.filter(c => c !== name));
}

/**
 * เรียงลำดับห้องเรียนใหม่
 * @param {string[]} classrooms - array ที่เรียงลำดับใหม่แล้ว
 */
export async function reorderClassrooms(classrooms) {
  await saveClassrooms(classrooms);
}

/**
 * ดึงข้อมูลครูประจำชั้นของทุกห้อง
 * คืนค่าเป็น Map: { 'ม.1/1': [{ uid, displayName, email }, ...], ... }
 */
export async function getHomeroomTeachers() {
  const snap = await getDocs(
    query(collection(db, USERS_COL), where('role', '==', 'homeroom_teacher'))
  );
  const map = {};
  snap.docs.forEach(d => {
    const data = d.data();
    if (data.classRoom) {
      if (!map[data.classRoom]) map[data.classRoom] = [];
      map[data.classRoom].push({
        uid: d.id,
        displayName: data.displayName || '',
        email: data.email || '',
      });
    }
  });
  return map;
}

/**
 * กำหนดครูประจำชั้นรายคน
 */
export async function assignHomeroomTeacher(classRoom, uid) {
  if (!uid) return;
  await setDoc(doc(db, USERS_COL, uid), {
    role: 'homeroom_teacher',
    classRoom,
  }, { merge: true });
}

/**
 * ปลดครูประจำชั้นออก
 */
export async function removeHomeroomTeacher(uid) {
  if (!uid) return;
  await setDoc(doc(db, USERS_COL, uid), {
    classRoom: '',
    // อาจจะยังคง role homeroom_teacher ไว้ หรือเปลี่ยนเป็น subject_teacher ก็ได้ 
    // แต่ในที่นี้เราแค่ลบห้องออก
  }, { merge: true });
}

// รักษาความเข้ากันได้ย้อนหลัง (ถ้ามีที่เรียกใช้)
export async function setHomeroomTeacher(classRoom, newUid, oldUid) {
  if (oldUid) await removeHomeroomTeacher(oldUid);
  if (newUid) await assignHomeroomTeacher(classRoom, newUid);
}
