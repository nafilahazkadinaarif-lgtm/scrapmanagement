# Scrap Handover Portal

Web handover scrap material, PT DSSP Power Kendari. Google Apps Script + Google Sheets + Google Drive (biaya Rp0).

- Spesifikasi: [docs/SPESIFIKASI.md](docs/SPESIFIKASI.md)
- Pemasangan: [docs/PANDUAN_SETUP.md](docs/PANDUAN_SETUP.md)
- Kode aplikasi: `src/` (file `.gs` dan `.html` untuk Apps Script)
- Tes otomatis logika inti: `npm test` (Node 20+, tanpa dependensi)

Repositori ini publik. Jangan pernah memasukkan file akun, daftar material, atau data pribadi lain ke repositori. Data diimpor lewat halaman admin ke Google Sheet.

## Status tahap

- [x] 1. Fondasi dan login
- [x] 2. Form pengajuan
- [x] 3. Alur approval
- [x] 4. Konfirmasi terima dan PDF
- [x] 5. Rekap
- [ ] 6. Material SAP dan penutup
