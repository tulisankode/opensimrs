import "./assets/css/main.css";

import { createApp } from "vue";
import { setAplikasi } from "./utils/aplikasi";
import { createPinia } from "pinia";

import App from "./App.vue";
import router from "./router";
import PhosphorIcons from "@phosphor-icons/vue";

import PrimeVue from "primevue/config";
import Aura from "@primevue/themes/aura";
import InputText from "primevue/inputtext";
import IconField from "primevue/iconfield";
import InputIcon from "primevue/inputicon";
import Dialog from "primevue/dialog";
import Breadcrumb from "primevue/breadcrumb";

import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
import AutoComplete from "primevue/autocomplete";
import Textarea from "primevue/textarea";
import MultiSelect from "primevue/multiselect";
import InputNumber from "primevue/inputnumber";
import Chip from "primevue/chip";

import Select from "primevue/select";
import DatePicker from "primevue/datepicker";
import ToggleSwitch from "primevue/toggleswitch";
import Card from "primevue/card";
import Tooltip from "primevue/tooltip";
import Button from "primevue/button";
import DataTable from "primevue/datatable";
import Column from "primevue/column";
import Paginator from "primevue/paginator";
import InputGroup from "primevue/inputgroup";
import InputGroupAddon from "primevue/inputgroupaddon";

import FileUpload from "primevue/fileupload";
import ColorPicker from "primevue/colorpicker";

import Chart from "primevue/chart";
import ProgressBar from "primevue/progressbar";
import Menu from "primevue/menu";
import Checkbox from "primevue/checkbox";
import Carousel from "primevue/carousel";
import Editor from "primevue/editor";

import Tabs from "primevue/tabs";
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanels from "primevue/tabpanels";
import TabPanel from "primevue/tabpanel";
import Slider from 'primevue/slider';
import Toast from 'primevue/toast';
import ToastService from 'primevue/toastservice';
import RadioButton from 'primevue/radiobutton';
import SpeedDial from 'primevue/speeddial';
import { definePreset } from "@primevue/themes";
import { terapkanTema, profilFaskes } from "./utils/tema";

import { CkeditorPlugin } from '@ckeditor/ckeditor5-vue';

import icons from "./components/icons";
import Vue3Lottie from 'vue3-lottie'

export const app = createApp(App);
setAplikasi(app);

app.use(createPinia());
app.use(router);
app.use(PhosphorIcons);

const myPreset = definePreset(Aura, {
  semantic: {
    colorScheme: {
      light: {
        text: {
          color: "#000000",
        },
      },
    },
  },
});
app.use(CkeditorPlugin)
app.use(ToastService);

app.use(PrimeVue, {
  theme: {
    preset: myPreset,
    options: {
      darkModeSelector: ".my-app-dark",
      cssLayer: {
        name: "primevue",
        order: "tailwind-base, primevue, tailwind-utilities",
      },
    },
  },
});
// Warna tema faskes tersimpan (Setting › Logo & Warna) diterapkan sejak awal agar tidak berkedip.
terapkanTema(profilFaskes.value?.bgWarna ?? profilFaskes.value?.bg_warna);
app.component("InputText", InputText);
app.component("IconField", IconField);
app.component("InputIcon", InputIcon);
app.component("Dialog", Dialog);
app.component("Breadcrumb", Breadcrumb);
app.component("Accordion", Accordion);
app.component("AccordionPanel", AccordionPanel);
app.component("AccordionHeader", AccordionHeader);
app.component("AccordionContent", AccordionContent);
app.component("AutoComplete", AutoComplete);
app.component("TextArea", Textarea);
app.component("MultiSelect", MultiSelect);
app.component("InputNumber", InputNumber);
app.component("Chip", Chip);
app.component("Card", Card);
app.component("Button", Button);
app.directive("tooltip", Tooltip);
app.component("Select", Select);
app.component("DatePicker", DatePicker);
app.component("ToggleSwitch", ToggleSwitch);
app.component("FileUpload", FileUpload);
app.component("ColorPicker", ColorPicker);
app.component("DataTable", DataTable);
app.component("Column", Column);
app.component("Paginator", Paginator);
app.component("Chart", Chart);
app.component("ProgressBar", ProgressBar);
app.component("Menu", Menu);
app.component("Checkbox", Checkbox);
app.component("Carousel", Carousel);
app.component("InputGroup", InputGroup);
app.component("InputGroupAddon", InputGroupAddon);
app.component("Editor", Editor);
app.component("Tabs", Tabs);
app.component("TabList", TabList);
app.component("Tab", Tab);
app.component("TabPanels", TabPanels);
app.component("TabPanel", TabPanel);
app.component("Slider", Slider);
app.component("Toast", Toast);
app.component("RadioButton", RadioButton);
app.component("SpeedDial", SpeedDial);

app.use(icons)
app.use(Vue3Lottie)

app.mount("#app");
