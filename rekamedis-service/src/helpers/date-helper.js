import moment from "moment";
import "dotenv/config";

const toEpochDate = (date) => {
  return moment(date).unix();
};

const timezoneDate = process.env.APPLICATION_TIMEZONE || "Asia/Jakarta";

export {toEpochDate, timezoneDate}
