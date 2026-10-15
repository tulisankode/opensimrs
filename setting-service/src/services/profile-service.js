import ProfileRepository from "../repositories/profile-repository.js";
import NotfoundException from "../errors/notfound-exception.js";
import ZodValidator from "../validations/zod-validator.js";
import ProfileValidation from "../validations/profile-validation.js";
import BadRequestException from "../errors/bad-request-exception.js";
import bcrypt from "bcrypt";
import {toEpochDate} from "../helpers/date-helper.js";

export default class ProfileService {
    static async getProfileByUsername(username) {
        const profile = await ProfileRepository.getByUsername(username);
        if (!profile) {
            throw new NotfoundException("profile tidak ditemukan");
        }

        profile.role = {
            role_uuid: profile.role_uuid,
            name: profile.role_name
        }
        delete profile.role_uuid;
        delete profile.role_name;

        return profile;
    }

    static async update(req){
        let validData = ZodValidator.validate(ProfileValidation.UPDATE, req);
        validData.updatedAt = toEpochDate(new Date());

        if ((req.old_password && req.password) || (!req.old_password && !req.password )){
            const user = await ProfileRepository.getByUsername(validData.username);
            if (!user) {
                throw new NotfoundException("profile tidak ditemukan");
            }
            if(req.old_password && req.password){
                const isPasswordValid =  await bcrypt.compare(req.old_password, user.password);

                if (!isPasswordValid) {
                    throw new BadRequestException("password lama salah");
                }

                if(req.password === req.old_password){
                    throw new BadRequestException("password baru tidak boleh sama dengan password lama");
                }

                validData.password = await bcrypt.hash(req.password, 10);
            }
        } else {
            throw new BadRequestException("password lama dan password baru harus diisi semua");
        }

        const affectedRow = await ProfileRepository.update(validData);
        if(affectedRow === 0){
            throw new NotfoundException("gagal mengupdate profile, data tidak ditemukan");
        }
    }
}