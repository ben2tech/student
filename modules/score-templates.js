// modules/score-templates.js — Score Templates Management
import { db } from '../firebase-config.js';
import {
  collection, doc, getDocs, setDoc, deleteDoc,
  query, where, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const COL = 'scoreTemplates';

/** ดึงโครงสร้างคะแนนของรายวิชา 1 รายการ */
export async function getScoreTemplate(subjectId, year, term) {
  const q = query(
    collection(db, COL),
    where('subjectId', '==', subjectId),
    where('academicYear', '==', parseInt(year)),
    where('term', '==', parseInt(term))
  );
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

/** ดึงโครงสร้างคะแนนทั้งหมดของเทอมนั้น */
export async function getScoreTemplates(year, term) {
  const q = query(
    collection(db, COL),
    where('academicYear', '==', parseInt(year)),
    where('term', '==', parseInt(term))
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** บันทึกโครงสร้างคะแนน (Upsert) */
export async function saveScoreTemplate(data) {
  const q = query(
    collection(db, COL),
    where('subjectId', '==', data.subjectId),
    where('academicYear', '==', data.academicYear),
    where('term', '==', data.term)
  );
  const snap = await getDocs(q);
  
  let docRef;
  if (!snap.empty) {
    docRef = doc(db, COL, snap.docs[0].id);
    await setDoc(docRef, { ...data, updatedAt: Timestamp.now() }, { merge: true });
    return snap.docs[0].id;
  } else {
    docRef = doc(collection(db, COL));
    await setDoc(docRef, { ...data, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    return docRef.id;
  }
}

/** ลบโครงสร้างคะแนน */
export async function deleteScoreTemplate(id) {
  await deleteDoc(doc(db, COL, id));
}

/** ตรวจสอบความถูกต้องของสัดส่วนคะแนน (ต้องรวมได้เท่ากับ totalScore) */
export function validateTemplate(template) {
  const errors = [];
  const b = template.beforeMidterm || { K:0, P:0, A:0, T:0 };
  const a = template.afterMidterm || { K:0, P:0, A:0, T:0 };
  const mid = template.midterm || 0;
  const fin = template.final || 0;
  const total = template.totalScore || 100;

  const sum = (b.K||0) + (b.P||0) + (b.A||0) + (b.T||0) +
              mid +
              (a.K||0) + (a.P||0) + (a.A||0) + (a.T||0) +
              fin;

  if (sum !== total) {
    errors.push(`คะแนนรวมได้ ${sum} แต่กำหนดไว้ ${total}`);
  }
  
  return { valid: errors.length === 0, errors };
}
