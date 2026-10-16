// Ekstensi tanpa kode (rancangan §7.8, fase 2): laporan (SELECT tervalidasi), template cetak, formulir tambahan.
// Studio merakit definisinya dengan agen AI & menyimpannya di tabel `ekstensi`; validasi, pratinjau, pemasangan, dan
// runtime berada di laporan-service (berjalan juga di produksi). Paket ekspor ditandatangani Ed25519.
import crypto from "node:crypto";
import config from "./config.js";
import { audit, query, satu, sekarang, sisipkan, ubah } from "./db.js";
import { Galat, permintaanSalah, tidakDitemukan } from "./respons.js";
import { bacaSemua, simpan } from "./pengaturan.js";
import { dekripsi, enkripsi } from "./rahasia.js";
import { jalankanAgen, periksaBatas } from "./agen/index.js";
import { susunPromptEkstensi, uraiKeluaran } from "./agen/prompt.js";
import { temukanDataPribadi } from "./kebijakan.js";

// Bentuk kanonik untuk tanda tangan (urutan kunci stabil) — sama persis dengan laporan-service/src/ekstensi/ekstensi-routes.js.
export const kanonik = (v) =>
  Array.isArray(v) ? `[${v.map(kanonik).join(",")}]` : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${kanonik(v[k])}`).join(",")}}` : JSON.stringify(v ?? null);

// Panggil runtime ekstensi di laporan-service dengan token pengguna (superadmin).
const laporan = async (token, metode, url, body) => {
  const r = await fetch(`${config.laporanUrl}${url}`, { method: metode, headers: { Authorization: token, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Galat(r.status === 401 ? 401 : r.status >= 500 ? 502 : r.status, `laporan-service: ${json.message ?? r.status}`);
  return json.payload;
};

const pastikanFitur = async () => {
  if ((await bacaSemua()).nilai.fitur?.ekstensi === false) throw new Galat(403, "Fitur Ekstensi belum diaktifkan superadmin (Pengaturan & Agen › Fitur Studio)");
};

const bentuk = (e) => ({ kode: e.kode, jenis: e.jenis, nama: e.nama, deskripsi: e.deskripsi ?? null, versi: e.versi ?? "1.0.0", definisi: e.definisi });

export const daftar = () => query(`SELECT * FROM ekstensi WHERE deleted_at IS NULL ORDER BY updated_at DESC`);

const ambil = async (uuid) => {
  const e = await satu(`SELECT * FROM ekstensi WHERE uuid = $1 AND deleted_at IS NULL`, [uuid]);
  if (!e) throw tidakDitemukan("Ekstensi");
  return e;
};

const naikVersi = (v = "1.0.0") => {
  const [a, b, c] = String(v).split(".").map((x) => Number(x) || 0);
  return `${a}.${b}.${c + 1}`;
};

// Simpan/ganti draf berdasarkan kode. Ekstensi terpasang yang diubah kembali menjadi draf (pasang ulang setelah dicek).
const simpanDraf = async (e, oleh, itemUuid = null) => {
  const lama = await satu(`SELECT * FROM ekstensi WHERE kode = $1 AND deleted_at IS NULL`, [e.kode]);
  if (lama) {
    const versi = e.versi && e.versi !== lama.versi ? e.versi : naikVersi(lama.versi);
    return ubah("ekstensi", lama.uuid, { jenis: e.jenis, nama: e.nama, deskripsi: e.deskripsi ?? null, versi, definisi: e.definisi, status: "draf", sumber: "lokal", tanda_tangan: null });
  }
  return sisipkan("ekstensi", { kode: e.kode, jenis: e.jenis, nama: e.nama, deskripsi: e.deskripsi ?? null, versi: e.versi || "1.0.0", definisi: e.definisi, status: "draf", sumber: "lokal", item_uuid: itemUuid, dibuat_oleh: oleh, updated_at: sekarang() });
};

export const simpanManual = async (ekstensi, token, oleh) => {
  await pastikanFitur();
  const { galat } = await laporan(token, "POST", "/ekstensi/validasi", { ekstensi });
  if (galat.length) throw permintaanSalah(galat.join("; "));
  const e = await simpanDraf(ekstensi, oleh);
  await audit(oleh, `Menyimpan ekstensi ${e.kode} ${e.versi}`);
  return e;
};

// Rakit dengan agen AI (asinkron). Bila validator menolak, galat dikembalikan ke agen (maks. 2 putaran perbaikan).
export const rakitDenganAgen = async ({ permintaan, uuid }, token, oleh) => {
  await pastikanFitur();
  if (!permintaan?.trim()) throw permintaanSalah("Tuliskan ekstensi yang dibutuhkan");
  const pribadi = temukanDataPribadi(permintaan);
  if (pribadi.length) throw permintaanSalah(`Permintaan memuat data pribadi (${pribadi[0]}); gunakan data fiktif`);
  await periksaBatas(null, oleh);
  const lama = uuid ? await ambil(uuid) : null;
  const tugas = await sisipkan("studio_tugas", { tahap: "ekstensi", jenis: "dokumen", status: "antri", instruksi: permintaan, dibuat_oleh: oleh, updated_at: sekarang() });

  (async () => {
    const log = (jenis, teks) => query(`INSERT INTO studio_tugas_log (tugas_uuid, jenis, teks, waktu) VALUES ($1, $2, $3, $4)`, [tugas.uuid, jenis, String(teks).slice(0, 8000), sekarang()]);
    try {
      const { nilai } = await bacaSemua();
      const pengetahuan = (await query(`SELECT judul, isi FROM studio_pengetahuan WHERE deleted_at IS NULL AND aktif ORDER BY judul`)).map((p) => `### ${p.judul}\n${p.isi}`).join("\n\n");
      let galatValidasi = [];
      let hasilAkhir = null;
      for (let putaran = 0; putaran < 3; putaran++) {
        const prompt = susunPromptEkstensi({ permintaan, definisiLama: hasilAkhir ?? (lama ? bentuk(lama) : null), galatValidasi, aturanInstalasi: nilai.aturan_instalasi, pengetahuan });
        const { hasil } = await jalankanAgen({ tugasUuid: tugas.uuid, prompt, mode: "dokumen", tahap: "ekstensi" });
        const k = uraiKeluaran(hasil);
        if (!k.ekstensi) {
          galatValidasi = ["Jawaban tidak memuat JSON di antara <ekstensi> dan </ekstensi>"];
          await log("galat", galatValidasi[0]);
          continue;
        }
        hasilAkhir = { ...k.ekstensi, kode: lama?.kode ?? k.ekstensi.kode };
        ({ galat: galatValidasi } = await laporan(token, "POST", "/ekstensi/validasi", { ekstensi: hasilAkhir }));
        if (!galatValidasi.length) {
          const e = await simpanDraf(hasilAkhir, oleh);
          await log("hasil", `✔ Ekstensi ${e.nama} (${e.kode} ${e.versi}) tersimpan sebagai draf. ${k.catatan ?? ""}`);
          await ubah("studio_tugas", tugas.uuid, { status: "selesai", hasil: JSON.stringify({ uuid: e.uuid, penjelasan: k.artefak }), selesai: sekarang(), pesan_galat: null });
          await audit("agen", `Merakit ekstensi ${e.kode} ${e.versi}`);
          return;
        }
        await log("galat", `Validasi gagal (putaran ${putaran + 1}): ${galatValidasi.join("; ")}`);
      }
      throw new Error(`Definisi masih belum valid: ${galatValidasi.join("; ")}`);
    } catch (e) {
      const t = await satu(`SELECT status FROM studio_tugas WHERE uuid = $1`, [tugas.uuid]);
      if (t?.status !== "dibatalkan") await ubah("studio_tugas", tugas.uuid, { status: "gagal", pesan_galat: e.message, selesai: sekarang() });
    }
  })();
  return tugas;
};

export const pratinjau = async (uuid, parameter, token) => {
  const e = await ambil(uuid);
  return laporan(token, "POST", "/ekstensi/pratinjau", { ekstensi: bentuk(e), parameter: parameter ?? {} });
};

export const pasang = async (uuid, faskes, token, oleh) => {
  await pastikanFitur();
  const e = await ambil(uuid);
  await laporan(token, "PUT", `/ekstensi/${uuid}/pasang`, { faskes: faskes ?? null });
  await audit(oleh, `Memasang ekstensi ${e.kode} ${e.versi}`);
  return ambil(uuid);
};

export const copot = async (uuid, token, oleh) => {
  const e = await ambil(uuid);
  await laporan(token, "PUT", `/ekstensi/${uuid}/copot`, {});
  await audit(oleh, `Mencopot ekstensi ${e.kode}`);
  return ambil(uuid);
};

export const hapus = async (uuid, oleh) => {
  const e = await ambil(uuid);
  if (e.status === "terpasang") throw permintaanSalah("Copot ekstensi dulu sebelum menghapus");
  await query(`UPDATE ekstensi SET deleted_at = $2, updated_at = $2 WHERE uuid = $1`, [uuid, sekarang()]);
  await audit(oleh, `Menghapus ekstensi ${e.kode}`);
};

// ---------- Penanda tangan paket (Ed25519) ----------

export const kunciPenandaTangan = async (oleh, buatBaru = false) => {
  const { nilai } = await bacaSemua();
  if (nilai.ekstensi_kunci_privat && !buatBaru) return nilai.ekstensi_kunci_publik;
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publik = publicKey.export({ type: "spki", format: "der" }).toString("base64");
  await simpan("ekstensi_kunci_privat", enkripsi(privateKey.export({ type: "pkcs8", format: "pem" })), oleh);
  await simpan("ekstensi_kunci_publik", publik, oleh);
  await audit(oleh, "Membuat kunci penanda tangan ekstensi");
  return publik;
};

export const eksporPaket = async (uuid, oleh) => {
  const e = await ambil(uuid);
  await kunciPenandaTangan(oleh);
  const { nilai } = await bacaSemua();
  const privat = crypto.createPrivateKey(dekripsi(nilai.ekstensi_kunci_privat));
  const isi = bentuk(e);
  const tandaTangan = crypto.sign(null, Buffer.from(kanonik(isi)), privat).toString("base64");
  await ubah("ekstensi", uuid, { tanda_tangan: tandaTangan });
  await audit(oleh, `Mengekspor paket ekstensi ${e.kode} ${e.versi}`);
  return { format: "opensimrs-ekstensi", versi_format: 1, ekstensi: isi, tanda_tangan: tandaTangan, kunci_publik: nilai.ekstensi_kunci_publik, dibuat_pada: sekarang(), dibuat_oleh: oleh };
};
