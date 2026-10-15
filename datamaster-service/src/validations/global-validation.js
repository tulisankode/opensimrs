import { z } from "zod";

export class GlobalValidation {
  static UUID_FASKES_UUID = z.object({
    uuid: z.string({ required_error: "uuid tidak boleh kosong" }).uuid({ message: "uuid tidak valid" }),
    faskes_uuid: z.string({ required_error: "faskes_uuid tidak boleh kosong" }).uuid({ message: "faskes_uuid tidak valid" }),
  });

  static UUID = z.object({
    uuid: z.string({ required_error: "uuid tidak boleh kosong" }).uuid({ message: "uuid tudak vlaid" }),
  });
}
