const toEpochDate = (date) => {
  return Math.floor(date.getTime()/1000.0);
};

export {toEpochDate}
