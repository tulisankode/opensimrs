// Tanggal filter laporan berformat YYYY-MM-DD dibaca sebagai tanggal lokal faskes (default WIB),
// bukan UTC — tanpa ini batas hari bergeser 7 jam.
const TZ_OFFSET = process.env.REPORT_TZ_OFFSET || "+07:00"
const isPlainDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)

export const dateToEpoch = (dateStr) => {
  const value = isPlainDate(dateStr) ? `${dateStr}T00:00:00${TZ_OFFSET}` : dateStr
  return Math.floor(new Date(value).getTime() / 1000.0)
}

// Batas akhir filter: tanggal akhir ikut terhitung penuh (s.d. 23:59:59)
export const endOfDateToEpoch = (dateStr) => {
  return isPlainDate(dateStr) ? dateToEpoch(dateStr) + 86399 : dateToEpoch(dateStr)
}
