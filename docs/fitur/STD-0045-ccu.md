# STD-0045 — Modul CCU (Coronary Care Unit)

CCU adalah modul katalog `ccu` berinstalasi **Instalasi Perawatan Intensif**: menu atas mengelompokkannya ke dropdown
**Perawatan Intensif** bersama ICU/HDU, dan Manajemen Modul menampilkannya di bagian *Ruang Perawatan Intensif*.
Preset segmen: RS kelas B dan A; segmen lain mengaktifkannya lewat Setting › Manajemen Modul.

## Arsitektur

- **Episode bersama.** Episode CCU adalah baris `icu_perawatans` dengan `unit = 'ccu'`. Masuk/keluar tertaut
  perpindahan bangsal Rawat Inap yang sudah *approve* (`perpindahans`), sehingga bed, status rawat inap, dan tagihan
  kamar tetap dikelola Rawat Inap. Satu admisi/bed hanya boleh punya satu episode intensif aktif lintas ICU/CCU/HDU.
- **Dipakai ulang dari ICU** (`routes/intensif-routes.js`, `IcuController`): dasbor dasar, serah terima masuk/keluar,
  flowsheet observasi + koreksi berjejak, balance cairan, laporan BOR/ALOS/mortalitas. Frontend memakai komponen
  `components/RawatInap/ICU/*` dengan prop `basis="/ccu"`.
- **Khusus CCU** (`ccu-routes.js`, `ccu-controller.js`, `ccu-service.js`, `ccu-repository.js`, `ccu-skor.js`):
  data klinis kardiak, EKG & irama, penanda jantung, skor risiko, intervensi kardiak, dasbor & laporan kardiak.

## API (`/api/v3/ranap/ccu`)

| Metode & path | Izin CCU |
|---|---|
| `GET /dashboard`, `GET /dashboard/kardiak` | Dasbor · READ |
| `GET /perpindahan-siap?arah=masuk\|keluar` | Serah Terima · KELOLA |
| `POST /perpindahan/:uuid/mulai`, `POST /perawatan/:uuid/keluar` | Serah Terima · KELOLA |
| `GET /perawatan/:uuid` | Perawatan · READ |
| `GET/POST /perawatan/:uuid/observasi`, `POST /observasi/:uuid/koreksi` | Flowsheet Observasi · READ/CREATE/KOREKSI |
| `POST /perawatan/:uuid/intake-output`, `GET /perawatan/:uuid/balance` | Balance Cairan · CREATE/READ |
| `GET/PUT /perawatan/:uuid/klinis` | Data Klinis Kardiak · READ/KELOLA |
| `GET/POST /perawatan/:uuid/ekg`, `POST /ekg/:uuid/batal` | EKG & Irama · READ/CREATE/BATAL |
| `GET/POST /perawatan/:uuid/penanda-jantung`, `POST /penanda-jantung/:uuid/batal` | Penanda Jantung · READ/CREATE/BATAL |
| `GET/POST /perawatan/:uuid/skor-risiko` | Skor Risiko · READ/CREATE |
| `GET/POST /perawatan/:uuid/intervensi`, `POST /intervensi/:uuid/batal` | Intervensi Kardiak · READ/CREATE/BATAL |
| `GET /laporan`, `GET /laporan/kardiak` | Laporan CCU · READ |

Semua kueri dibatasi `faskes_uuid` dari token; episode unit lain (ICU/HDU) tidak dapat dibaca atau ditulis lewat rute CCU.

## Data (`20261020150200-ccu_perawatan_kardiak`)

`icu_perawatans.unit` (bawaan `'icu'`), `ccu_klinis` (satu baris per episode), `ccu_ekgs`, `ccu_penanda_jantungs`,
`ccu_skor_risikos`, `ccu_intervensis`. Entri EKG/penanda/intervensi dibatalkan berjejak (`dibatalkan_pada/oleh`,
`alasan_batal`), tidak dihapus fisik. Kolom `sumber`/`status_tinjauan` EKG disiapkan untuk integrasi monitor/EKG
kelak: data perangkat yang belum ditinjau tidak dianggap catatan klinis terverifikasi.

## Perhitungan & batasan klinis

- QTc Bazett; TIMI UA/NSTEMI (0–7, rendah ≤ 2, sedang 3–4, tinggi ≥ 5); TIMI STEMI (0–14, kategori sama); Killip I–IV.
- Peringatan dasbor: irama VT/VF/torsades/asistol/PEA/blok AV total, elevasi ST, QTc ≥ 500 ms, troponin di atas batas
  dengan kenaikan ≥ 20 % dari sampel sebelumnya. Hanya dukungan keputusan; bobot, ambang, dan target mutu
  (door-to-balloon ≤ 90 menit, door-to-needle ≤ 30 menit) perlu disahkan KSM Jantung/komite mutu faskes.
- Belum termasuk: skor GRACE, integrasi monitor/EKG perangkat, tarik otomatis hasil troponin dari LIS (saat ini salin
  manual dengan sumber "lab" + nomor rujukan), order obat/tindakan (tetap lewat Rekam Medis/Farmasi).
