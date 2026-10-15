// Logika panggilan antrian poli yang dipakai bersama tabel Rawat Jalan (Semua/Pelayanan/Discharge).
// - Tombol Panggil/Panggil Ulang langsung di kolom Status.
// - Membuka RME pasien yang masih antri = pasien mulai diperiksa (status DIPERIKSA).
// - Pasien yang belum dipanggil dikonfirmasi dulu agar antrian di layar tidak terlewat.
import { reactive } from "vue";
import { useRJStore } from "@/stores/rawatJalan/laporanrajal";
import { modulAktif } from "@/stores/modulFaskes";

// status_rj: 0 batal, 1 booking, 2 check-in, 3 antrian, 4 diperiksa, 5 selesai
// status_panggilan: 0 menunggu, 1 dipanggil, 2 terlewat, 3 diproses, 4 selesai
export const masihAntri = (row: any) => [1, 2, 3].includes(Number(row?.statusRj));
export const sudahDipanggil = (row: any) => [1, 3].includes(Number(row?.statusPanggilan));

export type KeputusanPeriksa = "panggil" | "buka" | "batal";

export const konfirmasiPeriksa = reactive<{
  tampil: boolean;
  row: any;
  selesai: ((k: KeputusanPeriksa) => void) | null;
}>({ tampil: false, row: null, selesai: null });

const mintaKonfirmasi = (row: any) =>
  new Promise<KeputusanPeriksa>((resolve) => {
    konfirmasiPeriksa.row = row;
    konfirmasiPeriksa.selesai = resolve;
    konfirmasiPeriksa.tampil = true;
  });

export const jawabKonfirmasi = (k: KeputusanPeriksa) => {
  konfirmasiPeriksa.tampil = false;
  konfirmasiPeriksa.selesai?.(k);
  konfirmasiPeriksa.selesai = null;
};

export const panggilPasien = async (row: any) => {
  if (!row?.antrianPoliUuid) return false;
  const rjStore = useRJStore();
  await rjStore.updateAntrianCall(row.antrianPoliUuid, 1);
  return true;
};

// Dipanggil sebelum RME dibuka. Mengembalikan "buka" bila RME boleh dibuka.
export const siapkanPemeriksaan = async (row: any): Promise<KeputusanPeriksa> => {
  if (!masihAntri(row)) return "buka";
  // Tanpa modul Antrian (mis. praktik mandiri) tidak ada panggilan: RME langsung dibuka & ditandai diperiksa.
  if (modulAktif("antrian") && !sudahDipanggil(row) && row?.antrianPoliUuid) {
    const keputusan = await mintaKonfirmasi(row);
    if (keputusan === "panggil") {
      await panggilPasien(row);
      return "panggil";
    }
    if (keputusan === "batal") return "batal";
  }
  await useRJStore().mulaiPeriksa(row.uuid);
  return "buka";
};
