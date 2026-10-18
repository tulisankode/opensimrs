// Validasi badan permintaan WS Antrean. Tanpa dependensi tambahan (bpjs-service belum memakai zod) — pola sama
// dengan validasi manual yang sudah ada di modul BPJS lain (pcare.js/vclaim.js).

export class ValidasiGagal extends Error {
  status = 422;
}

const wajib = (body, field) => {
  const v = body?.[field];
  if (v === undefined || v === null || String(v).trim() === "") throw new ValidasiGagal(`${field} wajib diisi`);
  return String(v).trim();
};

const tanggal = (body, field) => {
  const v = wajib(body, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) throw new ValidasiGagal(`${field} harus berformat yyyy-mm-dd`);
  return v;
};

export const validasiStatusAntrean = (body) => ({
  kodepoli: wajib(body, "kodepoli"),
  kodedokter: body?.kodedokter ? String(body.kodedokter).trim() : null,
  tanggalperiksa: tanggal(body, "tanggalperiksa"),
});

export const validasiAmbilAntrean = (body) => {
  const nomorkartu = body?.nomorkartu ? String(body.nomorkartu).trim() : "";
  const nik = body?.nik ? String(body.nik).trim() : "";
  if (!nomorkartu && !nik) throw new ValidasiGagal("nomorkartu atau nik wajib diisi");
  return {
    nomorkartu: nomorkartu || null,
    nik: nik || null,
    nohp: body?.nohp ? String(body.nohp).trim() : null,
    norm: body?.norm ? String(body.norm).trim() : null,
    kodepoli: wajib(body, "kodepoli"),
    kodedokter: body?.kodedokter ? String(body.kodedokter).trim() : null,
    tanggalperiksa: tanggal(body, "tanggalperiksa"),
    jampraktek: body?.jampraktek ? String(body.jampraktek).trim() : null,
    pasienbaru: body?.pasienbaru === "1" || body?.pasienbaru === 1 || body?.pasienbaru === true,
    nomorreferensi: body?.nomorreferensi ? String(body.nomorreferensi).trim() : null,
    keluhan: body?.keluhan ? String(body.keluhan).trim().slice(0, 255) : "",
  };
};

export const validasiBatalAntrean = (body) => ({
  kodebooking: wajib(body, "kodebooking"),
  keterangan: body?.keterangan ? String(body.keterangan).trim().slice(0, 255) : "Dibatalkan oleh peserta (Mobile JKN)",
});

export const validasiCheckIn = (body) => ({
  kodebooking: wajib(body, "kodebooking"),
});

export const validasiSisaAntrean = (body) => {
  if (body?.kodebooking) return { kodebooking: String(body.kodebooking).trim() };
  return validasiStatusAntrean(body);
};

export const validasiPasienBaru = (body) => {
  const nik = body?.nik ? String(body.nik).trim() : "";
  if (!nik) throw new ValidasiGagal("nik wajib diisi");
  return { nik };
};
