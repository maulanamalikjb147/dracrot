# Ruang Dracin

Aplikasi web ringan untuk menjelajah dan menonton katalog drama melalui Syln SDK. Token Syln hanya digunakan oleh server Node dan tidak pernah dikirim ke browser.

## Menjalankan

Persyaratan: Node.js 22 atau yang lebih baru.

```bash
cp .env.example .env.local
```

Isi `SYLN_TOKEN` di `.env.local`, lalu:

```bash
npm install
npm run dev
```

Buka `http://localhost:3000`.

## Fitur

- Katalog terbaru dan pencarian judul
- Filter platform dan bahasa
- Detail drama dan daftar episode
- Pemilihan kualitas video dan subtitle
- Pembaruan URL tayangan yang kedaluwarsa
- Tampilan responsif untuk ponsel dan desktop
- Validasi input, pembatasan request body, dan security headers

## Keamanan

Jangan menaruh token pada `public/app.js`, HTML, atau variabel environment yang diekspos ke browser. File `.env.local` sudah diabaikan oleh Git.

