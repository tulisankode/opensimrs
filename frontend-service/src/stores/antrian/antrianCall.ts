import { defineStore } from "pinia";
import { ref } from "vue";
import { apiAdmisiGet, apiAdmisiPut } from "@/utils/apiHandler";

export const useAntrianCallStore = defineStore("antrianCall", () => {
  const antrianList = ref<any[]>([]);

  const getAllAntrianCall = async () => {
    const responseData = await apiAdmisiGet("/antrian-call", {});

    if (responseData && responseData.payload) {
      antrianList.value = responseData.payload;
      return responseData.payload;
    }
    return [];
  };

  const updateAntrianCall = async (uuid: string, newStatus: number) => {
    const payload = {
      statusPanggilan: newStatus,
    };

    const responseData = await apiAdmisiPut(`/antrian-call/${uuid}`, payload);

    await getAllAntrianCall();

    return responseData;
  };

  return {
    antrianList,
    getAllAntrianCall,
    updateAntrianCall,
  };
});