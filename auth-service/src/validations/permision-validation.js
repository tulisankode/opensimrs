import { z } from "zod";
import { categoryRequired, faskesUuidRequired, mainMenuCodeRequired, mainMenuNameRequired, mainMenuRequired, subMenuCodeRequired, subMenuNameRequired, uuidRequired } from "./message-validation-error.js";

export default class PermisionValidation {
  static CREATE = z.object({
    faskesUuid: z.string().min(1, faskesUuidRequired),
    category: z.string().min(1, categoryRequired),
    mainMenuCode: z.string().min(1, mainMenuCodeRequired),
    mainMenuName: z.string().min(1, mainMenuNameRequired),
    mainMenu: z.string().min(1, mainMenuRequired),
    subMenuName: z.string().min(1, subMenuNameRequired),
    subMenuCode: z.string().min(1, subMenuCodeRequired),
    status: z.boolean()
  });

  static UPDATE = z.object({
    uuid: z.string().min(1, uuidRequired),
    faskesUuid: z.string().min(1, faskesUuidRequired),
    category: z.string().min(1, categoryRequired),
    mainMenuCode: z.string().min(1, mainMenuCodeRequired),
    mainMenuName: z.string().min(1, mainMenuNameRequired),
    mainMenu: z.string().min(1, mainMenuRequired),
    subMenuName: z.string().min(1, subMenuNameRequired),
    subMenuCode: z.string().min(1, subMenuCodeRequired),
    status: z.boolean()
  });

  static UUID = z.string().min(1, uuidRequired);
}
