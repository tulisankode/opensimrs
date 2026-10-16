// Gerbang persetujuan per tahap & tingkat risiko (rancangan §6.2 & §8).
// Setiap gerbang = satu peran yang wajib menyetujui. Tahap berpindah setelah SEMUA gerbang menyetujui artefak terbaru.

export const PERAN = {
  pengusul: { label: "Pengusul", izin: ["Permintaan", "SETUJUI USECASE"] },
  product: { label: "Product", izin: ["PRD", "SETUJUI"] },
  triase: { label: "Product (triase)", izin: ["Permintaan", "TRIASE"] },
  klinis: { label: "Reviewer klinis", izin: ["Review Klinis", "SETUJUI"] },
  programmer: { label: "Programmer", izin: ["Desain", "SETUJUI"] },
  reviewer: { label: "Reviewer kode", izin: ["Coding", "REVIEW"] },
  qa: { label: "QA", izin: ["QA", "LULUS"] },
  rilis: { label: "Maintainer rilis", izin: ["Rilis", "SIAPKAN"] },
  maintainer: { label: "Core maintainer (superadmin)", izin: null }, // hanya superadmin
};

const tinggi = (risiko) => ["tinggi", "kritis"].includes(risiko);

export const gerbangTahap = (tahap, risiko) => {
  switch (tahap) {
    case "permintaan":
      return ["triase"];
    case "usecase":
      return ["pengusul"];
    case "prd":
      return ["product", ...(tinggi(risiko) ? ["klinis"] : []), ...(risiko === "kritis" ? ["maintainer"] : [])];
    case "desain":
      return ["programmer", ...(risiko === "kritis" ? ["maintainer"] : [])];
    case "coding":
      return ["reviewer", ...(risiko === "kritis" ? ["maintainer"] : [])];
    case "qa":
      return ["qa", ...(tinggi(risiko) ? ["klinis"] : [])];
    case "rilis":
      return ["rilis"];
    default:
      return [];
  }
};

// Izin submodul untuk aksi non-gerbang per tahap (diskusi, AI tulis ulang, sunting dokumen).
export const IZIN_KERJA_TAHAP = {
  permintaan: ["Permintaan", "UPDATE"],
  usecase: ["Permintaan", "UPDATE"],
  prd: ["PRD", "UPDATE"],
  desain: ["Desain", "UPDATE"],
  coding: ["Coding", "JALANKAN AGEN"],
  qa: ["QA", "UPDATE"],
  rilis: ["Rilis", "SIAPKAN"],
};

// Status gerbang: persetujuan "setuju" yang dibuat setelah tahap dimulai DAN setelah artefak terbaru tahap itu.
// persetujuan: baris studio_persetujuan tahap ini; sejak: epoch terendah yang dihitung.
export const statusGerbang = (tahap, risiko, persetujuan, sejak) => {
  const sah = persetujuan.filter((p) => p.tahap === tahap && p.keputusan === "setuju" && Number(p.created_at) >= Number(sejak || 0));
  return gerbangTahap(tahap, risiko).map((kode) => {
    const p = sah.filter((x) => x.peran === kode).at(-1);
    return { kode, label: PERAN[kode].label, disetujui: Boolean(p), oleh: p?.pengguna ?? null, pada: p ? Number(p.created_at) : null };
  });
};
