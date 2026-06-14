// app.js — Main Router & App Logic
import { loginUser, logoutUser, getUserData, onAuthStateChange, loginWithGoogle, hasRole } from './modules/auth.js';
import { showToast } from './modules/utils.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderStudentsPage } from './pages/students-page.js?v=1.4';
import { renderAttendancePage } from './pages/attendance-page.js';
import { renderBehaviorPage } from './pages/behavior-page.js';
import { renderBehaviorCriteriaPage } from './pages/behavior-criteria-page.js';
import { renderSubjectsPage } from './pages/subjects-page.js';
import { renderReportsPage } from './pages/reports-page.js?v=1.3';
import { renderParentPage } from './pages/parent-page.js';
import { renderUsersPage } from './pages/users-page.js';
import { renderClassesPage } from './pages/classes-page.js';

// ─── State ────────────────────────────────────────────────────────────────────
let currentUserData = null;

// ─── Router ───────────────────────────────────────────────────────────────────
const ROUTES = {
  dashboard:          { label: 'แดชบอร์ด',           icon: '📊', render: renderDashboard,            roles: ['admin','homeroom_teacher','subject_teacher'] },
  users:              { label: 'จัดการสมาชิก',       icon: '👥', render: renderUsersPage,             roles: ['admin'] },
  classes:            { label: 'จัดการห้องเรียน',    icon: '🏫', render: renderClassesPage,           roles: ['admin'] },
  subjects:           { label: 'รายวิชา',             icon: '📚', render: renderSubjectsPage,          roles: ['admin','subject_teacher'] },
  students:           { label: 'นักเรียน',            icon: '👨‍🎓', render: renderStudentsPage,         roles: ['admin','homeroom_teacher'] },
  attendance:         { label: 'เช็คชื่อ',            icon: '✅', render: renderAttendancePage,        roles: ['admin','homeroom_teacher','subject_teacher'] },
  behavior:           { label: 'พฤติกรรม',           icon: '✏️', render: renderBehaviorPage,           roles: ['admin','homeroom_teacher','subject_teacher'] },
  'behavior-criteria':{ label: 'เกณฑ์พฤติกรรม',     icon: '⚙️', render: renderBehaviorCriteriaPage,  roles: ['admin'] },
  reports:            { label: 'รายงาน',              icon: '📈', render: renderReportsPage,           roles: ['admin','homeroom_teacher'] },
  parent:             { label: 'ข้อมูลบุตรหลาน',     icon: '👨‍👧', render: renderParentPage,            roles: ['admin', 'parent'] },
};

// ─── Auth State ───────────────────────────────────────────────────────────────
onAuthStateChange(async (user) => {
  if (user) {
    try {
      currentUserData = await getUserData(user.uid);
      if (!currentUserData) {
        showToast('ไม่พบข้อมูลผู้ใช้ในระบบ กรุณาติดต่อ Admin', 'error');
        await logoutUser();
        showLogin();
        return;
      }
      showApp(currentUserData);
      navigateTo('dashboard');
    } catch (e) {
      console.error('Auth state error:', e);
      showLogin();
    }
  } else {
    currentUserData = null;
    showLogin();
  }
});

// ─── Show Login ───────────────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('layout-loading')?.classList.add('hidden');
  document.getElementById('layout-app').classList.add('hidden');
  document.getElementById('layout-login').classList.remove('hidden');
}

// ─── Show App ─────────────────────────────────────────────────────────────────
function showApp(userData) {
  document.getElementById('layout-loading')?.classList.add('hidden');
  document.getElementById('layout-login').classList.add('hidden');
  document.getElementById('layout-app').classList.remove('hidden');

  // User info in sidebar header
  document.getElementById('sidebar-username').textContent  = userData.displayName || userData.email;
  document.getElementById('sidebar-role').textContent = getRoleLabel(userData);
  document.getElementById('sidebar-avatar').textContent = (userData.displayName || 'U')[0].toUpperCase();

  // Build navigation
  buildNav(userData);
}

function getRoleLabel(userData) {
  const roles = [];
  if (hasRole(userData, 'admin')) roles.push('ผู้ดูแลระบบ');
  if (hasRole(userData, 'homeroom_teacher')) roles.push('ครูประจำชั้น');
  if (hasRole(userData, 'subject_teacher')) roles.push('ครูประจำวิชา');
  if (hasRole(userData, 'parent')) roles.push('ผู้ปกครอง');
  
  if (roles.length === 0) return userData.role || 'สมาชิก';
  return roles.join(' | ');
}

// ─── Build Nav ────────────────────────────────────────────────────────────────
function buildNav(userData) {
  const nav = document.getElementById('sidebar-nav');
  const role = (userData.role || '').toLowerCase().trim();
  console.log('[Debug] Building nav for role:', role, userData);

  nav.innerHTML = Object.entries(ROUTES)
    .filter(([key, route]) => {
      // Admin sees everything except Parent (unless they have a linked student)
      if (hasRole(userData, 'admin')) {
        if (key === 'parent') return !!userData.linkedStudentId;
        return true;
      }
      return route.roles.some(r => hasRole(userData, r));
    })
    .map(([key, route]) => `
      <button data-route="${key}" class="nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all
        text-gray-400 hover:text-white hover:bg-white/10">
        <span class="text-lg w-6 text-center">${route.icon}</span>
        <span class="nav-label">${route.label}</span>
      </button>`).join('');

  nav.querySelectorAll('.nav-item').forEach(btn => {
    btn.onclick = () => navigateTo(btn.dataset.route);
  });
}

// ─── Navigate ─────────────────────────────────────────────────────────────────
async function navigateTo(routeKey) {
  const route = ROUTES[routeKey];
  if (!route) return;
  
  const hasAccess = hasRole(currentUserData, 'admin') || route.roles.some(r => hasRole(currentUserData, r));
  if (!hasAccess) {
    showToast('คุณไม่มีสิทธิ์เข้าถึงหน้านี้', 'error');
    return;
  }

  // Highlight active nav
  document.querySelectorAll('.nav-item').forEach(btn => {
    const isActive = btn.dataset.route === routeKey;
    btn.className = `nav-item w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-all
      ${isActive ? 'bg-white/15 text-white' : 'text-gray-400 hover:text-white hover:bg-white/10'}`;
  });

  // Page title
  document.getElementById('page-title').textContent = route.label;

  // Collapse mobile sidebar
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('sidebar-overlay').classList.add('hidden');

  // Render page
  const content = document.getElementById('app-content');
  content.innerHTML = '<div class="flex items-center justify-center h-64"><div class="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>';

  try {
    await route.render(content, currentUserData);
  } catch (e) {
    console.error(`Error rendering ${routeKey}:`, e);
    content.innerHTML = `<div class="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
      <h3 class="font-bold mb-1">เกิดข้อผิดพลาด</h3>
      <p class="text-sm">${e.message}</p>
    </div>`;
    showToast('เกิดข้อผิดพลาดในการโหลดหน้า', 'error');
  }
}

// ─── Login Form ───────────────────────────────────────────────────────────────
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email    = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');

  btn.disabled = true;
  btn.textContent = 'กำลังเข้าสู่ระบบ...';
  document.getElementById('login-error').classList.add('hidden');

  try {
    await loginUser(email, password);
    // onAuthStateChange will handle the rest
  } catch (e) {
    const errEl = document.getElementById('login-error');
    errEl.textContent = getAuthErrorMessage(e.code);
    errEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'เข้าสู่ระบบ';
  }
});

function getAuthErrorMessage(code) {
  const msgs = {
    'auth/user-not-found':    'ไม่พบบัญชีผู้ใช้นี้ในระบบ',
    'auth/wrong-password':    'รหัสผ่านไม่ถูกต้อง',
    'auth/invalid-email':     'รูปแบบอีเมลไม่ถูกต้อง',
    'auth/too-many-requests': 'ลองเข้าสู่ระบบบ่อยเกินไป กรุณาลองใหม่ภายหลัง',
    'auth/invalid-credential':'อีเมลหรือรหัสผ่านไม่ถูกต้อง',
  };
  return msgs[code] || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
}

// ─── Logout ───────────────────────────────────────────────────────────────────
document.getElementById('btn-logout')?.addEventListener('click', async () => {
  await logoutUser();
  showToast('ออกจากระบบเรียบร้อย', 'info');
});

// ─── Google Sign-In ───────────────────────────────────────────────────────────
document.getElementById('btn-google-login')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-google-login');
  const errEl = document.getElementById('login-error');

  btn.disabled = true;
  btn.innerHTML = `
    <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
    </svg>
    กำลังเชื่อมต่อ Google...`;
  errEl.classList.add('hidden');

  try {
    await loginWithGoogle();
    // onAuthStateChange จะจัดการต่อเอง
  } catch (e) {
    // ผู้ใช้ปิด popup ไม่ต้องแสดง error
    if (e.code !== 'auth/popup-closed-by-user' && e.code !== 'auth/cancelled-popup-request') {
      errEl.textContent = getAuthErrorMessage(e.code);
      errEl.classList.remove('hidden');
    }
    btn.disabled = false;
    btn.innerHTML = `
      <svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
      </svg>
      เข้าสู่ระบบด้วย Google`;
  }
});

// ─── Mobile sidebar toggle ────────────────────────────────────────────────────
document.getElementById('btn-menu')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.remove('-translate-x-full');
  document.getElementById('sidebar-overlay').classList.remove('hidden');
});

document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
  document.getElementById('sidebar').classList.add('-translate-x-full');
  document.getElementById('sidebar-overlay').classList.add('hidden');
});

// ─── Nav minimize (desktop) ───────────────────────────────────────────────────
document.getElementById('btn-collapse')?.addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  const isCollapsed = sidebar.classList.contains('w-16');
  if (isCollapsed) {
    sidebar.classList.remove('w-16');
    sidebar.classList.add('w-64');
    document.querySelectorAll('.nav-label').forEach(el => el.classList.remove('hidden'));
    document.getElementById('sidebar-user-info').classList.remove('hidden');
    document.getElementById('brand-text').classList.remove('hidden');
  } else {
    sidebar.classList.add('w-16');
    sidebar.classList.remove('w-64');
    document.querySelectorAll('.nav-label').forEach(el => el.classList.add('hidden'));
    document.getElementById('sidebar-user-info').classList.add('hidden');
    document.getElementById('brand-text').classList.add('hidden');
  }
});
