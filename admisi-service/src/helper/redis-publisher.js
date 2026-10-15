import redis from "../configurations/redis-instance.js";

export async function publishAppointmentCheckin({ faskesUuid, kodeBooking, noRm }) {
    const streamKey = "admisi:mobile:appointment:checkin";
    try {
        await redis.xadd(streamKey,"*","data",JSON.stringify({
            faskes_uuid: faskesUuid,
            kode_booking: kodeBooking,
            no_rm: noRm,
            status: 2,
        }));
        await redis.expire(streamKey, 86400);
    } catch (err) {
        console.error("[Redis] Failed to publish appointment checkin:", err.message);
    }
}

export async function publishAppointmentCancel({ faskesUuid, kodeBooking, noRm }) {
    const streamKey = "admisi:mobile:appointment:cancel";
    try {
        await redis.xadd("admisi:mobile:appointment:cancel","*","data",JSON.stringify({
            faskes_uuid: faskesUuid,
            kode_booking: kodeBooking,
            no_rm: noRm,
            status: 0,
        }));
        await redis.expire(streamKey, 86400);
    } catch (err) {
        console.error("[Redis] Failed to publish appointment cancel:", err.message);
    }
}
