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

  static LABEL_ALASAN_SUBSTITUSI = {
    stok_kosong: "Stok kosong",
    tidak_ada_di_formularium: "Tidak tersedia di formularium",
    permintaan_pasien: "Permintaan pasien",
    penjamin: "Ketentuan penjamin",
    lainnya: "Lainnya",
  };

  static LABEL_STATUS_SUBSTITUSI = {
    menunggu: "Menunggu persetujuan dokter",
    disetujui: "Disetujui dokter",
    disetujui_lisan: "Konfirmasi lisan/telepon",
    tanpa_persetujuan: "Tanpa persetujuan (data lama)",
    ditolak: "Ditolak dokter",
    dibatalkan: "Dibatalkan apoteker",
  };

  // Substitusi yang sudah mengganti obat pada item resep.
  static STATUS_SUBSTITUSI_DITERAPKAN = ["disetujui", "disetujui_lisan", "tanpa_persetujuan"];

  // Tempelkan riwayat substitusi ke resep: tiap item mendapat `substitusi` (urut waktu, semua status),
  // `substitusi_dari` (nama obat yang diresepkan dokter = obat asal substitusi pertama yang diterapkan), dan
  // `substitusi_menunggu` (pengajuan yang belum diputuskan dokter, bila ada).
  // kunciItem: "obat_items" (detail resep) atau "obat" (data cetak e-resep).
  static lampirkanSubstitusi(resep, riwayat = [], kunciItem = "obat_items") {
    const perItem = new Map();
    const daftar = riwayat.map((r) => ({
      ...r,
      kategori_alasan_label:
        this.LABEL_ALASAN_SUBSTITUSI[r.kategori_alasan] ?? r.kategori_alasan,
      status_label: this.LABEL_STATUS_SUBSTITUSI[r.status] ?? r.status,
    }));
    for (const r of daftar) {
      if (!perItem.has(r.prescription_item_uuid)) perItem.set(r.prescription_item_uuid, []);
      perItem.get(r.prescription_item_uuid).push(r);
    }
    for (const item of resep[kunciItem] ?? []) {
      const milikItem = perItem.get(item.uuid) ?? [];
      const diterapkan = milikItem.filter(
        (r) => !r.status || this.STATUS_SUBSTITUSI_DITERAPKAN.includes(r.status)
      );
      item.substitusi = milikItem;
      item.substitusi_dari = diterapkan[0]?.nama_obat_asal ?? null;
      item.substitusi_menunggu = milikItem.find((r) => r.status === "menunggu") ?? null;
    }
    resep.riwayat_substitusi = daftar;
    return resep;
  }

  // Arti angka order_status resep dokter
  static STATUS = {
    BATAL: 0,
    RESEP_MASUK: 1,
    SUDAH_DITELAAH: 2,
    OBAT_DISIAPKAN: 3, // sudah diverifikasi: stok terpotong & tagihan terkirim
    SIAP_DISERAHKAN: 4,
    DISERAHKAN: 5,
    RETUR: 6,
  };

  static NAMA_STATUS = {
    0: "Batal",
    1: "Resep Masuk",
    2: "Sudah Ditelaah",
    3: "Obat Disiapkan (terverifikasi)",
    4: "Siap Diserahkan",
    5: "Sudah Diserahkan",
    6: "Retur",
  };

  // Pengali biaya racik/embalase. "paket": satu tarif per kelipatan isi bentuk racikan
  // (mis. isi 10: 1–10 bungkus = 1 paket, 11–20 = 2 paket); "item": per komponen racikan.
  static kaliBiayaRacik(metode, qty, isiPerPaket, jumlahKomponen) {
    if (metode === "paket") {
      const isi = Number(isiPerPaket) > 0 ? Number(isiPerPaket) : 1;
      return Math.max(1, Math.ceil(Number(qty || 0) / isi));
    }
    if (metode === "item") return jumlahKomponen;
    return null;
  }

  // harga jual = HPP x (1 + margin% Konfigurasi Harga), dibulatkan ke rupiah
  static hargaJual(hpp, margin) {
    return Math.round(Number(hpp || 0) * (1 + Number(margin || 0) / 100));
  }

  // Item tagihan resep; racikan ditagih sebagai satu paket: komponen + biaya racik + embalase.
  static itemTagihan(obatList, margin) {
    return obatList.map((item) => {
      if (item.is_compound) {
        const komponen = (item.racikan ?? []).reduce(
          (sum, r) =>
            sum + this.hargaJual(r.harga_satuan, margin) * Number(r.medication_qty || 0),
          0
        );
        return {
          nama_item: item.nama_racikan || item.name || "Obat Racikan",
          harga: komponen + Number(item.biaya_racik || 0) + Number(item.biaya_embalase || 0),
          qty: 1,
        };
      }
      return {
        nama_item: item.item_medis?.name,
        harga: this.hargaJual(item.harga_satuan, margin),
        qty: Number(item.medication_qty),
      };
    });
  }
}
