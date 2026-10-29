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
  IMPORT_EXCLUDE_NAMES: ['Test Dept', 'Test Planner', 'Test User', 'Administrator'],

  // ---- Pengajuan scrap ----
  SOURCES: ['Outage', 'Project', 'Routine Usage', 'Other'],
  STATUS: {
    DRAFT: 'Draft',
    WAIT_HEAD: 'Menunggu Dept Head',
    WAIT_LOG: 'Menunggu Logistic',
    APPROVED: 'Disetujui',
    DONE: 'Selesai',
    REJECTED: 'Ditolak',
    CANCELLED: 'Dibatalkan',
    DELETED: 'Dihapus'
  },
  DEFAULT_UOMS: ['PC', 'CAN', 'DRUM', 'LOT', 'SET', 'M', 'KG', 'L', 'BOX', 'ROL', 'PAC', 'TON'],
  UOM_OTHER: 'Other',
  MAX_ITEMS: 50,
  MAX_PHOTOS: 5,
  MAX_PHOTO_B64: 2000000, // ~1,5 MB biner, foto sudah dikompres di HP
  PHOTO_FOLDER_NAME: 'Scrap Portal Photos',
  ID_PREFIX: 'SCR',
  LOGISTIC_DEPARTMENT: 'Warehouse & Logistic', // nama departemen Logistic (untuk kolom tanda tangan PDF)
  UTC_OFFSET_HOURS: 8, // WITA

  // Tabel tambahan (kolom teks tetap berformat teks agar 0 di depan dan tanggal ISO aman)
  TABLES: {
    Submissions: {
      cols: ['ID', 'Number', 'Status', 'RequesterNIK', 'RequesterName', 'Department', 'Source', 'SourceOther',
        'FolderId', 'CreatedAt', 'UpdatedAt', 'SubmittedAt'],
      text: ['ID', 'Number', 'RequesterNIK', 'FolderId', 'CreatedAt', 'UpdatedAt', 'SubmittedAt']
    },
    Items: {
      cols: ['SubmissionID', 'Line', 'MaterialNo', 'Description', 'Qty', 'UoM', 'Reason'],
      text: ['SubmissionID', 'MaterialNo']
    },
    Photos: {
      cols: ['SubmissionID', 'FileId', 'Name', 'AddedAt'],
      text: ['SubmissionID', 'FileId', 'AddedAt']
    },
    History: {
      cols: ['SubmissionID', 'At', 'ByNIK', 'ByName', 'Action', 'Note'],
      text: ['SubmissionID', 'At', 'ByNIK']
    },
    UoM: { cols: ['Code'], text: ['Code'] }
  }
};
