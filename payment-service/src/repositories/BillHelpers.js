import db from '../configs/knex-config.js';

export function getReceiptNumberSubquery() {
  return db.raw(`(
      SELECT ph.receipt_number
      FROM payment_history ph
      WHERE ph.bill_uuid = b.uuid
      ORDER BY ph.created_at DESC
      LIMIT 1
    ) as receipt_number`);
}

export function getCashierNameSubquery() {
  return db.raw(`(
      SELECT STRING_AGG(DISTINCT cr.nama_kasir, ', ') 
      FROM payment_history ph 
      JOIN cashier_report cr ON ph.kasir_uuid = cr.uuid 
      WHERE ph.bill_uuid = b.uuid
    ) as cashier_name`);
}

export function getPaymentTypeSubquery() {
  return db.raw(`(
      CASE
        WHEN EXISTS (SELECT 1 FROM service_bill sb WHERE sb.bill_uuid = b.uuid AND sb.with_insurance = true)
        THEN 'ASURANSI'
        ELSE 'TUNAI'
      END
      ) as payment_type`);
}

export function getPaymentMethodSubquery() {
  return db.raw(`(
    SELECT ph.payment_method
    FROM payment_history ph
    WHERE ph.bill_uuid = b.uuid
    ORDER BY ph.created_at DESC
    LIMIT 1
    ) as payment_method`);
}

export function calculateBillTotals(billData) {
  const subTotal = parseFloat(billData.sub_total) || 0;
  const ppn = parseFloat(billData.ppn) || 0;
  const adminFee = parseFloat(billData.admin_fee) || 0;
  const discountPercent = parseFloat(billData.discount) || 0;
  const { voucher_value, voucher_type } = billData;

  let total = subTotal + ppn + adminFee;
  let voucherDeduction = 0;

  if (voucher_type && voucher_value) {
    if (voucher_type === 'persentase') {
      voucherDeduction = total * (parseFloat(voucher_value) / 100);
    } else if (voucher_type === 'potongan') {
      voucherDeduction = parseFloat(voucher_value);
    }
  }

  total -= voucherDeduction;

  if (discountPercent > 0) {
    const discountDeduction = total * (discountPercent / 100);
    total -= discountDeduction;
  }

  return total < 0 ? 0 : total;
}

export async function generateInvoiceAndBillCode(trx, faskesUuid) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  const prefixInvoice = `INV/${year}/${month}`;
  const prefixBill = `BILL/${year}/${month}`;

  let invoiceCode;
  let billCode;
  let isUnique = false;

  do {
    const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();

    invoiceCode = `${prefixInvoice}/${randomStr}`;
    billCode = `${prefixBill}/${randomStr}`;

    const existingBill = await trx('bills')
      .where('faskes_uuid', faskesUuid)
      .where((builder) => {
        builder.where('invoice_code', invoiceCode).orWhere('bill_code', billCode);
      })
      .first();

    if (!existingBill) {
      isUnique = true;
    }
  } while (!isUnique);

  return {
    invoice_code: invoiceCode,
    bill_code: billCode,
  };
}
