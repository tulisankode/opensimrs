import { z } from "zod"
export default class PerpindahanRequest{
    static REQUEST_MOVE_BED = z.object({
        destination_monitoring_room_uuid: z.string().uuid(),
        keterangan: z.string().max(255),
    })
}