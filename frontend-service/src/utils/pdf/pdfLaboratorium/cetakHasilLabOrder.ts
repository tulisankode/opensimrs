import { useExpertiseLab } from "@/stores/Laboratorium/expertise";
import { utilsStore } from "@/stores/utils";
import { createHasilLabPdf } from "./cetakHasilLab";

// Cetak hasil lab dari uuid order (data sama dengan halaman Expertise): dipakai di daftar Order Lab,
// Hasil Pemeriksaan, Expertise dan tab Penunjang RME.
export async function cetakHasilLabOrder(uuid: string) {
  const loading = utilsStore();
  const expertise = useExpertiseLab();
  loading.setLoading(true);
  try {
    const [pasien, tarif] = await Promise.all([expertise.getDetailPasien(uuid), expertise.getDetailTarif(uuid)]);
    await createHasilLabPdf({ ...(pasien?.payload || {}), ...(tarif?.payload || {}) });
  } finally {
    loading.setLoading(false);
  }
}
