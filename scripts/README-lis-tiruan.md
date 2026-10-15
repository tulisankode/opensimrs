# LIS tiruan (adamLIS) untuk pengembangan

`scripts/lis-tiruan.mjs` adalah server adamLIS tiruan tanpa dependensi untuk menguji Bridging LIS (Laboratorium & kirim massal MCU) tanpa server LIS asli.

```bash
node scripts/lis-tiruan.mjs                      # http://localhost:2312, x-api-key: kunci-uji-lis
PORT=2399 LIS_KUNCI=rahasia node scripts/lis-tiruan.mjs
```

Isi koneksi di **Setting › Konfigurasi Integrasi › LIS**:

| Kolom | Nilai |
| --- | --- |
| URL Registrasi | `http://localhost:2312/adam-lis/bridging_sim_rs/registrasi` |
| URL Ambil Hasil | `http://localhost:2312/api/v1/arsip/bridging/read?no_reg_rs={no_registrasi}` |
| URL Registrasi Bulk | `http://localhost:2312/adam-lis/api/v1/registrasi_bulk_mcu/create` |
| API Key | `kunci-uji-lis` |
| Kode RS / Kode Lab | bebas, mis. `J03` / `LAB_EP` |

Perilaku yang ditiru:

- **Registrasi per order** — format adamLIS; tindakan yang tidak dikenal dibalas `500` "Data Tindakan …Belum Dimappingkan", unit tidak dikenal dibalas "Data gagal disimpan".
- **Registrasi bulk MCU** — kontrak gateway `bridging_mcu`: query `kode_rs` & `kode_lab`, body `{ periksa_now, nama, perusahaan, data[] }`, semua field wajib tidak kosong (`400`, `field = data.N.…`), `data.length >= 150` ditolak, `201` dengan `payload[{ nolab, nama_pasien, no_rm, no_registrasi }]`, `409` semua-atau-tidak bila ada no_rm ganda/sudah terdaftar (`messsage: "Conflic"`), `500` "Gagal membuat MCU…" sesekali.
- **Baca hasil** — `GET /api/v1/arsip/bridging/read?no_reg_rs=` → `404` bila belum terdaftar, selain itu No. Lab + hasil pemeriksaan.
- Registrasi **idempoten per no_registrasi** dan dihitung: `GET /_uji/hitung` menampilkan berapa kali tiap no_registrasi diterima dan berapa kali benar-benar didaftarkan (`dobel_terdaftar` harus kosong).

Kendali uji (`POST /_uji/atur`, JSON digabung ke pengaturan):

```json
{ "tindakan_dikenal": ["LAB-001", "LAB-002"], "unit_dikenal": null, "rm_terdaftar": ["RM-000123"],
  "latensi_ms": 200, "gagal500_setiap": 0, "gantung_noreg": [], "gantung_ms": 120000,
  "hasil_item": { "LAB-001": [{ "kode": "HGB", "nama": "Hemoglobin", "nilai": "13.5" }] } }
```

`POST /_uji/reset` mengosongkan data & hitungan.
