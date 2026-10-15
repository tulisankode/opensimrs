import { DataTypes, QueryInterface, QueryTypes, where, } from "sequelize"
import sequelizeInstance from "../config/sequelize-db.js";
import { dateToEpoch, endOfDateToEpoch } from "../helpers/date-helper.js";
import BadRequestException from "../exceptions/bad-request-exception.js";
import { getMongoDatabase } from "../config/mongo-db.js";

// Jenis kunjungan dari frontend (rawat_jalan/rawat_inap/igd) → kode pelayanan di tabel transaksi (rj/ri/igd)
const toKodePelayanan = (type) => ({ rawat_jalan: "rj", rawat_inap: "ri" })[type] ?? type

const PelayananToTableNameEnum = {
  "igd": "instalasi_gawat_darurats",
  "ri": "rawat_inaps",
  "rj": "rawat_jalans"
}

export default class LaporanRepository {
  static async getRekapitulasiKunjungan({ faskes_uuid, filter = {}, limit, offset }) {
    let query = `
      SELECT visit_type, payment_method, pg.name as doctor_name, COUNT(x.id) AS total FROM 
      (	
      	SELECT 'igd' AS visit_type, igd.faskes_uuid, igd.id, igd.payment_method, p.pegawai_uuid, igd.tanggal_daftar FROM instalasi_gawat_darurats igd
      	JOIN practitioner p ON igd.practitioner_uuid = p.uuid
      	WHERE igd.deleted_at IS NULL
      
      	UNION ALL
      
      	SELECT 'rawat_inap' AS visit_type, ri.faskes_uuid, ri.id, ri.payment_method, p.pegawai_uuid, ri.tanggal_daftar FROM rawat_inaps ri
      	JOIN practitioner p ON ri.practitioner_uuid = p.uuid
      	WHERE ri.deleted_at IS NULL
      
      	UNION ALL
      
      	SELECT 'rawat_jalan' AS visit_type, rj.faskes_uuid, rj.id, rj.payment_method, p.pegawai_uuid, rj.tanggal_daftar FROM rawat_jalans rj
      	JOIN practitioner p ON rj.practitioner_uuid = p.uuid
      	WHERE rj.deleted_at IS NULL
      ) x
      JOIN pegawai pg ON pg.uuid = x.pegawai_uuid
    `

    // Check filter
    const replacements = { limit, offset, faskes_uuid }
    const whereCondition = ['x.faskes_uuid = :faskes_uuid']

    if (filter.type && filter.type.length) {
      const typePlaceholder = filter.type.map((_, index) => `:type${index}`).join(', ')
      whereCondition.push(`x.visit_type IN (${typePlaceholder})`)

      filter.type.forEach((type, index) => {
        replacements[`type${index}`] = type
      })
    }

    if (filter.name) {
      whereCondition.push(`pg.name ILIKE :name`)
      replacements.name = `%${filter.name}%`
    }

    // payment_method 0 (default validator) = semua metode bayar
    if (filter.payment_method) {
      whereCondition.push(`x.payment_method = :payment_method`)
      replacements.payment_method = filter.payment_method
    }

    if (filter.startDate) {
      whereCondition.push(`x.tanggal_daftar >= :startDate`)
      replacements.startDate = dateToEpoch(filter.startDate)
    }

    if (filter.endDate) {
      whereCondition.push(`x.tanggal_daftar <= :endDate`)
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    // Merge all where condition
    if (whereCondition.length > 0) {
      query += 'WHERE ' + whereCondition.join(' AND ')
    }

    query += `
      GROUP BY x.visit_type, x.payment_method, pg.name
    `

    let countQuery = `
      SELECT COUNT(*) FROM (${query}) y
    `

    query += `
      LIMIT :limit OFFSET :offset
    `

    const [results, countResult] = await Promise.all([
      sequelizeInstance.query(query, {
        replacements,
        type: QueryTypes.SELECT,
      }),
      sequelizeInstance.query(countQuery, {
        replacements,
        type: QueryTypes.SELECT
      })
    ])

    if (!results || !countResult) {
      throw new BadRequestException("Data gagal ditampilkan")
    }

    return [results, countResult[0].count]
  }

  static async getRekapitulasiTindakan({ faskes_uuid, filter = {}, limit, offset }) {
    // Sebagian riwayat menyimpan uuid tarif di nama_tindakan; tampilkan nama tarifnya
    const namaTindakan = `CASE WHEN ht.nama_tindakan ~ '^[0-9a-f]{8}-[0-9a-f]{4}-' THEN COALESCE(tf.name, ht.nama_tindakan) ELSE ht.nama_tindakan END`
    let query = `
      SELECT ${namaTindakan} AS "tindakan", ht.pelayanan AS "visit_type", ht.payment_method, COUNT(ht.uuid) AS total
      FROM history_tindakan ht
      LEFT JOIN tarif tf ON tf.uuid = ht.tarif_uuid
    `

    // Check filter
    const whereReplacements = [`ht.deleted_at IS NULL`, `ht.faskes_uuid = :faskes_uuid`]
    const replacements = { limit, offset, faskes_uuid }

    if (filter.name) {
      whereReplacements.push(`${namaTindakan} ILIKE :name`)
      replacements.name = `%${filter.name}%`
    }

    if (filter.type) {
      const typeReplacements = filter.type.map((_, index) => `:type${index}`).join(', ')
      whereReplacements.push(`ht.pelayanan IN (${typeReplacements})`)

      filter.type.forEach((type, index) => {
        replacements[`type${index}`] = toKodePelayanan(type)
      })
    }

    // payment_method 0 (default validator) = semua metode bayar
    if (filter.payment_method) {
      whereReplacements.push(`ht.payment_method = :payment_method`)
      replacements.payment_method = filter.payment_method
    }

    if (filter.startDate) {
      whereReplacements.push(`COALESCE(ht.tanggal_tindakan, ht.created_at) >= :startDate`)
      replacements.startDate = dateToEpoch(filter.startDate)
    }

    if (filter.endDate) {
      whereReplacements.push(`COALESCE(ht.tanggal_tindakan, ht.created_at) <= :endDate`)
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    // Merge all where condition
    if (whereReplacements.length > 0) {
      query += ' WHERE ' + whereReplacements.join(' AND ')
    }

    query += `
      GROUP BY 1, ht.pelayanan, ht.payment_method
    `

    let countQuery = `
      SELECT COUNT(y.tindakan) FROM (${query}) y
    `

    query += `
      LIMIT :limit OFFSET :offset
    `

    const [results, countResult] = await Promise.all([
      sequelizeInstance.query(query, {
        replacements,
        type: QueryTypes.SELECT
      }),
      sequelizeInstance.query(countQuery, {
        replacements,
        type: QueryTypes.SELECT
      })
    ])

    if (!results || !countResult) {
      throw new BadRequestException("Data gagal ditampilkan")
    }

    return [results, countResult[0].count]
  }

  static async getRekapitulasiLab({ faskes_uuid, filter = {}, limit, offset }) {
    let query = `
      SELECT
          tl.name AS tindakan,
          ol.pelayanan AS visit_type,
          ol.payment_method,
          COUNT(*) AS total
      FROM order_lab ol
      JOIN order_lab_pemeriksaan olp ON olp.order_lab_uuid = ol.uuid AND olp.deleted_at IS NULL
      JOIN tarif_lab tl ON tl.uuid = olp.tarif_lab_uuid
    `

    // Check filter
    const whereReplacements = [`ol.deleted_at IS NULL`, `ol.faskes_uuid = :faskes_uuid`]
    const replacements = { limit, offset, faskes_uuid }

    if (filter.name) {
      whereReplacements.push(`tl.name ILIKE :name`)
      replacements.name = `%${filter.name}%`
    }

    if (filter.type) {
      const typeReplacements = filter.type.map((_, index) => `:type${index}`).join(', ')
      whereReplacements.push(`ol.pelayanan::text IN (${typeReplacements})`)

      // enum order_lab.pelayanan: igd, rajal, ranap, aps
      const kodeLab = { rawat_jalan: "rajal", rawat_inap: "ranap" }
      filter.type.forEach((type, index) => {
        replacements[`type${index}`] = kodeLab[type] ?? type
      })
    }

    // payment_method 0 (default validator) = semua metode bayar
    if (filter.payment_method) {
      whereReplacements.push(`ol.payment_method = :payment_method`)
      replacements.payment_method = filter.payment_method
    }

    if (filter.startDate) {
      // tgl_pemeriksaan bertipe varchar berisi epoch → cast aman ke bigint
      whereReplacements.push(`(CASE WHEN ol.tgl_pemeriksaan ~ '^[0-9]+$' THEN ol.tgl_pemeriksaan::bigint END) >= :startDate`)
      replacements.startDate = dateToEpoch(filter.startDate)
    }

    if (filter.endDate) {
      whereReplacements.push(`(CASE WHEN ol.tgl_pemeriksaan ~ '^[0-9]+$' THEN ol.tgl_pemeriksaan::bigint END) <= :endDate`)
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    // Merge all where condition
    if (whereReplacements.length > 0) {
      query += ' WHERE ' + whereReplacements.join(' AND ')
    }

    query += `
      GROUP BY tl.name, ol.pelayanan, ol.payment_method
    `

    const countQuery = `
      SELECT COUNT (y.tindakan) FROM (${query}) y
    `

    query += `
      LIMIT :limit OFFSET :offset
    `

    const [results, countResult] = await Promise.all([
      sequelizeInstance.query(query, {
        replacements,
        type: QueryTypes.SELECT
      }),
      sequelizeInstance.query(countQuery, {
        replacements,
        type: QueryTypes.SELECT
      })
    ])

    if (!results || !countResult) {
      throw new BadRequestException("Data gagal ditampilkan")
    }
    return [results, countResult[0].count]
  }

  // Pasangan (pelayanan, no_pelayanan, diagnosis primer) dari rekam medis Mongo.
  // Tanpa paginasi di sini: paginasi dilakukan setelah filter SQL agar total benar.
  static async getDiagnosisFromMongo({ faskes_uuid }) {
    const db = await getMongoDatabase()
    const collection = await db.collection("rekam_medises")

    return collection.find(
      {
        faskes_uuid,
        pelayanan: { $in: Object.keys(PelayananToTableNameEnum) },
        "summary.diagnosis_primer": { $nin: [null, "", "-"] },
      },
      { projection: { _id: 0, pelayanan: 1, no_pelayanan: 1, diagnosis: "$summary.diagnosis_primer" } }
    ).toArray()
  }

  static async getRekapitulasiDiagnosis({ faskes_uuid, rekamMedises, filter = {}, limit = null, offset = null }) {
    const rows = rekamMedises.filter((rm) => rm.no_pelayanan && typeof rm.diagnosis === "string")
    if (rows.length === 0) return [[], 0]

    // Semua nilai dari Mongo dikirim sebagai parameter (tidak disisipkan ke SQL)
    const replacements = { faskes_uuid }
    const values = rows.map((rm, i) => {
      replacements[`pl${i}`] = rm.pelayanan
      replacements[`np${i}`] = rm.no_pelayanan
      replacements[`dg${i}`] = rm.diagnosis
      return `(:pl${i}, :np${i}, :dg${i})`
    })

    const kunjungan = Object.entries(PelayananToTableNameEnum)
      .map(([kode, table]) => `SELECT '${kode}' AS pelayanan, x.no_pelayanan, x.gender, x.tanggal_daftar, x.birth_detail_uuid, x.faskes_uuid, x.deleted_at FROM ${table} x`)
      .join(' UNION ALL ')

    const whereConditions = ['k.faskes_uuid = :faskes_uuid', 'k.deleted_at IS NULL']

    if (filter.type) {
      const kodeByType = { rawat_jalan: "rj", rawat_inap: "ri", igd: "igd" }
      const kode = filter.type.map((type) => kodeByType[type] ?? type)
      whereConditions.push(`k.pelayanan IN (${kode.map((_, i) => `:type${i}`).join(', ')})`)
      kode.forEach((value, i) => { replacements[`type${i}`] = value })
    }

    if (filter.gender && filter.gender !== "all") {
      whereConditions.push('k.gender = :gender')
      replacements.gender = filter.gender
    }

    if (filter.startDate) {
      whereConditions.push('k.tanggal_daftar >= :startDate')
      replacements.startDate = dateToEpoch(filter.startDate)
    }

    if (filter.endDate) {
      whereConditions.push('k.tanggal_daftar <= :endDate')
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    const groupedQuery = `
      SELECT
        rm.diagnosis,
        k.gender,
        CASE k.pelayanan WHEN 'rj' THEN 'rawat_jalan' WHEN 'ri' THEN 'rawat_inap' ELSE k.pelayanan END AS visit_type,
        COUNT(CASE WHEN bd.age_year < 1 THEN 1 END) AS "age<1",
        COUNT(CASE WHEN bd.age_year BETWEEN 1 AND 4 THEN 1 END) AS "age1-4",
        COUNT(CASE WHEN bd.age_year BETWEEN 5 AND 14 THEN 1 END) AS "age5-14",
        COUNT(CASE WHEN bd.age_year BETWEEN 15 AND 24 THEN 1 END) AS "age15-24",
        COUNT(CASE WHEN bd.age_year BETWEEN 25 AND 44 THEN 1 END) AS "age25-44",
        COUNT(CASE WHEN bd.age_year BETWEEN 45 AND 64 THEN 1 END) AS "age45-64",
        COUNT(CASE WHEN bd.age_year >= 65 THEN 1 END) AS "age65+",
        COUNT(*) AS total
      FROM (VALUES ${values.join(', ')}) AS rm(pelayanan, no_pelayanan, diagnosis)
      JOIN (${kunjungan}) k ON k.pelayanan = rm.pelayanan AND k.no_pelayanan = rm.no_pelayanan
      LEFT JOIN birth_details bd ON bd.uuid = k.birth_detail_uuid
      WHERE ${whereConditions.join(' AND ')}
      GROUP BY rm.diagnosis, k.gender, k.pelayanan
      ORDER BY COUNT(*) DESC, rm.diagnosis
    `

    let pagedQuery = groupedQuery
    if (limit !== null && limit !== undefined) {
      pagedQuery += ' LIMIT :limit OFFSET :offset'
      replacements.limit = limit
      replacements.offset = offset ?? 0
    }

    const [results, countResult] = await Promise.all([
      sequelizeInstance.query(pagedQuery, { replacements, type: QueryTypes.SELECT }),
      sequelizeInstance.query(`SELECT COUNT(*) AS count FROM (${groupedQuery}) g`, { replacements, type: QueryTypes.SELECT })
    ])

    return [results, countResult[0]?.count ?? 0]
  }
}
