# Dracrot

Aplikasi web ringan untuk menjelajah dan menonton katalog drama melalui Syln SDK. Token Syln hanya digunakan oleh server Node dan tidak pernah dikirim ke browser.

## Menjalankan

Persyaratan: Node.js 22 atau yang lebih baru. FFmpeg hanya diperlukan jika kompatibilitas unduhan QuickTime diaktifkan.

```bash
cp .env.example .env.local
```

Isi `SYLN_TOKEN` di `.env.local`, lalu:

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

### Kompatibilitas unduhan QuickTime

Normalisasi MP4 aktif secara bawaan agar durasi video terbaca benar oleh QuickTime di macOS. Atur nilainya di `.env.local`, lalu mulai ulang server:

```env
DOWNLOAD_QUICKTIME_COMPAT=true
```

- `true`: unduhan disiapkan sebagai MP4 standar tanpa encoding ulang; memerlukan FFmpeg dan perlu sedikit waktu sebelum unduhan dimulai.
- `false`: file asli dialirkan langsung dari penyedia; lebih cepat dan tidak memerlukan FFmpeg, tetapi QuickTime mungkin hanya membaca durasi fragmen pertama.

## Fitur

- Katalog terbaru dan pencarian judul
- Filter platform dan bahasa
- Detail drama dan daftar episode
- Halaman Daftar Saya/Favorit terpisah yang tersimpan di browser
- Unduh langsung per episode dengan nama file otomatis
- Pemilihan kualitas video dan subtitle
- Pembaruan URL tayangan yang kedaluwarsa
- Tampilan responsif untuk ponsel dan desktop
- Validasi input, pembatasan request body, dan security headers

## Keamanan

Jangan menaruh token pada `public/app.js`, HTML, atau variabel environment yang diekspos ke browser. File `.env.local` sudah diabaikan oleh Git.
