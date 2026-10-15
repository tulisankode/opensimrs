import moment from "moment";
import Utils from "./utils.js";

const toEpochDate = (date) => {
  return moment(date).unix();
};

const toStartDate = (input) => {
  const epochDate = Utils.numberTo10Digit(input) * 1000;
  return moment(epochDate).startOf('day').unix();
};

const toEndDate = (input) => {
  const epochDate = Utils.numberTo10Digit(input) * 1000;
  return moment(epochDate).endOf('day').unix();
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

export {toEpochDate, setRangeDate}
