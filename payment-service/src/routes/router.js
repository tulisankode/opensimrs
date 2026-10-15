import express from 'express';
import PaymentController from '../controllers/PaymentController.js';
import CashierController from '../controllers/CashierController.js';
import ReportController from '../controllers/ReportController.js';
import authorizationSdk from '@opensimrs/authorization-sdk';
import PatientBillController from '../controllers/PatientBillController.js';
import { tokenContextMiddleware } from '../middlewares/token-context-middleware.js';
// import { sseHandler } from '../helpers/sseService.js';
const r = express.Router();

// Cashier — didaftarkan sebelum rute ber-parameter (/:uuid/close) agar POST /cashier/close tidak tertangkap
// sebagai "tutup tagihan" dengan uuid "cashier".
r.get(`/cashier/check`, authorizationSdk([]), CashierController.CheckCashier);
r.get(`/cashier/close-day/check`, authorizationSdk([]), CashierController.getCloseDayConfirmation);
r.post(`/cashier/open`, authorizationSdk([]), CashierController.OpenCashier);
r.post(`/cashier/close`, authorizationSdk([]), CashierController.CloseShiftCashier);
r.post(`/cashier/close/day`, authorizationSdk([]), CashierController.CloseDayCashier);

// Payment
r.get('/closed-bills', authorizationSdk([]), PaymentController.getClosedBillList);
r.get('/closed-bills/:uuid/history', authorizationSdk([]), PaymentController.getPaymentHistory);
r.get('/aps-otc', authorizationSdk([]), PaymentController.getApsOtcList);
r.get('/pelayanan', authorizationSdk([]), PaymentController.getPelayananList);
r.get('/payment', authorizationSdk([]), PaymentController.findPayment);
r.get('/:uuid', authorizationSdk([]), tokenContextMiddleware, PaymentController.getDetailBill);
r.get('/:uuid/items', authorizationSdk([]), PaymentController.getBillItems);
r.get('/:uuid/detail', authorizationSdk([]), PaymentController.getDetailPayment);
r.get('/:uuid/pasien', tokenContextMiddleware, authorizationSdk([]), PaymentController.getDetailPasienBill);
r.post('/:uuid/voucher', authorizationSdk([]), PaymentController.applyVoucher);
r.post('/:uuid/discount', authorizationSdk([]), PaymentController.applyDiscount);
r.post('/:uuid/close', authorizationSdk([]), PaymentController.closeBill);
r.post('/:uuid/payment', authorizationSdk([]), PaymentController.paymentBill);
r.post('/closed-bills/:uuid/pay', authorizationSdk([]), PaymentController.payDebtOnClosedBill);

// Report
r.get(`/report/cashier`, authorizationSdk([]), ReportController.getReportCashier);
r.get(`/report/payment`, authorizationSdk([]), ReportController.getReportPayment);
r.get(`/report/revenue`, authorizationSdk([]), ReportController.getReportRevenue);

// Patient
r.get('/mobile-patient/bills', authorizationSdk([]), PatientBillController.getMyBills);
r.post('/internal/bills', tokenContextMiddleware, PatientBillController.createBill);

export default r;
