import { z } from "zod";

import {
  codeRequired,
  nameRequired,
  noRoomRequired,
  noRoomInvalid,
  kategoriRuanganUuidInvalid,
  kelasRuanganRequired,
  statusRequired,
  codeMaxLength,
  nameMaxLength,
} from "./message-validation-error.js";

export default class RuanganValidation {
  static CREATE = z.object({
    code: z.string({ required_error: codeRequired }).min(1, codeRequired).max(255, codeMaxLength),
    name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255, nameMaxLength),
    no_room: z.number({ required_error: noRoomRequired }).min(1, noRoomRequired),
    kategori_ruangan_uuid: z.string({ required_error: "Kategori ruangan uuid tidak boleh kosong" }),
    kelas_ruangan: z.number({ required_error: kelasRuanganRequired }),
    status: z.boolean({ required_error: statusRequired }),
  });


  static IMPORT = z.array(
    z.object({
      code: z.string({ required_error: codeRequired }).min(1, codeRequired).max(255, codeMaxLength),
      name: z.string({ required_error: nameRequired }).min(1, nameRequired).max(255, nameMaxLength),
      no_room: z.number({ required_error: noRoomRequired }),
      kategori_ruangan: z.string({ required_error: "kategori_ruangan tidak boleh kosong" }),
      kelas_ruangan: z.number({ required_error: kelasRuanganRequired }),
      status: z.boolean({ required_error: statusRequired }),
    })
  );

  static UPDATE = z.object({
    code: z.string().min(1, codeRequired).max(255, codeMaxLength).optional(),
    name: z.string().min(1, nameRequired).max(255, nameMaxLength).optional(),
    no_room: z.number().min(1, noRoomRequired).optional(),
    kategori_ruangan_uuid: z.string().uuid(kategoriRuanganUuidInvalid).optional(),
    kelas_ruangan: z.number().optional(),
    status: z.boolean({invalid_type_error: statusRequired}).optional(),
  });

  static DELETE = z.object({
    faskes_uuid: z.string({required_error: "faskes_uuid tidak boleh kosong"}).uuid({message: "faskes_uuid tidak valid"}),
    uuid: z.string({required_error: "uuid tidak boleh kosong"}).uuid({message: "uuid tidak valid"})
  })
}
