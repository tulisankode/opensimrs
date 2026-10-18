'use strict';

// Super admin mendapat seluruh aksi submodul "Pembelian Marketplace" (Inventory, STD-0019), sama seperti modul baru
// lain (Laundry, Sarpras). Migrasi 20261018120200-izin_inv_marketplace hanya memberi aksi operasional ke semua
// pemilik modul Inventory — termasuk super admin — sehingga super admin tidak bisa membuka Konfigurasi Koneksi.
// Super admin dikenali dari nama peran (akun superadmin bisa memiliki faskes_uuid). Peran lain tetap diatur admin
// lewat Setting › Hak Akses agar pemohon tidak otomatis bisa menyetujui & membayar permintaannya sendiri.
const MODUL = 'Inventory';
const SUB = 'Pembelian Marketplace';
const ALLOWS = ['READ', 'KONFIGURASI KONEKSI', 'CARI PENAWARAN', 'KELOLA PEMETAAN', 'AJUKAN PERMINTAAN', 'PERSETUJUAN', 'CHECKOUT', 'SINKRON STATUS', 'LIHAT LAPORAN'];

const baris = async (sq) => {
  const [peran] = await sq.query(`SELECT 'role' AS tabel, uuid, permissions FROM "role" WHERE lower(name) = 'super admin' AND deleted_at IS NULL`);
  const [akun] = await sq.query(
    `SELECT 'users' AS tabel, u.uuid, u.permissions FROM "users" u JOIN "role" r ON r.uuid::text = u.role_uuid::text
     WHERE lower(r.name) = 'super admin' AND u.deleted_at IS NULL`
  );
  return [...peran, ...akun];
};

module.exports = {
  async up(queryInterface) {
    const sq = queryInterface.sequelize;
    for (const r of await baris(sq)) {
      let data;
      try {
        data = JSON.parse(r.permissions || '[]');
      } catch {
        continue;
      }
      // Super admin tanpa daftar izin sudah boleh semua — jangan dibuatkan daftar parsial.
      if (!Array.isArray(data) || !data.length) continue;
      let modul = data.find((x) => x?.module === MODUL);
      if (!modul) {
        modul = { module: MODUL, subModules: [] };
        data.push(modul);
      }
      if (!Array.isArray(modul.subModules)) modul.subModules = [];
      let sub = modul.subModules.find((s) => s?.name === SUB);
      if (!sub) {
        sub = { name: SUB, allows: [] };
        modul.subModules.push(sub);
      }
      const lama = Array.isArray(sub.allows) ? sub.allows : [];
      const baru = [...new Set([...lama, ...ALLOWS])];
      if (baru.length === lama.length) continue;
      sub.allows = baru;
      await sq.query(`UPDATE "${r.tabel}" SET permissions = :p WHERE uuid = :u`, { replacements: { p: JSON.stringify(data), u: r.uuid } });
    }
  },

  async down() {
    // Tidak dikembalikan: aksi yang ditambahkan tidak bisa dibedakan dari aksi yang diberikan admin secara manual.
  },
};
