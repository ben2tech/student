// modules/grade-rules.js — Grade Rules Management
import { db } from '../firebase-config.js';
import {
  doc, getDoc, setDoc, Timestamp
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';

const COL = 'gradeRules';
const DOC_ID = 'default';

const DEFAULT_RULES = [
  { minScore: 80, maxScore: 100, grade: "4" },
  { minScore: 75, maxScore: 79, grade: "3.5" },
  { minScore: 70, maxScore: 74, grade: "3" },
  { minScore: 65, maxScore: 69, grade: "2.5" },
  { minScore: 60, maxScore: 64, grade: "2" },
  { minScore: 55, maxScore: 59, grade: "1.5" },
  { minScore: 50, maxScore: 54, grade: "1" },
  { minScore: 0, maxScore: 49, grade: "0" }
];

/** สร้างเกณฑ์ตัดเกรดเริ่มต้น */
export async function seedDefaultGradeRules() {
  const docRef = doc(db, COL, DOC_ID);
  await setDoc(docRef, {
    rules: DEFAULT_RULES,
    updatedAt: Timestamp.now()
  });
}

/** ดึงเกณฑ์ตัดเกรดทั้งหมด */
export async function getGradeRules() {
  const docRef = doc(db, COL, DOC_ID);
  const snap = await getDoc(docRef);
  if (!snap.exists()) {
    await seedDefaultGradeRules();
    return DEFAULT_RULES;
  }
  return snap.data().rules || DEFAULT_RULES;
}

/** บันทึกเกณฑ์ตัดเกรด */
export async function saveGradeRules(rules, updatedBy) {
  const docRef = doc(db, COL, DOC_ID);
  await setDoc(docRef, {
    rules,
    updatedBy: updatedBy || 'system',
    updatedAt: Timestamp.now()
  }, { merge: true });
}

/** คำนวณเกรดจากคะแนนรวม */
export function calculateGrade(totalScore, rules) {
  if (!rules || !Array.isArray(rules) || rules.length === 0) {
    rules = DEFAULT_RULES;
  }
  
  // Find matching rule
  const rule = rules.find(r => totalScore >= r.minScore && totalScore <= r.maxScore);
  return rule ? rule.grade : "-";
}
