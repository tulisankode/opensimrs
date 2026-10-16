import {
  baseInstance,
  settingInstance,
  baseInstanceDatamaster,
  baseInstanceAdmisi,
  baseInstanceIgd,
  baseInstanceFarmasi,
  authInstance,
  baseInstancePembayaran,
  baseInstanceLaboratorium,
  baseInstanceRawatJalan,
  baseInstanceRekamMedis,
  baseInstanceRawatInap,
  baseInstanceInventory,
  baseInstanceAntrian,
  baseInstanceStok,
  baseInstanceLaporan,
  baseInstanceSatuSehat,
  baseInstanceBpjs,
  baseInstancePenunjang,
  baseInstanceProgramPuskesmas,
  baseInstanceStudio,
  baseInstanceMentah,
} from "./Api";
import { app } from "@/utils/aplikasi";
import { useAuthStore } from "@/stores/auth";
import axios from "axios";

const cekHost = (baseUrl: unknown, nextUrl: string) => {
  // Deploy dengan domain API terpisah (mis. staging api.example.com): pakai alamat API apa adanya
  if (import.meta.env.VITE_KEEP_API_HOST === "true") return nextUrl;
  const url = new URL(baseUrl as string);
  let tempUrl = `:${url.port}${url.pathname}`;
  const currentHostUrl = window.location.hostname;
  const baseLocation =
    window.location.protocol + "//" + window.location.hostname;

  if (
    !currentHostUrl.includes("localhost") &&
    !currentHostUrl.includes("opensimrs")
  ) {
    if (tempUrl.endsWith("/") && nextUrl.startsWith("/")) {
      tempUrl = tempUrl.slice(0, -1);
    }
    console.log(`${baseLocation + tempUrl + nextUrl}`);
    return baseLocation + tempUrl + nextUrl;
  }
  
  console.log("🚀 ~ cekHost ~ tempUrl:", nextUrl)
  return nextUrl;
};

const normalizeDatamasterUrl = (url: string) => {
  if (url === "/datamaster") return "/";
  if (url.startsWith("/datamaster/")) return url.replace(/^\/datamaster/, "");
  return url;
};

const normalizeServiceUrl = (url: string, servicePrefixes: string[]) => {
  for (const prefix of servicePrefixes) {
    const normalizedPrefix = prefix.startsWith("/") ? prefix : `/${prefix}`;

    if (url === normalizedPrefix) return "/";
    if (url.startsWith(`${normalizedPrefix}/`)) {
      return url.slice(normalizedPrefix.length) || "/";
    }
    if (url.startsWith(`${normalizedPrefix}?`)) {
      return `/${url.slice(normalizedPrefix.length)}`;
    }
  }

  return url;
};

const normalizeFarmasiUrl = (url: string) => normalizeServiceUrl(url, ["farmasi"]);
const normalizeLaboratoriumUrl = (url: string) =>
  normalizeServiceUrl(url, ["lab"]);
const normalizePembayaranUrl = (url: string) =>
  normalizeServiceUrl(url, ["payment"]);
const normalizeInventoryUrl = (url: string) =>
  normalizeServiceUrl(url, ["inventory"]);
const normalizeRawatJalanUrl = (url: string) =>
  normalizeServiceUrl(url, ["rawat-jalan", "rajal", "v3/rajal"]);
const normalizeRawatJalanBaseUrl = (baseUrl: unknown) =>
  typeof baseUrl === "string"
    ? baseUrl.replace(/\/api\/v3\/rawat-jalan\/?$/, "/api/v3/rajal")
    : baseUrl;

const errorApiHandler = (error: any) => {
  let tempSummary = ``;
  let tempDetail = ``;
  const authStore = useAuthStore();
  // Gangguan jaringan/CORS: tidak ada response dari server
  if (!error?.response) {
    app.config.globalProperties.$toast.add({
      severity: "error",
      summary: "Tidak dapat terhubung ke server",
      detail: error?.message ?? "",
      life: 3000,
    });
    return;
  }
  // NOTE Belum refresh token
  if (error.response.data?.message) {
    if (
      error.response.data.message == "token tidak valid!" ||
      error.response.data.message == "jwt expired" ||
      ((error.response.data.message == "Authentikasi gagal" ||
        error.response.data.message == "Authorization gagal" ||
        error.response.data.message == "jwt expired") &&
        (error.response.data.errors[0].type.toLowerCase() == "invalid token" ||
          error.response.data.errors[0].type == "Invalid signature" ||
          (error.response.data.errors[0].type == "auth" &&
            error.response.data.errors[0].message == "jwt expired")))
    ) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("permission");
      localStorage.removeItem("user");
      localStorage.removeItem("faskes");
      localStorage.removeItem("faskes_profile");
      window.location.reload();
    }
    // NOTE Refresh Token
    // if (
    //   error.response.data.message == "token tidak valid!" ||
    //   ((error.response.data.message == "Authentikasi gagal" ||
    //     error.response.data.message == "Authorization gagal" ||
    //     error.response.data.message == "jwt expired") &&
    //     (error.response.data.errors[0].type.toLowerCase() == "invalid token" ||
    //       error.response.data.errors[0].type == "Invalid signature" ||
    //       (error.response.data.errors[0].type == "auth" &&
    //         error.response.data.errors[0].message == "jwt expired")))
    // ) {
    //   authStore.refreshTokenApi();
    //   return;
    // }
    // if (error.response.data.message == "Refresh token telah kadaluarsa" || error.response.data.errors[0].type == "expired") {
    //   localStorage.removeItem("access_token");
    //   localStorage.removeItem("permission");
    //   localStorage.removeItem("user");
    //   localStorage.removeItem("faskes");
    //   localStorage.removeItem("faskes_profile");
    //   window.location.reload();
    // }
    tempSummary = error.response.data.message;
    error.response.data.errors?.forEach((errorMsg: any, index: number) => {
      if (error.response.data.errors.length == index + 1) {
        tempDetail += "- " + errorMsg.message;
      } else {
        tempDetail += "- " + errorMsg.message + "\n";
      }
    });
  } else {
    tempSummary = error.message;
  }

  app.config.globalProperties.$toast.add({
    severity: "error",
    summary: tempSummary,
    detail: tempDetail,
    life: 3000,
  });
  throw new Error(tempSummary);
};

const apiBasePost = async (url: string, data: object) => {
  try {
    let response = await baseInstance.post(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiBaseGet = async (url: string, data: object) => {
  try {
    let response = await baseInstance.get(url, data);
    return response.data.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiBasePut = async (url: string, data: object) => {
  try {
    let response = await baseInstance.put(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiBaseDelete = async (url: string, data: object) => {
  try {
    let response = await baseInstance.delete(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};

// Auth
const apiAuthPost = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_AUTH, url);
  try {
    let response = await authInstance.post(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });

    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiAuthDelete = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_AUTH, url);
  try {
    let response = await authInstance.delete(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });

    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiAuthGet = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_AUTH, url);
  try {
    let response = await authInstance.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiAuthPut = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_AUTH, url);
  try {
    let response = await authInstance.put(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};

// Setting
const apiSettingPost = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_URL_SETTING, url);
  try {
    let response = await settingInstance.post(url, data);
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiSettingGet = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_URL_SETTING, url);
  try {
    let response = await settingInstance.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiSettingPut = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_URL_SETTING, url);
  try {
    let response = await settingInstance.put(url, data);
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiSettingDelete = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_URL_SETTING, url);
  try {
    let response = await settingInstance.delete(url, data);
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};

//Datamaster
const apiDatamasterGet = async (url: string, data: object) => {
  url = normalizeDatamasterUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_DATAMASTER, url);
  try {
    let response = await baseInstanceDatamaster.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiDatamasterPost = async (url: string, data: object) => {
  url = normalizeDatamasterUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_DATAMASTER, url);
  try {
    let response = await baseInstanceDatamaster.post(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiDatamasterPut = async (url: string, data: object) => {
  url = normalizeDatamasterUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_DATAMASTER, url);
  try {
    let response = await baseInstanceDatamaster.put(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiDatamasterDelete = async (url: string, data: object) => {
  url = normalizeDatamasterUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_DATAMASTER, url);
  try {
    let response = await baseInstanceDatamaster.delete(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: "Data berhasil dihapus",
      life: 3000,
    });
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};

//Pembayaran
const apiPembayaranGet = async (url: string, data: object) => {
  url = normalizePembayaranUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_PEMBAYARAN, url);
  try {
    let response = await baseInstancePembayaran.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiPembayaranPost = async (url: string, data: object) => {
  url = normalizePembayaranUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_PEMBAYARAN, url);
  try {
    let response = await baseInstancePembayaran.post(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    console.log("response", response);
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiPembayaranPut = async (url: string, data: object) => {
  url = normalizePembayaranUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_PEMBAYARAN, url);
  try {
    let response = await baseInstancePembayaran.put(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiPembayaranDelete = async (url: string, data: object) => {
  url = normalizePembayaranUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_PEMBAYARAN, url);
  try {
    let response = await baseInstancePembayaran.delete(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: "Data berhasil dihapus",
      life: 3000,
    });
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};

// Laboratorium
const apiLaboratoriumGet = async (url: string, data: object) => {
  url = normalizeLaboratoriumUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_LABORATORIUM, url);
  try {
    let response = await baseInstanceLaboratorium.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiLaboratoriumPost = async (url: string, data: object) => {
  url = normalizeLaboratoriumUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_LABORATORIUM, url);
  try {
    let response = await baseInstanceLaboratorium.post(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    console.log("response", response);
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiLaboratoriumPut = async (url: string, data: object) => {
  url = normalizeLaboratoriumUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_LABORATORIUM, url);
  try {
    let response = await baseInstanceLaboratorium.put(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiLaboratoriumDelete = async (url: string, data: object) => {
  url = normalizeLaboratoriumUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_LABORATORIUM, url);
  try {
    let response = await baseInstanceLaboratorium.delete(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: "Data berhasil dihapus",
      life: 3000,
    });
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};

//Admisi
const apiAdmisiGet = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_ADMISI, url);
  try {
    let response = await baseInstanceAdmisi.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiAdmisiPost = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_ADMISI, url);
  try {
    let response = await baseInstanceAdmisi.post(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiAdmisiPut = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_ADMISI, url);
  try {
    let response = await baseInstanceAdmisi.put(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiAdmisiPatch = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_ADMISI, url);
  try {
    let response = await baseInstanceAdmisi.patch(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiAdmisiDelete = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_ADMISI, url);
  try {
    let response = await baseInstanceAdmisi.delete(url, { data: data });
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
export const apiAdmisiDownload = async (url: string) => {
  let fullUrl = cekHost(import.meta.env.VITE_BASE_ADMISI, url);

  if (fullUrl === '/download') {
    fullUrl = import.meta.env.VITE_BASE_ADMISI + url;
  }

  try {
    const token = localStorage.getItem("access_token");
    if (!token) {
      alert("Token tidak ditemukan, silakan login ulang");
      return;
    }

    const response = await axios.get(fullUrl, {
      responseType: "blob",
      headers: {
        Authorization: token,
        Accept:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });

    return response;
  } catch (error) {
    console.error("Error di apiAdmisiDownload:", error);
    throw error;
  }
};

//Igd
const apiIgdGet = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_IGD, url);
  try {
    let response = await baseInstanceIgd.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiIgdPost = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_IGD, url);
  try {
    let response = await baseInstanceIgd.post(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiIgdPut = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_IGD, url);
  try {
    let response = await baseInstanceIgd.put(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiIgdDelete = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_IGD, url);
  try {
    let response = await baseInstanceIgd.delete(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};

//Farmasi
const apiFarmasiGet = async (url: string, data: object) => {
  url = normalizeFarmasiUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_FARMASI, url);
  try {
    let response = await baseInstanceFarmasi.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiFarmasiPost = async (url: string, data: object) => {
  url = normalizeFarmasiUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_FARMASI, url);
  try {
    let response = await baseInstanceFarmasi.post(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiFarmasiPostNoMessage = async (url: string, data: object) => {
  url = normalizeFarmasiUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_FARMASI, url);
  try {
    let response = await baseInstanceFarmasi.post(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiFarmasiPut = async (url: string, data: object) => {
  url = normalizeFarmasiUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_FARMASI, url);
  try {
    let response = await baseInstanceFarmasi.put(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiFarmasiDelete = async (url: string, data: object) => {
  url = normalizeFarmasiUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_FARMASI, url);
  try {
    let response = await baseInstanceFarmasi.delete(url, { data: data });
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiFarmasiPatch = async (url: string, data: object) => {
  url = normalizeFarmasiUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_FARMASI, url);
  try {
    let response = await baseInstanceFarmasi.patch(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};

// Rawat Jalan
const apiRawatJalanGet = async (url: string, data: object) => {
  url = normalizeRawatJalanUrl(url);
  url = cekHost(
    normalizeRawatJalanBaseUrl(import.meta.env.VITE_BASE_RAWAT_JALAN),
    url
  );
  try {
    // memuat data tidak perlu notifikasi sukses (sama dengan helper GET lain)
    let response = await baseInstanceRawatJalan.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiRawatJalanPut = async (url: string, data: object) => {
  url = normalizeRawatJalanUrl(url);
  url = cekHost(
    normalizeRawatJalanBaseUrl(import.meta.env.VITE_BASE_RAWAT_JALAN),
    url
  );
  try {
    let response = await baseInstanceRawatJalan.put(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};

// Rekam Medis
const apiRekamMedisGet = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_REKAM_MEDIS, url);
  try {
    // memuat data tidak perlu notifikasi sukses (sama dengan helper GET lain)
    let response = await baseInstanceRekamMedis.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
// opsi.diam: tanpa toast sukses (pemanggil menampilkan ringkasan sendiri, mis. SOAP Ringkas yang menyimpan beberapa bagian).
const apiRekamMedisPost = async (url: string, data: object, opsi: { diam?: boolean } = {}) => {
  url = cekHost(import.meta.env.VITE_BASE_REKAM_MEDIS, url);
  try {
    let response = await baseInstanceRekamMedis.post(url, data);
    if (!opsi.diam) {
      app.config.globalProperties.$toast.add({
        severity: "success",
        summary: response.data.message,
        life: 3000,
      });
    }
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiRekamMedisPut = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_REKAM_MEDIS, url);
  try {
    let response = await baseInstanceRekamMedis.put(url, data);
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiRekamMedisDelete = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_REKAM_MEDIS, url);
  try {
    let response = await baseInstanceRekamMedis.delete(url, { data: data });
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiRekamMedisDownload = async (url: string) => {
  let fullUrl = cekHost(import.meta.env.VITE_BASE_REKAM_MEDIS as string,url);

  if (!fullUrl.includes('http')) {
    fullUrl = import.meta.env.VITE_BASE_REKAM_MEDIS + url;
  }

  try {
    const token = localStorage.getItem("access_token");
    if (!token) {
      alert("Token tidak ditemukan, silakan login ulang");
      return;
    }

    const response = await axios.get(fullUrl, {
      responseType: "blob",
      headers: {
        Authorization: token,
        Accept: "application/pdf",
      },
    });

    return response;
  } catch (error) {
    console.error("Error di apiRekamMedisDownload:", error);
    throw error;
  }
};

// Rawat inap Perpindahan Bangsal
const apiRawatInapGet = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_RAWAT_INAP, url);
  try {
    let response = await baseInstanceRawatInap.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiRawatInapPost = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_RAWAT_INAP, url);
  try {
    let response = await baseInstanceRawatInap.post(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiRawatInapPut = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_RAWAT_INAP, url);
  try {
    let response = await baseInstanceRawatInap.put(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};

// Inventory
const apiInventoryGet = async (url: string, data: object) => {
  url = normalizeInventoryUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_INVENTORY, url);
  try {
    let response = await baseInstanceInventory.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiInventoryPost = async (url: string, data: object) => {
  url = normalizeInventoryUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_INVENTORY, url);
  try {
    let response = await baseInstanceInventory.post(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiInventoryPut = async (url: string, data: object) => {
  url = normalizeInventoryUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_INVENTORY, url);
  try {
    let response = await baseInstanceInventory.put(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiInventoryDelete = async (url: string, data: object) => {
  url = normalizeInventoryUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_INVENTORY, url);
  try {
    let response = await baseInstanceInventory.delete(url, { data: data });
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};

//Antrian
const apiAntrianGet = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_ANTRIAN, url);
  try {
    let response = await baseInstanceAntrian.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiAntrianGetNoMessage = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_ANTRIAN, url);
  try {
    const response = await baseInstanceAntrian.get(url, data);
    return response.data;
  } catch (error) {
    // Suppress global error toast; let caller handle empty state
    throw error;
  }
};
const apiAntrianDelete = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_ANTRIAN, url);
  try {
    let response = await baseInstanceAntrian.delete(url, { data: data });
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiAntrianPost = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_ANTRIAN, url);
  try {
    let response = await baseInstanceAntrian.post(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiAntrianPut = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_ANTRIAN, url);
  try {
    let response = await baseInstanceAntrian.put(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};

//Stok
const apiStokGet = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_STOK, url);
  try {
    let response = await baseInstanceStok.get(url, data);
    return response.data;
  } catch (error) {
    throw error;
  }
};
const apiStokPost = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_STOK, url);
  try {
    let response = await baseInstanceStok.post(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiStokPut = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_STOK, url);
  try {
    let response = await baseInstanceStok.put(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
const apiStokDelete = async (url: string, data: object) => {
  url = cekHost(import.meta.env.VITE_BASE_STOK, url);
  try {
    let response = await baseInstanceStok.delete(url, { data: data });
    app.config.globalProperties.$toast.add({
      severity: "success",
      summary: response.data.message,
      life: 3000,
    });
    return response;
  } catch (error) {
    errorApiHandler(error);
  }
};
//Laporan & Dashboard
const apiLaporanGet = async (url: string, data: object = {}) => {
  url = cekHost(import.meta.env.VITE_BASE_DASHBOARD, url);
  try {
    let response = await baseInstanceLaporan.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
//SATUSEHAT
const apiSatuSehatGet = async (url: string, data: object = {}) => {
  url = cekHost(import.meta.env.VITE_BASE_SATUSEHAT, url);
  try {
    let response = await baseInstanceSatuSehat.get(url, data);
    return response.data;
  } catch (error) {
    errorApiHandler(error);
  }
};
// Galat proses (mis. 422 data belum lengkap) dikembalikan ke pemanggil agar pesannya bisa ditampilkan per baris
const apiSatuSehatPost = async (url: string, data: object = {}) => {
  url = cekHost(import.meta.env.VITE_BASE_SATUSEHAT, url);
  try {
    let response = await baseInstanceSatuSehat.post(url, data);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data?.message) return { ...error.response.data, gagal: true };
    errorApiHandler(error);
  }
};
// LIS (lab-service /lab/lis): galat proses dikembalikan ke pemanggil { message, payload, gagal: true }
const apiLisKirim = async (metode: "get" | "post" | "put" | "delete", url: string, data: object = {}) => {
  url = normalizeLaboratoriumUrl(url);
  url = cekHost(import.meta.env.VITE_BASE_LABORATORIUM, url);
  try {
    const response = metode === "get" || metode === "delete" ? await baseInstanceLaboratorium[metode](url) : await baseInstanceLaboratorium[metode](url, data);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data?.message) return { message: error.response.data.message, payload: error.response.data.payload, gagal: true };
    errorApiHandler(error);
  }
};
const apiLisGet = (url: string) => apiLisKirim("get", url);
const apiLisPost = (url: string, data: object = {}) => apiLisKirim("post", url, data);
const apiLisPut = (url: string, data: object = {}) => apiLisKirim("put", url, data);
const apiLisDelete = (url: string) => apiLisKirim("delete", url);

//BPJS
// Galat proses (mis. 422 data belum lengkap, 404 peserta tidak ada) dikembalikan ke pemanggil agar pesannya bisa ditampilkan
const apiBpjsKirim = async (metode: "get" | "post" | "put" | "delete", url: string, data: object = {}) => {
  url = cekHost(import.meta.env.VITE_BASE_BPJS, url);
  try {
    const response = metode === "get" || metode === "delete" ? await baseInstanceBpjs[metode](url) : await baseInstanceBpjs[metode](url, data);
    return response.data;
  } catch (error: any) {
    if (error?.response?.data?.message) return { ...toPesanGalat(error.response.data), gagal: true };
    errorApiHandler(error);
  }
};
const toPesanGalat = (data: any) => ({ message: data.message, payload: data.payload });
const apiBpjsGet = (url: string) => apiBpjsKirim("get", url);
const apiBpjsPost = (url: string, data: object = {}) => apiBpjsKirim("post", url, data);
const apiBpjsPut = (url: string, data: object = {}) => apiBpjsKirim("put", url, data);
const apiBpjsDelete = (url: string) => apiBpjsKirim("delete", url);



// EKSTENSI tanpa kode — tanpa konversi kunci. layanan: "laporan" (runtime, VITE_BASE_DASHBOARD) atau "studio".
// Galat ditampilkan errorApiHandler dan fungsi mengembalikan undefined (kecuali diam).
const apiEkstensi = async (layanan: "laporan" | "studio", metode: "get" | "post" | "put" | "delete", url: string, data: object = {}, diam = false) => {
  const dasar = layanan === "studio" ? import.meta.env.VITE_BASE_STUDIO || "http://localhost:8090/api/v3/studio" : import.meta.env.VITE_BASE_DASHBOARD;
  const host = cekHost(dasar, url);
  // cekHost mengembalikan path relatif di localhost (mengandalkan baseURL instance) — instance mentah tanpa baseURL.
  const lengkap = /^https?:/.test(host) ? host : `${String(dasar).replace(/\/$/, "")}${url}`;
  try {
    const response = metode === "get" || metode === "delete" ? await baseInstanceMentah[metode](lengkap) : await baseInstanceMentah[metode](lengkap, data);
    if (metode !== "get" && !diam && response.data?.message) {
      app.config.globalProperties.$toast.add({ severity: "success", summary: response.data.message, life: 3000 });
    }
    return response.data;
  } catch (error) {
    if (diam) return undefined;
    try {
      errorApiHandler(error);
    } catch {
      /* sudah ditampilkan */
    }
    return undefined;
  }
};

// SIMRS STUDIO (studio-service). Path relatif terhadap VITE_BASE_STUDIO, mis. apiStudioGet("/item").
// Tulis menampilkan toast sukses (kecuali diam); galat ditampilkan errorApiHandler dan fungsi mengembalikan undefined.
const apiStudioKirim = async (metode: "get" | "post" | "put" | "delete", url: string, data: object = {}, diam = false) => {
  url = cekHost(import.meta.env.VITE_BASE_STUDIO || "http://localhost:8090/api/v3/studio", url);
  try {
    const response = metode === "get" || metode === "delete"
      ? await baseInstanceStudio[metode](url)
      : await baseInstanceStudio[metode](url, data);
    if (metode !== "get" && !diam && response.data?.message) {
      app.config.globalProperties.$toast.add({ severity: "success", summary: response.data.message, life: 3000 });
    }
    return response.data;
  } catch (error) {
    if (diam) return undefined;
    try {
      errorApiHandler(error);
    } catch {
      /* sudah ditampilkan */
    }
    return undefined;
  }
};
const apiStudioGet = (url: string, diam = false) => apiStudioKirim("get", url, {}, diam);
const apiStudioPost = (url: string, data: object = {}, diam = false) => apiStudioKirim("post", url, data, diam);
const apiStudioPut = (url: string, data: object = {}, diam = false) => apiStudioKirim("put", url, data, diam);

// PENUNJANG (penunjang-service: /fisioterapi, /radiologi, /mcu). Path relatif terhadap VITE_BASE_PENUNJANG,
// mis. apiPenunjangGet("/radiologi/order?page=1"). Tulis (POST/PUT/DELETE) menampilkan toast sukses; galat
// ditampilkan errorApiHandler dan fungsi mengembalikan undefined.
const apiPenunjangKirim = async (metode: "get" | "post" | "put" | "delete", url: string, data: object = {}, diam = false) => {
  url = cekHost(import.meta.env.VITE_BASE_PENUNJANG, url);
  try {
    const response = metode === "get" || metode === "delete"
      ? await baseInstancePenunjang[metode](url)
      : await baseInstancePenunjang[metode](url, data);
    if (metode !== "get" && !diam && response.data?.message) {
      app.config.globalProperties.$toast.add({ severity: "success", summary: response.data.message, life: 3000 });
    }
    return response.data;
  } catch (error) {
    // Galat sudah ditampilkan sebagai toast oleh errorApiHandler; sesuai kontrak di atas kembalikan undefined
    // (bukan melempar) agar status memuat/menyimpan di halaman pemanggil tetap dipulihkan.
    try {
      errorApiHandler(error);
    } catch {
      /* sudah ditampilkan */
    }
    return undefined;
  }
};
const apiPenunjangGet = (url: string) => apiPenunjangKirim("get", url);
const apiPenunjangPost = (url: string, data: object = {}, diam = false) => apiPenunjangKirim("post", url, data, diam);
const apiPenunjangPut = (url: string, data: object = {}, diam = false) => apiPenunjangKirim("put", url, data, diam);
const apiPenunjangDelete = (url: string) => apiPenunjangKirim("delete", url);

// PROGRAM PUSKESMAS (program-puskesmas-service: KIA/KB, Imunisasi, MTBS/MTBM, Sasaran, UKM, Laporan Dinkes).
// Path relatif terhadap VITE_BASE_PROGRAM_PUSKESMAS, mis. apiProgramPuskesmasGet("/kia/anc?page=1"). Tulis
// (POST/PUT/DELETE) menampilkan toast sukses; galat ditampilkan errorApiHandler dan fungsi mengembalikan undefined.
const apiProgramPuskesmasKirim = async (metode: "get" | "post" | "put" | "delete", url: string, data: object = {}, diam = false) => {
  url = cekHost(import.meta.env.VITE_BASE_PROGRAM_PUSKESMAS, url);
  try {
    const response = metode === "get" || metode === "delete"
      ? await baseInstanceProgramPuskesmas[metode](url)
      : await baseInstanceProgramPuskesmas[metode](url, data);
    if (metode !== "get" && !diam && response.data?.message) {
      app.config.globalProperties.$toast.add({ severity: "success", summary: response.data.message, life: 3000 });
    }
    return response.data;
  } catch (error) {
    try {
      errorApiHandler(error);
    } catch {
      /* sudah ditampilkan */
    }
    return undefined;
  }
};
const apiProgramPuskesmasGet = (url: string) => apiProgramPuskesmasKirim("get", url);
const apiProgramPuskesmasPost = (url: string, data: object = {}, diam = false) => apiProgramPuskesmasKirim("post", url, data, diam);
const apiProgramPuskesmasPut = (url: string, data: object = {}, diam = false) => apiProgramPuskesmasKirim("put", url, data, diam);
const apiProgramPuskesmasDelete = (url: string) => apiProgramPuskesmasKirim("delete", url);
// Ekspor Excel (laporan Dinkes): respons berkas (blob), bukan {message, payload}.
export const apiProgramPuskesmasDownload = async (url: string) => {
  const dasar = import.meta.env.VITE_BASE_PROGRAM_PUSKESMAS;
  const host = cekHost(dasar, url);
  const fullUrl = /^https?:/.test(host) ? host : `${String(dasar).replace(/\/$/, "")}${url}`;
  const token = localStorage.getItem("access_token");
  if (!token) {
    alert("Token tidak ditemukan, silakan login ulang");
    return;
  }
  try {
    return await axios.get(fullUrl, {
      responseType: "blob",
      headers: { Authorization: token, Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
    });
  } catch (error) {
    errorApiHandler(error);
    return undefined;
  }
};

// URL absolut layanan antrian untuk halaman tanpa login (layar TV mode kiosk); dipanggil dengan fetch
// biasa agar tidak membawa token/toast galat milik instance axios.
const urlPublikAntrian = (path: string) => {
  const base = String(import.meta.env.VITE_BASE_ANTRIAN ?? "").replace(/\/$/, "");
  const hasil = cekHost(base, path);
  return /^https?:\/\//.test(hasil) ? hasil : base + hasil;
};
export {
  apiPenunjangGet,
  apiStudioGet,
  apiEkstensi,
  apiStudioPost,
  apiStudioPut,
  apiPenunjangPost,
  apiPenunjangPut,
  apiPenunjangDelete,
  apiProgramPuskesmasGet,
  apiProgramPuskesmasPost,
  apiProgramPuskesmasPut,
  apiProgramPuskesmasDelete,
  urlPublikAntrian,
  apiBpjsGet,
  apiBpjsPost,
  apiBpjsPut,
  apiBpjsDelete,
  apiLisGet,
  apiLisPost,
  apiLisPut,
  apiLisDelete,
  apiSatuSehatGet,
  apiSatuSehatPost,
  apiLaporanGet,
  apiBasePost,
  apiBaseGet,
  apiBasePut,
  apiBaseDelete,
  apiAuthPost,
  apiAuthDelete,
  apiAuthGet,
  apiAuthPut,
  apiSettingPost,
  apiSettingGet,
  apiSettingPut,
  apiSettingDelete,
  apiDatamasterGet,
  apiDatamasterPost,
  apiDatamasterPut,
  apiDatamasterDelete,
  apiPembayaranGet,
  apiPembayaranPost,
  apiPembayaranPut,
  apiPembayaranDelete,
  apiLaboratoriumGet,
  apiLaboratoriumPost,
  apiLaboratoriumPut,
  apiLaboratoriumDelete,
  apiAdmisiGet,
  apiAdmisiPost,
  apiAdmisiPut,
  apiAdmisiPatch,
  apiAdmisiDelete,
  apiIgdGet,
  apiIgdPost,
  apiIgdPut,
  apiIgdDelete,
  apiRawatJalanGet,
  apiRawatJalanPut,
  apiFarmasiGet,
  apiFarmasiPost,
  apiFarmasiPostNoMessage,
  apiFarmasiPut,
  apiFarmasiDelete,
  apiFarmasiPatch,
  apiRekamMedisGet,
  apiRekamMedisPost,
  apiRekamMedisPut,
  apiRawatInapGet,
  apiRawatInapPost,
  apiRawatInapPut,
  apiInventoryGet,
  apiInventoryPost,
  apiInventoryPut,
  apiInventoryDelete,
  apiRekamMedisDelete,
  apiRekamMedisDownload,
  apiAntrianGet,
  apiAntrianDelete,
  apiAntrianPost,
  apiAntrianPut,
  apiAntrianGetNoMessage,
  apiStokGet,
  apiStokPost,
  apiStokPut,
  apiStokDelete,
};
