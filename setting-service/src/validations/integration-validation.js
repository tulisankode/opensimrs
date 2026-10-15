import { z } from 'zod';
import {uuidRequired} from "./message-validation-error.js";

export default class IntegrationValidation {
    static UPDATEVCLAIM = z.object(
        {
            uuid: z.string().min(1, uuidRequired),
            baseUrl: z.string(),
            userKey: z.string(),
            secretKey: z.string(),
            consId: z.string(),
            PPK: z.string(),
        }
    );

    static UPDATEOTHER = z.object(
        {
            uuid: z.string().min(1, uuidRequired),
            apiKeyPost: z.string(),
            method: z.string(),
            endpoint: z.string(),
            header: z.string(),
            request: z.string(),
            response: z.string(),
            statusLainnya : z.boolean()
        }
    );

    static UPDATESATUSEHAT = z.object({
        uuid: z.string().min(1, uuidRequired),
        client_secret: z.string(),
        organization_id: z.string(),
        client_id : z.string(),
        status_satu_sehat: z.boolean()
    })
}