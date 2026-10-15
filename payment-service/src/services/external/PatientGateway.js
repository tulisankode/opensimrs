import axios from 'axios';
import { EXTERNAL_API_CONFIG } from '../../configs/external-api.js';
import { Context } from '../../middlewares/context.js';
import { CTX_TOKEN } from '../../constants/context-constant.js';
import moment from 'moment';

export default class PatientGateway {
  static async getPatientDetail(patientUuid) {
    const { BASE_URL, TIMEOUT } = EXTERNAL_API_CONFIG.PATIENT_SERVICE;
    const token = Context.get(CTX_TOKEN);
    try {
      const url = `${BASE_URL}/api/v3/admisi/patient/${patientUuid}`;
      const response = await axios.get(url, {
        timeout: TIMEOUT,
        headers: {
          Authorization: token,
        },
      });
      return response.data.payload || null;
    } catch (error) {
      console.error(`[PatientGateway] Server Status:`, error.response.status);
      console.error(`[PatientGateway] Server Data:`, JSON.stringify(error.response.data));
      return null;
    }
  }

  static async getServiceDetail(serviceUuid, serviceType) {
    const { BASE_URL, TIMEOUT } = EXTERNAL_API_CONFIG.PATIENT_SERVICE;
    const token = Context.get(CTX_TOKEN);
    let endpointPath = '';
    switch (serviceType) {
      case 'RJ':
        endpointPath = 'rawat-jalan';
        break;
      case 'RI':
        endpointPath = 'rawat-inap';
        break;
      case 'IGD':
        endpointPath = 'igd';
        break;
      default:
        return null;
    }

    try {
      const url = `${BASE_URL}/api/v3/admisi/${endpointPath}/${serviceUuid}`;
      const response = await axios.get(url, {
        timeout: TIMEOUT,
        headers: { Authorization: token },
      });
      const payload = response.data.payload || {};
      let locationName = null;
      if (serviceType === 'RJ') {
        locationName = payload.lokasi?.name || null;
      } else if (serviceType === 'RI') {
        if (payload.ruangan?.name) {
          locationName = payload.ruangan.name;
        } else if (payload.monitoring_room?.room?.name) {
          locationName = payload.monitoring_room.room.name;
        }
      } else if (serviceType === 'IGD') {
        locationName = 'Instalasi Gawat Darurat';
      }

      let scheduleInfo = '-';
      if (serviceType === 'RJ') {
        if (payload.jadwal_periksa) {
          scheduleInfo = moment.unix(payload.tanggal_periksa);
        }
      } else if (serviceType === 'RI') {
        if (payload.tanggal_dirawat) {
          scheduleInfo = moment.unix(payload.tanggal_dirawat);
        }
      } else if (serviceType === 'IGD') {
        if (payload.tanggal_dirawat) {
          scheduleInfo = moment.unix(payload.tanggal_dirawat);
        }
      }
      // Tanggal kunjungan & pulang (epoch detik) untuk kuitansi / rincian biaya.
      const tanggalKunjungan = serviceType === 'RJ'
        ? payload.tanggal_periksa ?? payload.tanggal_daftar
        : payload.tanggal_dirawat ?? payload.tanggal_daftar;
      return {
        location_name: locationName,
        schedule_string: scheduleInfo,
        visit_date: Number(tanggalKunjungan) || null,
        discharge_date: Number(payload.discharge_date) || null,
        no_reg: payload.no_reg ?? null,
      };
    } catch (error) {
      console.error(`[PatientGateway] Error fetch service ${serviceUuid}:`, error.message);
      return null;
    }
  }
}
