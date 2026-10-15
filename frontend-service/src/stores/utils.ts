import { defineStore } from "pinia";
import type { selectedBedType } from "@/utils/Interface";
import { segarkanProfil } from "@/utils/tema";

export const utilsStore = defineStore({
  id: "utils",
  state: () => ({
    selectedRoom: null as selectedBedType | null,
    isLoading: false,
  }),
  getters: {},
  actions: {
    setSelectedRoom(roomData: selectedBedType | null) {
      this.selectedRoom = roomData;
    },
    setLoading(status: boolean) {
      this.isLoading = status;
    },
    // Simpan profil faskes sekaligus terapkan warna tema & logo (src/utils/tema.ts).
    setProfilFaskes(data: any) {
      segarkanProfil(data);
    },
  },
});
