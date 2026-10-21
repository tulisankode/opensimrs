import { QueryTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";

// Data lintas modul (database bersama) untuk tagihan Farmasi Ruangan & koreksi tagihan retur.
const satu = async (sql, replacements, transaction) => {
  const rows = await sequelizeInstance.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
  return rows[0] ?? null;
};

export default class TagihanRepository {
  // Kunjungan asal (RJ/RI/IGD) berdasarkan No. Registrasi — pola sama dengan penunjang-service/src/umum/kunjungan.js.
  static async cariKunjungan(noReg, faskesUuid, transaction) {
    if (!noReg) return null;
    return await satu(
      `SELECT * FROM (
         SELECT 'RJ' AS type, 'Rawat Jalan' AS service_name, uuid, no_reg, patient_uuid, practitioner_uuid, payment_method
           FROM rawat_jalans WHERE no_reg = :noReg AND faskes_uuid = :faskesUuid AND deleted_at IS NULL
         UNION ALL
         SELECT 'RI', 'Rawat Inap', uuid, no_reg, patient_uuid, practitioner_uuid, payment_method
           FROM rawat_inaps WHERE no_reg = :noReg AND faskes_uuid = :faskesUuid AND deleted_at IS NULL
         UNION ALL
         SELECT 'IGD', 'IGD', uuid, no_reg, patient_uuid, practitioner_uuid, payment_method
           FROM instalasi_gawat_darurats WHERE no_reg = :noReg AND faskes_uuid = :faskesUuid AND deleted_at IS NULL
       ) k LIMIT 1`,
      { noReg, faskesUuid },
      transaction
    );
  }

  // Banyak kunjungan sekaligus (daftar penyerahan): Map no_reg → kunjungan.
  static async cariKunjunganBanyak(noRegs, faskesUuid, transaction) {
    const daftar = [...new Set(noRegs.filter(Boolean))];
    if (daftar.length === 0) return new Map();
    const rows = await sequelizeInstance.query(
      `SELECT 'RJ' AS type, no_reg, payment_method FROM rawat_jalans
         WHERE no_reg IN (:daftar) AND faskes_uuid = :faskesUuid AND deleted_at IS NULL
       UNION ALL
       SELECT 'RI', no_reg, payment_method FROM rawat_inaps
         WHERE no_reg IN (:daftar) AND faskes_uuid = :faskesUuid AND deleted_at IS NULL
       UNION ALL
       SELECT 'IGD', no_reg, payment_method FROM instalasi_gawat_darurats
         WHERE no_reg IN (:daftar) AND faskes_uuid = :faskesUuid AND deleted_at IS NULL`,
      { replacements: { daftar, faskesUuid }, type: QueryTypes.SELECT, transaction }
    );
    const hasil = new Map();
    for (const r of rows) if (!hasil.has(r.no_reg)) hasil.set(r.no_reg, r);
    return hasil;
  }

  static async namaPasien(patientUuid, transaction) {
    const p = await satu(`SELECT name FROM patients WHERE uuid = :patientUuid`, { patientUuid }, transaction);
    return p?.name ?? null;
  }

  static async namaPraktisi(practitionerUuid, transaction) {
    if (!practitionerUuid) return null;
    const p = await satu(
      `SELECT TRIM(CONCAT_WS(' ', pg.first_title, pg.name, NULLIF(pg.last_title, ''))) AS nama
         FROM practitioner pr JOIN pegawai pg ON pg.uuid = pr.pegawai_uuid WHERE pr.uuid = :practitionerUuid`,
      { practitionerUuid },
      transaction
    );
    return p?.nama ?? null;
  }

  // Order alkes yang dibuat modul Kamar Operasi / Hemodialisa sudah ditagihkan modul itu sendiri saat pemakaian dicatat.
  static async dariPemakaianPenunjang(orderAlkesUuid, transaction) {
    const r = await satu(
      `SELECT 1 AS ada FROM ok_pemakaian_item WHERE order_alkes_uuid = :orderAlkesUuid
       UNION ALL SELECT 1 FROM hd_pemakaian WHERE order_alkes_uuid = :orderAlkesUuid
       LIMIT 1`,
      { orderAlkesUuid },
      transaction
    );
    return !!r;
  }

  // Status tagihan item ber-ref tertentu: null = belum pernah ditagihkan, { tertutup: true } = tagihan sudah ditutup/dibayar.
  static async statusTagihanRef(ref, faskesUuid, transaction) {
    const r = await satu(
      `SELECT bool_or(b.close_bill) AS tertutup
         FROM bill_item bi
         JOIN service_bill sb ON sb.uuid = bi.service_bill_uuid
         JOIN bills b ON b.uuid = sb.bill_uuid
        WHERE bi.faskes_uuid = :faskesUuid AND bi.deleted_at IS NULL AND bi.additional_field LIKE :pola`,
      { faskesUuid, pola: `%"ref":"${ref}"%` },
      transaction
    );
    return r?.tertutup === null || r?.tertutup === undefined ? null : { tertutup: !!r.tertutup };
  }

  // Status pembayaran tagihan yang memuat item ber-ref tsb, dihitung seperti kasir (BillingRepository.GetDetailBill):
  // tagihan induk + tagihan anak yang digabung ke induk; lunas bila total pembayaran ≥ total grand total.
  // Kolom bills.status sengaja tidak dipakai: tidak kembali false saat item baru masuk ke tagihan lunas yang belum ditutup.
  // Hasil: Map ref → { lunas, tertutup, total, dibayar }; ref yang belum pernah ditagihkan tidak ada di Map.
  static async statusBayarRef(refs, faskesUuid, transaction) {
    const daftar = [...new Set(refs.filter(Boolean))];
    if (daftar.length === 0) return new Map();
    const rows = await sequelizeInstance.query(
      `WITH item AS (
         SELECT DISTINCT substring(bi.additional_field from '"ref":"([^"]+)"') AS ref, COALESCE(b.merge_with, b.uuid) AS induk
           FROM bill_item bi
           JOIN service_bill sb ON sb.uuid = bi.service_bill_uuid
           JOIN bills b ON b.uuid = sb.bill_uuid
          WHERE bi.faskes_uuid = :faskesUuid AND bi.deleted_at IS NULL AND b.deleted_at IS NULL
            AND substring(bi.additional_field from '"ref":"([^"]+)"') IN (:daftar)
       ), grup AS (
         SELECT i.induk, x.uuid, x.grand_total, x.close_bill, x.uuid = i.induk AS adalah_induk
           FROM (SELECT DISTINCT induk FROM item) i
           JOIN bills x ON (x.uuid = i.induk OR x.merge_with = i.induk) AND x.deleted_at IS NULL
       ), nilai AS (
         SELECT g.induk, SUM(g.grand_total) AS total, bool_or(g.adalah_induk AND g.close_bill) AS tertutup,
                (SELECT COALESCE(SUM(ph.amount), 0) FROM payment_history ph
                  WHERE ph.deleted_at IS NULL AND ph.bill_uuid IN (SELECT g2.uuid FROM grup g2 WHERE g2.induk = g.induk)) AS dibayar
           FROM grup g GROUP BY g.induk
       )
       SELECT i.ref, n.total, n.dibayar, n.tertutup FROM item i JOIN nilai n ON n.induk = i.induk`,
      { replacements: { daftar, faskesUuid }, type: QueryTypes.SELECT, transaction }
    );
    // Satu ref di beberapa tagihan (jarang): dianggap selesai hanya bila semuanya selesai.
    const hasil = new Map();
    for (const r of rows) {
      const total = Number(r.total || 0);
      const dibayar = Number(r.dibayar || 0);
      // toleransi pembulatan sen (grand_total bertipe float)
      const kini = { lunas: dibayar >= total - 0.01, tertutup: !!r.tertutup, total, dibayar };
      const lama = hasil.get(r.ref);
      hasil.set(
        r.ref,
        lama
          ? {
              lunas: lama.lunas && kini.lunas,
              tertutup: lama.tertutup && kini.tertutup,
              total: lama.total + kini.total,
              dibayar: lama.dibayar + kini.dibayar,
            }
          : kini
      );
    }
    return hasil;
  }

  // Tagihan aktif (belum ditutup) yang memuat layanan kunjungan No. Reg tsb.
  static async tagihanAktifKunjungan(noReg, faskesUuid, transaction) {
    return await satu(
      `SELECT b.uuid FROM service_bill sb JOIN bills b ON b.uuid = sb.bill_uuid
        WHERE sb.service_code = :noReg AND sb.faskes_uuid = :faskesUuid AND b.close_bill = false
          AND b.deleted_at IS NULL AND sb.deleted_at IS NULL
        LIMIT 1`,
      { noReg, faskesUuid },
      transaction
    );
  }
}
