import config from "../config.js";
import { query, satu } from "../db.js";
import { Galat } from "../umum/respons.js";
import { panggilLayanan } from "../umum/layanan.js";
import { SQL_NAMA_DOKTER } from "./bersama.js";

// Integrasi Laboratorium PK (lab-service) untuk MCU.
// - Item lab paket menunjuk pemeriksaan/tarif lab (tarif_lab_uuid, mis. "Darah Rutin") atau parameter
//   item_pemeriksaan (ref_uuid). Saat pendaftaran, item tsb dipetakan ke daftar tarif lab lalu dibuat SATU order
//   lab per peserta di lab-service (pelayanan APS, is_mcu = true → tanpa tagihan lab; harga sudah termasuk paket).
// - Item lab teks bebas / tanpa tarif yang memuat parameternya diisi manual di stasiun Laboratorium MCU.
// - Hasil dibaca dari observation_item (diisi analis di modul Laboratorium atau dikirim balik oleh LIS).

export const STATUS_ORDER_LAB = { 0: "Batal", 1: "Order", 2: "Diperiksa", 3: "Selesai" };
export const LABEL_FLAG_LAB = { N: "Normal", TN: "Tidak normal", L: "Rendah", H: "Tinggi", KL: "Kritis rendah", KH: "Kritis tinggi", A: "Abnormal" };
export const flagAbnormal = (f) => !!f && !["N", ""].includes(String(f).toUpperCase());

// Katalog tarif lab aktif faskes + parameter yang tercakup (item langsung & isi kelompok). Tarif yang mengacu
// item/kelompok yang sudah dihapus dianggap tidak valid (lab-service menolak order dengan tarif tsb).
export const katalogTarifLab = async (faskesUuid, k, tarifUuids = null) => {
  const p = [faskesUuid];
  let filter = "";
  if (tarifUuids) {
    p.push(tarifUuids);
    filter = " AND tl.uuid = ANY($2)";
  }
  const rows = await query(
    `SELECT tl.uuid, tl.code AS kode, tl.name AS nama, tl.grand_total::float8 AS harga,
            ti.item_pemeriksaan_uuid AS item_langsung, ip.uuid AS item_langsung_aktif,
            ti.kelompok_pemeriksaan_uuid AS kelompok, kp.uuid AS kelompok_aktif, ipk.uuid AS item_kelompok
       FROM tarif_lab tl
       JOIN tarif_lab_item ti ON ti.tarif_lab_uuid = tl.uuid AND ti.deleted_at IS NULL
       LEFT JOIN item_pemeriksaan ip ON ip.uuid = ti.item_pemeriksaan_uuid AND ip.deleted_at IS NULL
       LEFT JOIN kelompok_pemeriksaan kp ON kp.uuid = ti.kelompok_pemeriksaan_uuid AND kp.deleted_at IS NULL
       LEFT JOIN item_kelompok_pemeriksaan ik ON ik.kelompok_pemeriksaan_uuid = kp.uuid AND ik.deleted_at IS NULL
       LEFT JOIN item_pemeriksaan ipk ON ipk.uuid = ik.item_pemeriksaan_uuid AND ipk.deleted_at IS NULL
      WHERE tl.faskes_uuid = $1 AND tl.deleted_at IS NULL AND tl.status IS NOT FALSE${filter}
      ORDER BY tl.code, tl.uuid`,
    p,
    k,
  );
  const peta = new Map();
  for (const r of rows) {
    const t = peta.get(r.uuid) ?? { uuid: r.uuid, kode: r.kode, nama: r.nama, harga: r.harga, items: new Set(), valid: true };
    if (r.item_langsung) {
      if (r.item_langsung_aktif) t.items.add(r.item_langsung_aktif);
      else t.valid = false;
    }
    if (r.kelompok) {
      if (!r.kelompok_aktif) t.valid = false;
      else if (r.item_kelompok) t.items.add(r.item_kelompok);
    }
    peta.set(r.uuid, t);
  }
  return [...peta.values()].filter((t) => t.valid && t.items.size);
};

// Petakan item lab paket → tarif lab yang diorder. Tarif eksplisit dipakai apa adanya. Parameter (ref_uuid) dicakup
// mulai dari parameter dengan pilihan tarif paling sedikit; untuk tiap parameter dipilih tarif dengan parameter
// tambahan (di luar paket) paling sedikit, lalu cakupan terbanyak — tanpa tumpang tindih dengan tarif terpilih
// (lab-service menolak parameter ganda). Dengan begitu panel kecil (mis. Darah Rutin) diutamakan dan panel besar yang
// membawa pemeriksaan sensitif (mis. paket pranikah berisi HIV/VDRL) tidak ikut terpilih.
// Hasil: { tarif: [{uuid,kode,nama,harga,jumlah_parameter,items}], manual: [item paket], konflik: [pesan] }.
export const rencanaLab = async (items, faskesUuid, k) => {
  const lab = (items ?? []).filter((i) => i.jenis === "lab");
  if (!lab.length) return { tarif: [], manual: [], konflik: [] };
  const katalog = await katalogTarifLab(faskesUuid, k);
  const perUuid = new Map(katalog.map((t) => [t.uuid, t]));
  const dipilih = [];
  const tercakup = new Set();
  const konflik = [];
  const pakai = (t) => {
    dipilih.push(t);
    t.items.forEach((i) => tercakup.add(i));
  };

  for (const it of lab.filter((i) => i.tarif_lab_uuid)) {
    const t = perUuid.get(it.tarif_lab_uuid);
    if (!t || dipilih.includes(t)) continue;
    if ([...t.items].some((i) => tercakup.has(i))) {
      konflik.push(`${t.nama} memuat parameter yang sudah ada di pemeriksaan lain paket ini`);
      continue;
    }
    pakai(t);
  }

  const perlu = new Set(lab.filter((i) => !i.tarif_lab_uuid && i.ref_uuid && !tercakup.has(i.ref_uuid)).map((i) => i.ref_uuid));
  const bebas = (t) => !dipilih.includes(t) && ![...t.items].some((i) => tercakup.has(i));
  while (perlu.size) {
    let pilih = null;
    for (const item of perlu) {
      const opsi = katalog.filter((t) => t.items.has(item) && bebas(t));
      if (!opsi.length) continue;
      const nilai = (t) => {
        let c = 0;
        for (const i of t.items) if (perlu.has(i)) c++;
        return { t, ekstra: t.items.size - c, c };
      };
      const terbaik = opsi.map(nilai).sort((a, b) => a.ekstra - b.ekstra || b.c - a.c)[0];
      if (!pilih || opsi.length < pilih.n || (opsi.length === pilih.n && terbaik.c > pilih.c)) pilih = { n: opsi.length, ...terbaik };
    }
    if (!pilih) break;
    pakai(pilih.t);
    for (const i of pilih.t.items) perlu.delete(i);
  }

  const terpakai = new Set(dipilih.map((t) => t.uuid));
  const manual = lab.filter((it) => (it.tarif_lab_uuid ? !terpakai.has(it.tarif_lab_uuid) : !(it.ref_uuid && tercakup.has(it.ref_uuid))));
  return {
    tarif: dipilih.map((t) => ({ uuid: t.uuid, kode: t.kode, nama: t.nama, harga: t.harga, jumlah_parameter: t.items.size, items: [...t.items] })),
    manual,
    konflik,
  };
};

// Lokasi asal order lab MCU: lokasi bernama MCU / Medical Check Up bila ada, selain itu lokasi induk faskes.
const lokasiMcu = (faskesUuid, k) =>
  satu(
    `SELECT uuid FROM lokasi WHERE faskes_uuid = $1 AND deleted_at IS NULL
      ORDER BY (name ILIKE '%mcu%' OR name ILIKE '%medical check%') DESC, (location_type = 'Site') DESC,
               (location_type = 'Building') DESC, id
      LIMIT 1`,
    [faskesUuid],
    k,
  );

// Buat order lab satu peserta di lab-service. Mengembalikan { uuid, no_order }.
export const buatOrderLab = async ({ faskesUuid, peserta, paket, perusahaan, tarifUuids, token, k, cito = false, dokterUuid = null, lokasiUuid = null, diagnosis = null }) => {
  const lokasi = lokasiUuid ? { uuid: lokasiUuid } : await lokasiMcu(faskesUuid, k);
  if (!lokasi) throw new Galat(400, "Lokasi faskes belum diatur sehingga order laboratorium MCU tidak dapat dibuat");
  const hariIni = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const tanggal = typeof peserta.tanggal === "string" ? peserta.tanggal.substring(0, 10) : hariIni;
  const waktu = tanggal === hariIni ? Math.floor(Date.now() / 1000) : Math.floor(Date.parse(`${tanggal}T08:00:00+07:00`) / 1000);
  const r = await panggilLayanan(`${config.labUrl}/order-lab`, {
    method: "POST",
    token,
    nama: "Laboratorium",
    body: {
      patient_uuid: peserta.patient_uuid,
      no_rm: peserta.no_rm,
      payment_method: 1,
      pelayanan: "aps",
      lokasi_uuid: lokasi.uuid,
      ...(dokterUuid ? { dokter_pengirim_uuid: dokterUuid } : {}),
      dokter_pengirim: "Medical Check Up",
      pasien_maternitas: false,
      keluhan_utama: null,
      catatan: `MCU ${peserta.no_mcu} · ${paket.nama}${perusahaan ? ` · ${perusahaan.nama}` : ""}`.slice(0, 255),
      diagnosis: diagnosis ? String(diagnosis).slice(0, 255) : null,
      rekam_medis_date: String(waktu),
      tgl_pemeriksaan: String(waktu),
      cito: !!cito,
      status_puasa: false,
      tarif_lab_uuids: tarifUuids,
      is_mcu: true,
    },
  });
  if (!r?.payload?.uuid) throw new Galat(502, "Laboratorium: order dibuat tanpa nomor order (perbarui lab-service)");
  return r.payload;
};

export const batalOrderLab = (uuid, alasan, token) =>
  panggilLayanan(`${config.labUrl}/order-lab-batal`, {
    method: "PUT",
    token,
    nama: "Laboratorium",
    body: { alasan_batal_order: String(alasan).slice(0, 255), order_lab_uuids: [uuid] },
  });

// Ringkas status order lab: jumlah parameter & yang sudah berisi hasil.
export const statusOrderLab = (uuid, k) =>
  satu(
    `SELECT o.uuid, o.no_order, o.order_status,
            (SELECT COUNT(*) FROM observation_item oi WHERE oi.order_lab_uuid = o.uuid AND oi.deleted_at IS NULL)::int AS total,
            (SELECT COUNT(*) FROM observation_item oi WHERE oi.order_lab_uuid = o.uuid AND oi.deleted_at IS NULL
                AND COALESCE(TRIM(oi.result), '') <> '')::int AS terisi
       FROM order_lab o WHERE o.uuid = $1 AND o.deleted_at IS NULL`,
    [uuid],
    k,
  );

// Hasil laboratorium peserta (order lab-service): parameter, hasil, satuan, nilai rujukan (sesuai jenis kelamin
// & umur, aturan sama dengan lab-service), flag, dikelompokkan per pemeriksaan (tarif) order.
export const hasilLabPeserta = async (peserta, k) => {
  if (!peserta.lab_order_uuid) return null;
  const order = await satu(
    `SELECT o.uuid, o.no_order, o.order_status, o.waktu_validasi, o.waktu_selsai AS waktu_selesai, o.catatan_analis,
            o.alasan_batal_order, ${SQL_NAMA_DOKTER("o.practitioner_uuid")} AS dokter_lab
       FROM order_lab o WHERE o.uuid = $1 AND o.deleted_at IS NULL`,
    [peserta.lab_order_uuid],
    k,
  );
  if (!order) return null;
  const umur = await satu(
    `SELECT COALESCE(DATE_PART('year', a) * 365 + DATE_PART('month', a) * 30 + DATE_PART('day', a), 0)::int AS hari
       FROM (SELECT AGE($1::date, bd.birth_date::date) a FROM patients p JOIN birth_details bd ON bd.uuid = p.birth_detail_uuid
              WHERE p.uuid = $2) x`,
    [peserta.tanggal, peserta.patient_uuid],
    k,
  );
  const [items, tarif] = await Promise.all([
    query(
      `SELECT oi.uuid, oi.item_pemeriksaan_uuid, ip.name AS nama, ip.code AS kode, ip.satuan, ip.metode, ip.no_urut,
              oi.result AS hasil, oi.flag, oi.status_periksa,
              (SELECT nr.tampilan FROM nilai_rujukan nr
                WHERE nr.item_pemeriksaan_uuid = oi.item_pemeriksaan_uuid AND nr.deleted_at IS NULL AND nr.status IS NOT FALSE
                  AND (nr.jenis_kelamin = $2 OR nr.jenis_kelamin = 'General')
                  AND $3::int BETWEEN COALESCE(nr.umur_bawah_tahun, 0) * 365 + COALESCE(nr.umur_bawah_bulan, 0) * 30 + COALESCE(nr.umur_bawah_hari, 0)
                                  AND COALESCE(nr.umur_atas_tahun, 999) * 365 + COALESCE(nr.umur_atas_bulan, 0) * 30 + COALESCE(nr.umur_atas_hari, 0)
                ORDER BY (nr.jenis_kelamin = 'General') LIMIT 1) AS nilai_rujukan
         FROM observation_item oi JOIN item_pemeriksaan ip ON ip.uuid = oi.item_pemeriksaan_uuid
        WHERE oi.order_lab_uuid = $1 AND oi.deleted_at IS NULL`,
      [order.uuid, peserta.gender ?? null, umur?.hari ?? 0],
      k,
    ),
    query(
      `SELECT olp.tarif_lab_uuid AS uuid, tl.name AS nama, tl.code AS kode FROM order_lab_pemeriksaan olp
         JOIN tarif_lab tl ON tl.uuid = olp.tarif_lab_uuid
        WHERE olp.order_lab_uuid = $1 AND olp.deleted_at IS NULL ORDER BY olp.created_at, tl.code`,
      [order.uuid],
      k,
    ),
  ]);
  // Kelompokkan parameter per pemeriksaan (tarif) order.
  const isiTarif = tarif.length ? await katalogTarifLab(peserta.faskes_uuid, k, tarif.map((t) => t.uuid)) : [];
  const kelompokItem = new Map();
  tarif.forEach((t, urut) => {
    const isi = isiTarif.find((x) => x.uuid === t.uuid);
    for (const i of isi?.items ?? []) if (!kelompokItem.has(i)) kelompokItem.set(i, { nama: t.nama, urut });
  });
  const hasil = items
    .map((i) => {
      const g = kelompokItem.get(i.item_pemeriksaan_uuid);
      const ada = String(i.hasil ?? "").trim() !== "";
      return {
        uuid: i.uuid,
        item_pemeriksaan_uuid: i.item_pemeriksaan_uuid,
        kelompok: g?.nama ?? "Lainnya",
        urut_kelompok: g?.urut ?? 999,
        nama: i.nama,
        kode: i.kode,
        satuan: i.satuan,
        metode: i.metode,
        no_urut: i.no_urut,
        hasil: ada ? i.hasil : null,
        flag: ada ? i.flag ?? null : null,
        label_flag: ada && i.flag ? LABEL_FLAG_LAB[i.flag] ?? i.flag : null,
        abnormal: ada && flagAbnormal(i.flag),
        nilai_rujukan: i.nilai_rujukan,
      };
    })
    .sort((a, b) => a.urut_kelompok - b.urut_kelompok || (a.no_urut ?? 9999) - (b.no_urut ?? 9999) || String(a.nama).localeCompare(String(b.nama)));
  const terisi = hasil.filter((h) => h.hasil !== null).length;
  return {
    ...order,
    status_label: STATUS_ORDER_LAB[order.order_status] ?? String(order.order_status),
    batal: Number(order.order_status) === 0,
    pemeriksaan: tarif.map((t) => t.nama),
    total: hasil.length,
    terisi,
    lengkap: hasil.length > 0 && terisi === hasil.length,
    tarif_uuids: tarif.map((t) => t.uuid),
    hasil: hasil.map(({ urut_kelompok, no_urut, ...h }) => h),
  };
};
