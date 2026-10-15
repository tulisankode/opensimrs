# @opensimrs/model-sdk

Definisi model Sequelize/Mongoose bersama untuk layanan OpenSIMRS. Versi 1.1.0, lisensi ISC (atribusi penulis asli ada di `package.json`).

Paket ini bagian dari monorepo (`packages/model-sdk`) dan dipasang layanan lewat `"@opensimrs/model-sdk": "file:../packages/model-sdk"` dengan `install-links=true` di `.npmrc` layanan, sehingga terpasang sebagai salinan dan sequelize/mongoose tetap satu instans. Setelah mengubah kode di sini, jalankan `npm run sdk:refresh` dari root repo.

## Pemakaian

Buat instance Sequelize dengan `createSequelizeInstance`:

```js
const sequelizeInstance = createSequelizeInstance({
  db_name: DB_NAME,
  db_username: DB_USERNAME,
  db_password: DB_PASSWORD,
  db_host: DB_HOST,
  db_port: DB_PORT,
  db_dialect: DB_DIALECT,
  pool: {
    max: DB_POOL_MAX ?? 50,
    min: DB_POOL_MIN ?? 13,
    acquire: DB_POOL_ACQUIRE ?? 30000,
    idle: DB_POOL_IDLE ?? 10000,
  },
});
export default sequelizeInstance;
```

Setelah itu model per domain bisa diimpor dari berkas `exports/` (mis. admisi, farmasi, lab, rekam medis).

Perubahan skema database **tidak** dilakukan lewat sinkronisasi model, melainkan lewat migrasi di `database/migrations/` (lihat [Konteks Pengembangan](../../docs/KONTEKS-PENGEMBANGAN.md)).

Usulan perbaikan untuk SDK ini disampaikan lewat Pull Request ke repo OpenSIMRS ([CONTRIBUTING](../../CONTRIBUTING.md)).
