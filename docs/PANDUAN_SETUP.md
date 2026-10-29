# Panduan pemasangan

Panduan ini bertambah tiap tahap. Saat ini: **Tahap 1 (login dan akun)** dan **Tahap 2 (form pengajuan)**, **Tahap 3 (alur approval)**, dan **Tahap 4 (konfirmasi terima dan PDF)**, dan **Tahap 5 (rekap)**.

## A. Siapkan Google (sekali saja)

1. Pakai akun Google khusus portal (disarankan) atau akun kantor. Pemilik akun ini memegang data dan foto.
2. Buka Google Sheets, buat spreadsheet kosong bernama **Scrap Portal DB**.
3. Menu **Extensions → Apps Script**. Project terbuka (terikat ke spreadsheet itu).

## B. Pasang kode

Pilih satu cara.

**Cara 1: salin manual (tanpa install apa pun)**
1. Hapus isi `Code.gs` bawaan. Ganti nama file menjadi `Code`.
2. Untuk setiap file di folder `src/` buat file baru di Apps Script dengan nama sama dan isi sama:
   - Script (`+ → Script`): `Config`, `Sec`, `Repo`, `Roles`, `Auth`, `Admin`, `Router`, `Setup`, `Code`
   - HTML (`+ → HTML`): `Index`, `Styles`, `Client`
3. **Project Settings** (ikon roda gigi) → centang **Show "appsscript.json" manifest file**. Buka `appsscript.json`, ganti isinya dengan isi `src/appsscript.json`.

**Cara 2: clasp (untuk pembaruan lebih cepat)**
1. `npm i -g @google/clasp`, lalu `clasp login`.
2. Salin `.clasp.json.example` menjadi `.clasp.json`, isi `scriptId` (Project Settings → Script ID).
3. `clasp push`.

## C. Buat tabel dan admin pertama

1. Di editor Apps Script pilih fungsi **setupSheets**, klik **Run**, setujui izin akses Google (muncul peringatan "belum diverifikasi": pilih *Advanced → Go to ... (unsafe)*, itu aplikasi Anda sendiri).
2. Di spreadsheet muncul sheet `Users` dan `Departments`.
3. Di sheet `Users`, isi **satu baris** admin pertama (baris 2). Kolom lain biarkan kosong:

   | NIK | Name | Nickname | Department | Level | Role | Status |
   |---|---|---|---|---|---|---|
   | NIK Anda | Nama Anda | Nama pendek | Warehouse & Logistic | 3. Departement Head | Super Admin | Active |

   Kolom NIK sudah berformat teks, jadi angka 0 di depan aman.

## D. Terbitkan sebagai web

1. **Deploy → New deployment → ikon roda gigi → Web app**.
2. *Execute as*: **Me**. *Who has access*: **Anyone**.
   (Tetap aman: siapa pun yang punya tautan hanya melihat halaman login. Data hanya terbuka setelah login NIK dan password.)
3. **Deploy**, salin URL web app. Kirim URL ini ke pengguna. Di HP: buka di Chrome → menu → *Add to Home screen*.
4. Setiap kali kode diubah: **Deploy → Manage deployments → ikon pensil → Version: New version → Deploy**. URL tetap sama.

## E. Pemakaian pertama

1. Buka URL, login dengan NIK admin dan password awal. Anda wajib membuat password baru.
2. Menu **Admin: Pengguna → Impor akun dari Excel**. Pilih file akun (kolom: Name, Nickname, Email, NIK, Dept Code, Department, Level, Role, Status). Alternatif jika file gagal terbaca: salin semua sel di Excel lalu tempel di kotak teks.
3. Akun uji (Test Dept, Test Planner, Test User, Administrator) otomatis dilewati.
4. Centang **Logistic Staff** untuk 5 orang Logistic.
5. Untuk akun yang lupa password: **Reset password** (kembali ke password awal, wajib ganti lagi).

## Aturan akun

- Password awal sama untuk semua akun baru dan akun yang direset. Wajib diganti di login pertama.
- Password baru minimal 8 karakter, tidak boleh sama dengan password awal.
- 5 kali salah: akun terkunci 15 menit.
- Sesi habis setelah 8 jam.
- Akun berstatus **No login** tidak bisa masuk (admin bisa mengubahnya).

## Daftar uji manual Tahap 1 (di Google, setelah terpasang)

- [ ] Login admin berhasil, dipaksa ganti password.
- [ ] Impor file akun: jumlah "Baru" mendekati jumlah akun file dikurangi akun uji.
- [ ] Sheet `Departments` terisi. Cek Dept. Head tiap departemen. Civil Maintenance terisi 1 orang (Dept. Head sementara). Departemen Management kosong.
- [ ] NIK pendek atau berawalan 0 bisa login persis seperti ditulis.
- [ ] Ketik 3 huruf nama di halaman login: muncul saran, NIK terisi.
- [ ] Akun biasa (bukan admin) tidak melihat menu Admin.
- [ ] Ubah status satu akun ke No login: akun itu tidak bisa masuk.
- [ ] Kecepatan login terasa wajar (jika lebih dari ±5 detik, kurangi `HASH_ROUNDS` di `Config.gs`).

## Tambahan Tahap 2 (form pengajuan dan foto)

Jika Tahap 1 sudah terpasang, lakukan ini sekali:

1. Salin file baru ke Apps Script: `Validate.gs`, `Workflow.gs`, `Subs.gs`, `ClientSubs.html`. Perbarui file yang berubah: `Config.gs`, `Repo.gs`, `Router.gs`, `Setup.gs`, `Index.html`, `Client.html`, `Styles.html`. (Dengan clasp cukup `clasp push`.)
2. Jalankan lagi **setupSheets** dari editor. Ia membuat sheet `Submissions`, `Items`, `Photos`, `History`, `UoM` (diisi daftar UoM awal) dan folder **Scrap Portal Photos** di Google Drive. Setujui izin Drive jika diminta.
3. **Deploy → Manage deployments → pensil → Version: New version → Deploy**.

Cara kerja:

- Pemohon: **+ Buat Pengajuan Scrap**, isi Sumber, item (boleh banyak), foto (1-5, dikompres otomatis di HP), lalu **Simpan Draft** atau **Kirim Pengajuan**.
- Nomor `SCR-tahun-0001` diberikan saat pertama kali dikirim. Draft belum bernomor.
- Setelah dikirim, status menjadi **Menunggu Dept Head**. Jika pemohon Dept. Head/Division Head/Management, departemennya tanpa Dept. Head, atau Dept. Head sendiri, status langsung **Menunggu Logistic**.
- Foto tersimpan di folder Drive (satu subfolder per pengajuan), tidak dibagikan publik. Foto hanya tampil di aplikasi untuk yang berhak melihat.
- UoM yang diketik lewat "Other" otomatis masuk daftar pilihan (sheet `UoM`, admin bisa mengedit langsung di sheet).
- Approval, tolak, batal, dan buka kembali hadir di Tahap 3.

### Uji manual Tahap 2

- [ ] Buat pengajuan 2 item (satu pakai UoM Other, Qty `2,5`) dengan 2 foto, kirim.
- [ ] Nomor `SCR-<tahun>-0001`, status sesuai jalur. Sheet `Items`, `Photos`, `History` terisi, foto ada di Drive.
- [ ] Draft bisa disimpan, dibuka lagi, diubah (foto dihapus/ditambah), dikirim, dihapus.
- [ ] Qty `1,25` ditolak. Kirim tanpa foto ditolak.
- [ ] Akun lain tidak bisa membuka pengajuan orang lain (kecuali Dept. Head departemen itu, Logistic, admin, Division Head, Management setelah dikirim).
- [ ] Upload foto dari HP via sinyal biasa berhasil (jika sering gagal, kecilkan ukuran di `ClientSubs.html` bagian `compress`).

## Tambahan Tahap 3 (alur approval)

Tidak ada sheet baru. Salin file baru dan yang berubah, lalu terbitkan versi baru:

- File baru: `Dept.gs`.
- File berubah: `Workflow.gs`, `Subs.gs`, `Router.gs`, `Repo.gs`, `Client.html`, `ClientSubs.html`.
- **Deploy → Manage deployments → pensil → Version: New version → Deploy**.

Aturan:

- Pemohon biasa: **Dept. Head (atau Deputy) → Logistic Staff → Disetujui**.
- Dept. Head, Division Head, Management, departemen tanpa Dept. Head, atau pemohon yang sendiri adalah Dept. Head: langsung ke Logistic.
- Tidak ada yang boleh menyetujui atau menolak pengajuannya sendiri (Logistic Staff yang mengajukan akan diproses Logistic Staff lain).
- Tolak: alasan wajib. Pemohon melihat alasannya dan bisa **Buka kembali** (menjadi Draft, nomor tetap). Setelah dikirim ulang, approval mulai dari awal.
- Batalkan: oleh pemohon selama belum Selesai (belum dikonfirmasi diterima). Pengajuan yang dibatalkan juga bisa dibuka kembali.
- Beranda menampilkan **Menunggu tindakan Anda (N)** untuk penyetuju. Notifikasi lain tidak ada.
- **Semua Pengajuan** (Dept. Head, Logistic, Admin, Division Head, Management): cari dan filter status. Dept. Head hanya melihat departemennya. Draft orang lain tidak terlihat.
- **Pengaturan Deputy** (Dept. Head): pilih satu Deputy dari departemen yang sama, berlaku sampai dicabut ("— tanpa Deputy —" lalu Simpan). Persetujuan Deputy tercatat "(Deputy)" di riwayat. Admin juga bisa mengatur lewat sheet `Departments` kolom `DeputyNIK`.
- Dept. Head per departemen ada di sheet `Departments` kolom `HeadNIK`. Ubah di sana bila ada pergantian (Dept. Head sementara Civil Maintenance juga di sini).

### Uji manual Tahap 3

- [ ] Pemohon biasa kirim: status Menunggu Dept Head dan terlihat siapa yang ditunggu.
- [ ] Dept. Head melihat di antreannya, **Tolak** tanpa alasan ditolak, dengan alasan berhasil.
- [ ] Pemohon melihat alasan, **Buka kembali**, ubah, kirim ulang: nomor sama, mulai dari awal.
- [ ] Dept. Head menyetujui, Logistic menyetujui: status **Disetujui**.
- [ ] Atur Deputy, Deputy menyetujui (tercatat "(Deputy)"). Cabut Deputy: tidak bisa lagi.
- [ ] Logistic Staff mengajukan sendiri: tidak muncul di antreannya, tombol Setujui tidak ada. Logistic lain bisa.
- [ ] Rekan sedepartemen tidak bisa membuka pengajuan orang lain.

## Tambahan Tahap 4 (konfirmasi terima dan PDF)

Tidak ada sheet baru. Salin file baru dan yang berubah, lalu terbitkan versi baru:

- File baru: `Pdf.gs`.
- File berubah: `Config.gs`, `Repo.gs`, `Workflow.gs`, `Subs.gs`, `Router.gs`, `ClientSubs.html`.
- **Deploy → Manage deployments → pensil → Version: New version → Deploy**.

Aturan:

- Setelah **Disetujui**, pengajuan muncul di antrean semua Logistic Staff sebagai "perlu konfirmasi terima". Salah satu Logistic Staff menekan **Konfirmasi Diterima** setelah scrap fisik diserahkan: status **Selesai**. Pemohon tidak bisa lagi membatalkan.
- Logistic Staff tidak bisa mengonfirmasi terima pengajuannya sendiri.
- **Cetak / Unduh PDF** ada di halaman detail semua pengajuan yang sudah dikirim (bagi yang berhak melihat). File A4 berisi data, item, foto, riwayat persetujuan di sistem, dan 4 kolom tanda tangan basah: Pemohon, Dept. Head, Logistic Staff (Penerima), Logistic Dept. Head. Nama tercetak di bawah kolom: approver/penerima sebenarnya jika sudah ada, selain itu Dept. Head departemen dari sheet `Departments`.
- Kolom **Logistic Dept. Head** diambil dari Dept. Head departemen bernama `Warehouse & Logistic` (`LOGISTIC_DEPARTMENT` di `Config.gs`). Ubah jika nama departemen berbeda.
- Waktu di PDF memakai WITA (UTC+8, `UTC_OFFSET_HOURS` di `Config.gs`).

### Uji manual Tahap 4

- [ ] Pengajuan Disetujui muncul di antrean Logistic. **Konfirmasi Diterima** mengubah status ke Selesai. Tombol Batalkan hilang bagi pemohon.
- [ ] PDF terunduh dari HP, tampil rapi di satu halaman A4, foto tampil (konverter PDF Google tidak bisa diuji di luar Google; jika foto tidak muncul, kabari agar diganti metode), nama dan waktu benar, 4 kolom tanda tangan lengkap.
- [ ] Cetak PDF, tanda tangan basah di kertas.
- [ ] Rekan yang tidak berhak tidak bisa mengunduh PDF pengajuan orang lain.

## Tambahan Tahap 5 (rekap)

Tidak ada sheet baru. Salin file baru dan yang berubah, lalu terbitkan versi baru:

- File baru: `Report.gs`, `ClientReport.html`.
- File berubah: `Router.gs`, `Index.html`, `Client.html`, `Styles.html`, `Config.gs`.
- **Deploy → Manage deployments → pensil → Version: New version → Deploy**.

Cara pakai: menu **Rekap** di beranda (untuk Dept. Head, Logistic Staff, Admin, Division Head, Management). Pilih tahun, bulan (atau setahun penuh), dan status.

- Isi: jumlah pengajuan dan item, jumlah per status, per bulan (jika setahun penuh), per departemen, per sumber scrap, total qty per UoM, dan daftar item.
- Tanggal acuan: saat pengajuan **dikirim** (WITA). Draft tidak dihitung. Ditolak dan Dibatalkan tetap terhitung kecuali difilter lewat status.
- Cakupan otomatis mengikuti hak akses: Logistic, Admin, Division Head, Management melihat semua. Dept. Head hanya departemennya.
- **Ekspor Excel**: file `.xlsx` dengan 3 sheet (Ringkasan, Pengajuan, Item). Jika pembaca Excel tidak termuat (internet terbatas), file diunduh sebagai CSV daftar item.

### Uji manual Tahap 5

- [ ] Rekap bulan ini sesuai jumlah pengajuan terkirim di sheet `Submissions`.
- [ ] Pindah bulan/tahun/status: angka berubah wajar.
- [ ] Ekspor Excel terunduh dari HP/laptop dan terbuka di Excel (3 sheet).
- [ ] Dept. Head hanya melihat departemennya. Logistic melihat semua.
