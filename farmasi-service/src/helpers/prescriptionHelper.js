export default class PrescriptionHelper {
  static mapPrescription(prescription) {
    const raw = prescription.get
      ? prescription.get({ plain: true })
      : prescription;


    const getUmur = (detail) => {
      if (!detail || !detail.birthDate) {
        return "N/A";
      }

      const birthDate = new Date(detail.birthDate);
      const today = new Date();

      let ageYear = today.getFullYear() - birthDate.getFullYear();
      let ageMonth = today.getMonth() - birthDate.getMonth();
      let ageDay = today.getDate() - birthDate.getDate();

      if (ageDay < 0) {
        ageMonth--;
        const daysInLastMonth = new Date(
          today.getFullYear(),
          today.getMonth(),
          0
        ).getDate();
        ageDay += daysInLastMonth;
      }

      if (ageMonth < 0) {
        ageYear--;
        ageMonth += 12;
      }

      return `${ageYear} Thn, ${ageMonth} Bln, ${ageDay} Hr`;
    };

    const mapPetugas = (petugas) => {
      return {
        petugas_verifikasi: petugas.petugas_verifikasi || null,
        waktu_verifikasi: petugas.waktu_verifikasi || null,
        petugas_penyiapan_obat: petugas.petugas_penyiapan_obat || null,
        waktu_penyiapan: petugas.waktu_penyiapan || null,
        petugas_pemberi: petugas.petugas_pemberi || null,
        waktu_pemberian: petugas.waktu_pemberian || null,
        petugas_pembatalan: petugas.petugas_pembatalan || null,
        alasan_batal: petugas.alasan_batal || null,
      };
    };

    const mapObatItem = (item) => {
      const racikanItems =
        item.racikan?.map((racikan) => ({
          uuid: racikan.uuid,
          item_medis_uuid: racikan.item_medis_uuid,
          nama_item: racikan.item_medis?.name || "N/A",
          qty_racikan: racikan.medication_qty,
          harga_satuan: racikan.harga_satuan,
          satuan: racikan.item_medis?.satuan_penggunaan?.name || null,
          jenis_stok_uuid:
            raw.order_status === 1 ? "" : racikan.jenis_stok_uuid,
          jenis_stok_name: item.jenis_stok?.name || null,
        })) || [];

      let nama_item_utama = "N/A";
      if (item.is_compound) {
        nama_item_utama = item.nama_racikan || "Racikan";
      } else {
        nama_item_utama = item.item_medis?.name || "N/A";
      }

      return {
        uuid: item.uuid,
        item_medis_uuid: item.item_medis_uuid,
        nama_item: nama_item_utama,
        total_obat: item.medication_qty,
        qty_sisa: item.sisa_qty_order,
        harga_satuan: item.harga_satuan,

        dosis: item.medication_dose_qty,
        satuan_dosis: item.satuan_dosis?.name || null,
        rute_pemberian: item.route,

        // Aturan Pakai
        aturan_pakai: item.aturan_pakai?.name || null,
        cara_pakai: item.cara_pakai?.cara_pakai || null,
        catatan_resep: item.prescription_notes,

        // Status Item
        is_chronic: item.is_chronic || false,
        is_compound: item.is_compound || false,

        // Info Racikan
        bentuk_racikan: item.bentuk_racikan?.nama_bentuk_racikan || null,
        jenis_racikan: item.jenis_racikan,

        jenis_stok_uuid: raw.order_status === 1 ? "" : item.jenis_stok_uuid,
        jenis_stok_name: item.jenis_stok?.name || null,

        racikan_items: racikanItems,
      };
    };

    let is_chronic_flag = false;
    let is_compound_flag = false;
    if (raw.obat) {
      for (const item of raw.obat) {
        if (item.is_chronic) is_chronic_flag = true;
        if (item.is_compound) is_compound_flag = true;
      }
    }

    return {
      uuid: raw.uuid,
      no_resep: raw.no_resep,
      no_rm: raw.patient?.no_rm || raw.no_rm,
      no_reg: raw.no_reg,
      dokter_order: raw.dokter_order,
      jenis_pelayanan: raw.jenis_pelayanan,
      // untuk ringkasan klinis (keluhan, alergi, diagnosis) di layar telaah resep farmasi
      rekam_medis_uuid: raw.rekam_medis_uuid || null,
      session_uuid: raw.session_uuid || null,
      order_date: raw.order_date,
      order_status: raw.order_status,
      is_takeaway: raw.is_takeaway,
      payment_method: raw.payment_method,
      lokasi_stok_uuid: raw.lokasi_stok_uuid || null,
      lokasi_stok_nama: raw.lokasi_stok?.name || null,
      total_harga: raw.total_harga || 0,
      is_chronic_flag: is_chronic_flag,
      is_compound_flag: is_compound_flag,

      //data pasien
      pasien: {
        uuid: raw.patient?.uuid || null,
        nama: raw.patient?.name || "N/A",
        gender: raw.patient?.gender || "N/A",
        tanggal_lahir: raw.patient?.birth_detail?.birthDate || null,
        umur: getUmur(raw.patient?.birth_detail),
      },

      //data petugas
      info_petugas: mapPetugas(raw),

      //data obat
      obat_items: raw.obat?.map(mapObatItem) || [],
    };
  }

  static mapPrescriptionList(list) {
    return list.map(this.mapPrescription);
  }
}
