import axios, { type AxiosResponse } from "axios";

// NOTE Helper Converter
type AnyObject = { [key: string]: any };

// Convert camelCase to snake_case
const toSnakeCase = (obj: AnyObject | any[]): AnyObject | any[] => {
  if (typeof obj !== "object" || obj === null || obj instanceof FormData)
    return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase(item));
  }

  return Object.keys(obj).reduce((acc: AnyObject, key: string) => {
    const snakeKey = key.replace(
      /[A-Z]/g,
      (letter) => `_${letter.toLowerCase()}`
    );
    acc[snakeKey] = toSnakeCase(obj[key]);
    return acc;
  }, {});
};

// Convert snake_case to camelCase
const toCamelCase = (obj: AnyObject | any[]): AnyObject | any[] => {
  if (typeof obj !== "object" || obj === null || obj instanceof FormData)
    return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item));
  }

  return Object.keys(obj).reduce((acc: AnyObject, key: string) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );
    acc[camelKey] = toCamelCase(obj[key]);
    return acc;
  }, {});
};

const normalizeRawatJalanBaseUrl = (baseUrl: string | undefined) =>
  baseUrl?.replace(/\/api\/v3\/rawat-jalan\/?$/, "/api/v3/rajal");

const baseInstance = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_URL,
});

baseInstance.interceptors.request.use(
  (config) => {
    const token = "";
    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = token;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

baseInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// login
const authInstance = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_AUTH,
});

authInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");

  if (!token) {
    config.headers["Authorization"] = "";
  } else {
    config.headers["Authorization"] = `${token}`;
  }
  if (config.data) {
    config.data = toSnakeCase(config.data);
  }

  return config;
});

authInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Setting
const settingInstance = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_URL_SETTING,
});

settingInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");

  if (!token) {
    config.headers["Authorization"] = "";
  } else {
    config.headers["Authorization"] = `${token}`;
  }
  if (config.data) {
    config.data = toSnakeCase(config.data);
  }

  return config;
});

settingInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

//Datamaster
const baseInstanceDatamaster = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_DATAMASTER,
});

baseInstanceDatamaster.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = `${token}`;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

baseInstanceDatamaster.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

//Pembayaran
const baseInstancePembayaran = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_PEMBAYARAN,
});

baseInstancePembayaran.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = `${token}`;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

baseInstancePembayaran.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Laboratorium
const baseInstanceLaboratorium = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_LABORATORIUM,
});

baseInstanceLaboratorium.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = `${token}`;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

baseInstanceLaboratorium.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

//Admisi
const baseInstanceAdmisi = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_ADMISI,
});

baseInstanceAdmisi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = token;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

baseInstanceAdmisi.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

//Farmasi
const baseInstanceFarmasi = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_FARMASI,
});

baseInstanceFarmasi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = token;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

baseInstanceFarmasi.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

//IGD
const baseInstanceIgd = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_IGD,
});

baseInstanceIgd.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = `${token}`;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Rawat Jalan
const baseInstanceRawatJalan = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: normalizeRawatJalanBaseUrl(import.meta.env.VITE_BASE_RAWAT_JALAN),
});

baseInstanceRawatJalan.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = `${token}`;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

baseInstanceRawatJalan.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Rawat Inap Perpindahan Bangsal
const baseInstanceRawatInap = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_RAWAT_INAP,
});

baseInstanceRawatInap.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = `${token}`;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

baseInstanceRawatInap.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Rekam Medis
const baseInstanceRekamMedis = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_REKAM_MEDIS,
});

baseInstanceRekamMedis.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");

    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = `${token}`;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

baseInstanceRekamMedis.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// INVENTORY
const baseInstanceInventory = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_INVENTORY,
});

baseInstanceInventory.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = `${token}`;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

baseInstanceInventory.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

//Antrian
const baseInstanceAntrian = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_ANTRIAN,
});

baseInstanceAntrian.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = `${token}`;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

baseInstanceAntrian.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

//Stok
const baseInstanceStok = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_STOK,
});

baseInstanceStok.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      config.headers["Authorization"] = "";
    } else {
      config.headers["Authorization"] = `${token}`;
    }
    if (config.data) {
      config.data = toSnakeCase(config.data);
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

baseInstanceStok.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => {
    return Promise.reject(error);
  }
);

//Laporan & Dashboard (laporan-service)
const baseInstanceLaporan = axios.create({
  headers: {
    common: {
      Accept: "text/plain, */*",
    },
  },
  baseURL: import.meta.env.VITE_BASE_DASHBOARD,
});

baseInstanceLaporan.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    config.headers["Authorization"] = token ? `${token}` : "";
    return config;
  },
  (error) => Promise.reject(error)
);

baseInstanceLaporan.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => Promise.reject(error)
);

//SATUSEHAT (satusehat-service)
const baseInstanceSatuSehat = axios.create({
  headers: {
    common: {
      Accept: "application/json",
    },
  },
  baseURL: import.meta.env.VITE_BASE_SATUSEHAT,
});

baseInstanceSatuSehat.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    config.headers["Authorization"] = token ? `${token}` : "";
    return config;
  },
  (error) => Promise.reject(error)
);

baseInstanceSatuSehat.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => Promise.reject(error)
);

//BPJS (bpjs-service)
const baseInstanceBpjs = axios.create({
  headers: {
    common: {
      Accept: "application/json",
    },
  },
  baseURL: import.meta.env.VITE_BASE_BPJS,
});

baseInstanceBpjs.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    config.headers["Authorization"] = token ? `${token}` : "";
    return config;
  },
  (error) => Promise.reject(error)
);

baseInstanceBpjs.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) {
      response.data = toCamelCase(response.data);
    }
    return response;
  },
  (error) => Promise.reject(error)
);

// Penunjang (penunjang-service): Fisioterapi, Radiologi, MCU — request snake_case, respons camelCase.
const baseInstancePenunjang = axios.create({
  headers: { common: { Accept: "application/json" } },
  baseURL: import.meta.env.VITE_BASE_PENUNJANG,
});
baseInstancePenunjang.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    config.headers["Authorization"] = token ? `${token}` : "";
    if (config.data) config.data = toSnakeCase(config.data);
    return config;
  },
  (error) => Promise.reject(error)
);
baseInstancePenunjang.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) response.data = toCamelCase(response.data);
    return response;
  },
  (error) => Promise.reject(error)
);

// SIMRS Studio (studio-service): mode pengembang berbasis AI — request snake_case, respons camelCase.
const baseInstanceStudio = axios.create({
  headers: { common: { Accept: "application/json" } },
  baseURL: import.meta.env.VITE_BASE_STUDIO || "http://localhost:8090/api/v3/studio",
});
baseInstanceStudio.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    config.headers["Authorization"] = token ? `${token}` : "";
    if (config.data) config.data = toSnakeCase(config.data);
    return config;
  },
  (error) => Promise.reject(error)
);
baseInstanceStudio.interceptors.response.use(
  (response: AxiosResponse) => {
    if (response.data) response.data = toCamelCase(response.data);
    return response;
  },
  (error) => Promise.reject(error)
);

// Tanpa konversi kunci (snake/camel): untuk ekstensi tanpa kode, yang definisi & kolom hasil kuerinya harus utuh.
const baseInstanceMentah = axios.create({ headers: { common: { Accept: "application/json" } } });
baseInstanceMentah.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    config.headers["Authorization"] = token ? `${token}` : "";
    return config;
  },
  (error) => Promise.reject(error)
);

export {
  baseInstanceMentah,
  baseInstanceStudio,
  baseInstancePenunjang,
  baseInstance,
  authInstance,
  settingInstance,
  baseInstanceDatamaster,
  baseInstancePembayaran,
  baseInstanceLaboratorium,
  baseInstanceAdmisi,
  baseInstanceIgd,
  baseInstanceRawatJalan,
  baseInstanceRawatInap,
  baseInstanceFarmasi,
  baseInstanceRekamMedis,
  baseInstanceInventory,
  baseInstanceAntrian,
  baseInstanceStok,
  baseInstanceLaporan,
  baseInstanceSatuSehat,
  baseInstanceBpjs,
};
