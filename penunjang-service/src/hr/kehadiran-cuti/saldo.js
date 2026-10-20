import { query, satu, sekarang } from "../../db.js";
import { Galat } from "../../umum/respons.js";
import { buat, audit } from "./repository.js";
import { hitungSaldo, alokasiSaldo, tanggalWib } from "./aturan.js";

export const kebijakan = async (f, tahun, k) => {
  const p = await satu(`SELECT * FROM hr_kebijakan_cuti WHERE faskes_uuid = $1 AND tahun = $2 AND deleted_at IS NULL ORDER BY versi DESC LIMIT 1`, [f, tahun], k);
  if (!p) throw new Galat(422, `Kebijakan cuti tahun ${tahun} belum lengkap`);
  return p;
};
const akhirBulan = (tahun, bulan) => Math.floor(Date.UTC(tahun, bulan, 1, -7) / 1000);
export const mutasi = async (req, s, data, k) => {
  const r = await buat("hr_saldo_cuti_mutasi", req, { saldo_uuid: s.uuid, ...data }, k);
  await audit(req, "hr_saldo_cuti_mutasi", r.uuid, { saldo_uuid: s.uuid, jenis: r.jenis, jumlah_hari: r.jumlah_hari, pengajuan_uuid: r.pengajuan_uuid ?? null, alasan: r.alasan ?? null }, k);
  return r;
};
export const bacaSaldo = async (req, s, pada, k, kecuali = null) => {
  const f = req.author.faskesUuid;
  const daftar = await query(`SELECT * FROM hr_saldo_cuti_mutasi WHERE faskes_uuid = $1 AND saldo_uuid = $2 AND deleted_at IS NULL`, [f, s.uuid], k);
  const r = await satu(`SELECT coalesce(sum(jumlah_hari), 0) AS jumlah FROM hr_saldo_cuti_reservasi WHERE faskes_uuid = $1 AND saldo_uuid = $2 AND aktif = true AND deleted_at IS NULL AND ($3::varchar IS NULL OR pengajuan_uuid <> $3)`, [f, s.uuid, kecuali], k);
  return { ...hitungSaldo(daftar, r.jumlah, pada), tahun: s.tahun, saldo_uuid: s.uuid, hak_tahunan: daftar.filter((m) => m.jenis === "hak").reduce((n, m) => n + Number(m.jumlah_hari), 0),
    pemakaian: -daftar.filter((m) => ["pemakaian", "pengembalian"].includes(m.jenis)).reduce((n, m) => n + Number(m.jumlah_hari), 0) };
};
// Pemanggil mengunci pegawai sebelum mengakses tahun secara berurutan, termasuk pengajuan lintas tahun.
export const pastikanSaldo = async (req, h, tahun, k) => {
  const f = req.author.faskesUuid;
  if (tahun < Number(tanggalWib(h.tanggal_mulai).slice(0, 4))) throw new Galat(422, "Tahun saldo mendahului awal kepegawaian");
  let s = await satu(`SELECT * FROM hr_saldo_cuti_tahun WHERE faskes_uuid = $1 AND kepegawaian_uuid = $2 AND tahun = $3 AND deleted_at IS NULL FOR UPDATE`, [f, h.uuid, tahun], k);
  const p = s ? await satu(`SELECT * FROM hr_kebijakan_cuti WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [s.kebijakan_uuid, f], k) : await kebijakan(f, tahun, k);
  if (!p) throw new Galat(422, "Kebijakan saldo tidak tersedia");
  if (!s) {
    s = await buat("hr_saldo_cuti_tahun", req, { kepegawaian_uuid: h.uuid, tahun, kebijakan_uuid: p.uuid, kedaluwarsa_carry: akhirBulan(tahun, p.data.bulan_kedaluwarsa) }, k);
    await mutasi(req, s, { sumber: "hak", jenis: "hak", jumlah_hari: p.data.hak_tahunan, kunci_idempotensi: `hak:${s.uuid}` }, k);
  }
  const sudahCarry = await satu(`SELECT 1 FROM hr_saldo_cuti_mutasi WHERE faskes_uuid = $1 AND saldo_uuid = $2 AND jenis = 'carry_over' AND deleted_at IS NULL`, [f, s.uuid], k);
  const awalTahun = Date.parse(`${tahun}-01-01T00:00:00+07:00`) / 1000;
  if (!sudahCarry && sekarang() >= awalTahun) {
    const lama = await satu(`SELECT * FROM hr_saldo_cuti_tahun WHERE faskes_uuid = $1 AND kepegawaian_uuid = $2 AND tahun = $3 AND deleted_at IS NULL FOR UPDATE`, [f, h.uuid, tahun - 1], k);
    const saldoLama = lama ? await bacaSaldo(req, lama, awalTahun - 1, k) : null;
    const jumlah = Math.min(p.data.batas_carry_over, Math.max(0, saldoLama?.hak_tersisa - (saldoLama?.reservasi ?? 0) || 0));
    await mutasi(req, s, { sumber: "carry_over", jenis: "carry_over", jumlah_hari: jumlah, kedaluwarsa: s.kedaluwarsa_carry, kunci_idempotensi: `carry:${s.uuid}` }, k);
    if (jumlah) await mutasi(req, lama, { sumber: "hak", jenis: "dipindahkan", jumlah_hari: -jumlah, kunci_idempotensi: `pindah:${s.uuid}` }, k);
  }
  return s;
};
export const reservasiSaldo = async (req, h, p, k) => {
  for (const [tahun, hari] of Object.entries(p.hari).sort()) {
    const s = await pastikanSaldo(req, h, Number(tahun), k);
    const pada = Math.max(sekarang(), Date.parse(`${hari.at(-1)}T23:59:59+07:00`) / 1000);
    alokasiSaldo(await bacaSaldo(req, s, pada, k), hari.length);
    await buat("hr_saldo_cuti_reservasi", req, { saldo_uuid: s.uuid, pengajuan_uuid: p.uuid, jumlah_hari: hari.length }, k);
  }
};
export const sahkanSaldo = async (req, h, p, k) => {
  for (const [tahun, hari] of Object.entries(p.hari).sort()) {
    const s = await pastikanSaldo(req, h, Number(tahun), k);
    const pada = Math.max(sekarang(), Date.parse(`${hari.at(-1)}T23:59:59+07:00`) / 1000);
    const alokasi = alokasiSaldo(await bacaSaldo(req, s, pada, k, p.uuid), hari.length);
    for (const [sumber, jumlah] of Object.entries(alokasi)) if (jumlah) await mutasi(req, s, { sumber, jenis: "pemakaian", jumlah_hari: -jumlah,
      pengajuan_uuid: p.uuid, kedaluwarsa: sumber === "carry_over" ? s.kedaluwarsa_carry : null, kunci_idempotensi: `pakai:${p.uuid}:${tahun}:${sumber}` }, k);
  }
};
export const lepasReservasi = (req, p, k) => query(`UPDATE hr_saldo_cuti_reservasi SET aktif = false, updated_at = $1 WHERE faskes_uuid = $2 AND pengajuan_uuid = $3 AND aktif = true AND deleted_at IS NULL`, [sekarang(), req.author.faskesUuid, p.uuid], k);
export const kembalikanSaldo = async (req, p, k) => {
  const daftar = await query(`SELECT m.* FROM hr_saldo_cuti_mutasi m WHERE m.faskes_uuid = $1 AND m.pengajuan_uuid = $2 AND m.jenis = 'pemakaian' AND m.deleted_at IS NULL ORDER BY m.saldo_uuid, m.uuid`, [req.author.faskesUuid, p.uuid], k);
  for (const m of daftar) await mutasi(req, { uuid: m.saldo_uuid }, { sumber: m.sumber, jenis: "pengembalian", jumlah_hari: -Number(m.jumlah_hari),
    pengajuan_uuid: p.uuid, kedaluwarsa: m.kedaluwarsa, kunci_idempotensi: `kembali:${m.uuid}` }, k);
};
export const tahunKini = () => Number(tanggalWib(sekarang()).slice(0, 4));
