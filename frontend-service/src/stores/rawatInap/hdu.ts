import { defineStore } from "pinia";
import { baseInstanceRawatInap } from "@/utils/Api";
import { hasPermission } from "@/utils/permissions";

export const bolehHdu = (sub: string, aksi = "READ") => hasPermission("Rawat Inap", `HDU ${sub}`, aksi);
export const pesanHdu = (error: any) => error?.response?.data?.message ?? "Layanan HDU tidak dapat diakses. Coba muat ulang.";
export const waktuHdu = (nilai: number | string | null) => nilai ? new Date(Number(nilai) * 1000).toLocaleString("id-ID") : "Belum dicatat";

export const useHduStore = defineStore("hdu", {
    state: () => ({ kunciPengiriman: {} as Record<string, string> }),
    actions: {
        async baca(path: string) {
            const response = await baseInstanceRawatInap.get(`/hdu${path}`);
            return response.data.payload;
        },
        async tulis(path: string, data: object, metode: "post" | "patch" = "post") {
            const sidik = `${metode}/${path}/${JSON.stringify(data)}`;
            const kunci = this.kunciPengiriman[sidik] ??= crypto.randomUUID();
            const response = await baseInstanceRawatInap.request({ method: metode, url: `/hdu${path}`, data, headers: { "Idempotency-Key": kunci } });
            delete this.kunciPengiriman[sidik];
            return response.data.payload;
        },
    },
});
