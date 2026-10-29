/**
 * Konfigurasi global. Tidak ada data pribadi di sini (repositori publik).
 */
var CFG = {
  SHEETS: { USERS: 'Users', DEPARTMENTS: 'Departments' },

  USER_COLS: [
    'NIK', 'Name', 'Nickname', 'Email', 'DeptCode', 'Department', 'Level', 'Role', 'Status',
    'IsLogistic', 'PassHash', 'PassSalt', 'MustChange', 'FailCount', 'LockUntil', 'LastLogin'
  ],
  DEPT_COLS: ['Department', 'DeptCode', 'HeadNIK', 'DeputyNIK'],

  // Kolom yang harus tetap teks (jaga angka 0 di depan)
  USER_TEXT_COLS: ['NIK', 'DeptCode', 'PassHash', 'PassSalt'],
  DEPT_TEXT_COLS: ['DeptCode', 'HeadNIK', 'DeputyNIK'],

  DEFAULT_PASSWORD: 'warehouseportal',
  MIN_PASSWORD_LENGTH: 8,
  MAX_FAILED: 5,
  LOCK_MINUTES: 15,
  SESSION_HOURS: 8,
  HASH_ROUNDS: 1000,

  SUGGEST_MIN_CHARS: 3,
  SUGGEST_MAX: 8,

  STATUS_VALUES: ['Active', 'No login'],
  ROLE_VALUES: ['User', 'Admin', 'Super Admin'],
  DEFAULT_LEVEL: '1. User Non Planner',

  // Akun uji tidak ikut diimpor
  IMPORT_EXCLUDE_NAMES: ['Test Dept', 'Test User', 'Administrator']
};
