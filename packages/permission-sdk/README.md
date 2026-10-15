# @opensimrs/permission-sdk

Middleware pengecekan izin (permission) per rute untuk layanan OpenSIMRS. Versi 1.1.0, lisensi ISC (atribusi penulis asli ada di `package.json`).

Paket ini bagian dari monorepo (`packages/permission-sdk`) dan dipasang layanan lewat `"@opensimrs/permission-sdk": "file:../packages/permission-sdk"`. Setelah mengubah kode di sini, jalankan `npm run sdk:refresh` dari root repo.

## Pemakaian

Middleware dipasang di tingkat rute dan membutuhkan parameter:

- `module`: nama modul
- `subModule`: nama submodul
- `feature`: nama fitur (`null` bila tidak ada)
- `action`: nama aksi
- koneksi Redis (diatur sekali lewat builder)

### Konfigurasi

```js
import { PermissionBuilder } from "@opensimrs/permission-sdk";
import redisClient from "./redis-client-config.js"; // konfigurasi koneksi Redis layanan

const permissionSdk = PermissionBuilder.setRedis(redisClient).build();

export { permissionSdk };
```

### Di rute

```js
const privateRoute = express.Router();
privateRoute.get("/dev", permissionSdk("Admisi", "Laporan Admisi", "Kunjungan", "READ"), (req, res) => res.send("OK"));

// bila tidak ada fitur, kirim null
privateRoute.get("/panggil", permissionSdk("Admisi", "Antrian", null, "PANGGIL"), (req, res) => res.send("OK"));
```

Daftar izin bersumber dari `auth-service/src/helpers/permission-list.js` (lihat [Manajemen Modul](../../docs/MANAJEMEN-MODUL.md#3-hubungan-dengan-hak-akses-izin)).
