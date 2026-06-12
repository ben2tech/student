/**
 * scripts/setup-admin.js
 * ─────────────────────────────────────────────────────────────────────────────
 * สคริปต์สำหรับสร้าง Admin คนแรก และ Seed ข้อมูลตัวอย่าง
 *
 * วิธีใช้:
 *   1. ติดตั้ง firebase-admin: npm install firebase-admin
 *   2. ดาวน์โหลด Service Account Key จาก Firebase Console →
 *      Project Settings → Service Accounts → Generate new private key
 *   3. วางไฟล์เป็น serviceAccountKey.json ใน scripts/
 *   4. แก้ไข ADMIN_CONFIG ด้านล่าง
 *   5. รัน: node scripts/setup-admin.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db   = admin.firestore();
const auth = admin.auth();

// ── 1. Config: แก้ไขข้อมูลผู้ดูแลระบบที่นี่ ──────────────────────────────────
const ADMIN_CONFIG = {
  email:    'admin@school.ac.th',
  password: 'Admin@2567!',         // เปลี่ยนรหัสผ่านหลังจาก Login ครั้งแรก
  displayName: 'ผู้ดูแลระบบ',
};

// ── 2. Seed data: เกณฑ์พฤติกรรมเริ่มต้น ─────────────────────────────────────
const BEHAVIOR_CRITERIA = [
  // Positive
  { name: 'จิตอาสา / บำเพ็ญประโยชน์',     category: 'positive', score: 10 },
  { name: 'ช่วยเหลือเพื่อน',              category: 'positive', score: 5  },
  { name: 'รักษาความสะอาด',               category: 'positive', score: 5  },
  { name: 'ประพฤติดีเด่น',                category: 'positive', score: 15 },
  { name: 'เข้าร่วมกิจกรรมโรงเรียน',      category: 'positive', score: 10 },
  { name: 'รับรางวัลการแข่งขัน',           category: 'positive', score: 20 },
  // Negative
  { name: 'ทะเลาะวิวาท / ใช้ความรุนแรง',  category: 'negative', score: -20 },
  { name: 'ลักทรัพย์',                    category: 'negative', score: -30 },
  { name: 'สูบบุหรี่ / ดื่มสุรา',          category: 'negative', score: -30 },
  { name: 'แต่งกายผิดระเบียบ',            category: 'negative', score: -5  },
  { name: 'ไม่ส่งการบ้าน',               category: 'negative', score: -3  },
  { name: 'ใช้โทรศัพท์โดยไม่ได้รับอนุญาต', category: 'negative', score: -5  },
  { name: 'พูดจาไม่สุภาพ',               category: 'negative', score: -5  },
];

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🚀 เริ่ม Setup ระบบ โรงเรียนเบญจมราชรังสฤษฎิ์ ๒...\n');

  // ── สร้าง Admin user ──────────────────────────────────────────────────────
  console.log('📧 สร้างบัญชี Admin...');
  let uid;
  try {
    const user = await auth.createUser({
      email:       ADMIN_CONFIG.email,
      password:    ADMIN_CONFIG.password,
      displayName: ADMIN_CONFIG.displayName,
    });
    uid = user.uid;
    console.log(`   ✅ สร้างสำเร็จ: ${ADMIN_CONFIG.email} (UID: ${uid})`);
  } catch (e) {
    if (e.code === 'auth/email-already-exists') {
      const user = await auth.getUserByEmail(ADMIN_CONFIG.email);
      uid = user.uid;
      console.log(`   ℹ️  บัญชีนี้มีอยู่แล้ว (UID: ${uid})`);
    } else throw e;
  }

  // ── บันทึก Role ใน Firestore ──────────────────────────────────────────────
  await db.collection('users').doc(uid).set({
    displayName: ADMIN_CONFIG.displayName,
    email:       ADMIN_CONFIG.email,
    role:        'admin',
    createdAt:   admin.firestore.Timestamp.now(),
  });
  console.log('   ✅ บันทึก Role "admin" สำเร็จ\n');

  // ── Seed Behavior Criteria ────────────────────────────────────────────────
  console.log('📋 Seed เกณฑ์พฤติกรรม...');
  const batch = db.batch();
  BEHAVIOR_CRITERIA.forEach(c => {
    const ref = db.collection('behaviorCriteria').doc();
    batch.set(ref, { ...c, createdAt: admin.firestore.Timestamp.now() });
  });
  await batch.commit();
  console.log(`   ✅ เพิ่มเกณฑ์พฤติกรรม ${BEHAVIOR_CRITERIA.length} รายการ\n`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('═══════════════════════════════════════════════');
  console.log('✅ Setup เสร็จสมบูรณ์!');
  console.log('');
  console.log('📌 ข้อมูล Admin:');
  console.log(`   อีเมล:    ${ADMIN_CONFIG.email}`);
  console.log(`   รหัสผ่าน: ${ADMIN_CONFIG.password}`);
  console.log('');
  console.log('⚠️  กรุณาเปลี่ยนรหัสผ่านหลัง Login ครั้งแรก!');
  console.log('═══════════════════════════════════════════════');

  process.exit(0);
}

main().catch(e => { console.error('❌ เกิดข้อผิดพลาด:', e); process.exit(1); });
