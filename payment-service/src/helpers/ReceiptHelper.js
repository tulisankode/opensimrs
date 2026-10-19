import { randomBytes } from 'crypto';

// Bagian acak 10 karakter hex (±1,1 triliun kemungkinan). Dulu hanya 4 karakter (65.536 kemungkinan) padahal
// receipt_number UNIK di seluruh database: setelah beberapa ratus kuitansi pembayaran mulai gagal 500 karena bentrok.
const PANJANG_ACAK = 10;
const MAKS_COBA = 5;

const buatNomor = () => `KUI/${randomBytes(PANJANG_ACAK / 2).toString('hex').toUpperCase()}`;

/**
 * Menghasilkan nomor kuitansi unik secara acak (tanpa urutan, untuk menghindari race condition antar-kasir).
 * Bila transaksi Knex diberikan, nomor yang sudah dipakai dilewati lalu dibuat ulang.
 * @param { import("knex").Knex.Transaction } [trx] - Transaksi Knex untuk memeriksa nomor yang sudah ada.
 * @returns {Promise<string>} Nomor kuitansi, mis. 'KUI/A1B2C3D4E5'
 */
export async function generateReceiptNumber(trx) {
  for (let coba = 0; coba < MAKS_COBA; coba++) {
    const nomor = buatNomor();
    if (!trx) return nomor;
    const ada = await trx('payment_history').where('receipt_number', nomor).first('id');
    if (!ada) return nomor;
  }
  throw new Error('Gagal membuat nomor kuitansi unik, silakan ulangi pembayaran');
}
