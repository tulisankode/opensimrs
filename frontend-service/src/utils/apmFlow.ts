import { defineStore } from "pinia";

type PatientStatus = "" | "success" | "not_found";

interface SelectedPoli {
  uuid: string;
  name: string;
}

interface ApmFlowState {
  patientStatus: PatientStatus;
  identity: string | null;
  noIdentity: string | null;
  paymentMethod: string | null;
  patientData: any | null;
  selectedPoli: SelectedPoli | null;
  selectedDoctorUuid: string | null;
  selectedJadwalUuid: string | null;
  apmSuccessResponse: any | null;
}

const STORAGE_KEY = "apm_flow_state";

export const useApmFlowStore = defineStore("apmFlow", {
  state: (): ApmFlowState => {
    const initial: ApmFlowState = {
      patientStatus: "",
      identity: null,
      noIdentity: null,
      paymentMethod: null,
      patientData: null,
      selectedPoli: null,
      selectedDoctorUuid: null,
      selectedJadwalUuid: null,
      apmSuccessResponse: null,
    };

    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        return { ...initial, ...saved };
      }
    } catch {
      // ignore
    }
    return initial;
  },

  actions: {
    save() {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state));
      } catch {
        // ignore
      }
    },

    setIdentity(identity: string | null, noIdentity: string | null) {
      this.identity = identity;
      this.noIdentity = noIdentity;
      this.save();
    },

    setPatientStatus(status: PatientStatus) {
      this.patientStatus = status;
      this.save();
    },

    setPatientData(data: any | null) {
      this.patientData = data;
      this.save();
    },

    setSelectedPoli(uuid: string, name: string) {
      this.selectedPoli = { uuid, name };
      this.save();
    },

    setSelectedDoctorUuid(uuid: string | null) {
      this.selectedDoctorUuid = uuid;
      this.save();
    },

    setSelectedJadwalUuid(uuid: string | null) {
      this.selectedJadwalUuid = uuid;
      this.save();
    },

    setPaymentMethod(method: string | null) {
      this.paymentMethod = method;
      this.save();
    },

    setApmSuccessResponse(resp: any | null) {
      this.apmSuccessResponse = resp;
      this.save();
    },

    resetFlow() {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
      this.$reset();
    },
  },
});
