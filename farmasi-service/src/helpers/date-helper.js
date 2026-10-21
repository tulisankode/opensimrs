import moment from "moment";
import Utils from "./utils.js";

const toEpochDate = (date) => {
  return moment(date).unix();
};

// Batas hari dihitung pada zona waktu faskes (default WIB, sama dengan laporan-service), bukan zona server:
// di server ber-TZ UTC, filter "hari ini" sebelumnya bergeser 7 jam sehingga transaksi pagi hari hilang dari laporan.
const TZ_OFFSET = process.env.REPORT_TZ_OFFSET || "+07:00";

const toStartDate = (input) => {
  const epochDate = Utils.numberTo10Digit(input) * 1000;
  return moment(epochDate).utcOffset(TZ_OFFSET).startOf('day').unix();
};

const toEndDate = (input) => {
  const epochDate = Utils.numberTo10Digit(input) * 1000;
  return moment(epochDate).utcOffset(TZ_OFFSET).endOf('day').unix();
};

const setRangeDate = (req) => {
  if (req.start_date){
    req.start_date = toStartDate(req.start_date);
  }

  if (req.end_date){
    req.end_date = toEndDate(req.end_date);
  }

  return req;
};

export {toEpochDate, setRangeDate, TZ_OFFSET}
