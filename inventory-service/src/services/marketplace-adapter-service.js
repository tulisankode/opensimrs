import axios from "axios";
import InternalServerException from "../errors/internal-server-exception.js";
import { dekripsi } from "../helpers/rahasia-marketplace.js";

// Adapter REST generik untuk marketplace mitra (STD-0019). Belum ada mitra nyata yang ditentukan, jadi kontrak
// di bawah ini generik dan juga dipakai oleh server tiruan (scripts/marketplace-tiruan.mjs). mode_mock pada
// koneksi hanya menentukan base_url mengarah ke server tiruan atau mitra nyata; kode adapter sama untuk keduanya.
// Kontrak:
//   GET  {base_url}/produk?q=&limit=                      header x-api-key
//   POST {base_url}/pesanan                                header x-api-key, Idempotency-Key
//   GET  {base_url}/pesanan/:nomor_pesanan_mitra            header x-api-key
const TIMEOUT_MS = Number(process.env.MARKETPLACE_TIMEOUT_MS) || 10000;

// Error yang dilempar saat hasil checkout tidak pasti (timeout/jaringan): pesanan TIDAK boleh dianggap gagal
// maupun berhasil, dan harus bisa diulang dengan kunci idempotensi yang sama (KT-8/G7).
// Turunan InternalServerException agar error-middleware membalas pesan yang jelas (HTTP 504), bukan 500 generik.
export class MarketplaceTidakPastiException extends InternalServerException {
  constructor(message) {
    super(`Hasil checkout belum pasti: ${message}. Pesanan ditahan di Menunggu Konfirmasi; ulangi checkout (aman, idempoten).`);
    this.code = 504;
    this.tidakPasti = true;
  }
}

// Galat dari mitra (ditolak/tidak terjangkau) dibalas 502 — bukan galat internal SIMRS.
const galatMitra = (pesan) => {
  const galat = new InternalServerException(pesan);
  galat.code = 502;
  return galat;
};

// Pesan galat yang aman ditampilkan/dicatat: tidak pernah menyertakan api_key.
const pesanAman = (error) => {
  if (error.response) return `Mitra membalas HTTP ${error.response.status}: ${error.response.data?.message || "galat tidak diketahui"}`;
  if (error.code === "ECONNABORTED") return "Waktu tunggu ke marketplace mitra habis (timeout)";
  return "Tidak dapat menghubungi marketplace mitra";
};

export default class MarketplaceAdapterService {
  static _client(koneksi) {
    return axios.create({
      baseURL: koneksi.base_url,
      timeout: TIMEOUT_MS,
      headers: {
        "x-api-key": dekripsi(koneksi.api_key_enc) || "",
        "Content-Type": "application/json",
      },
    });
  }

  static async cariPenawaran(koneksi, { q, limit } = {}) {
    try {
      const res = await this._client(koneksi).get("/produk", { params: { q, limit } });
      const items = res.data?.payload?.items ?? res.data?.items ?? [];
      return items.map((i) => ({
        produk_mitra_id: String(i.produk_mitra_id ?? i.id ?? ""),
        nama: i.nama ?? i.name ?? "",
        kemasan: i.kemasan ?? null,
        harga: Number(i.harga ?? 0),
        stok: Number(i.stok ?? 0),
        estimasi_kirim: i.estimasi_kirim ?? null,
        mitra: koneksi.nama_mitra,
        diambil_pada: Math.floor(Date.now() / 1000),
      }));
    } catch (error) {
      console.error("[MarketplaceAdapterService] Gagal mencari penawaran:", pesanAman(error));
      throw galatMitra(pesanAman(error));
    }
  }

  // Checkout idempoten: idempotencyKey = nomor_internal pesanan. Pada hasil tidak pasti (timeout/jaringan),
  // lempar MarketplaceTidakPastiException agar status pesanan tidak diubah seolah berhasil/gagal (KT-8/G7).
  static async checkout(koneksi, { idempotencyKey, items, catatan }) {
    try {
      const res = await this._client(koneksi).post(
        "/pesanan",
        {
          items: items.map((i) => ({ produk_mitra_id: i.produk_mitra_id, jumlah: i.jumlah, harga_satuan: i.harga_satuan })),
          catatan,
        },
        { headers: { "Idempotency-Key": idempotencyKey } }
      );
      const payload = res.data?.payload ?? res.data ?? {};
      return {
        nomor_pesanan_mitra: payload.nomor_pesanan_mitra ?? payload.order_id ?? null,
        status: payload.status ?? "menunggu_konfirmasi",
        tagihan: payload.tagihan ?? null,
      };
    } catch (error) {
      if (!error.response || error.code === "ECONNABORTED" || error.response.status >= 500) {
        throw new MarketplaceTidakPastiException(pesanAman(error));
      }
      console.error("[MarketplaceAdapterService] Checkout ditolak mitra:", pesanAman(error));
      throw galatMitra(pesanAman(error));
    }
  }

  static async cekStatus(koneksi, nomorPesananMitra) {
    try {
      const res = await this._client(koneksi).get(`/pesanan/${encodeURIComponent(nomorPesananMitra)}`);
      const payload = res.data?.payload ?? res.data ?? {};
      return { status: payload.status ?? null, tagihan: payload.tagihan ?? null };
    } catch (error) {
      console.error("[MarketplaceAdapterService] Gagal menarik status:", pesanAman(error));
      throw galatMitra(pesanAman(error));
    }
  }

  // Normalisasi status mitra -> status lokal yang didukung (KF-11). Status asing dianggap tidak dikenal
  // (dikembalikan null) alih-alih dikarang menjadi status tertentu (KT-10).
  static petakanStatus(statusMitra) {
    const peta = {
      menunggu: "menunggu_konfirmasi",
      menunggu_konfirmasi: "menunggu_konfirmasi",
      pending: "menunggu_konfirmasi",
      dibayar: "dibayar",
      paid: "dibayar",
      dikemas: "dikemas",
      packed: "dikemas",
      dikirim: "dikirim",
      shipped: "dikirim",
      diterima_sebagian: "diterima_sebagian",
      diterima: "diterima",
      delivered: "diterima",
      dibatalkan: "dibatalkan",
      cancelled: "dibatalkan",
      batal: "dibatalkan",
    };
    const kode = String(statusMitra ?? "").trim().toLowerCase();
    return peta[kode] ?? null;
  }
}
