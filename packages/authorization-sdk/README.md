# @opensimrs/authorization-sdk

Middleware otorisasi untuk layanan OpenSIMRS: memeriksa JWT (**HS256**) pada setiap request dan membaca sesi di Redis. Versi 1.2.0, lisensi ISC (atribusi penulis asli ada di `package.json`).

Paket ini bagian dari monorepo (`packages/authorization-sdk`) dan dipasang layanan lewat `"@opensimrs/authorization-sdk": "file:../packages/authorization-sdk"`. Setelah mengubah kode di sini, jalankan `npm run sdk:refresh` dari root repo.

## Konfigurasi `.env`

```dotenv
# Kunci JWT HS256 — wajib sama di semua layanan
SECRET_KEY=isi-dengan-hasil-openssl-rand-hex-32

# Redis (username & sandi opsional; kosongkan untuk Redis lokal tanpa sandi)
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DATABASE=0
REDIS_USERNAME=
REDIS_PASSWORD=
```

`PRIVATE_KEY`/`PUBLIC_KEY` tidak dipakai.

## Middleware

```js
import authorizationSdk from "@opensimrs/authorization-sdk";

const app = express();
// parameter: daftar URL yang tidak perlu diotorisasi
app.use(authorizationSdk(["/v3/login", "/v3/home"]));
```

## Membuat kunci Redis dari token

```js
import generateRedisKeyByJwtToken from "@opensimrs/authorization-sdk/generateKeyRedis";

const redisKey = generateRedisKeyByJwtToken(token);
```

## Membuat dan memeriksa token

```js
import { JwtUtils } from "@opensimrs/authorization-sdk/jwt-utils";

// payload: data yang dibungkus di dalam token (contoh fiktif)
const payload = {
  email: "petugas@contoh.test",
  role: "super-admin",
  faskesUuid: "00000000-0000-7000-8000-000000000000",
};
const token = await JwtUtils.sign(payload);
const isi = await JwtUtils.veryfy(token);
```

Tersedia juga `JwtUtils.signRefreshToken` dan `JwtUtils.verifyRefreshToken`.

## Memeriksa peran superadmin

```js
import { isSuperadmin, NAMA_SUPERADMIN } from "@opensimrs/authorization-sdk/peran";

// menerima objek author dari JWT ({ role }) atau nama peran langsung
if (isSuperadmin(req.author)) { /* ... */ }
```

`NAMA_SUPERADMIN` bernilai `"super admin"`; perbandingan tidak peka huruf besar/kecil.

## Dependensi

- `jsonwebtoken`
- `redis`
