// modules/scores.js — Scores Management
import { db } from '../firebase-config.js';
import {
  collection, doc, getDocs, setDoc, writeBatch,
  query, where, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const COL = 'scores';

/** Helper to generate composite document ID */
export function makeScoreId(subjectId, year, term, studentId) {
  return `${subjectId}_${year}_${term}_${studentId}`;
}

/** ดึงคะแนนทั้งห้อง */
export async function getScoresByClass(subjectId, year, term, classRoom) {
  const q = query(
    collection(db, COL),
    where('subjectId', '==', subjectId),
    where('academicYear', '==', parseInt(year)),
    where('term', '==', parseInt(term)),
    where('classRoom', '==', classRoom)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** บันทึกคะแนนนักเรียน 1 คน */
export async function saveScore(scoreData) {
  const id = makeScoreId(scoreData.subjectId, scoreData.academicYear, scoreData.term, scoreData.studentId);
  const docRef = doc(db, COL, id);
  await setDoc(docRef, {
    ...scoreData,
    academicYear: parseInt(scoreData.academicYear),
    term: parseInt(scoreData.term),
    updatedAt: Timestamp.now()
  }, { merge: true });
}

/** บันทึกคะแนนหลายคนพร้อมกัน (batch write) */
export async function saveScoresBatch(scoresArray) {
  const BATCH_SIZE = 400; // Firestore limit 500 ops/batch
  
  for (let i = 0; i < scoresArray.length; i += BATCH_SIZE) {
    const chunk = scoresArray.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(s => {
      const id = makeScoreId(s.subjectId, s.academicYear, s.term, s.studentId);
      const ref = doc(db, COL, id);
      batch.set(ref, { 
        ...s, 
        academicYear: parseInt(s.academicYear),
        term: parseInt(s.term),
        updatedAt: Timestamp.now() 
      }, { merge: true });
    });
    await batch.commit();
  }
}

/** ลบคะแนนทั้งวิชาของห้องนั้น */
export async function deleteScoresByClass(subjectId, year, term, classRoom) {
  const scores = await getScoresByClass(subjectId, year, term, classRoom);
  if (scores.length === 0) return;
  
  const BATCH_SIZE = 400;
  for (let i = 0; i < scores.length; i += BATCH_SIZE) {
    const chunk = scores.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(s => {
      batch.delete(doc(db, COL, s.id));
    });
    await batch.commit();
  }
}

/** คำนวณคะแนนรวม */
export function calculateTotalScore(scoreObj, template) {
  const b = scoreObj.beforeMidterm || {};
  const a = scoreObj.afterMidterm || {};
  
  const total = 
    (parseFloat(b.K) || 0) + (parseFloat(b.P) || 0) + (parseFloat(b.A) || 0) + (parseFloat(b.T) || 0) +
    (parseFloat(scoreObj.midterm) || 0) +
    (parseFloat(a.K) || 0) + (parseFloat(a.P) || 0) + (parseFloat(a.A) || 0) + (parseFloat(a.T) || 0) +
    (parseFloat(scoreObj.final) || 0);
    
  return total;
}

/** คำนวณคะแนนเฉลี่ยห้อง */
export async function getClassAverage(subjectId, year, term, classRoom) {
  const scores = await getScoresByClass(subjectId, year, term, classRoom);
  if (scores.length === 0) return 0;
  
  const totalSum = scores.reduce((sum, s) => sum + (s.totalScore || 0), 0);
  return totalSum / scores.length;
}

/** 
 * แปลง TSV จากการ Paste Excel 
 * columnOrder เช่น ['K1', 'P1', 'A1', 'T1', 'midterm', 'K2', 'P2', 'A2', 'T2', 'final']
 */
export function parseScoresFromClipboard(clipboardText, columnOrder) {
  const lines = clipboardText.trim().split(/\r?\n/).filter(l => l.trim() !== '');
  const rows = [];
  
  lines.forEach(line => {
    const cols = line.split('\t');
    const rowObj = {};
    for (let i = 0; i < Math.min(cols.length, columnOrder.length); i++) {
      rowObj[columnOrder[i]] = cols[i].trim();
    }
    rows.push(rowObj);
  });
  
  return rows;
}

/** 
 * อ่านไฟล์ CSV เพื่อใช้สำหรับหน้าต่างจับคู่คอลัมน์ 
 * @param {string} csvText ข้อมูล CSV
 * @param {number} headerRow บรรทัดที่เป็นส่วนหัว (1-indexed)
 * @param {number} dataRow บรรทัดที่ข้อมูลเริ่ม (1-indexed)
 */
export function parseScoreCSV(csvText, headerRow = 1, dataRow = 2) {
  const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length === 0) throw new Error('ไฟล์ว่างเปล่า');

  let sep = ',';
  if (lines[0].includes('\t')) sep = '\t';
  else if (lines[0].includes(';')) sep = ';';

  const hIdx = Math.max(0, headerRow - 1);
  const dIdx = Math.max(0, dataRow - 1);

  if (hIdx >= lines.length) throw new Error('ไม่พบบรรทัดส่วนหัวตามที่ระบุ');
  
  const headers = lines[hIdx].split(sep).map(h => h.trim().replace(/^["']|["']$/g, ''));
  
  const data = [];
  for (let i = dIdx; i < lines.length; i++) {
    const cols = lines[i].split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
    data.push(cols);
  }

  return { headers, data };
}
