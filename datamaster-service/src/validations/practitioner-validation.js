import { z } from "zod";
import { codeBpjsInvalid, statusRequired } from "./message-validation-error.js";

export default class PractitionerValidation {
  static CREATE_DOKTER = z.object({
    uuid: z.string({required_error: "uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"}),
    faskes_uuid: z.string({required_error: "faskes_uuid tidak boleh kosong"}).uuid({message: "faskes_uuid tidak valid"}),
    pegawai_uuid: z.string({ required_error: "Pegawai uuid tidak boleh kosong" }).min(1, "Pegawai Required").uuid({message: "pegawai_uuid tidak valid"}),
    code_bpjs: z.string({message: "code_bpjs tidak boleh kosong"}).max(255, codeBpjsInvalid),
    sip: z.string().max(255).optional().nullable(),
    str: z.string().max(255).optional().nullable(),
    is_doctor: z.boolean({ required_error: "Tipe praktisi tidak boleh kosong" }),
    code_antrian_dokter: z.string({ required_error: "Code antrian dokter tidak boleh kosong" }).min(1).max(15),
    poli_pelayanan: z.array(z.object({
      lokasi_uuid: z.string({ required_error: "location_uuid tidak boleh kosong" }).uuid({message: "lokasi_uuid tidak valid"}),
      name: z.string().min(1).max(255).nullable().optional()
    })).min(1, "poli_pelayanan tidak boleh kosong"),
    status: z.boolean({ required_error: statusRequired }),
  });

  static CREATE_NON_DOKTER = z.object({
    faskes_uuid: z.string({required_error: "faskes_uuid tidak boleh kosong"}).uuid({message: "fakes_uuid tidak valid"}),
    code_bpjs: z.string().max(255, codeBpjsInvalid).optional(),
    pegawai_uuid: z.string({ required_error: "Pegawai uuid tidak boleh kosong" }).min(1, "Pegawai Required").uuid({message: "pegawai_uuid tidak valid"}),
    str: z.string().min(1, "STR Required").max(255).nullable().optional(),
    is_doctor: z.boolean({required_error: "Tipe praktisi tidak boleh kosong"}),
    // Poli tugas non-dokter (opsional): dipakai panel panggilan antrian untuk menyaring "antrian saya".
    poli_pelayanan: z.array(z.object({
      lokasi_uuid: z.string().uuid({message: "lokasi_uuid tidak valid"}),
      name: z.string().max(255).nullable().optional()
    })).optional(),
    status: z.boolean({ required_error: statusRequired }),
  });

  static UPDATE_DOKTER = z.object({
    uuid: z.string({required_error: "uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"}),
    faskes_uuid: z.string({required_error: "faskes_uuid tidak boleh kosong"}).uuid({message: "fakes_uuid tidak valid"}),
    pegawai_uuid: z.string({ required_error: "Pegawai uuid tidak boleh kosong" }).min(1, "Pegawai Required").uuid().optional(),
    code_bpjs: z.string({ required_error: "Code BPJS tidak boleh kosong" }).max(255, codeBpjsInvalid).nullable().optional(),
    sip: z.string().max(255).optional().nullable(),
    str: z.string().max(255).optional().nullable(),
    is_doctor: z.boolean({required_error: "Tipe praktisi tidak boleh kosong"}),
    code_antrian_dokter: z.string({ required_error: "Code antrian dokter tidak boleh kosong" }).min(1).max(15).optional(),
    poli_pelayanan: z.array(z.object({
      lokasi_uuid: z.string({ required_error: "location_uuid tidak boleh kosong" }).uuid({message: "lokasi_uuid tidak valid"}),
    })).min(1, "poli_pelayanan tidak boelh kosong"),
    status: z.boolean({ required_error: statusRequired }).optional(),
  });

  static UPDATE_NON_DOKTER = z.object({
    uuid: z.string({required_error: "uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"}),
    faskes_uuid: z.string({required_error: "faskes_uuid tidak boleh kosong"}).uuid({message: "fakes_uuid tidak valid"}),
    pegawai_uuid: z.string({ required_error: "Pegawai uuid tidak boleh kosong" }).min(1, "Pegawai Required").uuid({message: "uuid tidak valid"}).optional(),
    str: z.string().min(1, "STR Required").max(255).nullable().optional(),
    is_doctor: z.boolean({required_error: "Tipe praktisi tidak boleh kosong"}),
    // Poli tugas non-dokter (opsional): dipakai panel panggilan antrian untuk menyaring "antrian saya".
    poli_pelayanan: z.array(z.object({
      lokasi_uuid: z.string().uuid({message: "lokasi_uuid tidak valid"}),
      name: z.string().max(255).nullable().optional()
    })).optional(),
    status: z.boolean({ required_error: statusRequired }).optional(),
  });
}
