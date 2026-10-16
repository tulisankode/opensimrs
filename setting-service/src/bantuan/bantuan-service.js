// Helpdesk asisten pengguna: pertanyaan cara pakai OpenSIMRS diteruskan ke agen OpenClaw lewat endpoint kompatibel
// OpenAI di Gateway (POST /v1/chat/completions). Rancangan: docs/rancangan/HELPDESK-OPENCLAW.md.
// Token Gateway memberi akses operator penuh → hanya disimpan di .env layanan ini, tidak pernah dikirim ke peramban.
import crypto from "crypto";
import { QueryTypes } from "sequelize";
import moment from "moment";
import sequelizeInstance from "../configurations/sequelize-instance.js";
import BadRequestException from "../errors/bad-request-exception.js";
import ModulService, { isSuperadmin } from "../services/modul-service.js";
import { samarkanDataPribadi } from "./saring.js";

const FITUR = "helpdesk_ai";
const RETENSI_DETIK = 90 * 86400;
const PANJANG_MAKS = 2000;

const konfigurasi = () => ({
  url: (process.env.HELPDESK_GATEWAY_URL || "").replace(/\/$/, ""),
  token: process.env.HELPDESK_GATEWAY_TOKEN || "",
  agen: process.env.HELPDESK_AGEN || "helpdesk-opensimrs",
  batasPerJam: Number(process.env.HELPDESK_BATAS_PER_JAM) || 20,
  timeoutMs: (Number(process.env.HELPDESK_TIMEOUT_DETIK) || 120) * 1000,
});

class TerlaluBanyak extends BadRequestException {
  constructor(message) {
    super(message);
    this.status = 429;
  }
}

const hashPengguna = (author) => crypto.createHash("sha256").update(`${author.faskesUuid}:${author.username}`).digest("hex").slice(0, 32);

// Batas laju per pengguna (memori proses; cukup untuk satu instance setting-service).
const riwayatLaju = new Map();
const periksaLaju = (kunci, batas) => {
  const satuJam = Date.now() - 3600_000;
  const daftar = (riwayatLaju.get(kunci) ?? []).filter((t) => t > satuJam);
  if (daftar.length >= batas) throw new TerlaluBanyak(`Batas ${batas} pertanyaan per jam tercapai. Coba lagi nanti atau hubungi tim IT.`);
  daftar.push(Date.now());
  riwayatLaju.set(kunci, daftar);
};

const ATURAN = `Anda adalah asisten Bantuan OpenSIMRS untuk petugas fasilitas kesehatan.
- Jawab dalam Bahasa Indonesia yang singkat dan jelas, hanya tentang cara memakai aplikasi OpenSIMRS.
- Jawab berdasarkan panduan pengguna di workspace Anda. Sebutkan nama menu/tombol persis dan rujuk bagian panduan yang dipakai.
- Bila panduan tidak memuat jawabannya, katakan Anda belum tahu dan sarankan menghubungi tim IT faskes. Jangan mengarang langkah.
- Anda tidak bisa melihat data pasien, transaksi, maupun database. Tolak pertanyaan tentang pasien tertentu.
- Jangan memberi saran klinis (diagnosis, dosis, terapi, interpretasi hasil).
- Teks [NIK], [HP], [EMAIL], [NO-RM], [NO-KARTU] adalah data yang sudah disamarkan; jangan memintanya kembali.`;

// Konteks faskes & pengguna untuk jawaban yang sesuai (mis. "menu Rawat Inap belum aktif untuk faskes Anda").
const susunKonteks = (author, modul, halaman) => {
  const aktif = modul.katalog.filter((m) => m.aktif && m.tersedia).map((m) => m.nama);
  const nonaktif = modul.katalog.filter((m) => !m.aktif && m.tersedia).map((m) => m.nama);
  return [
    ATURAN,
    "",
    "Konteks pengguna saat ini:",
    `- Peran: ${author.role ?? "-"}`,
    `- Segmen faskes: ${modul.segmen ?? "belum diatur"}`,
    `- Modul aktif: ${aktif.join(", ") || "-"}`,
    `- Modul tidak aktif di faskes ini: ${nonaktif.join(", ") || "-"}`,
    `- Halaman yang sedang dibuka: ${halaman || "-"}`,
  ].join("\n");
};

export default class BantuanService {
  static async status(author) {
    const k = konfigurasi();
    if (!k.url || !k.token) return { aktif: false, alasan: "Helpdesk belum dikonfigurasi (HELPDESK_GATEWAY_URL/HELPDESK_GATEWAY_TOKEN)" };
    const modul = await ModulService.ambil(author);
    if (!modul.fitur_aktif.includes(FITUR)) return { aktif: false, alasan: "Fitur Asisten Bantuan tidak aktif untuk faskes ini (Setting › Manajemen Modul)" };
    return { aktif: true, batasPerJam: k.batasPerJam };
  }

  /**
   * Kirim pertanyaan dan alirkan jawaban ke `kirim(potongan)`. Mengembalikan { jawaban, disamarkan }.
   * body: { pertanyaan, halaman, sesi } — sesi = id percakapan dari peramban ("Percakapan baru" mengganti nilainya).
   */
  static async tanya(author, body, kirim, signal) {
    const k = konfigurasi();
    const status = await this.status(author);
    if (!status.aktif) throw new BadRequestException(status.alasan);
    const mentah = String(body?.pertanyaan ?? "").trim();
    if (!mentah) throw new BadRequestException("Pertanyaan wajib diisi");
    if (mentah.length > PANJANG_MAKS) throw new BadRequestException(`Pertanyaan maksimal ${PANJANG_MAKS} karakter`);
    const halaman = String(body?.halaman ?? "").slice(0, 255);
    const sesi = String(body?.sesi ?? "").replace(/[^\w-]/g, "").slice(0, 40);
    const pengguna = hashPengguna(author);
    periksaLaju(pengguna, k.batasPerJam);

    const { teks: pertanyaan, disamarkan } = samarkanDataPribadi(mentah);
    const modul = await ModulService.ambil(author);
    const mulai = Date.now();
    let jawaban = "";
    let galat = null;
    try {
      const batas = AbortSignal.timeout(k.timeoutMs);
      const res = await fetch(`${k.url}/v1/chat/completions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${k.token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `openclaw/${k.agen}`,
          // Sesi Gateway per pengguna (hash, bukan nama) dan per percakapan.
          user: `${pengguna}${sesi ? `-${sesi}` : ""}`,
          stream: true,
          messages: [
            { role: "system", content: susunKonteks(author, modul, halaman) },
            { role: "user", content: pertanyaan },
          ],
        }),
        signal: signal ? AbortSignal.any([signal, batas]) : batas,
      });
      if (!res.ok) {
        const isi = (await res.text().catch(() => "")).slice(0, 300);
        throw new Error(res.status === 401 ? "Token Gateway helpdesk ditolak" : `Gateway helpdesk membalas ${res.status} ${isi}`);
      }
      // Server-sent events: data: {choices:[{delta:{content}}]} … data: [DONE]
      const pembaca = res.body.getReader();
      const dekoder = new TextDecoder();
      let sisa = "";
      for (;;) {
        const { value, done } = await pembaca.read();
        if (done) break;
        sisa += dekoder.decode(value, { stream: true });
        const baris = sisa.split("\n");
        sisa = baris.pop();
        for (const b of baris) {
          const data = b.startsWith("data:") ? b.slice(5).trim() : "";
          if (!data || data === "[DONE]") continue;
          let e;
          try {
            e = JSON.parse(data);
          } catch {
            continue;
          }
          if (e.error) throw new Error(e.error.message ?? "Asisten gagal menjawab");
          const potongan = e.choices?.[0]?.delta?.content ?? "";
          if (potongan) {
            jawaban += potongan;
            kirim(potongan);
          }
        }
      }
      if (!jawaban.trim()) throw new Error("Asisten tidak memberi jawaban");
      return { jawaban, disamarkan };
    } catch (e) {
      galat = e.name === "TimeoutError" ? "Asisten terlalu lama menjawab" : e.message;
      throw new BadRequestException(`${galat}. Coba lagi atau hubungi tim IT.`);
    } finally {
      const sekarang = moment().unix();
      await sequelizeInstance.query(
        `INSERT INTO bantuan_log (faskes_uuid, pengguna_hash, halaman, pertanyaan, jawaban, disamarkan, durasi_ms, galat, created_at)
         VALUES (:f, :p, :h, :q, :j, :d, :ms, :g, :t)`,
        { replacements: { f: author.faskesUuid, p: pengguna, h: halaman || null, q: pertanyaan, j: jawaban || null, d: disamarkan, ms: Date.now() - mulai, g: galat, t: sekarang } },
      ).catch(() => {});
      await sequelizeInstance.query(`DELETE FROM bantuan_log WHERE created_at < :batas`, { replacements: { batas: sekarang - RETENSI_DETIK } }).catch(() => {});
    }
  }

  // Ringkasan 30 hari untuk superadmin: jumlah, halaman tersering, pertanyaan gagal/tak terjawab terbaru.
  static async ringkasan(author) {
    if (!isSuperadmin(author)) {
      const e = new BadRequestException("Hanya superadmin yang dapat melihat ringkasan Helpdesk");
      e.status = 403;
      throw e;
    }
    const sejak = moment().unix() - 30 * 86400;
    const pilih = (sql) => sequelizeInstance.query(sql, { replacements: { f: author.faskesUuid, s: sejak }, type: QueryTypes.SELECT });
    const [[total], halaman, perluPerhatian] = await Promise.all([
      pilih(`SELECT COUNT(*)::int AS pertanyaan, COUNT(DISTINCT pengguna_hash)::int AS pengguna, COUNT(*) FILTER (WHERE galat IS NOT NULL)::int AS gagal,
                    COALESCE(SUM(disamarkan), 0)::int AS disamarkan, COALESCE(AVG(durasi_ms), 0)::int AS rata_durasi_ms
               FROM bantuan_log WHERE faskes_uuid = :f AND created_at >= :s`),
      pilih(`SELECT COALESCE(halaman, '-') AS halaman, COUNT(*)::int AS jumlah FROM bantuan_log
              WHERE faskes_uuid = :f AND created_at >= :s GROUP BY 1 ORDER BY 2 DESC LIMIT 10`),
      pilih(`SELECT pertanyaan, LEFT(COALESCE(jawaban, ''), 300) AS jawaban, galat, halaman, created_at FROM bantuan_log
              WHERE faskes_uuid = :f AND created_at >= :s
                AND (galat IS NOT NULL OR jawaban ILIKE '%belum tahu%' OR jawaban ILIKE '%hubungi tim IT%')
              ORDER BY created_at DESC LIMIT 50`),
    ]);
    return { total, halaman, perlu_perhatian: perluPerhatian };
  }
}
