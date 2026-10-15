import { computed, onMounted, ref } from "vue";
import * as XLSX from "xlsx-js-style";
import { useLaporanRekapStore, type JenisRekap } from "@/stores/laporanRekap";

export const JENIS_KUNJUNGAN: Record<string, string> = {
  rawat_jalan: "Rawat Jalan",
  rawat_inap: "Rawat Inap",
  igd: "IGD",
  aps: "APS",
};
export const METODE_BAYAR: Record<string, string> = { tunai: "Tunai", asuransi: "Asuransi" };

// Opsi filter (optionValue "uuid" / optionLabel "name" mengikuti HeaderFilter)
export const OPSI_JENIS_KUNJUNGAN = [
  { uuid: "rawat_jalan", name: "Rawat Jalan" },
  { uuid: "rawat_inap", name: "Rawat Inap" },
  { uuid: "igd", name: "IGD" },
];
export const OPSI_METODE_BAYAR = [
  { uuid: "1", name: "Tunai" },
  { uuid: "2", name: "Asuransi" },
];

// Default periode laporan: 30 hari terakhir (sama dengan HeaderFilter)
export const defaultStartDate = () => new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);

const toParam = (date?: Date | null) => {
  if (!date) return undefined;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
const toTanggal = (date?: Date | null) => (date ? toParam(date)!.split("-").reverse().join("-") : "-");

export interface KolomExport {
  header: string;
  value: (row: any) => string | number;
}

// olahSemua: bila diisi, semua data diambil sekaligus (endpoint export), diolah (mis. pivot) lalu dipaginasi di browser
export function useRekapLaporan(jenis: JenisRekap, judul: string, olahSemua?: (data: any[]) => any[]) {
  const store = useLaporanRekapStore();

  const serverRows = ref<any[]>([]);
  const allRows = ref<any[]>([]);
  const serverTotal = ref(0);
  const pageSize = ref(10);
  const offset = ref(0);
  const loading = ref(false);

  const search = ref("");
  const jenisKunjungan = ref("");
  const filterKedua = ref(""); // metode bayar (kunjungan/tindakan/lab) atau jenis kelamin (diagnosis)
  const startDate = ref<Date>(defaultStartDate());
  const endDate = ref<Date>(new Date());

  const params = (extra: Record<string, unknown> = {}) => ({
    name: search.value || undefined,
    type: jenisKunjungan.value || undefined,
    ...(jenis === "diagnosis"
      ? { gender: filterKedua.value || undefined }
      : { payment_method: filterKedua.value || undefined }),
    startDate: toParam(startDate.value),
    endDate: toParam(endDate.value),
    ...extra,
  });

  const rows = computed(() =>
    olahSemua ? allRows.value.slice(offset.value, offset.value + pageSize.value) : serverRows.value
  );
  const totalRecords = computed(() => (olahSemua ? allRows.value.length : serverTotal.value));

  const fetchData = async () => {
    if (startDate.value && endDate.value && endDate.value < startDate.value) return;
    loading.value = true;
    try {
      if (olahSemua) {
        const res = await store.exportRekap(jenis, params());
        allRows.value = olahSemua(res?.payload ?? []);
      } else {
        const res = await store.getRekap(jenis, params({ limit: pageSize.value, offset: offset.value }));
        serverRows.value = res?.payload ?? [];
        serverTotal.value = Number(res?.properties?.total ?? 0);
      }
    } finally {
      loading.value = false;
    }
  };

  const cari = () => {
    offset.value = 0;
    fetchData();
  };

  const onPage = (event: { first: number; rows: number }) => {
    offset.value = event.first;
    pageSize.value = event.rows;
    if (!olahSemua) fetchData();
  };

  const resetFilter = (headerRef?: { resetForm?: () => void }) => {
    search.value = "";
    jenisKunjungan.value = "";
    filterKedua.value = "";
    startDate.value = defaultStartDate();
    endDate.value = new Date();
    headerRef?.resetForm?.();
    cari();
  };

  const exportExcel = async (kolom: KolomExport[]) => {
    const res = await store.exportRekap(jenis, params());
    const data = olahSemua ? olahSemua(res?.payload ?? []) : res?.payload ?? [];
    const faskes = (() => {
      try {
        return JSON.parse(localStorage.getItem("faskes_profile") ?? "{}");
      } catch {
        return {};
      }
    })();

    const aoa: (string | number)[][] = [
      [judul.toUpperCase()],
      [faskes?.name ?? ""],
      [`Periode: ${toTanggal(startDate.value)} s.d. ${toTanggal(endDate.value)}`],
      [],
      ["No", ...kolom.map((k) => k.header)],
      ...data.map((row, i) => [i + 1, ...kolom.map((k) => k.value(row))]),
    ];
    const sheet = XLSX.utils.aoa_to_sheet(aoa);
    sheet["!cols"] = [{ wch: 5 }, ...kolom.map(() => ({ wch: 22 }))];
    const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
    for (let c = range.s.c; c <= range.e.c; c++) {
      const header = sheet[XLSX.utils.encode_cell({ r: 4, c })];
      if (header) header.s = { font: { bold: true }, fill: { fgColor: { rgb: "D9F2EF" } }, alignment: { horizontal: "center" } };
    }
    if (sheet.A1) sheet.A1.s = { font: { bold: true, sz: 13 } };

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Rekap");
    XLSX.writeFile(workbook, `${judul} ${toParam(startDate.value)} sd ${toParam(endDate.value)}.xlsx`);
  };

  onMounted(fetchData);

  return {
    rows,
    totalRecords,
    pageSize,
    offset,
    loading,
    search,
    jenisKunjungan,
    filterKedua,
    startDate,
    endDate,
    fetchData,
    cari,
    onPage,
    resetFilter,
    exportExcel,
  };
}
