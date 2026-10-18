'use strict';

const path = require('path');
const { pathToFileURL } = require('url');
const MODUL = 'HR / SDM';

const proses = async (queryInterface, tambah) => {
  const sq = queryInterface.sequelize;
  const { sdmPermission } = await import(pathToFileURL(path.join(__dirname, '..', '..', 'auth-service', 'src', 'helpers', 'permission-list.js')).href);
  for (const tabel of ['role', 'users']) {
    const [rows] = await sq.query(`SELECT uuid, faskes_uuid, permissions FROM "${tabel}" WHERE permissions IS NOT NULL AND permissions <> ''`);
    for (const r of rows) {
      let data;
      try { data = JSON.parse(r.permissions); } catch { continue; }
      if (!Array.isArray(data) || !data.length) continue;
      const idx = data.findIndex((x) => x?.module === MODUL);
      let berubah = false;
      if (tambah && idx < 0 && !r.faskes_uuid) { data.push(JSON.parse(JSON.stringify(sdmPermission))); berubah = true; }
      else if (!tambah && idx >= 0) { data.splice(idx, 1); berubah = true; }
      if (berubah) await sq.query(`UPDATE "${tabel}" SET permissions = :p WHERE uuid = :u`, { replacements: { p: JSON.stringify(data), u: r.uuid } });
    }
  }
};

module.exports = {
  async up(queryInterface) { await proses(queryInterface, true); },
  async down(queryInterface) { await proses(queryInterface, false); },
};
