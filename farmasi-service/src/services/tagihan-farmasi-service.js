import "dotenv/config";
import axiosInstance from "../configurations/axios-instance.js";
import TagihanRepository from "../repositories/tagihan-repository.js";
import BadRequestException from "../errors/bad-request-exception.js";
import InternalServerException from "../errors/internal-server-exception.js";

// Tagihan Farmasi Ruangan (kategori 3 = Alkes) & koreksi tagihan retur ke modul Pembayaran (POST /internal/bills).
// - Order alkes ditagihkan saat diverifikasi (stok dipotong), ref "alkes:<uuid order>": kirim ulang mengganti item order
//   yang sama, daftar kosong menarik tagihan (batal order).
// - Retur dicatat sebagai baris bernilai negatif ref "retur:<uuid retur>" di tagihan kunjungan yang masih terbuka,
//   senilai HPP item yang diretur (basis nilai retur = HPP, sama dengan retur.total).
// Harga jual = HPP x (1 + margin% Konfigurasi Harga), sama dengan tagihan resep (prescription-service.js).
const PEMBAYARAN_URL = (process.env.BASE_URL_API_PEMBAYARAN || "http://localhost:8089/api/v3/payment/internal").replace(/\/$/, "");
export const KATEGORI_OBAT = "2";
export const KATEGORI_ALKES = "3";

export const hargaJual = (hpp, konfigurasiHarga) =>
  Math.round(Number(hpp || 0) * (1 + Number(konfigurasiHarga?.margin || 0) / 100));

export const refOrderAlkes = (uuid) => `alkes:${uuid}`;
export const refResep = (uuid) => `resep:${uuid}`;

// Obat/alkes dibayar dulu baru diserahkan (keputusan pemilik 21-10-2026). Tidak menunggu kasir:
// - rawat inap: seluruh tagihan dibayar saat pasien pulang;
// - penjamin (BPJS/asuransi, payment_method kunjungan ≠ 1): dibayar penjamin lewat klaim, tagihannya tidak pernah
//   "lunas" oleh pasien di kasir (izin Resep Dokter pun memisahkan alur ASURANSI tanpa tahap Menunggu Pembayaran);
// - BHP Kamar Operasi/Hemodialisa: ditagihkan modul tsb;
// - belum ada item tagihan (data lama sebelum penanda ref, atau kunjungan tidak ditemukan): tidak ada yang bisa dicek.
// Selebihnya (RJ/IGD tunai) boleh diserahkan bila tagihan lunas atau sudah ditutup kasir (piutang disetujui kasir).
export const STATUS_BAYAR = Object.freeze({
  RAWAT_INAP: { kode: "rawat_inap", label: "Rawat inap", boleh_diserahkan: true },
  PENJAMIN: { kode: "penjamin", label: "Penjamin", boleh_diserahkan: true },
  PENUNJANG: { kode: "oleh_penunjang", label: "Ditagih modul penunjang", boleh_diserahkan: true },
  TANPA_TAGIHAN: { kode: "tanpa_tagihan", label: "Tanpa tagihan kasir", boleh_diserahkan: true },
  LUNAS: { kode: "lunas", label: "Lunas", boleh_diserahkan: true },
  PIUTANG: { kode: "piutang", label: "Ditutup kasir (piutang)", boleh_diserahkan: true },
  MENUNGGU: { kode: "menunggu_pembayaran", label: "Menunggu pembayaran", boleh_diserahkan: false },
});

// kunjungan: hasil cariKunjungan (boleh null); tagihan: hasil statusBayarRef untuk ref order (boleh undefined).
export const nilaiStatusBayar = ({ order, kunjungan, tagihan, olehPenunjang = false }) => {
  if (kunjungan?.type === "RI" || String(order?.jenis_pelayanan ?? "").toLowerCase() === "ri") return STATUS_BAYAR.RAWAT_INAP;
  if (Number(kunjungan?.payment_method ?? order?.payment_method ?? 1) !== 1) return STATUS_BAYAR.PENJAMIN;
  if (olehPenunjang) return STATUS_BAYAR.PENUNJANG;
  if (!tagihan) return STATUS_BAYAR.TANPA_TAGIHAN;
  if (tagihan.lunas) return STATUS_BAYAR.LUNAS;
  if (tagihan.tertutup) return STATUS_BAYAR.PIUTANG;
  return { ...STATUS_BAYAR.MENUNGGU, sisa: Math.max(Math.round(tagihan.total - tagihan.dibayar), 0) };
};

const kirim = async ({ faskesUuid, kunjungan, ref, items, token }) => {
  const payload = {
    faskes_uuid: faskesUuid,
    patient_uuid: kunjungan.patient_uuid,
    patient_name: await TagihanRepository.namaPasien(kunjungan.patient_uuid),
    target_patient_uuid: null,
    services: [
      {
        type: kunjungan.type,
        practitioner_name: await TagihanRepository.namaPraktisi(kunjungan.practitioner_uuid),
        service_name: kunjungan.service_name,
        service_code: kunjungan.no_reg,
        layanan_uuid: kunjungan.uuid,
        with_insurance: Number(kunjungan.payment_method ?? 1) !== 1,
        replace_ref: ref,
        items: items.map((i) => ({ ...i, additional_info: { ...(i.additional_info ?? {}), ref } })),
      },
    ],
  };
  try {
    await axiosInstance.post(`${PEMBAYARAN_URL}/bills`, payload, { headers: { Authorization: token } });
  } catch (e) {
    throw new InternalServerException(
      "Gagal sinkronisasi ke Billing: " +
        (e?.response?.data?.errors?.[0]?.message || e?.response?.data?.message || e.message)
    );
  }
};

export default class TagihanFarmasiService {
  // Status pembayaran banyak order sekaligus (daftar/detail penyerahan). jenis: "resep" | "alkes".
  // Hasil: Map uuid order → status (lihat STATUS_BAYAR).
  static async statusPembayaran(orders, jenis, faskesUuid, transaction) {
    const ref = jenis === "resep" ? refResep : refOrderAlkes;
    const [kunjungan, tagihan] = await Promise.all([
      TagihanRepository.cariKunjunganBanyak(orders.map((o) => o.no_reg), faskesUuid, transaction),
      TagihanRepository.statusBayarRef(orders.map((o) => ref(o.uuid)), faskesUuid, transaction),
    ]);
    const hasil = new Map();
    for (const order of orders) {
      const olehPenunjang =
        jenis === "alkes" &&
        (order.jenis_pelayanan === "ok" || (await TagihanRepository.dariPemakaianPenunjang(order.uuid, transaction)));
      hasil.set(
        order.uuid,
        nilaiStatusBayar({ order, kunjungan: kunjungan.get(order.no_reg), tagihan: tagihan.get(ref(order.uuid)), olehPenunjang })
      );
    }
    return hasil;
  }

  // Tolak penyerahan bila tagihan pasien tunai rawat jalan/IGD belum dibayar di kasir.
  static async pastikanSudahDibayar(order, jenis, faskesUuid, transaction) {
    const status = (await this.statusPembayaran([order], jenis, faskesUuid, transaction)).get(order.uuid);
    if (!status.boleh_diserahkan) {
      throw new BadRequestException(
        `${jenis === "resep" ? "Obat" : "Alkes"} belum dapat diserahkan: tagihan pasien belum dibayar di kasir` +
          (status.sisa ? ` (sisa Rp ${status.sisa.toLocaleString("id-ID")}).` : ".")
      );
    }
    return status;
  }

  // items: [{ item_name, qty, hpp, order_alkes_item_uuid }]; hapus = true menarik tagihan order (batal).
  // Hasil: { status: "terkirim" | "ditarik" | "oleh_penunjang" | "tanpa_kunjungan" | "tanpa_tagihan" }
  static async tagihOrderAlkes({ order, items = [], konfigurasiHarga, token, hapus = false }) {
    if (order.jenis_pelayanan === "ok" || (await TagihanRepository.dariPemakaianPenunjang(order.uuid))) {
      return { status: "oleh_penunjang" };
    }
    const ref = refOrderAlkes(order.uuid);
    const sudah = await TagihanRepository.statusTagihanRef(ref, order.faskes_uuid);
    if (hapus && !sudah) return { status: "tanpa_tagihan" };
    if (sudah?.tertutup) {
      throw new BadRequestException(
        `Tagihan alkes order ${order.no_order_alkes} sudah ditutup/dibayar di kasir; gunakan Retur Obat & Material.`
      );
    }
    const kunjungan = await TagihanRepository.cariKunjungan(order.no_reg, order.faskes_uuid);
    if (!kunjungan) return { status: "tanpa_kunjungan" };

    await kirim({
      faskesUuid: order.faskes_uuid,
      kunjungan,
      ref,
      token,
      items: hapus
        ? []
        : items.map((i) => ({
            item_name: i.item_name,
            qty: Number(i.qty),
            price: hargaJual(i.hpp, konfigurasiHarga),
            category_code: KATEGORI_ALKES,
            additional_info: { order_alkes_uuid: order.uuid, order_alkes_item_uuid: i.order_alkes_item_uuid },
          })),
    });
    return { status: hapus ? "ditarik" : "terkirim" };
  }

  // Koreksi tagihan retur: baris negatif di tagihan kunjungan yang masih terbuka.
  // Hasil: { status: "terkirim" | "tagihan_tertutup" | "tanpa_kunjungan", pesan }
  static async koreksiRetur({ faskesUuid, noReg, returUuid, kategori, items, token }) {
    const kunjungan = await TagihanRepository.cariKunjungan(noReg, faskesUuid);
    if (!kunjungan) return { status: "tanpa_kunjungan", pesan: `Kunjungan ${noReg} tidak ditemukan; koreksi tagihan manual.` };
    const aktif = await TagihanRepository.tagihanAktifKunjungan(noReg, faskesUuid);
    if (!aktif) {
      return {
        status: "tagihan_tertutup",
        pesan: "Tagihan kunjungan sudah ditutup/dibayar; pengembalian dana dilakukan manual di kasir.",
      };
    }
    await kirim({
      faskesUuid,
      kunjungan,
      ref: `retur:${returUuid}`,
      token,
      items: items.map((i) => ({
        item_name: `Retur ${i.item_name}`,
        qty: Number(i.qty),
        // basis nilai retur = HPP (harga_satuan item yang diretur), sama dengan retur.total & laporan (keputusan pemilik)
        price: -Math.abs(Number(i.harga_satuan)),
        category_code: kategori,
        additional_info: { retur_uuid: returUuid },
      })),
    });
    return { status: "terkirim", pesan: null };
  }
}
