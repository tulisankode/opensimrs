import { query, satu, sisipkan, sekarang, transaksi } from "../db.js";
import { tidakDitemukan, permintaanSalah } from "../umum/respons.js";
import { nomorBaru } from "../umum/nomor.js";
import { kirimTagihan } from "../umum/tagihan.js";
import { itemPaket } from "./paket.js";
import { konflik, hargaKontrak, susunStasiun } from "./bersama.js";
import { rencanaLab, buatOrderLab, batalOrderLab } from "./lab.js";

// Inti pendaftaran peserta MCU (dipakai pendaftaran manual & impor Excel rombongan).
// Per peserta: baris mcu_peserta (harga kontrak perusahaan bila ada, selain itu harga paket), order radiologi
// (rad_order sumber 'mcu', tanpa tagihan), order laboratorium di lab-service (is_mcu, tanpa tagihan lab) dan —
// untuk perorangan — tagihan kasir layanan MCU. Pemeriksaan tambahan di luar paket (dari impor) ikut diorder dan
// ditagihkan terpisah (perorangan: item tagihan kasir; korporasi: masuk invoice lewat harga_tambahan).
// Panggilan ke lab-service & Pembayaran berada di luar transaksi DB, sehingga bila ada yang gagal semuanya
// dikompensasi (order lab dibatalkan, tagihan ditarik) lalu transaksi di-rollback.

const tambahanDitagih = (p) => (Array.isArray(p.tambahan) ? p.tambahan : []).filter((t) => t.ditagih !== false);

export const tagihanPeserta = (peserta, paket, author, hapus = false) =>
  kirimTagihan({
    faskesUuid: peserta.faskes_uuid,
    patientUuid: peserta.patient_uuid,
    noReg: null,
    paymentMethod: peserta.payment_method,
    ref: `mcu:${peserta.uuid}`,
    items: hapus
      ? []
      : [
          {
            item_name: `Medical Check Up: ${paket.nama}`,
            qty: 1,
            price: Number(peserta.harga),
            additional_info: { no_mcu: peserta.no_mcu, kode_paket: paket.kode, jenis_mcu: peserta.jenis_mcu },
          },
          ...tambahanDitagih(peserta).map((t) => ({
            item_name: `MCU tambahan (${t.jenis === "lab" ? "Lab" : "Radiologi"}): ${t.nama}`,
            qty: 1,
            price: Number(t.harga) || 0,
            additional_info: { no_mcu: peserta.no_mcu, tambahan: t.kode ?? null },
          })),
        ],
    token: author.token,
    hapus,
    apsType: "MCU",
    apsServiceName: "Medical Check Up",
    apsServiceCode: peserta.no_mcu,
    apsLayananUuid: peserta.uuid,
  });

// Paket & perusahaan valid untuk cara bayar tsb.
export const ambilPaketDaftar = async (paketUuid, f, caraBayar, k) => {
  const paket = await satu(`SELECT * FROM mcu_paket WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [paketUuid, f], k);
  if (!paket) throw tidakDitemukan("Paket MCU");
  if (!paket.status) throw permintaanSalah(`Paket ${paket.nama} tidak aktif`);
  if (paket.jenis !== "semua" && paket.jenis !== caraBayar) throw permintaanSalah(`Paket ${paket.nama} khusus MCU ${paket.jenis}`);
  return paket;
};

export const ambilPerusahaanDaftar = async (perusahaanUuid, f, k) => {
  if (!perusahaanUuid) throw permintaanSalah("perusahaan_uuid wajib diisi untuk MCU korporasi");
  const p = await satu(`SELECT * FROM mcu_perusahaan WHERE uuid = $1 AND faskes_uuid = $2 AND deleted_at IS NULL`, [perusahaanUuid, f], k);
  if (!p) throw tidakDitemukan("Perusahaan");
  if (!p.status) throw permintaanSalah(`Perusahaan ${p.nama} tidak aktif`);
  return p;
};

// Pasien yang sudah terdaftar MCU (belum batal) pada tanggal tsb.
export const sudahTerdaftar = (f, patientUuids, tanggal, k) =>
  query(
    `SELECT s.patient_uuid, s.no_mcu, s.tanggal::text AS tanggal, pt.name FROM mcu_peserta s JOIN patients pt ON pt.uuid = s.patient_uuid
      WHERE s.faskes_uuid = $1 AND s.patient_uuid = ANY($2) AND s.tanggal = ANY($3::date[]) AND s.status <> 'batal' AND s.deleted_at IS NULL`,
    [f, patientUuids, Array.isArray(tanggal) ? tanggal : [tanggal]],
    k,
  );

const kompensasi = async (catatan, author) => {
  for (const uuid of catatan.lab) await batalOrderLab(uuid, "Pendaftaran MCU gagal, order dibatalkan otomatis", author.token).catch(() => {});
  for (const { peserta, paket } of catatan.tagihan) await tagihanPeserta(peserta, paket, author, true).catch(() => {});
};

const teks = (v, max = 255) => {
  const t = String(v ?? "").trim();
  return t ? t.slice(0, max) : null;
};

// Daftarkan satu kelompok (paket + tanggal sama) di dalam transaksi `k`. daftar: [{ pasien: {uuid,no_rm,name},
// nik_karyawan?, jabatan?, bagian?, no_registrasi?, cito?, unit_asal_uuid?, dokter_pengirim_uuid?, penjamin_uuid?,
// payment_method?, diagnosa_awal?, icd10_code?, icd10_nama?, tambahan?: [{jenis:'lab'|'radiologi', uuid, kode, nama,
// harga, items?, modalitas?}] }]. Panggilan eksternal dicatat di `catatan` untuk kompensasi.
const daftarkanKelompok = async (k, { f, author, caraBayar, jenisMcu, tanggal, paket, perusahaan, paymentMethod, daftar, catatan }) => {
  const items = await itemPaket(paket.uuid, k);
  const itemRad = items.filter((i) => i.jenis === "radiologi" && i.ref_uuid);
  const rencana = await rencanaLab(items, f, k);
  const kontrak = perusahaan ? await hargaKontrak(perusahaan.uuid, paket.uuid, tanggal, k) : null;
  const harga = kontrak ? Number(kontrak.harga) : Number(paket.harga);
  const parameterPaket = new Set(rencana.tarif.flatMap((t) => t.items ?? []));
  const dibuat = [];
  for (const d of daftar) {
    const px = d.pasien;
    // Pemeriksaan tambahan: lab yang parameternya sudah tercakup paket / radiologi yang sudah ada di paket dilewati.
    const catatanTambahan = [];
    const labTambahan = [];
    const radTambahan = [];
    const tercakup = new Set(parameterPaket);
    for (const t of Array.isArray(d.tambahan) ? d.tambahan : []) {
      if (t.jenis === "lab") {
        const isi = t.items ?? [];
        if (rencana.tarif.some((x) => x.uuid === t.uuid) || isi.some((i) => tercakup.has(i))) {
          catatanTambahan.push(`${t.nama}: sudah termasuk paket`);
          continue;
        }
        isi.forEach((i) => tercakup.add(i));
        labTambahan.push(t);
      } else if (t.jenis === "radiologi") {
        if (itemRad.some((r) => r.ref_uuid === t.uuid) || radTambahan.some((r) => r.uuid === t.uuid)) {
          catatanTambahan.push(`${t.nama}: sudah termasuk paket`);
          continue;
        }
        radTambahan.push(t);
      }
    }
    const tambahan = [...labTambahan, ...radTambahan].map((t) => ({
      jenis: t.jenis,
      uuid: t.uuid,
      kode: t.kode ?? null,
      nama: t.nama,
      harga: Number(t.harga) || 0,
    }));
    const hargaTambahan = tambahan.reduce((n, t) => n + t.harga, 0);
    const metodeBayar = Number(d.payment_method ?? paymentMethod) || 1;

    const peserta = await sisipkan(
      "mcu_peserta",
      {
        faskes_uuid: f,
        no_mcu: await nomorBaru(f, "MCU", k),
        patient_uuid: px.uuid,
        no_rm: px.no_rm,
        perusahaan_uuid: perusahaan?.uuid ?? null,
        paket_uuid: paket.uuid,
        tanggal,
        harga,
        kontrak_uuid: kontrak?.uuid ?? null,
        cara_bayar: caraBayar,
        jenis_mcu: jenisMcu,
        payment_method: metodeBayar,
        status: "terdaftar",
        nik_karyawan: teks(d.nik_karyawan, 50),
        jabatan: teks(d.jabatan, 150),
        bagian: teks(d.bagian, 150),
        no_registrasi: teks(d.no_registrasi, 100),
        cito: !!d.cito,
        unit_asal_uuid: d.unit_asal_uuid ?? null,
        dokter_pengirim_uuid: d.dokter_pengirim_uuid ?? null,
        penjamin_uuid: d.penjamin_uuid ?? null,
        diagnosa_awal: teks(d.diagnosa_awal, 2000),
        icd10_code: teks(d.icd10_code, 20),
        icd10_nama: teks(d.icd10_nama, 500),
        tambahan,
        harga_tambahan: hargaTambahan,
        // Pemeriksaan tambahan lab/radiologi menambah stasiun terkait bila paket tidak memilikinya.
        stasiun: susunStasiun(paket.stasiun ?? [], [...labTambahan, ...radTambahan]),
        dibuat_oleh: author.username,
      },
      k,
    );
    peserta.nama_pasien = px.name;
    peserta.tanggal = tanggal; // kolom DATE dikembalikan pg sebagai Date lokal → simpan bentuk YYYY-MM-DD
    peserta.catatan_tambahan = catatanTambahan;
    const klinis = [d.diagnosa_awal, d.icd10_nama ? `ICD-10: ${d.icd10_code ? d.icd10_code + " " : ""}${d.icd10_nama}` : null]
      .filter(Boolean)
      .join(" · ");

    // Order radiologi otomatis (masuk worklist Radiologi, tanpa tagihan; tambahan ditagihkan lewat MCU).
    const semuaRad = [
      ...itemRad.map((it) => ({ uuid: it.ref_uuid, nama: it.nama, modalitas: it.modalitas, harga: it.harga_ref })),
      ...radTambahan,
    ];
    if (semuaRad.length) {
      const order = await sisipkan(
        "rad_order",
        {
          faskes_uuid: f,
          no_order: await nomorBaru(f, "RAD", k),
          patient_uuid: px.uuid,
          no_rm: px.no_rm,
          sumber: "mcu",
          pelayanan: "mcu",
          lokasi_asal_uuid: d.unit_asal_uuid ?? null,
          dokter_pengirim_uuid: d.dokter_pengirim_uuid ?? null,
          payment_method: peserta.payment_method,
          klinis: `Medical Check Up ${paket.nama} (${peserta.no_mcu})${klinis ? ` — ${klinis}` : ""}`,
          catatan: perusahaan ? `MCU korporasi: ${perusahaan.nama}` : "MCU perorangan",
          cito: !!d.cito,
          tanpa_tagihan: true,
          mcu_peserta_uuid: peserta.uuid,
          status: "valid",
          divalidasi_oleh: author.username,
          divalidasi_pada: sekarang(),
          dibuat_oleh: author.username,
        },
        k,
      );
      for (const it of semuaRad) {
        await sisipkan(
          "rad_order_item",
          {
            faskes_uuid: f,
            order_uuid: order.uuid,
            pemeriksaan_uuid: it.uuid,
            nama: it.nama,
            modalitas: it.modalitas ?? null,
            harga: Number(it.harga ?? 0),
            status: "menunggu",
          },
          k,
        );
      }
      await query(`UPDATE mcu_peserta SET rad_order_uuid = $1 WHERE uuid = $2`, [order.uuid, peserta.uuid], k);
      peserta.rad_order_uuid = order.uuid;
      peserta.no_order_radiologi = order.no_order;
    }

    // Order laboratorium di lab-service (is_mcu: tanpa tagihan lab, harga termasuk paket / tagihan MCU).
    const tarifUuids = [...rencana.tarif.map((t) => t.uuid), ...labTambahan.map((t) => t.uuid)];
    if (tarifUuids.length) {
      const lab = await buatOrderLab({
        faskesUuid: f,
        peserta,
        paket,
        perusahaan,
        tarifUuids,
        token: author.token,
        k,
        cito: !!d.cito,
        dokterUuid: d.dokter_pengirim_uuid ?? null,
        lokasiUuid: d.unit_asal_uuid ?? null,
        diagnosis: klinis || null,
      });
      catatan.lab.push(lab.uuid);
      await query(`UPDATE mcu_peserta SET lab_order_uuid = $1 WHERE uuid = $2`, [lab.uuid, peserta.uuid], k);
      peserta.lab_order_uuid = lab.uuid;
      peserta.no_order_lab = lab.no_order;
    }
    dibuat.push(peserta);
  }

  // Perorangan → tagihan kasir (layanan MCU) per peserta.
  if (caraBayar === "perorangan") {
    for (const p of dibuat) {
      await tagihanPeserta(p, paket, author);
      catatan.tagihan.push({ peserta: p, paket });
    }
  }
  return dibuat;
};

// Jalankan beberapa kelompok pendaftaran dalam SATU transaksi (semua berhasil atau semua dibatalkan).
// kelompok: [{ caraBayar, jenisMcu, tanggal, paket, perusahaan, paymentMethod, daftar }]
export const daftarkanPeserta = async (author, kelompok) => {
  const catatan = { lab: [], tagihan: [] };
  try {
    return await transaksi(async (k) => {
      const semua = [];
      for (const g of kelompok) semua.push(...(await daftarkanKelompok(k, { ...g, f: author.faskesUuid, author, catatan })));
      return semua;
    });
  } catch (e) {
    await kompensasi(catatan, author);
    throw e;
  }
};

// Validasi daftar pasien (milik faskes, tidak ganda, belum terdaftar MCU di tanggal tsb.).
export const pasienValid = async (f, daftar, tanggal) => {
  const uuids = daftar.map((d) => d.patient_uuid);
  if (new Set(uuids).size !== uuids.length) throw permintaanSalah("Ada pasien yang dipilih lebih dari sekali");
  const pasienDb = await query(`SELECT uuid, no_rm, name FROM patients WHERE uuid = ANY($1) AND faskes_uuid = $2 AND deleted_at IS NULL`, [uuids, f]);
  const hilang = daftar.filter((d) => !pasienDb.some((x) => x.uuid === d.patient_uuid));
  if (hilang.length) throw permintaanSalah(`${hilang.length} pasien tidak ditemukan / belum terdaftar di faskes ini`);
  const ganda = await sudahTerdaftar(f, uuids, tanggal);
  if (ganda.length) throw konflik(`Sudah terdaftar MCU pada tanggal ${tanggal}: ${ganda.map((g) => `${g.name} (${g.no_mcu})`).join(", ")}`);
  return daftar.map((d) => ({ ...d, pasien: pasienDb.find((x) => x.uuid === d.patient_uuid) }));
};

// Ringkasan respons pendaftaran.
export const ringkasPeserta = (p) => ({
  uuid: p.uuid,
  no_mcu: p.no_mcu,
  patient_uuid: p.patient_uuid,
  no_rm: p.no_rm,
  nama_pasien: p.nama_pasien,
  tanggal: p.tanggal,
  harga: Number(p.harga),
  harga_tambahan: Number(p.harga_tambahan ?? 0),
  kontrak_uuid: p.kontrak_uuid ?? null,
  rad_order_uuid: p.rad_order_uuid ?? null,
  no_order_radiologi: p.no_order_radiologi ?? null,
  lab_order_uuid: p.lab_order_uuid ?? null,
  no_order_lab: p.no_order_lab ?? null,
  catatan_tambahan: p.catatan_tambahan ?? [],
});
