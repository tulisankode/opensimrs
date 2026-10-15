const toEpochDate = (date) => {
  return Math.floor(date.getTime());
};

const startOfMonthForEpochSec = (epochSec) => {
  const d = new Date(epochSec * 1000);

  const year = d.getFullYear();
  const month = d.getMonth(); // 0..11

  // Awal bulan UTC: jam 00:00:00
  const startUtc = new Date(year, month, 1, 0, 0, 0, 0);
  
  return {
    startDateISO: startUtc.toISOString(),
    startEpochSec: Math.floor(startUtc.getTime() / 1000),
    startDateObj: startUtc,
  };
};

const endOfMonthForEpochSec = (epochSec) => {
  // epochSec = detik
  const d = new Date(epochSec * 1000);

  // gunakan UTC agar tidak terpengaruh timezone lokal
  const year = d.getFullYear();
  const month = d.getMonth(); // 0..11

  // buat tanggal "0" pada bulan berikutnya di UTC -> hasil = akhir bulan yang diinginkan
  const endUtc = new Date(year, month + 1, 0, 23, 59, 59, 999);

  return {
    endDateISO: endUtc.toISOString(), // string ISO UTC
    endEpochSec: Math.floor(endUtc.getTime() / 1000), // epoch dalam detik
    endDateObj: endUtc, // Date object (UTC)
  };
};

export { toEpochDate, endOfMonthForEpochSec, startOfMonthForEpochSec };