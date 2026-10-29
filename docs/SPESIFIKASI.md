# Spesifikasi: Scrap Handover Portal, PT DSSP Power Kendari

Status: **DRAFT FINAL, menunggu perintah "Eksekusi"**
Tidak ada data pribadi di file ini (repositori publik). Data akun dan material diimpor lewat halaman admin ke Google Sheet.

## 1. Tujuan

Pemohon mengajukan penyerahan scrap (data + foto), disetujui Dept. Head lalu Logistic, scrap diserahkan, Logistic mengonfirmasi terima. Semua tercatat, bisa dicetak (PDF) dan direkap.

## 2. Teknologi (biaya Rp0)

| Bagian | Pakai |
|---|---|
| Tampilan web (ramah HP) | Google Apps Script Web App (HTML) |
| Database | Google Sheets |
| Penyimpanan foto dan PDF | Google Drive (folder privat, tidak dibagikan publik) |
| Login | NIK + password buatan sendiri (di-hash), bukan Google login |
| Cadangan data | Salinan Sheet otomatis mingguan ke Drive + tombol ekspor |
| Notifikasi | Tidak ada. Beranda menampilkan angka "Menunggu tindakan Anda" |

Aplikasi diakses lewat satu alamat web dan bisa dipasang sebagai ikon di layar HP.

## 3. Peran

| Peran | Penentu | Hak |
|---|---|---|
| Pemohon | Semua akun Active | Buat, draft, kirim, batalkan, buka kembali, cetak PDF (pengajuan miliknya) |
| Dept. Head | Level "3. Departement Head" | Setujui/tolak pengajuan departemennya, tunjuk Deputy, lihat departemennya |
| Deputy | Ditunjuk Dept. Head | Sama dengan Dept. Head, tercatat "a.n." |
| Logistic Staff | Penanda di data akun (awal: 5 orang dari Warehouse & Logistic, ditandai admin lewat halaman Pengguna; Division Head tidak termasuk) | Setujui tahap Logistic, konfirmasi terima, lihat semua pengajuan, rekap |
| Division Head / Management | Level 4 dan 5 | Hanya baca (semua pengajuan dan rekap). Jika membuat pengajuan sendiri, tanpa approval Dept. Head |
| Admin / Super Admin | Kolom Role di data akun | Kelola akun, departemen, Dept. Head, daftar pilihan, impor, reset password, ubah status login |

Aturan keamanan: tidak boleh menyetujui atau mengonfirmasi pengajuan miliknya sendiri. Contoh: pengajuan Arif (Dept. Head sekaligus Logistic Staff) diproses Logistic Staff lain.

## 4. Aturan jalur approval

Dept. Head ditentukan dari **nama departemen** pemohon (bukan kode), karena satu kode bisa berisi beberapa departemen.

| Pemohon | Jalur |
|---|---|
| Level 1 dan 2 (User/Planner) di departemen yang punya Dept. Head | Dept. Head → Logistic Staff |
| Dept. Head, Division Head, atau Management | Langsung Logistic Staff |
| PPS Management (tanpa Dept. Head) | Langsung Logistic Staff |
| Civil Maintenance | Satu orangnya dijadikan Dept. Head sementara (bisa diubah admin) |

Status: `Draft → Menunggu Dept Head → Menunggu Logistic → Disetujui → Selesai`
Cabang: `Ditolak` (alasan wajib), `Dibatalkan`.

- Pemohon boleh membatalkan selama belum "Selesai" (belum dikonfirmasi diterima Logistic).
- Ditolak dan Dibatalkan boleh dibuka kembali menjadi Draft, diperbaiki, lalu dikirim ulang. Nomor pengajuan tetap sama. Approval mengulang dari awal jalur.
- Konfirmasi terima hanya oleh Logistic Staff.
- Deputy berlaku terus sampai dicabut Dept. Head (atau admin). Deputy dipilih dari karyawan departemen yang sama.
- Semua aksi tercatat: siapa, kapan, catatan.

## 5. Form pengajuan

**Per pengajuan:** Sumber Scrap (wajib: Outage / Project / Routine Usage / Other + teks bebas), foto (wajib, minimal 1, maksimal 5), nomor otomatis `SCR-2026-0001` (urut per tahun, diberikan saat pertama kali dikirim, bukan saat Draft), pemohon dan departemen (otomatis).

**Per item (boleh banyak):**
| Kolom | Aturan |
|---|---|
| No. Material | Opsional. Saran otomatis dari daftar SAP (MM60). Memilih material mengisi deskripsi dan UoM otomatis, masih bisa diubah |
| Material Description | Wajib |
| Qty | Wajib, lebih dari 0, maksimal 1 angka di belakang koma |
| UoM | Wajib. Dropdown: PC, CAN, DRUM, LOT, SET, M, KG, L, BOX, ROL, PAC, TON + "Other" (ketik sendiri). Admin bisa menambah. Kode UoM dari SAP yang belum ada otomatis ditambahkan |
| Scrap Reason | Wajib, teks bebas |

**Foto:** diambil dari kamera atau galeri, dikompres di HP sebelum dikirim (sisi terpanjang 1280 px, JPEG kualitas sedang, ±200-400 KB). Disimpan di folder Drive per pengajuan, tidak dibagikan publik. Ditampilkan lewat aplikasi.

## 6. Login dan akun

- Login: NIK (teks persis seperti di data, termasuk NIK pendek atau berawalan 0) + password.
- Ketik nama atau nickname di halaman login → saran akun (nama, departemen) → NIK terisi otomatis.
- Password awal `warehouseportal` untuk semua akun, **wajib diganti** di login pertama. Password disimpan dalam bentuk hash, bukan teks asli.
- Terkunci 15 menit setelah 5 kali salah. Admin bisa reset ke password awal.
- Status "No login" tidak bisa masuk. Admin bisa mengubah status.
- Sesi berakhir otomatis setelah 8 jam.
- Akun uji (Test Dept, Test User, Administrator) tidak ikut diimpor.
- Catatan: saran nama membuka NIK ke siapa pun yang mengetik nama. Risiko ini diterima karena password awal sama untuk semua. Mitigasi: wajib ganti password.

## 7. Halaman

1. Login (+ ganti password wajib di login pertama)
2. Beranda: angka "Menunggu tindakan Anda", pengajuan terbaru, tombol "Buat Pengajuan"
3. Form Pengajuan (item banyak, foto, Simpan Draft / Kirim)
4. Pengajuan Saya (filter status, buka kembali, batalkan)
5. Antrean Approval (Dept. Head/Deputy dan Logistic)
6. Detail Pengajuan (data, foto, riwayat, Setujui/Tolak/Konfirmasi Terima, Cetak PDF)
7. Rekap (bulanan/tahunan; jumlah pengajuan, daftar item, ringkasan per departemen dan sumber; ekspor Excel)
8. Pengaturan Deputy (khusus Dept. Head)
9. Admin: Pengguna (impor/ubah/reset/status/penanda Logistic), Departemen dan Dept. Head, Daftar UoM, Impor Material, Cadangan

## 8. PDF formulir

A4, berisi: nomor, tanggal, pemohon, departemen, sumber scrap, tabel item, foto, riwayat approval digital (nama dan waktu), dan kolom tanda tangan basah: **Pemohon, Dept. Head, Logistic Staff (penerima), Logistic Dept. Head**. Dibuat di Drive dan bisa diunduh/dicetak dari HP.

## 9. Struktur data (Google Sheet)

`Users`, `Departments` (nama, Dept. Head, Deputy), `Submissions`, `Items`, `Photos`, `History`, `UoM`, `Sources`, `Materials` (hanya No. Material, Deskripsi, UoM dari MM60; harga dan kolom lain tidak diimpor), `Settings`, `Counter`.

## 10. Tahapan pengerjaan

| Tahap | Isi | Selesai bila |
|---|---|---|
| 1 | Kerangka proyek, Sheet, login, ganti password, impor akun, saran nama | Bisa login NIK, wajib ganti password |
| 2 | Form pengajuan, item banyak, foto terkompres, draft, nomor otomatis | Pengajuan tersimpan dengan foto di Drive |
| 3 | Jalur approval, Deputy, tolak/batalkan/buka kembali, riwayat | Semua jalur di bagian 4 berjalan |
| 4 | Konfirmasi terima, PDF dengan tanda tangan basah | PDF tercetak lengkap |
| 5 | Rekap bulanan/tahunan dan ekspor Excel | Angka rekap cocok dengan data |
| 6 | Impor material SAP (6.604 baris) dan saran material, cadangan mingguan, panduan setup | Siap dipakai |

## 11. Batasan yang harus disadari

- Sesi ini tidak bisa menjalankan atau menerbitkan Apps Script di akun Google Anda. Saya menulis kodenya dan panduan langkah demi langkah. Anda yang menempel/menerbitkan kode (±15 menit) dan membuat Sheet serta folder Drive.
- Logika inti (jalur approval, nomor, hash password) saya uji otomatis di sini. Tampilan dan Google Drive/Sheet hanya bisa diuji setelah terpasang, jadi saya sertakan daftar uji manual.
- Layanan gratis Google punya kuota harian. Untuk 2-3 transaksi per minggu jauh di bawah batas.
- Pemilik Sheet/Drive sebaiknya akun khusus portal atau akun kantor, bukan pribadi.
- Alamat web berbentuk script.google.com/... (bisa dipasang sebagai ikon di HP).

## 12. Asumsi yang saya pakai (koreksi bila keliru)

1. Kolom "Logistic Dept. Head" di PDF hanya untuk tanda tangan basah. Tidak ada langkah approval sistem untuk dia.
2. Division Head dan Management bisa melihat semua pengajuan dan rekap (hanya baca).
3. Satu Dept. Head memiliki satu Deputy pada satu waktu.
4. Maksimal 5 foto per pengajuan.
5. Setelah dibuka kembali, pengajuan mengulang jalur approval dari awal.
6. Civil Maintenance: satu orangnya jadi Dept. Head sementara, sehingga pengajuannya langsung ke Logistic.
