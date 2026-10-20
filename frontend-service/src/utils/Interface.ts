import { linkType } from "@/utils/Enum";

export interface SidebarBody {
  name: string;
  icon?: string;
  type: linkType;
  datas?: any;
  url?: string;
  child?: SidebarBody[];
  permission?: {
    module: string;
    submodule?: string | null;
    action?: string | string[] | null;
    feature?: string | string[] | null;
  };
  featureStatus?: "real" | "stub";
}

export interface selectedBedType {
  roomCategory: string;
  roomClass: string;
  room: string;
  bed: number;
}

export interface ListMenu {
  title: string;
  icon: string;
  iconWeight?: string;
  url: string;
  // Modul segmen yang masih dalam pengembangan (badge "Soon").
  segera?: boolean;
  // Grup menu (mis. "Penunjang") berisi beberapa modul dalam dropdown.
  anak?: ListMenu[];
  // Isi grup ditampilkan sebagai daftar datar (tanpa subjudul bidang/instalasi), mis. "Perawatan Intensif".
  datar?: boolean;
}

export interface FilterAdmisi {
  q?: string;
  paymentMethod?: string;
  page?: number;
  limit?: number;
  platform?: string;
  poly?: string[];
  startDate?: string;
  endDate?: string;
  dpjp?: string;
  status?: string;
  room?: string[];
  withoutIdentity?: string;
}

export interface Allow {
  name: string;
  checked: boolean;
}

export interface Feature {
  name: string;
  checked: boolean;
  allows: Allow[];
}

export interface SubModule {
  name: string;
  checked: boolean;
  features: Feature[];
  allows: Allow[];
}

export interface Module {
  module: string;
  checked: boolean;
  subModules: SubModule[];
}
