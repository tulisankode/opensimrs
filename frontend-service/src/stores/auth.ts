import { apiAuthPost, apiAuthDelete, apiAuthPut } from "@/utils/apiHandler";
import { defineStore } from "pinia";
import { useModulFaskesStore } from "@/stores/modulFaskes";
import { bersihkanStatusStudio } from "@/stores/simrsStudio";

export const useAuthStore = defineStore({
  id: "auth",
  state: () => ({
    faskesUuid: "",
  }),
  getters: {
    getFaskesUuid(state) {
      return state.faskesUuid;
    },
  },
  actions: {
    setFaskesUuid(payload: string) {
      this.faskesUuid = payload;
    },
    async loginApi(payload = {}) {
      const response = await apiAuthPost("/login", payload);

      localStorage.setItem("access_token", `Bearer ${response.payload.token}`);
      localStorage.setItem("refresh_token", response.payload.refreshToken);
      localStorage.setItem(
        "permission",
        JSON.stringify(response.payload.permissions)
      );
      localStorage.setItem("user", JSON.stringify(response.payload.user));
      // Status SIMRS Studio milik pengguna sebelumnya (mis. superadmin) tidak boleh terbawa ke sesi ini.
      bersihkanStatusStudio();

      // Modul aktif faskes (Setting › Manajemen Modul) untuk menu & guard rute.
      try {
        await useModulFaskesStore().muat();
      } catch {
        /* tanpa konfigurasi modul: semua modul tampil */
      }

      return response;
    },
    async logoutApi() {
      const response = await apiAuthDelete("/logout", {});

      localStorage.removeItem("access_token");
      localStorage.removeItem("permission");
      localStorage.removeItem("user");
      localStorage.removeItem("faskes");
      localStorage.removeItem("faskes_profile");
      useModulFaskesStore().bersihkan();
      bersihkanStatusStudio();
      return response;
    },

    async tokenApi(faskesUuid: string, payload = {}) {
      return apiAuthPut(`/token/${faskesUuid}`, payload);
    },

    async refreshTokenApi() {
      try {
        const access_token = localStorage.getItem("access_token");
        const refresh_token = localStorage.getItem("refresh_token");
        const response = await apiAuthPost("/auth/refresh-token", {
          token: access_token,
          refresh_token,
        });

        // Simpan token baru
        localStorage.setItem(
          "access_token",
          `Bearer ${response.payload.token}`
        );
        localStorage.setItem("refresh_token", response.payload.refreshToken);

        return response;
      } catch (error) {
        throw new Error("Gagal memperbarui token.");
      }
    },
  },
});
