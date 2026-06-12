// modules/students.js — Student CRUD + Grade Promotion
import { db, storage } from '../firebase-config.js';
import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, writeBatch, setDoc, Timestamp,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-storage.js';
import { downloadCSV } from './utils.js';

const COL = 'students';
const BACKUP_COL = 'promotionBackups';

/** ดึงนักเรียนทั้งหมด หรือกรองตาม classRoom */
export async function getStudents(classRoom = null) {
  let q;
  if (classRoom) {
    q = query(collection(db, COL), where('classRoom', '==', classRoom), orderBy('number'));
  } else {
    q = query(collection(db, COL), orderBy('classRoom'), orderBy('number'));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** ดึงนักเรียน 1 คน */
export async function getStudent(id) {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

/** เพิ่มนักเรียนใหม่ */
export async function addStudent(data) {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

/** แก้ไขข้อมูลนักเรียน */
export async function updateStudent(id, data) {
  await updateDoc(doc(db, COL, id), { ...data, updatedAt: Timestamp.now() });
}

/** ลบนักเรียน */
export async function deleteStudent(id) {
  await deleteDoc(doc(db, COL, id));
}

/** อัปโหลดรูปนักเรียน */
export async function uploadStudentPhoto(studentId, file) {
  const fileRef = ref(storage, `students/${studentId}/${Date.now()}_${file.name}`);
  const snap = await uploadBytes(fileRef, file);
  const url = await getDownloadURL(snap.ref);
  return url;
}

/**
 * เลื่อนชั้นนักเรียนยกห้อง
 * 1. Backup ข้อมูลก่อนเลื่อน
 * 2. Batch update classRoom ของนักเรียนทุกคนในห้อง
 */
export async function promoteStudents(fromClass, toClass, performedBy) {
  // ดึงนักเรียนในห้องต้นทาง
  const students = await getStudents(fromClass);
  if (students.length === 0) throw new Error(`ไม่พบนักเรียนในห้อง ${fromClass}`);

  // Backup snapshot
  const backupRef = doc(collection(db, BACKUP_COL));
  await setDoc(backupRef, {
    fromClass,
    toClass,
    performedBy,
    createdAt: Timestamp.now(),
    studentCount: students.length,
    students: students,
  });

  // Batch update
  const batch = writeBatch(db);
  students.forEach(s => {
    batch.update(doc(db, COL, s.id), { classRoom: toClass, updatedAt: Timestamp.now() });
  });
  await batch.commit();

  return { backupId: backupRef.id, count: students.length };
}

/** ดึงประวัติการเลื่อนชั้น */
export async function getPromotionBackups() {
  const snap = await getDocs(collection(db, BACKUP_COL));
  return snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) =>
    b.createdAt?.seconds - a.createdAt?.seconds
  );
}

/** ดึง student โดย parentUserId */
export async function getStudentByParentUid(parentUid) {
  const q = query(collection(db, COL), where('parentUid', '==', parentUid));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ─── CSV Import ───────────────────────────────────────────────────────────────

/**
 * แปลง CSV text เป็น array ของข้อมูลนักเรียน
 * รองรับ Header row ภาษาไทยและอังกฤษ
 * รูปแบบ CSV: เลขที่,รหัสนักเรียน,ชื่อ,นามสกุล,วันเกิด,เบอร์นักเรียน,ห้องเรียน,ชื่อผู้ปกครอง,เบอร์ผู้ปกครอง
 */
export function parseStudentCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV ต้องมีอย่างน้อย 1 แถวข้อมูล (ไม่นับ header)');

  // Detect separator: comma, semicolon, or tab
  let sep = ',';
  if (lines[0].includes('\t')) sep = '\t';
  else if (lines[0].includes(';')) sep = ';';

  // Header mapping (ยืดหยุ่น)
  // Clean header: remove spaces, quotes, and non-printable characters
  const cleanHeader = (h) => h.trim().toLowerCase().replace(/[\s\-_]+/g, '').replace(/['"]/g, '');
  const raw = lines[0].split(sep).map(cleanHeader);

  // Debug: If first column looks like garbled text, it's probably an encoding issue
  if (raw[0] && /[^\u0000-\u007F]/.test(raw[0]) === false && lines[0].includes('เ') === false && lines[0].length > 0) {
     // This is a weak check, but often if Thai characters are missing in the raw first line 
     // while expecting them, it might be encoding. 
  }

  const colMap = {
    number:      ['เลขที่','number','no','ลำดับ','ที่'],
    studentCode: ['รหัสนักเรียน','studentcode','รหัส','code','id','รหัสประจำตัว'],
    firstName:   ['ชื่อ','firstname','name','ชื่อตัว','ชื่อจริง'],
    lastName:    ['นามสกุล','lastname','surname','familyname'],
    birthDate:   ['วันเกิด','birthdate','dob','birthday','วันเดือนปีเกิด'],
    phone:       ['เบอร์นักเรียน','phone','tel','เบอร์โทร','โทรศัพท์'],
    classRoom:   ['ห้องเรียน','classroom','class','ชั้นเรียน','ห้อง','ชั้น'],
    parentName:  ['ชื่อผู้ปกครอง','parentname','parent','ผู้ปกครอง','ชื่อบิดามารดา'],
    parentPhone: ['เบอร์ผู้ปกครอง','parentphone','parenttel','เบอร์โทรผู้ปกครอง'],
    photoUrl:    ['รูป','รูปถ่าย','photo','photourl','image','imageurl'],
    behaviorScore: ['คะแนนพฤติกรรม','behaviorscore','score','points','คะแนน'],
  };

  const idx = {};
  Object.entries(colMap).forEach(([field, aliases]) => {
    const found = raw.findIndex(h => aliases.includes(h));
    if (found !== -1) idx[field] = found;
  });

  // Check for common encoding failure (if no headers found at all)
  if (Object.keys(idx).length === 0) {
    throw new Error('ไม่พบข้อมูลที่ต้องการใน Header กรุณาตรวจสอบว่าบันทึกไฟล์เป็น "CSV UTF-8" หรือไม่');
  }

  // Require at minimum: ชื่อ + ห้องเรียน
  if (idx.firstName === undefined) throw new Error('ไม่พบคอลัมน์ "ชื่อ" ใน CSV (อาจเป็นเพราะการเข้ารหัสภาษาไทยผิดพลาด ให้ลอง Save As เป็น CSV UTF-8)');
  if (idx.classRoom === undefined)  throw new Error('ไม่พบคอลัมน์ "ห้องเรียน" ใน CSV');

  const errors = [];
  const students = [];

  lines.slice(1).forEach((line, i) => {
    if (!line.trim()) return;
    const cols = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const get  = (field) => (idx[field] !== undefined ? cols[idx[field]] : '') || '';

    const firstName = get('firstName').trim();
    const classRoom = get('classRoom').trim();
    if (!firstName) { errors.push(`แถว ${i + 2}: ไม่มีชื่อนักเรียน`); return; }
    if (!classRoom) { errors.push(`แถว ${i + 2}: ไม่มีห้องเรียน`); return; }

    students.push({
      number:      parseInt(get('number')) || (i + 1),
      studentCode: get('studentCode'),
      firstName,
      lastName:    get('lastName'),
      birthDate:   get('birthDate'),
      phone:       get('phone'),
      classRoom,
      parentName:  get('parentName'),
      parentPhone: get('parentPhone'),
      photoUrl:    get('photoUrl'),
      behaviorScore: parseInt(get('behaviorScore')) || 0,
    });
  });

  return { students, errors };
}

/**
 * Import นักเรียนจาก CSV แบบ Batch (Firestore writeBatch)
 * คืนค่า: จำนวนที่นำเข้าสำเร็จ
 */
export async function importStudentsFromCSV(students, overwrite = false) {
  const BATCH_SIZE = 400; // Firestore limit 500 ops/batch
  let imported = 0;

  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const chunk = students.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(s => {
      const ref = doc(collection(db, COL));
      batch.set(ref, { ...s, createdAt: Timestamp.now() });
    });
    await batch.commit();
    imported += chunk.length;
  }
  return imported;
}

/** Download CSV template */
export function downloadStudentCSVTemplate() {
  const header = ['เลขที่','รหัสนักเรียน','ชื่อ','นามสกุล','วันเกิด(YYYY-MM-DD)','เบอร์นักเรียน','ห้องเรียน','ชื่อผู้ปกครอง','เบอร์ผู้ปกครอง','คะแนนพฤติกรรม'];
  const sample = [
    ['1','65001','สมชาย','ใจดี','2010-03-15','0812345678','ม.1/1','นายสมศักดิ์ ใจดี','0898765432','100'],
    ['2','65002','สมหญิง','มีสุข','2010-07-22','0887654321','ม.1/1','นางสมศรี มีสุข','0876543210','100'],
  ];
  downloadCSV([header, ...sample], 'student_import_template.csv');
}
