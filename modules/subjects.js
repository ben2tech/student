// modules/subjects.js — Subject Management
import { db } from '../firebase-config.js';
import {
  collection, doc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, Timestamp, arrayUnion, arrayRemove, or
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const COL = 'subjects';

/** ดึงรายวิชาทั้งหมด */
export async function getSubjects() {
  const q = query(collection(db, COL), orderBy('code'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** ดึงรายวิชาที่ครูคนนี้มีสิทธิ์จัดการ */
export async function getSubjectsByTeacher(teacherUid) {
  const q = query(
    collection(db, COL),
    or(
      where('canManage', 'array-contains', teacherUid),
      where('teacherId', '==', teacherUid)
    )
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** ดึงรายวิชาที่สอนในห้องที่กำหนด */
export async function getSubjectsByClassRoom(classRoom) {
  const q = query(
    collection(db, COL),
    where('classRooms', 'array-contains', classRoom)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** เพิ่มรายวิชาใหม่ */
export async function addSubject(data) {
  const ref = await addDoc(collection(db, COL), {
    name: data.name,
    code: data.code,
    teacherId: data.teacherId || '',
    classRooms: data.classRooms || [],
    canManage: data.canManage || [],
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

/** แก้ไขรายวิชา */
export async function updateSubject(id, data) {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: Timestamp.now() });
}

/** ลบรายวิชา */
export async function deleteSubject(id) {
  await deleteDoc(doc(db, COL, id));
}

/** Admin มอบสิทธิ์ครูให้จัดการรายวิชา */
export async function grantSubjectPermission(subjectId, teacherUid) {
  await updateDoc(doc(db, COL, subjectId), {
    canManage: arrayUnion(teacherUid),
  });
}

/** เพิกถอนสิทธิ์ครู */
export async function revokeSubjectPermission(subjectId, teacherUid) {
  await updateDoc(doc(db, COL, subjectId), {
    canManage: arrayRemove(teacherUid),
  });
}

/** ตรวจสอบสิทธิ์ครูในการจัดการวิชา */
export function canManageSubject(subject, roles, userUid) {
  const rolesArray = Array.isArray(roles) ? roles : [roles];
  if (rolesArray.includes('admin')) return true;
  return subject.canManage?.includes(userUid) || subject.teacherId === userUid;
}
