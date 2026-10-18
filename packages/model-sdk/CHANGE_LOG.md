### INFO
Terjadi perubahan pada model sdk ini mengenai cara membuat instance sequelize, pada versi terbaru ini v1.0.62 ini developer memiliki kendali penuh dalam pembuatan instance sequelize dengan menggunakan fungsi `createSequelizeInstance`

### v1.3.0 — Audit Trail terpusat (STD-0029)
Menambahkan helper bersama untuk Audit Trail: `./audit-context` (konteks pengguna/permintaan per request lewat
`AsyncLocalStorage`), `./audit-sequelize` (`pasangAuditSequelize(sequelize, { layanan })` — hook global afterCreate/
afterUpdate/afterDestroy/afterBulkCreate yang mencatat perubahan entitas daftar putih ke tabel `audit_trail`), dan
`./audit-core` (penyamaran nilai sensitif + perhitungan hash baris, dipakai juga oleh setting-service untuk
menampilkan & memverifikasi catatan). `createSequelizeInstance` di `configurations/config-db.js` kini otomatis
memasang hook ini pada instance singleton yang dibuatnya.