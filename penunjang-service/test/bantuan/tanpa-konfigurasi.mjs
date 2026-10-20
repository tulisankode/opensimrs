// Pengganti impor khusus pengujian: tidak memuat .env dan selalu menolak koneksi database.
export async function resolve(specifier, context, nextResolve) {
  const hasil = await nextResolve(specifier, context);
  const data = (sumber) => ({ url: `data:text/javascript,${encodeURIComponent(sumber)}`, shortCircuit: true });
  if (hasil.url.endsWith("/test/hemodialisa-bridging-hdis.test.js")) return data(`import { test } from 'node:test';
    test('Uji integrasi HDIS terpisah karena mengakses berkas rahasia dan variabel kunci', { skip: true }, () => {});`);
  if (specifier === "dotenv/config") return data("export {};");
  if (hasil.url.endsWith("/penunjang-service/src/config.js")) return data(`export default {
    pg: {}, maxUploadMutuMb: 10, berkasSarprasMaksMb: 10, settingUrl: 'http://127.0.0.1',
    pembayaranUrl: 'http://127.0.0.1', inventoryUrl: 'http://127.0.0.1'
  };`);
  if (specifier === "pg") return data(`class Pool {
    query() { throw new Error('Koneksi database dilarang dalam pengujian ini'); }
    connect() { throw new Error('Koneksi database dilarang dalam pengujian ini'); }
  } export default { Pool }; export { Pool };`);
  return hasil;
}
