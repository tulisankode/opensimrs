import { QueryTypes } from "sequelize";
import moment from "moment";
import sequelizeInstance from "../configurations/sequelize-instance.js";
import BadRequestException from "../errors/bad-request-exception.js";
import {
  muatKatalog, cariSegmen, hitungModulAktif, hitungFiturAktif, hitungBagianAktif,
  fiturBawaan, fiturLayak, bagianBawaan, hitungKonfigurasi,
} from "../modul/katalog-modul.js";

class ForbiddenException extends BadRequestException {
  constructor(message) {
    super(message);
    this.status = 403;
  }
}

export const isSuperadmin = (author) => String(author?.role ?? "").trim().toLowerCase() === "super admin";

const pilih = (sql, replacements, transaction) => sequelizeInstance.query(sql, { replacements, type: QueryTypes.SELECT, transaction });

// Pengaturan faskes: segmen (faskes_segmen) + override per tingkat (faskes_*_override).
const bacaKonfigurasi = async (faskesUuid, transaction) => {
  const [segmen] = await pilih(
    `SELECT segmen_kode, diubah_oleh, updated_at FROM faskes_segmen WHERE faskes_uuid = :f`, { f: faskesUuid }, transaction
  );
  const pisah = (baris, kolom) => ({
    tambahan: baris.filter((r) => r.aktif).map((r) => r[kolom]),
    nonaktif: baris.filter((r) => !r.aktif).map((r) => r[kolom]),
  });
  const [modul, fitur, bagian] = await Promise.all([
    pilih(`SELECT modul_kode, aktif FROM faskes_modul_override WHERE faskes_uuid = :f`, { f: faskesUuid }, transaction),
    pilih(`SELECT fitur_kode, aktif FROM faskes_fitur_override WHERE faskes_uuid = :f`, { f: faskesUuid }, transaction),
    pilih(`SELECT bagian_kode, aktif FROM faskes_bagian_override WHERE faskes_uuid = :f`, { f: faskesUuid }, transaction),
  ]);
  return {
    diatur: !!segmen,
    segmen: segmen?.segmen_kode ?? null,
    diubahOleh: segmen?.diubah_oleh ?? null,
    diubahPada: segmen?.updated_at ? Number(segmen.updated_at) : null,
    override: { modul: pisah(modul, "modul_kode"), fitur: pisah(fitur, "fitur_kode"), bagian: pisah(bagian, "bagian_kode") },
  };
};

const ringkasSnapshot = (k) => k?.diatur ? {
  segmen: k.segmen,
  modul_tambahan: k.override.modul.tambahan, modul_nonaktif: k.override.modul.nonaktif,
  fitur_tambahan: k.override.fitur.tambahan, fitur_nonaktif: k.override.fitur.nonaktif,
  bagian_tambahan: k.override.bagian.tambahan, bagian_nonaktif: k.override.bagian.nonaktif,
} : null;

const daftarPoli = async (faskesUuid) => pilih(
  `SELECT uuid, name, COALESCE(jenis_poli, 'umum') AS jenis_poli FROM lokasi
    WHERE faskes_uuid = :faskes AND is_poli = true AND deleted_at IS NULL ORDER BY name`,
  { faskes: faskesUuid }
);

// Jumlah modul, fitur & bagian (yang sudah tersedia) pada preset segmen, plus modul dalam rencana.
const hitungJumlahSegmen = (K, segmen) => {
  const modul = hitungModulAktif(K, { segmen });
  const fitur = hitungFiturAktif(K, { segmen, modulAktif: modul });
  const bagian = hitungBagianAktif(K, { segmen, fiturAktif: fitur, modulAktif: modul });
  const rencana = (cariSegmen(K, segmen)?.modul ?? []).filter((k) => !K.KATALOG_MODUL.find((m) => m.kode === k)?.tersedia).length;
  return { modul: modul.length, fitur: fitur.length, bagian: bagian.length, modul_rencana: rencana };
};

export default class ModulService {
  // Konfigurasi modul faskes + katalog berstatus (dipakai menu, guard rute & halaman Manajemen Modul).
  static async ambil(author) {
    const [K, konfigurasi, poli] = await Promise.all([muatKatalog(), bacaKonfigurasi(author.faskesUuid), daftarPoli(author.faskesUuid)]);
    const { segmen, override } = konfigurasi;
    const { modulAktif: aktif, fiturAktif, bagianAktif } = hitungKonfigurasi(K, { segmen, override });
    const modulDasar = new Set(cariSegmen(K, segmen)?.modul ?? []);
    const fiturDasar = new Set(segmen ? fiturBawaan(K, segmen, aktif) : []);
    const bagianDasar = new Set(segmen ? bagianBawaan(K, segmen, fiturAktif, aktif) : []);
    const o = override;

    return {
      segmen,
      diatur: konfigurasi.diatur,
      diubah_oleh: konfigurasi.diubahOleh,
      diubah_pada: konfigurasi.diubahPada,
      boleh_ubah: isSuperadmin(author),
      modul_aktif: aktif,
      fitur_aktif: fiturAktif,
      bagian_aktif: bagianAktif,
      jenis_poli: K.JENIS_POLI,
      // Peta poli → jenis (bagian RME khusus spesialisasi, mis. odontogram hanya di poli gigi).
      poli,
      segmen_list: K.SEGMEN.map(({ kode, nama, urutan, ringkas, modul }) => ({
        kode, nama, urutan, ringkas, modul,
        jumlah: hitungJumlahSegmen(K, kode),
        fitur_mati: K.FITUR_MATI_SEGMEN[kode] ?? [],
        bagian_mati: K.BAGIAN_MATI_SEGMEN[kode] ?? [],
      })),
      katalog_bagian: K.KATALOG_BAGIAN.map((b) => ({
        ...b,
        aktif: bagianAktif.includes(b.kode),
        sumber: b.wajib ? (fiturAktif.includes(b.fitur) ? "wajib" : "fitur_nonaktif")
          : !fiturAktif.includes(b.fitur) || (b.modul && !aktif.includes(b.modul)) ? "fitur_nonaktif"
          : o.bagian.nonaktif.includes(b.kode) ? "nonaktif"
          : bagianDasar.has(b.kode) ? "segmen"
          : o.bagian.tambahan.includes(b.kode) ? "tambahan"
          : segmen ? "tidak" : "semua",
      })),
      katalog_fitur: K.KATALOG_FITUR.map((f) => ({
        ...f,
        aktif: fiturAktif.includes(f.kode),
        sumber: !fiturLayak(f, aktif) ? "modul_nonaktif"
          : f.wajib ? "wajib"
          : o.fitur.nonaktif.includes(f.kode) ? "nonaktif"
          : fiturDasar.has(f.kode) ? "segmen"
          : o.fitur.tambahan.includes(f.kode) ? "tambahan"
          : segmen ? "tidak" : "semua",
      })),
      katalog: K.KATALOG_MODUL.map((m) => ({
        ...m,
        aktif: aktif.includes(m.kode),
        sumber: m.inti ? "inti"
          : o.modul.nonaktif.includes(m.kode) ? "nonaktif"
          : modulDasar.has(m.kode) ? "segmen"
          : o.modul.tambahan.includes(m.kode) ? "tambahan"
          : segmen ? "tidak" : "semua",
      })),
    };
  }

  // Ubah segmen & override modul/fitur/bagian. Hanya superadmin.
  // Body: segmen, modul_tambahan, modul_nonaktif, fitur_tambahan, fitur_nonaktif (fitur_* boleh berisi kode bagian).
  static async simpan(author, body) {
    if (!isSuperadmin(author)) {
      throw new ForbiddenException("Hanya superadmin yang dapat mengubah segmen & modul faskes.");
    }
    const K = await muatKatalog({ segar: true });
    const segmen = String(body?.segmen ?? "");
    const s = cariSegmen(K, segmen);
    if (!s) throw new BadRequestException("Segmen faskes tidak valid.");

    const kodeModul = new Set(K.KATALOG_MODUL.map((m) => m.kode));
    const kodeFitur = new Set(K.KATALOG_FITUR.map((f) => f.kode));
    const kodeBagian = new Set(K.KATALOG_BAGIAN.map((b) => b.kode));
    const kodeWajib = new Set([...K.KATALOG_FITUR, ...K.KATALOG_BAGIAN].filter((x) => x.wajib).map((x) => x.kode));
    const bersihkan = (daftar) => [...new Set((Array.isArray(daftar) ? daftar : []).map(String))];

    // Modul: override hanya yang berbeda dari preset segmen.
    const modulTambahan = bersihkan(body?.modul_tambahan).filter((k) => !s.modul.includes(k));
    const modulNonaktif = bersihkan(body?.modul_nonaktif).filter((k) => s.modul.includes(k));
    const salah = [...modulTambahan, ...modulNonaktif].filter((k) => !kodeModul.has(k));
    if (salah.length) throw new BadRequestException(`Kode modul tidak dikenal: ${salah.join(", ")}`);
    if (modulNonaktif.some((k) => K.KATALOG_MODUL.find((m) => m.kode === k)?.inti)) {
      throw new BadRequestException("Modul inti tidak dapat dinonaktifkan.");
    }

    // Fitur & bagian (dikirim dalam daftar yang sama, dipisah menurut katalog).
    const masukTambahan = bersihkan(body?.fitur_tambahan);
    const masukNonaktif = bersihkan(body?.fitur_nonaktif);
    const fiturSalah = [...masukTambahan, ...masukNonaktif].filter((k) => !kodeFitur.has(k) && !kodeBagian.has(k));
    if (fiturSalah.length) throw new BadRequestException(`Kode fitur/bagian tidak dikenal: ${fiturSalah.join(", ")}`);
    if (masukNonaktif.some((k) => kodeWajib.has(k))) throw new BadRequestException("Fitur/bagian wajib tidak dapat dinonaktifkan.");

    const modulAktif = hitungModulAktif(K, { segmen, tambahan: modulTambahan, nonaktif: modulNonaktif });
    const presetFitur = new Set(fiturBawaan(K, segmen, modulAktif));
    const fiturTambahan = masukTambahan.filter((k) => kodeFitur.has(k) && !presetFitur.has(k));
    const fiturNonaktif = masukNonaktif.filter((k) => kodeFitur.has(k) && presetFitur.has(k));
    const fiturAktif = hitungFiturAktif(K, { segmen, modulAktif, tambahan: fiturTambahan, nonaktif: fiturNonaktif });
    const presetBagian = new Set(bagianBawaan(K, segmen, fiturAktif, modulAktif));
    const bagianTambahan = masukTambahan.filter((k) => kodeBagian.has(k) && !presetBagian.has(k));
    const bagianNonaktif = masukNonaktif.filter((k) => kodeBagian.has(k) && presetBagian.has(k));

    const sekarang = moment().unix();
    await sequelizeInstance.transaction(async (transaction) => {
      const q = (sql, replacements) => sequelizeInstance.query(sql, { replacements, transaction });
      const sebelum = await bacaKonfigurasi(author.faskesUuid, transaction);

      await q(
        `INSERT INTO faskes_segmen (faskes_uuid, segmen_kode, diubah_oleh, created_at, updated_at)
         VALUES (:f, :s, :o, :t, :t)
         ON CONFLICT (faskes_uuid) DO UPDATE SET segmen_kode = EXCLUDED.segmen_kode, diubah_oleh = EXCLUDED.diubah_oleh, updated_at = EXCLUDED.updated_at`,
        { f: author.faskesUuid, s: segmen, o: author.username ?? null, t: sekarang }
      );
      const tulisOverride = async (tabel, kolom, tambahan, nonaktif) => {
        await q(`DELETE FROM ${tabel} WHERE faskes_uuid = :f`, { f: author.faskesUuid });
        for (const [kode, aktif] of [...tambahan.map((k) => [k, true]), ...nonaktif.map((k) => [k, false])]) {
          await q(`INSERT INTO ${tabel} (faskes_uuid, ${kolom}, aktif) VALUES (:f, :k, :a)`, { f: author.faskesUuid, k: kode, a: aktif });
        }
      };
      await tulisOverride("faskes_modul_override", "modul_kode", modulTambahan, modulNonaktif);
      await tulisOverride("faskes_fitur_override", "fitur_kode", fiturTambahan, fiturNonaktif);
      await tulisOverride("faskes_bagian_override", "bagian_kode", bagianTambahan, bagianNonaktif);

      const sesudah = await bacaKonfigurasi(author.faskesUuid, transaction);
      await q(
        `INSERT INTO faskes_modul_riwayat (faskes_uuid, oleh, sebelum, sesudah, alasan, created_at)
         VALUES (:f, :o, CAST(:sebelum AS jsonb), CAST(:sesudah AS jsonb), :alasan, :t)`,
        {
          f: author.faskesUuid, o: author.username ?? null,
          sebelum: JSON.stringify(ringkasSnapshot(sebelum)), sesudah: JSON.stringify(ringkasSnapshot(sesudah)),
          alasan: body?.alasan ? String(body.alasan).slice(0, 500) : null, t: sekarang,
        }
      );
    });
    return this.ambil(author);
  }

  // Ubah jenis poli (umum/gigi/mata/…) — hanya superadmin. Validasi kode dijamin FK lokasi → ref_jenis_poli.
  static async simpanJenisPoli(author, body) {
    if (!isSuperadmin(author)) throw new ForbiddenException("Hanya superadmin yang dapat mengubah jenis poli.");
    const K = await muatKatalog();
    const jenis = String(body?.jenis_poli ?? "");
    if (!K.JENIS_POLI.some((j) => j.kode === jenis)) throw new BadRequestException("Jenis poli tidak valid.");
    const [, hasil] = await sequelizeInstance.query(
      `UPDATE lokasi SET jenis_poli = :jenis WHERE uuid = :uuid AND faskes_uuid = :faskes AND is_poli = true AND deleted_at IS NULL`,
      { replacements: { jenis, uuid: String(body?.lokasi_uuid ?? ""), faskes: author.faskesUuid } }
    );
    if (!hasil?.rowCount) throw new BadRequestException("Poli tidak ditemukan.");
    return this.ambil(author);
  }

  static async riwayat(author) {
    return pilih(
      `SELECT oleh, sebelum, sesudah, alasan, created_at FROM faskes_modul_riwayat
        WHERE faskes_uuid = :faskes ORDER BY created_at DESC, id DESC LIMIT 50`,
      { faskes: author.faskesUuid }
    );
  }
}
