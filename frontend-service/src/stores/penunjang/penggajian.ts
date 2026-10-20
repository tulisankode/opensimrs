import { apiPenunjangGet, apiPenunjangPost, apiPenunjangPut } from "@/utils/apiHandler";
import { akunSuperadminTanpaDaftar, hasPermission } from "@/utils/permissions";

export const subGaji: Record<string, string> = { komponen: "Komponen Penggajian", konfigurasi: "Konfigurasi Penggajian", rekening: "Rekening Penggajian", periode: "Periode Penggajian", verifikasi: "Verifikasi Penggajian", persetujuan: "Persetujuan Penggajian", pembayaran: "Pembayaran Penggajian", rekap: "Rekap Penggajian", ekspor: "Ekspor Bank Penggajian", slip: "Slip Penggajian", administratif: "Slip Administratif Penggajian" };
export const izinGaji = (sub: string, aksi = "READ") => {
  return akunSuperadminTanpaDaftar() || hasPermission("HR / SDM", subGaji[sub] ?? sub, aksi, null);
};
export const halamanGaji = () => [
  ["periode", ["periode", "verifikasi", "persetujuan", "pembayaran", "administratif"]], ["slip", ["slip"]], ["komponen", ["komponen"]], ["konfigurasi", ["konfigurasi", "rekening"]], ["rekap", ["rekap", "ekspor"]],
].find(([, sub]) => (sub as string[]).some((s) => izinGaji(s)))?.[0] as string | undefined;
export const statusGaji: Record<string, string> = { draf: "Draf", verifikasi: "Verifikasi", menunggu_persetujuan: "Menunggu persetujuan", disetujui: "Disetujui", dibayar: "Dibayar" };
const basis = "/hr/penggajian";
export const bacaGaji = (path: string, params: Record<string, any> = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== "" && v != null) q.set(k.replace(/[A-Z]/g, (x) => `_${x.toLowerCase()}`), String(v)); });
  const s = q.toString();
  return apiPenunjangGet(`${basis}${path}${s ? `?${s}` : ""}`);
};
export const simpanGaji = (path: string, data: object, ubah = false) => ubah ? apiPenunjangPut(`${basis}${path}`, data) : apiPenunjangPost(`${basis}${path}`, data);
export const nominalGaji = (v: string | undefined) => {
  const s = String(v ?? "0.00"), negatif = s.startsWith("-");
  const [a, b = "00"] = s.replace("-", "").split(".");
  return `${negatif ? "-" : ""}Rp ${a.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${b.padEnd(2, "0")}`;
};
export const unduhGaji = (data: { isiBase64: string; tipe: string; nama: string }) => {
  const isi = Uint8Array.from(atob(data.isiBase64), (x) => x.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([isi], { type: data.tipe }));
  const a = document.createElement("a"); a.href = url; a.download = data.nama; a.click();
  URL.revokeObjectURL(url);
};

// ── Label tampilan. Nilai yang dikirim ke API tetap kode aslinya.
export const JENIS_KOMPONEN: Record<string, string> = { penghasilan: "Penghasilan", potongan: "Potongan", iuran_pemberi_kerja: "Iuran pemberi kerja" };
export const KATEGORI_KOMPONEN: Record<string, string> = { gaji_pokok: "Gaji pokok", tunjangan: "Tunjangan", potongan_lain: "Potongan lain", iuran: "Iuran", jaspel: "Jasa pelayanan", bpjs: "BPJS", pph21: "PPh 21" };
export const PAJAK_KOMPONEN: Record<string, string> = { kena_pajak: "Objek pajak (kena PPh 21)", bukan_objek: "Bukan objek pajak" };
export const STATUS_DATA_GAJI: Record<string, string> = { draf: "Draf", disahkan: "Disahkan", terverifikasi: "Terverifikasi", tercatat: "Tercatat", tertahan: "Tertahan", gagal: "Gagal", lengkap: "Lengkap", pengecualian: "Pengecualian" };
export const labelGaji = (kode?: string | null) => (kode ? statusGaji[kode] ?? STATUS_DATA_GAJI[kode] ?? JENIS_KOMPONEN[kode] ?? KATEGORI_KOMPONEN[kode] ?? kode.replaceAll("_", " ") : "-");
export const opsiGaji = (obj: Record<string, string>) => Object.entries(obj).map(([value, label]) => ({ value, label }));
const HIJAU = "bg-success-50 text-success-400", KUNING = "bg-warning-50 text-warning-400", MERAH = "bg-danger-50 text-danger-400", ABU = "bg-grey-75 text-grey-500", BIRU = "bg-info-50 text-info-400";
const WARNA_GAJI: Record<string, string> = { draf: ABU, verifikasi: BIRU, menunggu_persetujuan: KUNING, disetujui: BIRU, dibayar: HIJAU, disahkan: HIJAU, terverifikasi: HIJAU,
  tercatat: HIJAU, tertahan: KUNING, gagal: MERAH, lengkap: HIJAU, pengecualian: MERAH };
export const kelasLencanaGaji = (kode?: string | null) => `inline-block px-2 py-0.5 text-xs font-semibold rounded-full whitespace-nowrap ${WARNA_GAJI[kode ?? ""] ?? ABU}`;

const BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
export const OPSI_BULAN = BULAN.map((label, i) => ({ value: i + 1, label }));
export const periodeGaji = (tahun?: number | string, bulan?: number | string) => (tahun && bulan ? `${BULAN[Number(bulan) - 1] ?? bulan} ${tahun}` : "-");
// Tanggal kalender dipetakan ke pukul 00.00 WIB (sama dengan masukan lama "YYYY-MM-DDT00:00:00+07:00") agar masa berlaku
// tepat pada batas awal bulan yang dipakai backend.
export const epochHariGaji = (d?: Date | null) => (d ? Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), -7) / 1000 : null);
export const tanggalGaji = (e?: number | string | null) => {
  const n = Number(e);
  return n ? new Date(n * 1000).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }) : "-";
};
export const waktuGaji = (e?: number | string | null) => {
  const n = Number(e);
  return n ? new Date(n * 1000).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }) : "-";
};
export const masaGaji = (r: { berlakuMulai?: any; berlakuSampai?: any }) => `${tanggalGaji(r.berlakuMulai)} – ${r.berlakuSampai == null ? "seterusnya" : `sebelum ${tanggalGaji(r.berlakuSampai)}`}`;
// Respons penunjang dikonversi camelCase secara mendalam (termasuk isi aturan/kebijakan JSON). Untuk ditampilkan atau
// disunting sebagai JSON, kunci dikembalikan ke snake_case seperti yang disimpan backend; saat dikirim, instance
// penunjang mengonversi lagi ke snake_case sehingga hasilnya sama.
export const kunciSnake = (v: any): any => Array.isArray(v) ? v.map(kunciSnake)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k.replace(/[A-Z]/g, (h) => `_${h.toLowerCase()}`), kunciSnake(x)])) : v;
// Kunci berhuruf besar akan diubah diam-diam oleh konversi snake_case instance penunjang (mis. definisi "dasarBpjs" menjadi
// "dasar_bpjs" sementara rumus tetap merujuk "dasarBpjs"), jadi ditolak sebelum dikirim.
export const kunciBesar = (v: any): boolean => Array.isArray(v) ? v.some(kunciBesar)
  : !!v && typeof v === "object" && Object.entries(v).some(([k, x]) => /[A-Z]/.test(k) || kunciBesar(x));
export const jsonGaji = (v: any) => JSON.stringify(kunciSnake(v), null, 2);

// Sumber jasa pelayanan saat membuka periode gaji: periode Remunerasi disetujui & berjurnal, lewat referensi Penggajian
// (tidak memerlukan izin modul Akuntansi). dipakaiPeriodeUuid terisi bila sudah dipakai periode gaji lain.
export const bacaSumberJaspel = (params: Record<string, any> = {}) => bacaGaji("/referensi/remunerasi", params);
