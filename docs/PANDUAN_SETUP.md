# Panduan pemasangan

Panduan ini bertambah tiap tahap. Saat ini: **Tahap 1 (login dan akun)**.

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
3. Akun uji (Test Dept, Test User, Administrator) otomatis dilewati.
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
