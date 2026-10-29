# Scrap Handover Portal

Web handover scrap material, PT DSSP Power Kendari. Google Apps Script + Google Sheets + Google Drive (biaya Rp0).

- Spesifikasi: [docs/SPESIFIKASI.md](docs/SPESIFIKASI.md)
- Pemasangan: [docs/PANDUAN_SETUP.md](docs/PANDUAN_SETUP.md)
- Kode aplikasi: `src/` (sumber, per file). **Untuk dipasang: `dist/`** (3 file hasil gabungan: `Code.gs`, `Index.html`, `appsscript.json`)
- Tes otomatis logika inti: `npm test`; tes versi gabungan: `npm run test:bundle` (Node 20+, tanpa dependensi)
- Setelah mengubah `src/`, jalankan `npm run build` untuk memperbarui `dist/` (tes `npm test` gagal jika `dist/` kedaluwarsa)

Repositori ini publik. Jangan pernah memasukkan file akun, daftar material, atau data pribadi lain ke repositori. Data diimpor lewat halaman admin ke Google Sheet.

## Status tahap

- [x] 1. Fondasi dan login
- [x] 2. Form pengajuan
- [x] 3. Alur approval
- [x] 4. Konfirmasi terima dan PDF
- [x] 5. Rekap
- [x] 6. Material SAP dan penutup
