// modules/utils.js — Shared Utilities

/** แปลงวันที่เป็นภาษาไทย พ.ศ. */
export function formatThaiDate(date) {
  if (!date) return '-';
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  const buddhist = d.getFullYear() + 543;
  const months = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  return `${d.getDate()} ${months[d.getMonth()]} ${buddhist}`;
}

/** แปลงวันที่เป็น string YYYY-MM-DD */
export function toDateKey(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/** Tailwind classes ตามสถานะการเช็คชื่อ */
export function getStatusClasses(status) {
  const map = {
    present: 'bg-green-100 text-green-800 border-green-300',
    late:    'bg-yellow-100 text-yellow-800 border-yellow-300',
    absent:  'bg-red-100 text-red-800 border-red-300',
    leave:   'bg-blue-100 text-blue-800 border-blue-300',
  };
  return map[status] || 'bg-gray-100 text-gray-600 border-gray-300';
}

export function getStatusLabel(status) {
  const map = { present: 'มา', late: 'สาย', absent: 'ขาด', leave: 'ลา' };
  return map[status] || '-';
}

export function getStatusBadge(status) {
  return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold border ${getStatusClasses(status)}">${getStatusLabel(status)}</span>`;
}

/** Toast notification */
let _toastTimer;
export function showToast(msg, type = 'info') {
  let toast = document.getElementById('toast-global');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-global';
    toast.className = 'fixed bottom-6 right-6 z-[9999] px-5 py-3 rounded-xl shadow-2xl text-white text-sm font-medium transition-all duration-300 opacity-0 translate-y-4';
    document.body.appendChild(toast);
  }
  const colors = { success: 'bg-green-600', error: 'bg-red-600', info: 'bg-indigo-600', warning: 'bg-yellow-500' };
  toast.className = toast.className.replace(/bg-\w+-\d+/g, '');
  toast.classList.add(colors[type] || 'bg-indigo-600');
  toast.textContent = msg;
  toast.classList.remove('opacity-0', 'translate-y-4');
  toast.classList.add('opacity-100', 'translate-y-0');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-4');
    toast.classList.remove('opacity-100', 'translate-y-0');
  }, 3000);
}

/** Generic Confirm Dialog */
export function showConfirm(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-black/60 z-[9998] flex items-center justify-center p-4';
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scale-in">
        <h3 class="text-lg font-bold text-gray-800">${title}</h3>
        <p class="text-gray-600 text-sm">${message}</p>
        <div class="flex gap-3 justify-end">
          <button id="confirm-cancel" class="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 text-sm font-medium transition">ยกเลิก</button>
          <button id="confirm-ok" class="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 text-sm font-medium transition">ยืนยัน</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirm-cancel').onclick = () => { overlay.remove(); resolve(false); };
    overlay.querySelector('#confirm-ok').onclick    = () => { overlay.remove(); resolve(true);  };
  });
}

/** Modal helper */
export function openModal(title, bodyHTML, footerHTML = '') {
  closeModal();
  const overlay = document.createElement('div');
  overlay.id = 'modal-overlay';
  overlay.className = 'fixed inset-0 bg-black/60 z-[9990] flex items-center justify-center p-4 overflow-y-auto';
  overlay.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 animate-scale-in">
      <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <h2 class="text-lg font-bold text-gray-800">${title}</h2>
        <button id="modal-close-btn" class="text-gray-400 hover:text-gray-600 transition text-2xl leading-none">&times;</button>
      </div>
      <div class="p-6 overflow-y-auto max-h-[70vh]">${bodyHTML}</div>
      ${footerHTML ? `<div class="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">${footerHTML}</div>` : ''}
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#modal-close-btn').onclick = closeModal;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  return overlay;
}

export function closeModal() {
  document.getElementById('modal-overlay')?.remove();
}

/** Download CSV */
export function downloadCSV(rows, filename) {
  const BOM = '\uFEFF';
  const csv = BOM + rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}

/** Grade/class list (legacy fallback – ใช้เฉพาะเมื่อยังไม่ได้โหลดจาก Firestore) */
export const CLASS_OPTIONS = [
  'ม.1/1','ม.1/2','ม.1/3',
  'ม.2/1','ม.2/2','ม.2/3',
  'ม.3/1','ม.3/2','ม.3/3',
  'ม.4/1','ม.4/2','ม.4/3',
  'ม.5/1','ม.5/2','ม.5/3',
  'ม.6/1','ม.6/2','ม.6/3',
];

/**
 * สร้าง HTML option สำหรับ dropdown เลือกห้องเรียน
 * @param {string} selected    - ค่าที่ต้องการ pre-select
 * @param {string[]} [list]    - รายชื่อห้องเรียน (ถ้าไม่ส่งจะใช้ CLASS_OPTIONS)
 */
export function classSelectOptions(selected = '', list = CLASS_OPTIONS) {
  return list.map(c => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

export function roleLabel(role) {
  const map = {
    admin: 'ผู้ดูแลระบบ',
    homeroom_teacher: 'ครูประจำชั้น',
    subject_teacher: 'ครูประจำวิชา',
    parent: 'ผู้ปกครอง',
    student_affairs: 'กิจการนักเรียน',
  };
  return map[role] || role;
}

export function roleBadge(role) {
  const colors = {
    admin: 'bg-purple-100 text-purple-700',
    homeroom_teacher: 'bg-indigo-100 text-indigo-700',
    subject_teacher: 'bg-teal-100 text-teal-700',
    student_affairs: 'bg-pink-100 text-pink-700',
    parent: 'bg-orange-100 text-orange-700',
  };
  return `<span class="px-2 py-0.5 rounded-full text-xs font-semibold ${colors[role] || 'bg-gray-100 text-gray-600'}">${roleLabel(role)}</span>`;
}

/** Loading spinner HTML */
export function spinnerHTML(msg = 'กำลังโหลด...') {
  return `<div class="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
    <div class="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
    <p class="text-sm">${msg}</p>
  </div>`;
}

/** Empty state HTML */
export function emptyHTML(msg = 'ไม่มีข้อมูล') {
  return `<div class="flex flex-col items-center justify-center py-16 gap-2 text-gray-400">
    <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 9.414V19a2 2 0 01-2 2z"/>
    </svg>
    <p class="text-sm">${msg}</p>
  </div>`;
}

/**
 * บีบอัดรูปภาพบนฝั่ง Client (ลดขนาดและแปลงเป็น JPEG)
 * @param {File} file
 * @param {Object} options
 * @param {number} options.maxWidth
 * @param {number} options.maxHeight
 * @param {number} options.quality
 * @returns {Promise<{compressedFile: File, dataUrl: string}>}
 */
export function compressImage(file, { maxWidth = 800, maxHeight = 800, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Canvas to Blob failed'));
            return;
          }
          const compressedFile = new File([blob], file.name.replace(/\.\w+$/, '.jpg'), {
            type: 'image/jpeg',
            lastModified: Date.now()
          });
          resolve({ compressedFile, dataUrl });
        }, 'image/jpeg', quality);
      };
      img.onerror = () => reject(new Error('ไม่สามารถโหลดไฟล์รูปภาพได้'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
    reader.readAsDataURL(file);
  });
}

