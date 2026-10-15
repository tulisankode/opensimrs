<script setup lang="ts">
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import { jawabKonfirmasi, konfirmasiPeriksa } from "./antrianPoli";
</script>

<template>
  <CustomDialog
    :visible="konfirmasiPeriksa.tampil"
    @update:visible="(v: boolean) => !v && jawabKonfirmasi('batal')"
    @closeDialog="jawabKonfirmasi('batal')"
  >
    <template #header>Pasien belum dipanggil</template>
    <template #body>
      <div class="pt-4 text-sm max-w-[460px]">
        <p>
          <b>{{ konfirmasiPeriksa.row?.patient?.name }}</b>
          (antrian <b>{{ konfirmasiPeriksa.row?.noAntrianPoli }}</b>) belum dipanggil.
          Panggil dulu agar nomor tampil & diumumkan di layar antrian?
        </p>
        <div class="flex justify-end gap-2 mt-5">
          <CustomButton label="Batal" outlined borderColor="border-grey-300" textColor="text-grey-400" @click="jawabKonfirmasi('batal')" />
          <CustomButton label="Buka Tanpa Memanggil" outlined borderColor="border-opensimrs-300" textColor="text-opensimrs-300" @click="jawabKonfirmasi('buka')" />
          <CustomButton label="Panggil Sekarang" @click="jawabKonfirmasi('panggil')" />
        </div>
      </div>
    </template>
  </CustomDialog>
</template>
