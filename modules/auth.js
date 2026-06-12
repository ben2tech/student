// modules/auth.js — Firebase Authentication & Role Management
import { auth, db } from '../firebase-config.js';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';
import {
  doc, getDoc, setDoc, collection, getDocs, updateDoc, deleteDoc, query, where, Timestamp, writeBatch,
} from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js';
import { downloadCSV } from './utils.js';

/** Login ด้วย Email/Password */
export async function loginUser(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/** Logout */
export async function logoutUser() {
  await signOut(auth);
}

/**
 * Login ด้วย Google
 * - ถ้า user ยังไม่มีใน Firestore → สร้าง doc อัตโนมัติ (role = 'parent' เป็น default)
 * - Admin สามารถเปลี่ยน role ภายหลังได้
 */
export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  return cred.user;
}

/** ดึง Role + ข้อมูล user จาก Firestore */
export async function getUserData(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  if (snap.exists()) return { uid, ...snap.data() };

  // 🛡️ Auto-creation สำหรับผู้ใช้ใหม่ (เช่น Google Login ครั้งแรก)
  const user = auth.currentUser;
  if (user && user.uid === uid) {
    const data = {
      displayName: user.displayName || '',
      email:       user.email || '',
      photoURL:    user.photoURL || '',
      roles:       ['parent'],
      createdAt:   Timestamp.now(),
    };
    try {
      await setDoc(doc(db, 'users', uid), data);
      return { uid, ...data };
    } catch (e) {
      console.error('Error auto-creating user document:', e);
      return null;
    }
  }
  return null;
}

/** ตรวจสอบสิทธิ์ (รองรับทั้ง role string และ roles array) */
export function hasRole(userData, roleName) {
  if (!userData) return false;
  if (userData.role === 'admin') return true; // Admin has all roles
  if (userData.role === roleName) return true;
  if (Array.isArray(userData.roles) && userData.roles.includes(roleName)) return true;
  return false;
}

/** Monitor auth state */
export function onAuthStateChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/** สร้าง User ใหม่ (Admin only) */
export async function createUser(email, password, profileData) {
  // Note: createUserWithEmailAndPassword จะ sign-in อัตโนมัติ
  // ใช้ secondary approach: สร้างผ่าน Admin SDK ไม่ได้บน client
  // วิธีนี้จะ sign-in เป็น user ใหม่ชั่วคราว แล้ว sign-in กลับ
  const currentUser = auth.currentUser;
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(cred.user, { displayName: profileData.displayName });
  await setDoc(doc(db, 'users', cred.user.uid), {
    ...profileData,
    email,
    createdAt: new Date(),
  });
  // Sign back in as admin (re-login)
  // This is a limitation of client-side Firebase - after creating user, current user changes
  // The admin will need to re-login after creating a user
  return cred.user.uid;
}

/** แก้ไขข้อมูล user */
export async function updateUserData(uid, data) {
  await updateDoc(doc(db, 'users', uid), data);
}

/** ลบ user document (ไม่ลบ Auth account) */
export async function deleteUserData(uid) {
  await deleteDoc(doc(db, 'users', uid));
}

/** ดึงรายชื่อ users ทั้งหมด */
export async function getAllUsers() {
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
}

/** ดึง users ตาม role */
export async function getUsersByRole(role) {
  // Query by 'role' field (legacy)
  const q1 = query(collection(db, 'users'), where('role', '==', role));
  const snap1 = await getDocs(q1);
  
  // Query by 'roles' array field
  const q2 = query(collection(db, 'users'), where('roles', 'array-contains', role));
  const snap2 = await getDocs(q2);

  const results = new Map();
  snap1.docs.forEach(d => results.set(d.id, { uid: d.id, ...d.data() }));
  snap2.docs.forEach(d => results.set(d.id, { uid: d.id, ...d.data() }));

  return [...results.values()];
}


/** Current user getter */
export function currentUser() {
  return auth.currentUser;
}

// ─── CSV Import for Users ───────────────────────────────────────────────────

/**
 * แปลง CSV text เป็น array ของข้อมูลสมาชิก
 */
export function parseUserCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error('CSV ต้องมีอย่างน้อย 1 แถวข้อมูล (ไม่นับ header)');

  let sep = ',';
  if (lines[0].includes('\t')) sep = '\t';
  else if (lines[0].includes(';')) sep = ';';

  const cleanHeader = (h) => h.trim().toLowerCase().replace(/[\s\-_]+/g, '').replace(/['"]/g, '');
  const raw = lines[0].split(sep).map(cleanHeader);

  const colMap = {
    uid:         ['uid', 'userid', 'id', 'รหัสผู้ใช้'],
    displayName: ['ชื่อ', 'name', 'displayname', 'ชื่อแสดง', 'ชื่อนามสกุล'],
    email:       ['อีเมล', 'email', 'mail'],
    roles:       ['สิทธิ์', 'roles', 'role', 'หน้าที่'],
    classRoom:   ['ห้องเรียน', 'classroom', 'class', 'ห้อง'],
  };

  const idx = {};
  Object.entries(colMap).forEach(([field, aliases]) => {
    const found = raw.findIndex(h => aliases.includes(h));
    if (found !== -1) idx[field] = found;
  });

  if (!idx.uid) throw new Error('ไม่พบคอลัมน์ "UID" ใน CSV');
  if (!idx.displayName) throw new Error('ไม่พบคอลัมน์ "ชื่อ" ใน CSV');

  const errors = [];
  const users = [];

  lines.slice(1).forEach((line, i) => {
    const cols = line.split(sep).map(c => c.trim().replace(/^["']|["']$/g, ''));
    const get  = (field) => (idx[field] !== undefined ? cols[idx[field]] : '') || '';

    const uid = get('uid');
    const name = get('displayName');
    if (!uid) { errors.push(`แถว ${i + 2}: ไม่มี UID`); return; }
    if (!name) { errors.push(`แถว ${i + 2}: ไม่มีชื่อ`); return; }

    const rolesRaw = get('roles');
    const roles = rolesRaw ? rolesRaw.split('|').map(r => r.trim()) : ['parent'];

    users.push({
      uid,
      displayName: name,
      email: get('email'),
      roles: roles,
      role: roles[0],
      classRoom: get('classRoom'),
      createdAt: Timestamp.now(),
    });
  });

  return { users, errors };
}

/**
 * Import สมาชิกจาก CSV แบบ Batch
 */
export async function importUsersFromCSV(users) {
  const BATCH_SIZE = 400;
  let imported = 0;

  for (let i = 0; i < users.length; i += BATCH_SIZE) {
    const chunk = users.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(u => {
      const { uid, ...data } = u;
      batch.set(doc(db, 'users', uid), data, { merge: true });
    });
    await batch.commit();
    imported += chunk.length;
  }
  return imported;
}

/** Download User CSV template */
export function downloadUserCSVTemplate() {
  const header = ['UID', 'ชื่อ-นามสกุล', 'อีเมล', 'สิทธิ์ (คั่นด้วย |)', 'ห้องเรียน'];
  const sample = [
    ['COPY_UID_FROM_FIREBASE_1', 'ครูสมศรี มีสุข', 'somsri@example.com', 'homeroom_teacher|subject_teacher', 'ม.1/1'],
    ['COPY_UID_FROM_FIREBASE_2', 'แอดมินใจดี', 'admin@example.com', 'admin', ''],
  ];
  downloadCSV([header, ...sample], 'user_import_template.csv');
}
