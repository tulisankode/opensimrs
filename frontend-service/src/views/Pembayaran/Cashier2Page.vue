<script setup lang="ts">
import { onMounted, ref, type PropType } from "vue";
import CustomButton from "@/components/Base/CustomButton.vue";
import CustomSelect from "@/components/Base/CustomSelect.vue";
import CustomBreadCrumb from "@/components/Base/CustomBreadCrumb.vue";
import CustomAccordion from "@/components/Base/CustomAccordion.vue";
import CustomTextfield from "@/components/Base/CustomTextfield.vue";
import CustomChip from "@/components/Base/CustomChip.vue";
import CustomDialog from "@/components/Base/CustomDialog.vue";
import CustomInputNumber from "@/components/Base/CustomInputNumber.vue";

const emits = defineEmits(["update:rows", "update:current-page"]);
const handleRowsUpdate = (rows: number) => {
  console.log("Rows updated:", handleRowsUpdate);
};

const closeHarianDialog = ref(false);
const closeKasirDialog = ref(false);
const pembayaranDialog = ref(false);
const pembayaranBPJSDialog = ref(false);
const listTagihanIGDDialog = ref(false);
const listTagihanRIDialog = ref(false);
const closeBillDialog = ref(false);

const itemsPasien = ref([
  {
    layanan: "IGD",
    doctor: "dr. Spesialis Sp. A",
    tanggal_jadwal: "10-10-2010",
    insurance_account_name: "TUNAI",
    no_time: "10:00",
    status: "Lunas",
    jumlah: "1",
    tarif: "1000",
    total: "1500",
    tindakan: "Spesialis Poli Pagi",
    penunjangLab: "Kimia Klinik",
    penunjangFisio: "Fisio 1",
    obat: "Paramex",
    golonganObat: "Obat Keras",
    jasa: "1000",
    alkes: "Kasa",
    kamar: "Mawar",
    jenisRuangan: "Rawatan Umum",
    kelasRuangan: "Kelas I",
    waktu: "2 hari",
  },
  {
    layanan: "Rawat Inap",
    doctor: "dr. Spesialis Sp. A",
    tanggal_jadwal: "10-10-2010",
    insurance_account_name: "TUNAI",
    no_time: "10:00",
    status: "Lunas",
    jumlah: "4",
    tarif: "1000",
    total: "4000",
    tindakan: "Bersih-Bersih Toilet",
    penunjangLab: "Darah lengkap",
    penunjangFisio: "Fisio 2",
    obat: "Paramex",
    golonganObat: "Obat Keras",
    jasa: "1000",
    alkes: "Alcohol",
    kamar: "Mawar",
    jenisRuangan: "Rawatan Umum",
    kelasRuangan: "Kelas I",
    waktu: "2 hari",
  },
  {
    layanan: "IGD",
    doctor: "dr. Spesialis Sp. A",
    tanggal_jadwal: "10-10-2010",
    insurance_account_name: "TUNAI",
    no_time: "10:00",
    new_patient: true,
    status: "Lunas",
    jumlah: "1",
    tarif: "2000",
    total: "2000",
    tindakan: "Potong Roti",
    penunjangLab: "Hematologi",
    penunjangFisio: "Fisio 3",
    obat: "Paramex",
    golonganObat: "Obat Keras",
    jasa: "1000",
    alkes: "Salonpas",
    kamar: "Mawar",
    jenisRuangan: "Rawatan Umum",
    kelasRuangan: "Kelas I",
    waktu: "2 hari",
  },
  {
    layanan: "Rawat Inap Bayi",
    doctor: "dr. Spesialis Sp. A",
    tanggal_jadwal: "10-10-2010",
    insurance_account_name: "TUNAI",
    insurance_account_name2: "Gabung Tagihan Keluarga",
    no_time: "10:00",
    status: "Lunas",
    jumlah: "3",
    tarif: "500",
    total: "1500",
    tindakan: "Asuhan Keperawatan",
    penunjangLab: "Darah Lengkap",
    penunjangFisio: "Fisio 4",
    obat: "Paramex",
    golonganObat: "Obat Keras",
    jasa: "1000",
    alkes: "Jarum Suntik",
    kamar: "Mawar",
    jenisRuangan: "Rawatan Umum",
    kelasRuangan: "Kelas I",
    waktu: "2 hari",
  },
  {
    layanan: "Rawat Inap Bayi",
    doctor: "dr. Spesialis Sp. A",
    tanggal_jadwal: "10-10-2010",
    insurance_account_name: "TUNAI",
    insurance_account_name2: "Gabung Tagihan Keluarga",
    no_time: "10:00",
    status: "Lunas",
    jumlah: "2",
    tarif: "3000",
    total: "6000",
    tindakan: "Asuhan Kebidanan",
    penunjangLab: "Testing",
    penunjangFisio: "Fisio 5",
    obat: "Paramex",
    golonganObat: "Obat Keras",
    jasa: "1000",
    alkes: "Testing",
    kamar: "Mawar",
    jenisRuangan: "Rawatan Umum",
    kelasRuangan: "Kelas I",
    waktu: "2 hari",
  },
]);
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <Card
      pt:body:class="h-full pt-0"
      pt:content:class="h-full"
      class="h-full overflow-hidden overflow-y-auto"
    >
      <template #header>
        <CustomAccordion :openWithHeader="false" noBorder>
          <template #header>
            <div class="flex justify-between w-full align-middle">
              <div class="flex">
                <CustomButton icon="PhArrowClockwise" class="mr-5" />
                <CustomBreadCrumb
                  :home="{
                    label: 'Kasir',
                    home: true,
                  }"
                />
              </div>
            </div>
          </template>
          <template #content>
            <div class="flex flex-row mt-[10px]">
              <CustomTextfield
                label="Pencarian Transaksi"
                prependIcon="PhMagnifyingGlass"
                placeholder="Cari Nama / address / No. RM"
                class="w-[48%] mr-4"
              />
              <div
                class="bg-opensimrs-300 w-[2px] h-[35px] mt-[30px] mr-[15px]"
              ></div>
              <CustomTextfield
                pr
                label="Saldo Awal"
                placeholder="0"
                class="basis-[15%]"
                disabled
              >
                <template #prependText>
                  <div
                    class="font-semibold text-MD leading-7 text-opensimrs-300 w-[53.34px] flex items-center justify-center border-r"
                  >
                    Rp.
                  </div>
                </template>
              </CustomTextfield>
              <CustomSelect
                disabled
                label="Pilih Shift"
                class="ml-3 basis-[10%]"
                optionLabel=""
                optionValue=""
                :options="['Pagi', 'Siang', 'Sore', 'Malem']"
              />
              <CustomButton
                @click="closeKasirDialog = true"
                label="Closing Kasir"
                class="ml-3 mt-[25px]"
              />
              <CustomButton
                @click="closeHarianDialog = true"
                label="Closing Harian"
                outlined
                borderColor="border-opensimrs-300"
                textColor="text-opensimrs-300"
                class="ml-3 mt-[25px]"
              />
            </div>
            <div class="flex mt-[10px]"></div>
          </template>
          <template #collapseIcon>
            <CustomButton
              icon="PhCaretUp"
              backgroundColor="bg-opensimrs-75"
              textColor="text-opensimrs-300"
            />
          </template>
          <template #expandIcon>
            <CustomButton
              icon="PhCaretDown"
              backgroundColor="bg-opensimrs-75"
              textColor="text-opensimrs-300"
            />
          </template>
        </CustomAccordion>
      </template>
      <template #content>
        <div class="grid grid-cols-2 gap-2">
          <div
            class="h-[21%] border-2 border-opensimrs-300 rounded-lg flex flex-row mr-[20px]"
          >
            <div class="basis-1/2">
              <p class="font-bold text-MD mt-[15px] ml-[15px]">
                Nama lengkap pasien
              </p>
              <p class="ml-[15px] text-sm">REG1231235</p>
              <CustomButton class="h-5 text-xs ml-[15px]"
                >00-00-00</CustomButton
              >
              <CustomChip
                :showCheckedIcon="false"
                label="Laki-laki"
                bgColor="bg-male-75"
                textColor="text-male-300"
                customClass="h-5 pr-[6px] border-none ml-[10px]"
              />
              <CustomChip
                :showCheckedIcon="false"
                label="Perempuan"
                bgColor="bg-female-75"
                textColor="text-female-300"
                customClass="h-5 pr-[6px] border-none mr-[5px]"
              />
            </div>
            <div
              class="bg-mediumGrey-300 w-[1px] h-[74px] mr-[20px] mt-[15px]"
            ></div>
            <div class="mt-[30px] mr-[40px]">
              <p class="text-xs font-bold underline underline-offset-2">Umur</p>
              <p class="">24Thn 2Bln 1Hari</p>
            </div>
          </div>

          <!-- Kolom Pembayaran -->
          <div class="p-5 rounded-lg bg-opensimrs-50">
            <!-- Total Pembayaran -->
            <div class="flex justify-between">
              <p class="text-base font-bold font-poppins">Total Pembayaran</p>
              <div class="flex">
                <CustomButton
                  label="Cetak Invoice"
                  class="mt-[-10px] mr-[10px]"
                />
                <CustomButton label="Cetak Rincian Biaya" class="mt-[-10px]" />
              </div>
            </div>
            <hr class="mt-2 mb-2 border border-slate-300" />
            <!-- Biaya Administrasi -->
            <div class="flex justify-between mt-6">
              <div class="text-sm text-black font-poppins">
                Biaya Administrasi
              </div>
              <div class="text-sm font-poppins">Rp, 0</div>
            </div>
            <!-- Biaya Tindakan -->
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Biaya Tindakan</div>
              <div class="text-sm font-poppins">Rp, 0</div>
            </div>
            <!-- Biaya Obat -->
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Biaya Obat</div>
              <div class="text-sm font-poppins">Rp, 0</div>
            </div>
            <!-- Biaya Kamar -->
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">Biaya Kamar</div>
              <div class="text-sm font-poppins">Rp, 0</div>
            </div>
            <!-- PPN -->
            <div class="flex justify-between mt-4">
              <div class="text-sm font-poppins">PPN</div>
              <div class="text-sm font-poppins">Rp, 0</div>
            </div>
            <hr class="mt-4 border-dashed border-[1px] border-slate-300" />
            <!-- Diskon -->
            <div class="flex justify-between mt-6">
              <div class="text-sm font-poppins">Diskon</div>
              <div class="text-sm font-poppins">Rp, 0</div>
            </div>
            <hr class="mt-6 mb-2 border-black border-1" />
            <!-- Grand Total -->
            <div class="flex justify-between mt-6">
              <div class="text-sm font-bold font-poppins">Grand Total</div>
              <div class="text-sm font-bold font-poppins">Rp, 0</div>
            </div>

            <div class="flex mt-[30px]">
              <CustomInputNumber
                placeholder="5"
                :show-label="false"
                class="w-[80px] bg-white rounded-xl"
              >
                <template #appendText>
                  <div
                    class="font-semibold bg-white text-sm text-opensimrs-300 ml-[10px] mt-[10px] rounded-r-xl w-[20px]"
                  >
                    %
                  </div>
                </template>
              </CustomInputNumber>
              <CustomButton label="Pakai Diskon" class="ml-[10px]" />

              <CustomTextfield
                :showLabel="false"
                placeholder="Masukkan Kode Voucher"
                class="w-[30%] ml-[50px] mr-[10px] "
              />
              <CustomButton
                label="Pakai Voucher"
                class=""
              />
            </div>
            <!-- Button Bayar -->
            <div class="mt-[60px]">
              <div class="flex">
                <CustomButton
                  @click="pembayaranBPJSDialog = true"
                  label="Bayar"
                  class="w-full"
                />
              </div>
            </div>
            <!-- <div class="mt-[60px]">
              <div class="flex">
                <CustomButton 
                  @click="closeBillDialog = true"
                  label="Close Bill" 
                  class="w-full"
                  backgroundColor="bg-danger-300"
                  borderColor="border-danger-300"
                  textColor="text-white"
                />
              </div>
            </div> -->
          </div>

          <!-- List Tagihan Pelayanan -->
          <div class="mt-[-390px] mr-[20px]">
            <DataTable
              :value="itemsPasien"
              scrollable
              scrollHeight="380px"
              class="overflow-hidden rounded-[10px]"
              :pt="{ headerRow: 'text-SM' }"
              @rowClick="listTagihanRIDialog = true"
            >
              <Column
                field="no"
                headerClass="bg-opensimrs-300 text-white"
                bodyClass="text-SM"
                style="width: 60px"
              >
                <template #header>
                  <div class="w-full font-bold">List Tagihan Pelayanan</div>
                </template>
                <template #body="slotProps">
                  <div class="flex">
                    <p class="font-bold text-normal">
                      {{ slotProps.data.layanan }}
                    </p>
                    <CustomChip
                      class="ml-2"
                      :showCheckedIcon="false"
                      label="TUNAI"
                      bgColor="bg-opensimrs-50"
                      textColor="text-opensimrs-300"
                      borderColor="border-opensimrs-300"
                    />
                    <CustomChip
                      class="ml-2"
                      :showCheckedIcon="false"
                      label="BPJS"
                      bgColor="bg-warning-50"
                      textColor="text-warning-300"
                      borderColor="border-warning-300"
                    />
                  </div>
                  <div class="flex">
                    <UserDoctorIcon class="mt-2" />
                    <p class="mt-2 text-sm text-grey-400">
                      {{ slotProps.data.doctor }}
                    </p>
                  </div>
                  <div class="flex">
                    <p class="text-sm">Tanggal</p>
                    <PhArrowRight
                      :size="18"
                      class="my-auto ml-2 text-success-300"
                      weight="bold"
                    />
                    <p class="ml-2 text-sm">
                      {{ slotProps.data.tanggal_jadwal }}
                    </p>
                    <p class="ml-2 text-sm">{{ slotProps.data.no_time }}</p>
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </div>
      </template>
    </Card>

    <!-- Closing Harian -->
    <CustomDialog v-model:visible="closeHarianDialog" width="600px">
      <template #header>Closing Harian</template>
      <template #body>
        <div class="grid grid-flow-col grid-rows-1">
          <div class="row-span-1">
            <img
              src="../../assets/icons/profil.svg"
              class="w-[50px] h-[50px] mt-[20px]"
            />
          </div>
          <div class="mr-[250px]">
            <p class="font-bold mt-[20px]">Nama akun</p>
            <p class="text-sm text-grey-300">
              Terakhir login 4 Mar 2024 | 12:00
            </p>
          </div>
        </div>
        <div>
          <p class="mt-[30px] font-bold">
            Tanggal & Jam Closing
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
            <span class="font-normal">: 4 Mar 2024 | 12:00</span>
          </p>
        </div>
        <hr class="mt-8 border-1 border-grey-200" />
        <div class="text-center">
          <p class="mt-6 text-base font-bold text-grey-300">
            Apakah anda yakin ingin melakukan penutupan hari ini?
          </p>
        </div>
        <hr class="mt-6 border-1 border-grey-200" />
      </template>
      <template #footer>
        <CustomButton
          @click="closeHarianDialog = false"
          label="Batal"
          outlined
          class=""
          borderColor="border-grey-200"
          textColor="text-grey-300"
        />
        <CustomButton
          @click="() => {}"
          label="Closing Harian"
          class=""
          backgroundColor="bg-opensimrs-300"
        />
      </template>
    </CustomDialog>

    <!-- Kasir Harian -->
    <CustomDialog v-model:visible="closeKasirDialog" width="600px">
      <template #header>Closing Kasir</template>
      <template #body>
        <div class="grid grid-flow-col grid-rows-1">
          <div class="row-span-1">
            <img
              src="../../assets/icons/profil.svg"
              class="w-[50px] h-[50px] mt-[20px]"
            />
          </div>
          <div class="mr-[250px]">
            <p class="font-bold mt-[20px]">Nama akun</p>
            <p class="text-sm text-grey-300">
              Terakhir login 4 Mar 2024 | 12:00
            </p>
          </div>
        </div>
        <div class="grid grid-cols-[15%_15%_40%_30%]">
          <div>
            <p class="mt-[30px] text-sm font-bold">Shift</p>
          </div>
          <div>
            <p class="mt-[30px] text-sm">: Pagi</p>
          </div>
          <div>
            <p class="mt-[30px] ml-[30px] text-sm font-bold">
              Tanggal & Jam Closing
            </p>
          </div>
          <div>
            <p class="mt-[30px] ml-[30px] text-sm">: 4 Mar 2024 | 12:00</p>
          </div>
        </div>
        <hr class="mt-8 border-1 border-grey-200" />

        <!-- Saldo Awal -->
        <div class="flex justify-between">
          <div>
            <p class="mt-6 text-sm font-bold">Saldo Awal (Kas)</p>
          </div>
          <div>
            <p class="mt-6 text-sm">Saldo Awal (Kas)</p>
          </div>
        </div>

        <!-- Tunai -->
        <div class="flex justify-between">
          <div>
            <p class="mt-6 text-sm font-bold">Tunai</p>
          </div>
          <div>
            <CustomTextfield label="" class="mt-[15px]" placeholder="0">
              <template #prependText>
                <div
                  class="font-semibold text-MD leading-7 text-opensimrs-300 w-[53.34px] flex items-center justify-center border-r"
                >
                  Rp.
                </div>
              </template>
            </CustomTextfield>
          </div>
        </div>
        <hr class="mt-6 border-1 border-grey-200" />
      </template>
      <template #footer>
        <CustomButton
          @click="closeKasirDialog = false"
          label="Batal"
          outlined
          class=""
          borderColor="border-grey-200"
          textColor="text-grey-300"
        />
        <CustomButton
          @click="() => {}"
          label="Closing Kasir"
          class=""
          backgroundColor="bg-opensimrs-300"
        />
      </template>
    </CustomDialog>

    <!-- Pembayaran Tunai -->
    <CustomDialog v-model:visible="pembayaranDialog" width="600px">
      <template #header>Pembayaran</template>
      <template #body>
        <div class="flex justify-between">
          <div>
            <p class="font-bold mt-[20px]">Grand Total</p>
          </div>
          <div>
            <p class="font-bold mt-[20px]">Rp. 1.500.000, 00</p>
          </div>
        </div>
        <hr class="mt-6 border-1 border-grey-200" />
        <!-- Diskon -->
        <div class="flex justify-between">
          <div>
            <p class="font-bold mt-[20px] text-sm">Diskon</p>
          </div>
          <div>
            <CustomTextfield label="" class="mt-[15px]" placeholder="0">
              <template #prependText>
                <div
                  class="font-semibold text-MD leading-7 text-opensimrs-300 w-[53.34px] flex items-center justify-center border-r"
                >
                  Rp.
                </div>
              </template>
            </CustomTextfield>
          </div>
        </div>

        <!-- Jumlah Bayar -->
        <div class="flex justify-between">
          <div>
            <p class="font-bold mt-[20px] text-sm">Jumlah Bayar</p>
          </div>
          <div>
            <CustomTextfield label="" class="mt-[15px]" placeholder="0">
              <template #prependText>
                <div
                  class="font-semibold text-MD leading-7 text-opensimrs-300 w-[53.34px] flex items-center justify-center border-r"
                >
                  Rp.
                </div>
              </template>
            </CustomTextfield>
          </div>
        </div>

        <!-- Kembalian -->
        <div class="flex justify-between">
          <div>
            <p class="font-bold mt-[20px] text-sm">Kembalian</p>
          </div>
          <div>
            <CustomTextfield label="" class="mt-[15px]" placeholder="0">
              <template #prependText>
                <div
                  class="font-semibold text-MD leading-7 text-opensimrs-300 w-[53.34px] flex items-center justify-center border-r"
                >
                  Rp.
                </div>
              </template>
            </CustomTextfield>
          </div>
        </div>
        <hr class="mt-6 border-1 border-grey-200" />

        <!-- Keterangan -->
        <div>
          <CustomTextfield
            class="mt-[30px]"
            label="Keterangan"
            placeholder="Keterangan"
          />
        </div>

        <!-- Metode Pembayaran -->
        <div class="grid grid-cols-[40%_40%_20%]">
          <div>
            <CustomSelect
              label="Metode Pembayaran"
              class="mt-[20px]"
              optionLabel=""
              optionValue=""
              :options="['Dana', 'Ovo', 'Gopay']"
            />
          </div>
          <div>
            <CustomInputNumber
              label="Referensi"
              class="mt-[20px] ml-[20px] w-[100%]"
            />
          </div>
          <div>
            <CustomButton label="Bayar" class="mt-[45px] ml-[45px]" />
          </div>
        </div>
      </template>
    </CustomDialog>

    <!-- Pembayaran non Tunai -->
    <CustomDialog v-model:visible="pembayaranBPJSDialog" width="600px">
      <template #header>Pembayaran</template>
      <template #body>
        <div class="flex justify-between">
          <div>
            <p class="font-bold mt-[20px]">Grand Total</p>
          </div>
          <div>
            <p class="font-bold mt-[20px]">Rp. 1.500.000, 00</p>
          </div>
        </div>
        <hr class="mt-6 border-1 border-grey-200" />
        <!-- Dijamin -->
        <div class="flex justify-between">
          <div>
            <p class="font-bold mt-[30px] text-sm">Dijamin</p>
          </div>
          <div>
            <CustomTextfield label="" class="mt-[15px]" placeholder="0">
              <template #prependText>
                <div
                  class="font-semibold text-MD leading-7 text-opensimrs-300 w-[53.34px] flex items-center justify-center border-r"
                >
                  Rp.
                </div>
              </template>
            </CustomTextfield>
          </div>
        </div>
        <hr class="mt-6 border-1 border-grey-200" />

        <!-- Keterangan -->
        <div>
          <CustomTextfield
            class="mt-[30px]"
            label="Keterangan"
            placeholder="Keterangan"
          />
        </div>

        <!-- Metode Pembayaran -->
        <div class="grid grid-cols-[40%_40%_20%]">
          <div>
            <CustomSelect
              label="Metode Pembayaran"
              class="mt-[20px]"
              optionLabel=""
              optionValue=""
              :options="['Dana', 'Ovo', 'Gopay']"
            />
          </div>
          <!-- No. Anggota -->
          <div>
            <CustomInputNumber
              label="No. Anggota"
              class="mt-[20px] ml-[20px] w-[100%]"
            />
          </div>
          <div>
            <CustomButton label="Bayar" class="mt-[45px] ml-[45px]" />
          </div>
        </div>
      </template>
    </CustomDialog>

    <!-- List Tagihan IGD -->
    <CustomDialog v-model:visible="listTagihanIGDDialog" width="1000px">
      <template #header>Detail Tagihan Pelayanan</template>
      <template #body>
        <div>
          <div class="pt-5">
            <div class="flex">
              <p class="font-bold">IGD</p>
              <CustomChip
                class="ml-2"
                :showCheckedIcon="false"
                label="TUNAI"
                bgColor="bg-opensimrs-50"
                textColor="text-opensimrs-300"
                borderColor="border-opensimrs-300"
              />
              <!-- <CustomChip
                class="ml-2"
                :showCheckedIcon="false"
                label="ASURANSI"
                bgColor="bg-warning-50"
                textColor="text-warning-300"
                borderColor="border-warning-300"
              /> -->
            </div>
            <div class="flex">
              <UserDoctorIcon class="mt-2" />
              <p class="mt-2 text-sm text-grey-400">
                dr. Osama bin Laden SP.KK
              </p>
            </div>
            <div class="flex">
              <p class="text-sm">Tanggal</p>
              <PhArrowRight
                :size="18"
                class="my-auto ml-2 text-success-300"
                weight="bold"
              />
              <p class="ml-2 text-sm">10 Januari 2090</p>
              <p class="ml-2 text-sm">10.10</p>
            </div>
          </div>

          <!-- Table Tindakan -->
          <div class="pt-5">
            <DataTable
              v-if="itemsPasien.length"
              :value="itemsPasien"
              class="overflow-hidden rounded-[10px]"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <!-- Tanggal -->
              <Column
                field="tanggal"
                header="Tanggal"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.tanggal_jadwal }}
                    </p>
                  </div>
                </template>
              </Column>
              <!-- Tindakan, Pemeriksaan, dan Administrasi -->
              <Column
                field="pasien"
                header="Tindakan, Pemeriksaan, dan Administrasi"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="flex flex-wrap">
                    <p class="text-sm">{{ slotProps.data.tindakan }}</p>
                  </div>
                </template>
              </Column>
              <!-- Jumlah -->
              <Column
                field="jumlah"
                header="Jumlah"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jumlah }}</div>
                </template>
              </Column>
              <!-- Tarif -->
              <Column field="tarif" header="Tarif" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.tarif }}</div>
                </template>
              </Column>
              <!-- Total -->
              <Column field="total" header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.total }}</div>
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Table Penunjang Lab -->
          <div class="pt-5">
            <DataTable
              v-if="itemsPasien.length"
              :value="itemsPasien"
              class="overflow-hidden rounded-[10px]"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <!-- Tanggal -->
              <Column
                field="tanggal"
                header="Tanggal"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.tanggal_jadwal }}
                    </p>
                  </div>
                </template>
              </Column>
              <!-- Penunjang - Laboratorium -->
              <Column
                field="penunjang"
                header="Penunjang - Laboratorium"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="flex flex-wrap">
                    <p class="text-sm">{{ slotProps.data.penunjangLab }}</p>
                  </div>
                </template>
              </Column>
              <!-- Jumlah -->
              <Column
                field="jumlah"
                header="Jumlah"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jumlah }}</div>
                </template>
              </Column>
              <!-- Tarif -->
              <Column field="tarif" header="Tarif" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.tarif }}</div>
                </template>
              </Column>
              <!-- Total -->
              <Column field="total" header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.total }}</div>
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Table Penunjang Fisio -->
          <div class="pt-5">
            <DataTable
              v-if="itemsPasien.length"
              :value="itemsPasien"
              class="overflow-hidden rounded-[10px]"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <!-- Tanggal -->
              <Column
                field="tanggal"
                header="Tanggal"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.tanggal_jadwal }}
                    </p>
                  </div>
                </template>
              </Column>
              <!-- Penunjang - Fisio -->
              <Column
                field="penunjang"
                header="Penunjang - Fisio"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="flex flex-wrap">
                    <p class="text-sm">{{ slotProps.data.penunjangFisio }}</p>
                  </div>
                </template>
              </Column>
              <!-- Jumlah -->
              <Column
                field="jumlah"
                header="Jumlah"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jumlah }}</div>
                </template>
              </Column>
              <!-- Tarif -->
              <Column field="tarif" header="Tarif" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.tarif }}</div>
                </template>
              </Column>
              <!-- Total -->
              <Column field="total" header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.total }}</div>
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Table Obat -->
          <div class="pt-5">
            <DataTable
              v-if="itemsPasien.length"
              :value="itemsPasien"
              class="overflow-hidden rounded-[10px]"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <!-- Tanggal -->
              <Column
                field="tanggal"
                header="Tanggal"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.tanggal_jadwal }}
                    </p>
                  </div>
                </template>
              </Column>

              <!-- Obat -->
              <Column
                field="penunjang"
                header="Obat"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="flex flex-wrap">
                    <p class="text-sm">{{ slotProps.data.obat }}</p>
                  </div>
                </template>
              </Column>

              <!-- Golongan Obat -->
              <Column
                field="jumlah"
                header="Golongan Obat"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.golonganObat }}</div>
                </template>
              </Column>

              <!-- Jumlah -->
              <Column
                field="jumlah"
                header="Jumlah"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jumlah }}</div>
                </template>
              </Column>

              <!-- Tarif -->
              <Column field="tarif" header="Tarif" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.tarif }}</div>
                </template>
              </Column>

              <!-- Jasa -->
              <Column field="tarif" header="Jasa" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jasa }}</div>
                </template>
              </Column>

              <!-- Total -->
              <Column field="total" header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.total }}</div>
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Table Alkes -->
          <div class="pt-5">
            <DataTable
              v-if="itemsPasien.length"
              :value="itemsPasien"
              class="overflow-hidden rounded-[10px]"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <!-- Tanggal -->
              <Column
                field="tanggal"
                header="Tanggal"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.tanggal_jadwal }}
                    </p>
                  </div>
                </template>
              </Column>

              <!-- Alkes -->
              <Column field="alkes" header="Alkes" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="flex flex-wrap">
                    <p class="text-sm">{{ slotProps.data.alkes }}</p>
                  </div>
                </template>
              </Column>

              <!-- Jumlah -->
              <Column
                field="jumlah"
                header="Jumlah"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jumlah }}</div>
                </template>
              </Column>

              <!-- Tarif -->
              <Column field="tarif" header="Tarif" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.tarif }}</div>
                </template>
              </Column>

              <!-- Total -->
              <Column field="total" header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.total }}</div>
                </template>
              </Column>
            </DataTable>
          </div>

          <div class="mt-4">
            <card class="bg-opensimrs-50">
              <template #content>
                <div class="flex justify-between">
                  <p class="text-base font-bold">Total</p>
                  <p class="text-base font-bold">RP. 57.000, 00</p>
                </div>
              </template>
            </card>
          </div>
        </div>
      </template>
    </CustomDialog>

    <!-- List Tagihan Rawat Inap -->
    <CustomDialog v-model:visible="listTagihanRIDialog" width="1000px">
      <template #header>Detail Tagihan Pelayanan</template>
      <template #body>
        <div>
          <div class="pt-5">
            <div class="flex">
              <p class="font-bold">Rawat Inap</p>
              <CustomChip
                class="ml-2"
                :showCheckedIcon="false"
                label="TUNAI"
                bgColor="bg-opensimrs-50"
                textColor="text-opensimrs-300"
                borderColor="border-opensimrs-300"
              />
              <CustomChip
                class="ml-2"
                :showCheckedIcon="false"
                label="BPJS"
                bgColor="bg-warning-50"
                textColor="text-warning-300"
                borderColor="border-warning-300"
              />
            </div>
            <div class="flex">
              <UserDoctorIcon class="mt-2" />
              <p class="mt-2 text-sm text-grey-400">
                dr. Osama bin Laden SP.KK
              </p>
            </div>
            <div class="flex">
              <p class="text-sm">Tanggal</p>
              <PhArrowRight
                :size="18"
                class="my-auto ml-2 text-success-300"
                weight="bold"
              />
              <p class="ml-2 text-sm">10 Januari 2090</p>
              <p class="ml-2 text-sm">10.10</p>
            </div>
          </div>

          <!-- Table Kamar -->
          <div class="pt-5">
            <DataTable
              v-if="itemsPasien.length"
              :value="itemsPasien"
              class="overflow-hidden rounded-[10px]"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <!-- Tanggal -->
              <Column
                field="tanggal"
                header="Tanggal"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.tanggal_jadwal }}
                    </p>
                  </div>
                </template>
              </Column>
              <!-- Kamar -->
              <Column field="kamar" header="Kamar" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="flex flex-wrap">
                    <p class="text-sm">{{ slotProps.data.kamar }}</p>
                  </div>
                </template>
              </Column>
              <!-- Jenis Ruangan -->
              <Column
                field="jenisRuangan"
                header="Jenis Ruangan"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jenisRuangan }}</div>
                </template>
              </Column>
              <!-- Kelas Ruangan -->
              <Column
                field="kelasRuangan"
                header="Kelas Ruangan"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.kelasRuangan }}</div>
                </template>
              </Column>
              <!-- Waktu -->
              <Column field="waktu" header="Waktu" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.waktu }}</div>
                </template>
              </Column>
              <!-- Tarif -->
              <Column field="tarif" header="Tarif" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.tarif }}</div>
                </template>
              </Column>
              <!-- Total -->
              <Column field="total" header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.total }}</div>
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Table Tindakan -->
          <div class="pt-5">
            <DataTable
              v-if="itemsPasien.length"
              :value="itemsPasien"
              class="overflow-hidden rounded-[10px]"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <!-- Tanggal -->
              <Column
                field="tanggal"
                header="Tanggal"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.tanggal_jadwal }}
                    </p>
                  </div>
                </template>
              </Column>
              <!-- Tindakan, Pemeriksaan, dan Administrasi -->
              <Column
                field="pasien"
                header="Tindakan, Pemeriksaan, dan Administrasi"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="flex flex-wrap">
                    <p class="text-sm">{{ slotProps.data.tindakan }}</p>
                  </div>
                </template>
              </Column>
              <!-- Jumlah -->
              <Column
                field="jumlah"
                header="Jumlah"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jumlah }}</div>
                </template>
              </Column>
              <!-- Tarif -->
              <Column field="tarif" header="Tarif" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.tarif }}</div>
                </template>
              </Column>
              <!-- Total -->
              <Column field="total" header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.total }}</div>
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Table Penunjang Lab -->
          <div class="pt-5">
            <DataTable
              v-if="itemsPasien.length"
              :value="itemsPasien"
              class="overflow-hidden rounded-[10px]"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <!-- Tanggal -->
              <Column
                field="tanggal"
                header="Tanggal"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.tanggal_jadwal }}
                    </p>
                  </div>
                </template>
              </Column>
              <!-- Penunjang - Laboratorium -->
              <Column
                field="penunjang"
                header="Penunjang - Laboratorium"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="flex flex-wrap">
                    <p class="text-sm">{{ slotProps.data.penunjangLab }}</p>
                  </div>
                </template>
              </Column>
              <!-- Jumlah -->
              <Column
                field="jumlah"
                header="Jumlah"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jumlah }}</div>
                </template>
              </Column>
              <!-- Tarif -->
              <Column field="tarif" header="Tarif" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.tarif }}</div>
                </template>
              </Column>
              <!-- Total -->
              <Column field="total" header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.total }}</div>
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Table Penunjang Fisio -->
          <div class="pt-5">
            <DataTable
              v-if="itemsPasien.length"
              :value="itemsPasien"
              class="overflow-hidden rounded-[10px]"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <!-- Tanggal -->
              <Column
                field="tanggal"
                header="Tanggal"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.tanggal_jadwal }}
                    </p>
                  </div>
                </template>
              </Column>
              <!-- Penunjang - Fisio -->
              <Column
                field="penunjang"
                header="Penunjang - Fisio"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="flex flex-wrap">
                    <p class="text-sm">{{ slotProps.data.penunjangFisio }}</p>
                  </div>
                </template>
              </Column>
              <!-- Jumlah -->
              <Column
                field="jumlah"
                header="Jumlah"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jumlah }}</div>
                </template>
              </Column>
              <!-- Tarif -->
              <Column field="tarif" header="Tarif" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.tarif }}</div>
                </template>
              </Column>
              <!-- Total -->
              <Column field="total" header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.total }}</div>
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Table Obat -->
          <div class="pt-5">
            <DataTable
              v-if="itemsPasien.length"
              :value="itemsPasien"
              class="overflow-hidden rounded-[10px]"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <!-- Tanggal -->
              <Column
                field="tanggal"
                header="Tanggal"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.tanggal_jadwal }}
                    </p>
                  </div>
                </template>
              </Column>

              <!-- Obat -->
              <Column
                field="penunjang"
                header="Obat"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="flex flex-wrap">
                    <p class="text-sm">{{ slotProps.data.obat }}</p>
                  </div>
                </template>
              </Column>

              <!-- Golongan Obat -->
              <Column
                field="jumlah"
                header="Golongan Obat"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.golonganObat }}</div>
                </template>
              </Column>

              <!-- Jumlah -->
              <Column
                field="jumlah"
                header="Jumlah"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jumlah }}</div>
                </template>
              </Column>

              <!-- Tarif -->
              <Column field="tarif" header="Tarif" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.tarif }}</div>
                </template>
              </Column>

              <!-- Jasa -->
              <Column field="tarif" header="Jasa" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jasa }}</div>
                </template>
              </Column>

              <!-- Total -->
              <Column field="total" header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.total }}</div>
                </template>
              </Column>
            </DataTable>
          </div>

          <!-- Table Alkes -->
          <div class="pt-5">
            <DataTable
              v-if="itemsPasien.length"
              :value="itemsPasien"
              class="overflow-hidden rounded-[10px]"
              scrollable
              scrollHeight="flex"
              :pt="{ headerRow: 'text-SM' }"
            >
              <!-- Tanggal -->
              <Column
                field="tanggal"
                header="Tanggal"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div>
                    <p class="text-SM">
                      {{ slotProps.data.tanggal_jadwal }}
                    </p>
                  </div>
                </template>
              </Column>

              <!-- Alkes -->
              <Column field="alkes" header="Alkes" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="flex flex-wrap">
                    <p class="text-sm">{{ slotProps.data.alkes }}</p>
                  </div>
                </template>
              </Column>

              <!-- Jumlah -->
              <Column
                field="jumlah"
                header="Jumlah"
                headerClass="bg-opensimrs-50"
              >
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.jumlah }}</div>
                </template>
              </Column>

              <!-- Tarif -->
              <Column field="tarif" header="Tarif" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.tarif }}</div>
                </template>
              </Column>

              <!-- Total -->
              <Column field="total" header="Total" headerClass="bg-opensimrs-50">
                <template #body="slotProps">
                  <div class="text-SM">{{ slotProps.data.total }}</div>
                </template>
              </Column>
            </DataTable>
          </div>
          <div class="mt-4">
            <card class="bg-opensimrs-50">
              <template #content>
                <div class="flex justify-between">
                  <p class="text-base font-bold">Total</p>
                  <p class="text-base font-bold">RP. 57.000, 00</p>
                </div>
              </template>
            </card>
          </div>
        </div>
      </template>
    </CustomDialog>

    <!-- Bill Close Notification -->
    <CustomDialog
      v-model:visible="closeBillDialog"
      width="700px"
      headerBg="bg-danger-300"
    >
      <template #header>Close Bill</template>
      <template #body>
        <div class="grid grid-cols-1">
          <div>
            <p class="mt-[20px]">
              Pastikan semua biaya dan tagihan sudah tercantum dan terbayarkan
              hingga lunas, <span class="font-bold">Close Bill</span> pasien?
            </p>
          </div>
          <div>
            <p class="mt-[20px] text-danger-300">
              *Tidak dapat mengubah/menambah tagihan, jika sudah
              <span class="font-bold">Close Bill</span>
            </p>
          </div>
        </div>
        <hr class="mt-6 border-1 border-grey-200" />
      </template>
      <template #footer>
        <CustomButton
          @click="closeBillDialog = false"
          label="Batal"
          outlined
          class=""
          borderColor="border-grey-200"
          textColor="text-grey-300"
        />
        <CustomButton
          label="Close Bill"
          backgroundColor="bg-danger-300"
          borderColor="border-danger-300"
          textColor="text-white"
        />
      </template>
    </CustomDialog>
  </div>
</template>
