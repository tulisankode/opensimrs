import { QueryTypes, where } from "sequelize"
import sequelizeInstance from "../config/sequelize-db.js"
import { dateToEpoch, endOfDateToEpoch } from "../helpers/date-helper.js"

export default class DashboardRepository {
  // Pasien baru = pasien yang didaftarkan (dibuat) dalam periode filter
  static async getTotalPasienBaru({ faskes_uuid, filter = {} }) {
    const whereConditions = ['p.faskes_uuid = :faskes_uuid', 'p.deleted_at IS NULL']
    const replacements = { faskes_uuid }

    if (filter.startDate) {
      whereConditions.push('p.created_at >= :startDate')
      replacements.startDate = dateToEpoch(filter.startDate)
    }
    if (filter.endDate) {
      whereConditions.push('p.created_at <= :endDate')
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    return sequelizeInstance.query(
      `SELECT COUNT(p.id) AS total FROM patients p WHERE ${whereConditions.join(' AND ')}`,
      { replacements, type: QueryTypes.SELECT }
    )
  }

  static async getTotalKunjungan({ faskes_uuid, filter = {} }) {
    let query = `
      SELECT COUNT(x.id) AS total FROM 
      (	
      	SELECT 'igd' AS visit_type, igd.faskes_uuid, igd.id, igd.tanggal_daftar, igd.deleted_at FROM instalasi_gawat_darurats igd
      	UNION ALL
      	SELECT 'rawat_inap' AS visit_type, ri.faskes_uuid, ri.id, ri.tanggal_daftar, ri.deleted_at FROM rawat_inaps ri
      	UNION ALL
      	SELECT 'rawat_jalan' AS visit_type, rj.faskes_uuid, rj.id, rj.tanggal_daftar, rj.deleted_at FROM rawat_jalans rj
      ) x
    `

    let whereReplacement = [`x.faskes_uuid = :faskes_uuid`, `x.deleted_at IS NULL`]
    const replacements = { faskes_uuid }

    if (filter.startDate) {
      whereReplacement.push(`x.tanggal_daftar >= :startDate`)
      replacements.startDate = dateToEpoch(filter.startDate)
    }
    if (filter.endDate) {
      whereReplacement.push(`x.tanggal_daftar <= :endDate`)
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    if (whereReplacement.length > 0) {
      query += ' WHERE ' + whereReplacement.join(' AND ')
    }

    const results = await sequelizeInstance.query(query, {
      replacements,
      type: QueryTypes.SELECT
    })

    return results
  }

  static async getTotalPasienBatal({ faskes_uuid, filter = {} }) {
    let query = `
     SELECT COUNT(x.id) AS total FROM 
      (	
      	SELECT 'igd' AS visit_type, igd.faskes_uuid, igd.id, igd.tanggal_daftar, igd.deleted_at, igd.status_igd AS status FROM instalasi_gawat_darurats igd
      	UNION ALL
      	SELECT 'rawat_inap' AS visit_type, ri.faskes_uuid, ri.id, ri.tanggal_daftar, ri.deleted_at, ri.status_ri AS status FROM rawat_inaps ri
      	UNION ALL
      	SELECT 'rawat_jalan' AS visit_type, rj.faskes_uuid, rj.id, rj.tanggal_daftar, rj.deleted_at, rj.status_rj AS status FROM rawat_jalans rj
      ) x 
    `

    let whereReplacement = [`x.status = 0`, `x.faskes_uuid = :faskes_uuid`, `x.deleted_at IS NULL`]
    const replacements = { faskes_uuid }

    if (filter.startDate) {
      whereReplacement.push(`x.tanggal_daftar >= :startDate`)
      replacements.startDate = dateToEpoch(filter.startDate)
    }
    if (filter.endDate) {
      whereReplacement.push(`x.tanggal_daftar <= :endDate`)
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    if (whereReplacement.length > 0) {
      query += ' WHERE ' + whereReplacement.join(' AND ')
    }

    const results = await sequelizeInstance.query(query, {
      replacements,
      type: QueryTypes.SELECT
    })

    return results
  }

  static async getTotalTransaksiObat({ faskes_uuid, filter = {} }) {
    let query = `
    SELECT COUNT(po.id) AS total 
    FROM penjualan_obat po
    `

    const whereConditions = ['po.deleted_at IS NULL', 'po.faskes_uuid = :faskes_uuid']
    const replacements = { faskes_uuid }

    if (filter.startDate) {
      whereConditions.push('po.tanggal_pembelian >= :startDate')
      replacements.startDate = dateToEpoch(filter.startDate)
    }

    if (filter.endDate) {
      whereConditions.push('po.tanggal_pembelian <= :endDate')
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ')
    }

    const results = await sequelizeInstance.query(query, {
      replacements,
      type: QueryTypes.SELECT
    })

    return results
  }

  static async getTotalPendapatanKlinik({ faskes_uuid, filter = {} }) {
    let query = `
    SELECT COALESCE(SUM(b.grand_total), 0) AS total 
    FROM bills b
    `

    const whereConditions = ['b.deleted_at IS NULL', 'b.faskes_uuid = :faskes_uuid']
    const replacements = { faskes_uuid }

    if (filter.startDate) {
      whereConditions.push('b.created_at >= :startDate')
      replacements.startDate = dateToEpoch(filter.startDate)
    }

    if (filter.endDate) {
      whereConditions.push('b.created_at <= :endDate')
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ')
    }

    const results = await sequelizeInstance.query(query, {
      replacements,
      type: QueryTypes.SELECT
    })

    return results
  }

  static async getTotalKunjunganRawatJalan({ faskes_uuid, filter = {} }) {
    let query = `
    SELECT 
      COUNT(rj.uuid) AS total,
      COUNT(CASE WHEN rj.status_rj IN (1, 2, 3) THEN 1 END) AS total_antrian, -- booked, check-in, antrian
      COUNT(CASE WHEN rj.status_rj = 4 THEN 1 END) AS total_diperiksa,
      COUNT(CASE WHEN rj.status_rj = 5 THEN 1 END) AS total_discharge
    FROM rawat_jalans rj
  `

    const whereConditions = ['rj.faskes_uuid = :faskes_uuid', 'rj.deleted_at IS NULL']
    const replacements = { faskes_uuid }

    if (filter.startDate) {
      whereConditions.push('rj.tanggal_daftar >= :startDate')
      replacements.startDate = dateToEpoch(filter.startDate)
    }

    if (filter.endDate) {
      whereConditions.push('rj.tanggal_daftar <= :endDate')
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ')
    }

    const results = await sequelizeInstance.query(query, {
      replacements,
      type: QueryTypes.SELECT
    })

    return results
  }

  static async getTotalKunjunganStatusRawat({ faskes_uuid, filter = {} }) {
    let query = `
    SELECT 
      TO_TIMESTAMP(x.tanggal_daftar)::date AS tgl,
      COUNT(CASE WHEN x.visit_type = 'igd' THEN x.id END) AS igd,
      COUNT(CASE WHEN x.visit_type = 'rawat_inap' THEN x.id END) AS rawat_inap,
      COUNT(CASE WHEN x.visit_type = 'rawat_jalan' THEN x.id END) AS rawat_jalan
    FROM 
      (	
        SELECT 'igd' AS visit_type, igd.faskes_uuid, igd.id, igd.tanggal_daftar, igd.deleted_at 
        FROM instalasi_gawat_darurats igd
        UNION ALL
        SELECT 'rawat_inap' AS visit_type, ri.faskes_uuid, ri.id, ri.tanggal_daftar, ri.deleted_at 
        FROM rawat_inaps ri
        UNION ALL
        SELECT 'rawat_jalan' AS visit_type, rj.faskes_uuid, rj.id, rj.tanggal_daftar, rj.deleted_at 
        FROM rawat_jalans rj
      ) x
  `;

    const whereConditions = ['x.faskes_uuid = :faskes_uuid', 'x.deleted_at IS NULL'];
    const replacements = { faskes_uuid };

    if (filter.startDate) {
      whereConditions.push('x.tanggal_daftar >= :startDate');
      replacements.startDate = dateToEpoch(filter.startDate);
    }

    if (filter.endDate) {
      whereConditions.push('x.tanggal_daftar <= :endDate');
      replacements.endDate = endOfDateToEpoch(filter.endDate);
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += `
    GROUP BY TO_TIMESTAMP(x.tanggal_daftar)::DATE
    ORDER BY tgl;
  `;

    const results = await sequelizeInstance.query(query, {
      replacements,
      type: QueryTypes.SELECT
    });

    return results;
  }

  static async getTotalKunjunganPasien({ faskes_uuid, filter = {} }) {
    let query = `
    SELECT 
      COUNT(x.id)
    FROM 
        (	
            SELECT 'igd' AS visit_type, igd.faskes_uuid, igd.id, igd.tanggal_daftar, igd.deleted_at 
            FROM instalasi_gawat_darurats igd
            WHERE igd.status_igd != 0
            UNION ALL
            SELECT 'rawat_inap' AS visit_type, ri.faskes_uuid, ri.id, ri.tanggal_daftar, ri.deleted_at 
            FROM rawat_inaps ri
            WHERE ri.status_ri != 0
            UNION ALL
            SELECT 'rawat_jalan' AS visit_type, rj.faskes_uuid, rj.id, rj.tanggal_daftar, rj.deleted_at 
            FROM rawat_jalans rj
            WHERE rj.status_rj != 0
        ) x
      `

    const whereConditions = ['x.faskes_uuid = :faskes_uuid', 'x.deleted_at IS NULL']
    const replacements = { faskes_uuid }

    if (filter.startDate) {
      whereConditions.push('x.tanggal_daftar >= :startDate')
      replacements.startDate = dateToEpoch(filter.startDate)
    }

    if (filter.endDate) {
      whereConditions.push('x.tanggal_daftar <= :endDate')
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ')
    }

    const results = await sequelizeInstance.query(query, {
      replacements,
      type: QueryTypes.SELECT
    })

    return results
  }

  static async getTotalKunjunganByGender({ faskes_uuid, filter = {} }) {
    let query = `
    SELECT 
      COUNT(CASE WHEN x.gender = 'Male' THEN 1 END) AS total_male,
      COUNT(CASE WHEN x.gender = 'Female' THEN 1 END) AS total_female
    FROM 
       (	
           SELECT 'igd' AS visit_type, igd.faskes_uuid, igd.id, igd.tanggal_daftar, igd.deleted_at, igd.gender 
           FROM instalasi_gawat_darurats igd
           UNION ALL
           SELECT 'rawat_inap' AS visit_type, ri.faskes_uuid, ri.id, ri.tanggal_daftar, ri.deleted_at, ri.gender
           FROM rawat_inaps ri
           UNION ALL
           SELECT 'rawat_jalan' AS visit_type, rj.faskes_uuid, rj.id, rj.tanggal_daftar, rj.deleted_at, rj.gender
           FROM rawat_jalans rj
       ) x
    `

    const whereConditions = ['x.faskes_uuid = :faskes_uuid', 'x.deleted_at IS NULL']
    const replacements = { faskes_uuid }

    if (filter.startDate) {
      whereConditions.push('x.tanggal_daftar >= :startDate')
      replacements.startDate = dateToEpoch(filter.startDate)
    }

    if (filter.endDate) {
      whereConditions.push('x.tanggal_daftar <= :endDate')
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ')
    }

    const results = await sequelizeInstance.query(query, {
      replacements,
      type: QueryTypes.SELECT
    })

    return results
  }

  static async getTotalPendapatan({ faskes_uuid, filter = {} }) {
    let query = `
    SELECT SUM(x.total) AS total, x.tanggal, x.type 
    FROM (
        SELECT 'masuk' AS TYPE, b.grand_total AS total, TO_TIMESTAMP(b.created_at)::DATE AS tanggal, b.deleted_at, b.faskes_uuid FROM bills b
        UNION ALL
        SELECT 'keluar' AS TYPE, pbs.grand_total AS total, TO_TIMESTAMP(pbs.tanggal_pembelian)::DATE AS tanggal, pbs.deleted_at, pbs.faskes_uuid FROM public."pembelian_Barang_supplier" pbs
    ) x
    `

    const whereConditions = ['x.deleted_at IS NULL', 'x.faskes_uuid = :faskes_uuid']
    const replacements = { faskes_uuid }

    if (filter.startDate) {
      whereConditions.push('x.tanggal >= :startDate')
      replacements.startDate = filter.startDate
    }

    if (filter.endDate) {
      whereConditions.push('x.tanggal <= :endDate')
      replacements.endDate = filter.endDate
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ')
    }

    query += `
      GROUP BY x.tanggal, x.TYPE
    `

    const results = await sequelizeInstance.query(query, {
      replacements,
      type: QueryTypes.SELECT
    })

    return results
  }

  static async getRekapitulasiTopPoli({ faskes_uuid, filter = {} }) {
    let query = `
    SELECT
      COUNT(rj.id) AS total,
      l.name AS poli 
    FROM rawat_jalans rj
    JOIN lokasi l ON rj.lokasi_uuid = l.uuid
    `

    const whereConditions = ['rj.faskes_uuid = :faskes_uuid', 'rj.deleted_at IS NULL']
    const replacements = { faskes_uuid }

    if (filter.startDate) {
      whereConditions.push('rj.tanggal_daftar >= :startDate')
      replacements.startDate = dateToEpoch(filter.startDate)
    }

    if (filter.endDate) {
      whereConditions.push('rj.tanggal_daftar <= :endDate')
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ')
    }

    query += `
      GROUP BY l.name
    `

    const results = await sequelizeInstance.query(query, {
      replacements,
      type: QueryTypes.SELECT
    })

    return results
  }

  static async getRekapitulasiTopDPJP({ faskes_uuid, filter = {} }) {
    let query = `
    SELECT COUNT(x.id) AS total, pg.name 
    FROM  
      (	
      	SELECT 'igd' AS visit_type, igd.faskes_uuid, igd.id, igd.tanggal_daftar, igd.deleted_at, igd.practitioner_uuid FROM instalasi_gawat_darurats igd
      	UNION ALL
      	SELECT 'rawat_inap' AS visit_type, ri.faskes_uuid, ri.id, ri.tanggal_daftar, ri.deleted_at, ri.practitioner_uuid FROM rawat_inaps ri
      	UNION ALL
      	SELECT 'rawat_jalan' AS visit_type, rj.faskes_uuid, rj.id, rj.tanggal_daftar, rj.deleted_at, rj.practitioner_uuid FROM rawat_jalans rj
      ) x
    JOIN practitioner p ON p.uuid = x.practitioner_uuid
    JOIN pegawai pg ON pg.uuid = p.pegawai_uuid
    `

    const whereConditions = ['x.faskes_uuid = :faskes_uuid', 'x.deleted_at IS NULL']
    const replacements = { faskes_uuid }

    if (filter.startDate) {
      whereConditions.push('x.tanggal_daftar >= :startDate')
      replacements.startDate = dateToEpoch(filter.startDate)
    }

    if (filter.endDate) {
      whereConditions.push('x.tanggal_daftar <= :endDate')
      replacements.endDate = endOfDateToEpoch(filter.endDate)
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ')
    }

    query += `
    GROUP BY x.practitioner_uuid, pg.name
    ORDER BY COUNT(x.id) DESC
    `

    const results = await sequelizeInstance.query(query, {
      replacements,
      type: QueryTypes.SELECT
    })

    return results
  }

}
