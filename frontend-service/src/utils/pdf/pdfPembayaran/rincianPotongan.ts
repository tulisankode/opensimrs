// Rincian potongan tagihan untuk cetakan kuitansi & tagihan. Rumus SAMA dengan payment-service
// (repositories/BillHelpers.js calculateBillTotals): dasar = subtotal + PPN + biaya admin → voucher dipotong lebih dulu
// (persentase dari dasar atau nominal) → diskon % dihitung dari sisa setelah voucher.
export interface RincianPotongan {
  subTotal: number;
  ppn: number;
  adminFee: number;
  voucher: { kode: string; label: string; nominal: number } | null;
  diskon: { persen: number; nominal: number } | null;
  grandTotal: number;
}

const angka = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const rp = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;

export function hitungRincianPotongan(bill: any): RincianPotongan {
  const subTotal = angka(bill?.subTotal ?? bill?.sub_total);
  const ppn = angka(bill?.ppn);
  const adminFee = angka(bill?.adminFee ?? bill?.admin_fee);
  let total = subTotal + ppn + adminFee;

  let voucher: RincianPotongan["voucher"] = null;
  const vTipe = bill?.voucherType ?? bill?.voucher_type;
  const vNilai = angka(bill?.voucherValue ?? bill?.voucher_value);
  if (vTipe && vNilai) {
    const nominal = vTipe === "persentase" ? total * (vNilai / 100) : vNilai;
    voucher = {
      kode: String(bill?.voucherCode ?? bill?.voucher_code ?? "").trim(),
      label: vTipe === "persentase" ? `${vNilai}%` : rp(vNilai),
      nominal: Math.min(nominal, total),
    };
    total -= voucher.nominal;
  }

  let diskon: RincianPotongan["diskon"] = null;
  const persen = angka(bill?.discount);
  if (persen > 0) {
    diskon = { persen, nominal: total * (persen / 100) };
    total -= diskon.nominal;
  }

  const grandTotal = angka(bill?.grandTotal ?? bill?.grand_total) || Math.max(total, 0);
  return { subTotal, ppn, adminFee, voucher, diskon, grandTotal };
}

// Baris tabel pdfmake [label, nilai] untuk rincian; kosong bila tidak ada potongan/biaya tambahan.
export function barisRincianPotongan(r: RincianPotongan, gaya: { margin?: number[] } = {}) {
  const m = gaya.margin ?? [5, 2];
  const baris: any[] = [[{ text: "Subtotal", margin: m }, { text: rp(r.subTotal), alignment: "right", margin: m }]];
  if (r.adminFee) baris.push([{ text: "Biaya Administrasi", margin: m }, { text: rp(r.adminFee), alignment: "right", margin: m }]);
  if (r.ppn) baris.push([{ text: "PPN", margin: m }, { text: rp(r.ppn), alignment: "right", margin: m }]);
  if (r.voucher) {
    baris.push([
      { text: `Voucher${r.voucher.kode ? ` (${r.voucher.kode})` : ""} ${r.voucher.label}`, margin: m },
      { text: `- ${rp(r.voucher.nominal)}`, alignment: "right", margin: m, color: "#B42318" },
    ]);
  }
  if (r.diskon) {
    baris.push([
      { text: `Diskon ${r.diskon.persen}%`, margin: m },
      { text: `- ${rp(r.diskon.nominal)}`, alignment: "right", margin: m, color: "#B42318" },
    ]);
  }
  baris.push([
    { text: "Total Tagihan", bold: true, margin: m, fillColor: "#EAECEF" },
    { text: rp(r.grandTotal), bold: true, alignment: "right", margin: m, fillColor: "#EAECEF" },
  ]);
  return baris;
}
