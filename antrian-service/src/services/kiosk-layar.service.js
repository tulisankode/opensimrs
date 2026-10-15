import crypto from "node:crypto";
import moment from "moment";
import { QueryTypes } from "sequelize";
import sequelizeInstance from "@opensimrs/model-sdk/instance";
import LayarAntrianModel from "../models/layar-antrian.model.js";
import { LayarAntrianRepository } from "../repositories/layar-antrian.repository.js";
import AdmisiAntrianRepository from "../repositories/admisi-antrian.repository.js";
import { NotFoundException } from "../exceptions/not-found.exception.js";
import { UnauthorizedException } from "../exceptions/unauthorized.exception.js";

// Layar antrian mode kiosk (TV): dibuka lewat URL /layar/:uuid?kunci=… tanpa login.
// Kunci per layar hanya memberi akses baca panggilan HARI INI untuk layar tersebut, dan data pasien
// dibatasi pada yang ditampilkan di layar (nama, nomor antrian, poli, dokter).

const WIB = 420;
const RJ_BATAL = 0;
const RJ_SELESAI = 5;
const PANGGILAN_SELESAI = 4;

const buatKunci = () => crypto.randomBytes(24).toString("base64url");

const kunciCocok = (tersimpan, diberikan) => {
  if (!tersimpan || !diberikan) return false;
  const a = Buffer.from(String(tersimpan));
  const b = Buffer.from(String(diberikan));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

// Hanya field yang dipakai komponen layar.
const ringkasPanggilan = (item) => {
  const p = item.patient_data ?? {};
  return {
    uuid: item.uuid,
    pelayanan: item.pelayanan,
    status_panggilan: item.status_panggilan,
    updated_at: item.updated_at,
    patient_data: {
      name: p.name,
      antrian: {
        no_antrian_admisi: p.antrian?.no_antrian_admisi ?? null,
        no_antrian_poli: p.antrian?.no_antrian_poli ?? null,
        no_antrian_farmasi: p.antrian?.no_antrian_farmasi ?? null,
      },
      jadwal_dokter: {
        lokasi_uuid: p.jadwal_dokter?.lokasi_uuid ?? null,
        nama_dokter: p.jadwal_dokter?.nama_dokter ?? null,
        nama_poli: p.jadwal_dokter?.nama_poli ?? null,
      },
    },
  };
};

export class KioskLayarService {
  // Ambil kunci layar (dibuat bila belum ada) untuk admin yang login.
  static async ambilKunci({ faskesUuid, uuid, buatUlang = false }) {
    const layar = await LayarAntrianModel.findOne({ where: { uuid, faskesUuid, deletedAt: null } });
    if (!layar) throw new NotFoundException("Layar antrian tidak ditemukan");
    let kunci = layar.get("kunci_kiosk");
    if (!kunci || buatUlang) {
      kunci = buatKunci();
      await LayarAntrianModel.update({ kunci_kiosk: kunci }, { where: { uuid, faskesUuid } });
    }
    return { uuid, kunci };
  }

  // Data layar untuk TV: konfigurasi + panggilan hari ini (admisi, poli layar ini, farmasi).
  static async dataPublik({ uuid, kunci }) {
    const layar = await LayarAntrianModel.findOne({ where: { uuid, deletedAt: null } });
    if (!layar || !kunciCocok(layar.get("kunci_kiosk"), kunci)) {
      throw new UnauthorizedException("Kunci layar tidak valid. Minta link kiosk terbaru dari admin.");
    }
    const faskesUuid = layar.get("faskesUuid");

    const [konfigurasi, faskes, antrian] = await Promise.all([
      LayarAntrianRepository.findOne({ faskesUuid, uuid }),
      sequelizeInstance.query("SELECT name FROM faskes WHERE uuid = :uuid LIMIT 1", {
        replacements: { uuid: faskesUuid },
        type: QueryTypes.SELECT,
      }),
      AdmisiAntrianRepository.findAll({
        faskesUuid,
        noPagination: true,
        filters: {
          start_date: moment().utcOffset(WIB).startOf("day").unix(),
          end_date: moment().utcOffset(WIB).endOf("day").unix(),
        },
      }),
    ]);

    const lokasiLayar = new Set((konfigurasi.lokasi ?? []).map((l) => l.uuid));
    const semua = antrian.data ?? [];
    const urut = (kunciNomor) => (a, b) =>
      String(a.patient_data?.antrian?.[kunciNomor] ?? "").localeCompare(String(b.patient_data?.antrian?.[kunciNomor] ?? ""));

    const admisi = konfigurasi.is_admisi
      ? semua.filter((a) => a.pelayanan === "admisi").sort(urut("no_antrian_admisi"))
      : [];
    const poli = konfigurasi.is_poli
      ? semua
          .filter((a) => a.pelayanan === "poli")
          .filter((a) => lokasiLayar.size === 0 || lokasiLayar.has(a.patient_data?.jadwal_dokter?.lokasi_uuid))
          // Selaras dengan status kunjungan: batal tidak tampil, sudah pulang dianggap selesai.
          .filter((a) => a.patient_data?.status_rj !== RJ_BATAL)
          .map((a) => (a.patient_data?.status_rj === RJ_SELESAI ? { ...a, status_panggilan: PANGGILAN_SELESAI } : a))
          .sort(urut("no_antrian_poli"))
      : [];
    const farmasi = konfigurasi.is_farmasi
      ? semua.filter((a) => a.pelayanan === "farmasi").sort(urut("no_antrian_farmasi"))
      : [];

    const { kunci_kiosk, ...konfigTanpaKunci } = konfigurasi;
    return {
      layar: konfigTanpaKunci,
      faskes: { name: faskes[0]?.name ?? null },
      waktu_server: moment().unix(),
      admisi: admisi.map(ringkasPanggilan),
      poli: poli.map(ringkasPanggilan),
      farmasi: farmasi.map(ringkasPanggilan),
    };
  }
}
