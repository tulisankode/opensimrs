# Lingkungan Development, Staging, dan Production

> Aturan pemisahan lingkungan dan pengelolaan `.env` OpenSIMRS, untuk pengembang dan implementator.
>
> Dokumen terkait: [Petunjuk Instalasi](./INSTALLATION_GUIDE.md) · [Spesifikasi Hardware](./SPESIFIKASI-HARDWARE.md) · [Panduan Implementator](./kontributor/IMPLEMENTATOR.md) · [SECURITY.md](../SECURITY.md)

---

## 1. Tujuan tiap lingkungan

| Lingkungan | Tujuan | Data | Siapa yang mengakses |
|---|---|---|---|
| **Development** | Menulis dan mencoba kode di laptop pengembang | Data demo (`db:demo:seed`, `db:demo:transaksi`) | Pengembang |
| **Staging** | Meniru production untuk uji rilis, uji migrasi, uji integrasi di sandbox, pelatihan pengguna | Data demo, atau salinan production yang **sudah dianonimkan** | Tim implementasi, QA, pengguna kunci saat pelatihan |
| **Production** | Melayani pasien sungguhan | Data nyata faskes | Petugas faskes sesuai peran; akses server sangat terbatas |

Staging dan production berada di server (atau setidaknya database dan `.env`) yang **terpisah**.

---

## 2. Alur promosi kode

```
branch fitur ──PR + review + CI──▶ main ──tag rilis (vX.Y.Z)──▶ staging ──uji lulus──▶ production
```

1. Pekerjaan dilakukan di **branch fitur** dan masuk ke `main` hanya lewat Pull Request yang lulus CI dan review ([CONTRIBUTING](../CONTRIBUTING.md)).
2. Rilis ditandai dengan **tag** (mis. `v1.0.0-alpha.2`) dan dicatat di [CHANGELOG](../CHANGELOG.md).
3. **Staging** memasang tag rilis (bukan sembarang commit), menjalankan migrasi, lalu diuji (skenario P1 di [rencana pengujian](./testing/rencana-testing.md)).
4. **Production** memasang tag yang sama setelah staging lulus: cadangkan dulu, jalankan migrasi, pantau setelah pembaruan.

Dengan Docker, kedua server memakai `deploy/server/deploy.sh` dengan `.env` masing-masing ([Petunjuk Instalasi bagian 8.3](./INSTALLATION_GUIDE.md#83-server-dengan-deploysh)).

---

## 3. Aturan `.env`

1. **`.env` tidak pernah di-commit.** Repo hanya memuat templat `.env.example` tanpa nilai rahasia.
2. **Satu berkas per lingkungan**, disimpan di server, di luar folder repo: `~/.opensimrs/.env` (lokasi bisa diganti dengan `OPENSIMRS_STATE_DIR`), atau di secret manager. Hak akses berkas dibatasi (`chmod 600`).
3. **`SECRET_KEY` berbeda di setiap lingkungan** (dan sama di semua layanan dalam satu lingkungan). Token dari staging tidak boleh berlaku di production.
4. Semua kunci dibuat **acak**: `openssl rand -hex 32`. Jangan memakai contoh dari dokumentasi.
5. **Rotasi kunci** bila bocor, saat pegawai yang memegangnya keluar, atau secara berkala. Perhatikan: `SECRET_KEY` (atau `BPJS_KUNCI_RAHASIA`/`LIS_KUNCI_RAHASIA`) juga dipakai mengenkripsi kredensial integrasi; rotasi kunci enkripsi membutuhkan pengisian ulang kredensial integrasi ([Petunjuk Instalasi 5.4](./INSTALLATION_GUIDE.md#54-konfigurasi-integrasi-per-faskes)). Merotasi `SECRET_KEY` membuat semua pengguna harus login ulang.
6. **`SYNC_DB=false`** di staging dan production: skema hanya berubah lewat migrasi (`npm run db:migrate`), tidak pernah lewat ORM.
7. **`NODE_ENV`**: `development` di laptop; `production` di staging dan production (mengurangi log debug).
8. **`DEMO_PASSWORD` dan data demo HANYA di development/staging.** Di production, `db:demo:seed` dan `db:demo:reset` **dilarang** dijalankan; jangan isi `DEMO_PASSWORD`. *Pengecualian sementara* sampai wizard instalasi (B-40 di [Roadmap](./ROADMAP.md)) tersedia: membuat superadmin pertama lewat `db:demo:seed` **sekali, sebelum ada data nyata**, dengan `DEMO_PASSWORD` kuat, lalu segera mengganti sandi superadmin, menonaktifkan faskes & akun demo, dan mengosongkan `DEMO_PASSWORD` ([Petunjuk Instalasi 7.3](./INSTALLATION_GUIDE.md#73-akun-superadmin-pertama)).
9. **Integrasi:** SATUSEHAT memakai `SATUSEHAT_LINGKUNGAN=sandbox` dan BPJS memakai `BPJS_LINGKUNGAN=development` di development dan staging; endpoint produksi (`produksi`/`production`) **hanya** di production. LIS memakai endpoint uji (atau LIS tiruan `scripts/lis-tiruan.mjs`) di luar production.
10. **Staging tidak memakai salinan data pasien asli** kecuali sudah dianonimkan (nama, NIK, No. RM, nomor BPJS, alamat, nomor telepon diganti data fiktif) dan disetujui faskes.
11. **Cadangkan sebelum migrasi production**, dan pastikan cadangan itu bisa dipulihkan.
12. **Akses server dan log:** hanya orang yang ditunjuk; pakai akun pribadi (bukan akun bersama) dan kunci SSH. Log tidak boleh dikirim ke luar faskes tanpa disaring dari data pasien dan kredensial.

---

## 4. Variabel `.env` per lingkungan

Keterangan: **Wajib** = harus diisi; **Rahasia** = jangan dibagikan atau di-commit. Nilai `<acak>` dibuat dengan `openssl rand -hex 32` dan berbeda per lingkungan.

| Variabel | Development | Staging | Production | Wajib | Rahasia |
|---|---|---|---|---|---|
| `NODE_ENV` | `development` | `production` | `production` | Disarankan | – |
| `DB_HOST` | `127.0.0.1` | `db` (Docker) / host DB | `db` (Docker) / host DB | Ya | – |
| `DB_NAME` | `opensimrs` | `opensimrs` | `opensimrs` | Ya | – |
| `DB_USERNAME` | `opensimrs` | `opensimrs` | `opensimrs` | Ya | – |
| `DB_PASSWORD` | sandi lokal bebas | `<acak>` | `<acak>` | Ya | Ya |
| `MONGO_DB_USERNAME` / `MONGO_DB_PASSWORD` | `opensimrs` / sandi lokal | `opensimrs` / `<acak>` | `opensimrs` / `<acak>` | Ya | Sandi: ya |
| `MONGO_DB_AUTH_SOURCE` | `admin` | `admin` | `admin` | Ya | – |
| `REDIS_PASSWORD` | kosong | `<acak>` (disarankan) | `<acak>` (disarankan) | Tidak | Ya |
| `SECRET_KEY` | `<acak>` | `<acak>` (beda dari dev) | `<acak>` (beda dari staging) | Ya | Ya |
| `API_KEY_SECRET`, `API_KEY_CHECK_NORM`, `ADMISI_SECRET_KEY`, `ANTRIAN_KEY_SECRET` | `<acak>` | `<acak>` | `<acak>` | Ya | Ya |
| `SYNC_DB` | `false` | `false` | `false` | Ya | – |
| `DEMO_PASSWORD` | kosong (`Demo@2026`) | sandi kuat | **tidak diisi; data demo dilarang** | Tidak | Ya |
| `SEED_ADMIN_PASSWORD` | opsional | opsional | hanya saat penyiapan awal, lalu dikosongkan | Tidak | Ya |
| `SATUSEHAT_MODE` / `SATUSEHAT_LINGKUNGAN` | `mock` / `sandbox` | `nyata` / `sandbox` | `nyata` / `produksi` | Bila modul aktif | – |
| `BPJS_MODE` / `BPJS_LINGKUNGAN` | `mock` / `development` | `nyata` / `development` | `nyata` / `production` | Bila modul aktif | – |
| `LIS_MODE` | `mock` atau LIS tiruan | endpoint uji LIS | endpoint LIS produksi | Bila fitur aktif | – |
| `BPJS_KUNCI_RAHASIA`, `LIS_KUNCI_RAHASIA` | kosong (pakai `SECRET_KEY`) | `<acak>` | `<acak>` | Disarankan | Ya |
| `PUBLIC_API_URL` | – | `https://api-staging.simrs.contoh.id` | `https://api.simrs.contoh.id` | Server | – |
| `FRONTEND_ALLOWED_HOSTS` | – | `staging.simrs.contoh.id` | `simrs.contoh.id` | Server | – |
| `BASE_URL_API_INVENTORY` (penunjang-service) | bawaan `http://localhost:8086/api/v3/inventory` | alamat inventory-service | alamat inventory-service | Tidak | – |
| `MAX_UPLOAD_BERKAS_SARPRAS_MB` (penunjang-service) | bawaan `5` (1–20) | `5` | `5` | Tidak | – |

Kredensial integrasi per faskes (SATUSEHAT Client ID/Secret, BPJS cons-id/secret/user key, API key LIS) **tidak** ditaruh di `.env`; semuanya diisi di **Setting › Konfigurasi Integrasi** dan disimpan terenkripsi. Isi kredensial sandbox di staging dan kredensial produksi hanya di production.

---

## 5. Daftar periksa per lingkungan

- [ ] `.env` tersimpan di luar repo (`~/.opensimrs/.env` atau secret manager) dengan hak akses terbatas.
- [ ] `SECRET_KEY` dan semua kunci acak serta berbeda dari lingkungan lain.
- [ ] `SYNC_DB=false` (staging/production) dan `NODE_ENV=production`.
- [ ] Production tanpa data demo dan tanpa `DEMO_PASSWORD`.
- [ ] Integrasi memakai sandbox di luar production.
- [ ] Cadangan dibuat sebelum migrasi production dan pemulihan sudah diuji.
- [ ] Daftar orang yang punya akses server dan log terdokumentasi.
