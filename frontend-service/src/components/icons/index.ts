import type { App } from "vue";
import MenuOpenIcon from "./MenuOpenIcon.vue";
import UserPlusIcon from "./UserPlusIcon.vue";
import BPJSIcon from "./BPJSIcon.vue";
import DatabaseUserIcon from "./DatabaseUserIcon.vue";
import MonitoringBedIcon from "./MonitoringBedIcon.vue";
import FileReportIcon from "./FileReportIcon.vue";
import GearFillIcon from "./GearFillIcon.vue";
import FisioIcon from "./FisioIcon.vue";
import TrainingIcon from "./TrainingIcon.vue";
import DoubleBoxIcon from "./DoubleBoxIcon.vue";
import DatabaseFill from "./DatabaseFill.vue";
import ArrowRightBrokenIcon from "./ArrowRightBrokenIcon.vue";
import UploadPictureIcon from "./UploadPictureIcon.vue";
import DetailIcon from "./DetailIcon.vue";
import CashRegisterIcon from "./CashRegisterIcon.vue";
import PayMoneyIcon from "./PayMoneyIcon.vue";
import ClosedBillIcon from "./ClosedBillIcon.vue";
import LayoutIcon from "./LayoutIcon.vue";
import UserDoctorIcon from "./UserDoctorIcon.vue";
import PillFillIcon from "./PillFillIcon.vue";
import ShoppingBagIcon from "./ShoppingBagIcon.vue";
import UndoFillIcon from "./UndoFillIcon.vue";
import SyringeFillIcon from "./SyringeFillIcon.vue";
import HistoryIcon from "./HistoryIcon.vue";
import FileImportIcon from "./FileImportIcon.vue";
import TrashFillIcon from "./TrashFillIcon.vue";
import HandshakeIcon from "./HandshakeIcon.vue";
import SolarUserCheckIcon from "./SolarUserCheckIcon.vue";
import CheckCircleIcon from "./CheckCircleIcon.vue";
import HouseFill from "./HouseFill.vue";
import AddPrint from "./AddPrint.vue";
import Stethoscop from "./Stethoscop.vue";
import PlusIcon from "./PlusIcon.vue";
import OpenBoxIcon from "./OpenBoxIcon.vue";
import BoxPlusIcon from "./BoxPlusIcon.vue";
import BoxUpIcon from "./BoxUpIcon.vue";
import BoxDownIcon from "./BoxDownIcon.vue";
import DownloadIcon from "./DownloadIcon.vue";
import HospitalFillIcon from "./HospitalFillIcon.vue";
import BellNotificationIcon from "./BellNotificationIcon.vue";
import UserAccountIcon from "./UserAccountIcon.vue";
import SideMenuTitle from "./SideMenuTitle.vue";
import ExpandIcon from "./ExpandIcon.vue";
import UangIcon from "./UangIcon.vue";
import WalletIcon from "./WalletIcon.vue";
import CreditCardIcon from "./CreditCardIcon.vue";
import DoctorIcon from "./DoctorIcon.vue";
import AnnouncementIcon from "./AnnouncementIcon.vue";
import SkipIcon from "./SkipIcon.vue";
import FinishButton from "./FinishButton.vue";

export default {
  install: (app: App<Element>) => {
    app.component("MenuOpenIcon", MenuOpenIcon);
    app.component("UserPlusIcon", UserPlusIcon);
    app.component("BPJSIcon", BPJSIcon);
    app.component("DatabaseUserIcon", DatabaseUserIcon);
    app.component("MonitoringBedIcon", MonitoringBedIcon);
    app.component("FileReportIcon", FileReportIcon);
    app.component("GearFillIcon", GearFillIcon);
    app.component("FisioIcon", FisioIcon);
    app.component("TrainingIcon", TrainingIcon);
    app.component("DoubleBoxIcon", DoubleBoxIcon);
    app.component("DatabaseFill", DatabaseFill);
    app.component("ArrowRightBrokenIcon", ArrowRightBrokenIcon);
    app.component("UploadPictureIcon", UploadPictureIcon);
    app.component("DetailIcon", DetailIcon);
    app.component("CashRegisterIcon", CashRegisterIcon);
    app.component("PayMoneyIcon", PayMoneyIcon);
    app.component("ClosedBillIcon", ClosedBillIcon);
    app.component("LayoutIcon", LayoutIcon);
    app.component("UserDoctorIcon", UserDoctorIcon);
    app.component("PillFillIcon", PillFillIcon);
    app.component("ShoppingBagIcon", ShoppingBagIcon);
    app.component("UndoFillIcon", UndoFillIcon);
    app.component("SyringeFillIcon", SyringeFillIcon);
    app.component("HistoryIcon", HistoryIcon);
    app.component("FileImportIcon", FileImportIcon);
    app.component("TrashFillIcon", TrashFillIcon);
    app.component("HandshakeIcon", HandshakeIcon);
    app.component("SolarUserCheckIcon", SolarUserCheckIcon);
    app.component("CheckCircleIcon", CheckCircleIcon);
    app.component("HouseFill", HouseFill);
    app.component("AddPrint", AddPrint);
    app.component("Stethoscop", Stethoscop);
    app.component("PlusIcon", PlusIcon);
    app.component("DownloadIcon", DownloadIcon);
    app.component("HospitalFillIcon", HospitalFillIcon);
    app.component("BellNotificationIcon",BellNotificationIcon)
    app.component("UserAccountIcon",UserAccountIcon)
    app.component("SideMenuTitle",SideMenuTitle)
    app.component("ExpandIcon",ExpandIcon)
    app.component("DoctorIcon",DoctorIcon)
    app.component("AnnouncementIcon",AnnouncementIcon)
    app.component("SkipIcon",SkipIcon)
    app.component("FinishButton",FinishButton)

    // NOTE Inventory
    app.component("OpenBoxIcon", OpenBoxIcon);
    app.component("BoxPlusIcon", BoxPlusIcon);
    app.component("BoxUpIcon", BoxUpIcon);
    app.component("BoxDownIcon", BoxDownIcon);

    // NOTE Pembayaran
    app.component("UangIcon", UangIcon)
    app.component("WalletIcon", WalletIcon)
    app.component("CreditCardIcon", CreditCardIcon)
  },
};
