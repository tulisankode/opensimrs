import { defineStore } from "pinia";
import { useStockLocationStore } from "@/stores/datamasterFarmasi/StockLocation";

type StockLocation = {
  uuid: string;
  name: string;
  [key: string]: any;
};

export const useStockLocationSelectionStore = defineStore({
  id: "stockLocationSelection",
  state: () => ({
    all: [] as StockLocation[],
    selectedUuid: "" as string,
    lastFetchedAt: 0 as number,
  }),
  getters: {
    filtered(state): StockLocation[] {
      return state.selectedUuid
        ? state.all.filter((item) => item.uuid !== state.selectedUuid)
        : state.all;
    },
    getByUuid:
      (state) =>
      (uuid: string): StockLocation | null =>
        state.all.find((i) => i.uuid === uuid) ?? null,
  },
  actions: {
    setAll(payload: StockLocation[]) {
      this.all = payload ?? [];
      this.lastFetchedAt = Date.now();
    },
    setSelectedUuid(uuid: string) {
      this.selectedUuid = uuid ?? "";
    },
    clearSelectedUuid() {
      this.selectedUuid = "";
    },
    async fetchDepo(
      page = 1,
      limit = 9999999,
      name = "",
      jenisLokasi = "depo"
    ) {
      const api = useStockLocationStore();
      const response = await api.getApi(page, limit, name, jenisLokasi);
      this.setAll(response?.payload ?? []);
      return response;
    },
  },
});
