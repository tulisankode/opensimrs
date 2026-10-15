import FpoPemberianModel from "../models/postgres/fpo-pemberian-model.js";
import {Op} from "sequelize";
import moment from "moment";
import dayjs from "dayjs";
import tz from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";
import BadRequestException from "../errors/bad-request-exception.js";
import { ItemMedisModel, PrescriptionItemModel, PrescriptionItemRacikanModel, PrescriptionModel, SatuanModel } from "@opensimrs/model-sdk/farmasi";
import { timezoneDate } from "../helpers/date-helper.js";
dayjs.extend(utc);
dayjs.extend(tz);

FpoPemberianModel.belongsTo(PrescriptionItemModel, {foreignKey: 'prescription_item_uuid', as: 'prescription_item', targetKey: 'uuid'});
PrescriptionItemModel.belongsTo(PrescriptionModel, {foreignKey: 'prescription_uuid', targetKey: 'uuid'});

export default class FpoRepository {
    
    static async get(req) {
        const data = await FpoPemberianModel.findAll({
            where: {
            prescription_item_uuid: req.prescription_item_uuid,
            jam_pemberian: {
                [Op.between]: [
                    dayjs.unix(req.date).tz(timezoneDate).startOf('day').unix(),
                    dayjs.unix(req.date).tz(timezoneDate).endOf('day').unix()
                ]
            },
            },
            include: [
                {
                    model: PrescriptionItemModel,
                    as: 'prescription_item',
                    attributes: ['medication_qty', 'medication_dose_qty', 'medication_dose_satuan_uuid', 'route'],
                    include: [
                        {
                            model: PrescriptionModel,
                            attributes: ['no_resep', 'no_reg', 'dokter_order'],
                        },
                        {
                            model: ItemMedisModel,
                            as: 'item_medis',
                            attributes: ['name'],
                        },
                        {
                            model: SatuanModel,
                            as: 'satuan_dosis',
                            attributes: ['name'],
                        }
                    ]
                }
            ],
            attributes: { exclude: ['deleted_at', 'created_at', 'updated_at', 'faskes_uuid'] },
        });

        //* definisi rentang waktu
        const timeGroups = {
            pagi: { start: 7, end: 12 },
            siang: { start: 12, end: 16 },
            sore: { start: 16, end: 18 },
            malam: { start: 18, end: 24 },
            khusus: { start: 0, end: 7 },
        };

        //* inisialisasi struktur payload
        const jadwal = {};
        Object.entries(timeGroups).forEach(([key, { start, end }]) => {
            jadwal[key] = {
            range: `${String(start).padStart(2, '0')}:00 - ${String(end).padStart(2, '0')}:00`,
            jumlah_pemberian: 0,
            data: []
            };
        });

        //* masukkan data ke kelompok waktu yang sesuai
        data.forEach(item => {
            const jam = dayjs.unix(item.jam_pemberian).tz(timezoneDate).hour();
            const groupKey = Object.keys(timeGroups).find(
            key => jam >= timeGroups[key].start && jam < timeGroups[key].end
            ) || 'khusus';

            jadwal[groupKey].data.push({
            uuid: item.uuid,
            jam_pemberian: dayjs.unix(item.jam_pemberian).tz(timezoneDate).format('HH:mm'),
            note: item.note,
            nama_pemberi: item.nama_pemberi,
            });
        });

        //* hitung jumlah pemberian per kelompok
        Object.keys(jadwal).forEach(k => {
            jadwal[k].jumlah_pemberian = jadwal[k].data.length;
        });

        return {
            detail: data[0]?.prescription_item,
            tgl_pemberian: dayjs.unix(req.date).tz(timezoneDate).format("YYYY-MM-DD"),
            jadwal
        };
    }

    static async insert(req, transaction) {
        await FpoPemberianModel.create(req, {transaction});
    }

    static async update(req, transaction) {
        return await FpoPemberianModel.update(req, {
            where: {
                uuid: req.uuid
            },
            transaction
        });
    }

    static async reduceItem(req, transaction) {
        await PrescriptionItemModel.update({
            sisa_qty_order: PrescriptionItemModel.sequelize.literal(`sisa_qty_order - 1`)
        }, {
            where: {
                uuid: req.prescription_item_uuid
            },
            transaction
        })
    }

    static async getSisaQtyOrder(prescriptionItemUuid) {
        return await PrescriptionItemModel.findOne({
            where: {
                uuid: prescriptionItemUuid
            },
            attributes: ['sisa_qty_order']
        })
    }
}