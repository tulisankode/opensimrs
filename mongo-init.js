// Dijalankan sekali oleh image mongo saat volume masih kosong (lihat docker-compose.yml).
// Layanan memakai akun root dari .env (MONGO_DB_USERNAME/MONGO_DB_PASSWORD, authSource=admin);
// skrip ini hanya menyiapkan database aplikasi. Tidak ada kredensial yang ditulis di sini.
const nama = process.env.MONGO_INITDB_DATABASE || "opensimrs";
db = db.getSiblingDB(nama);
db.createCollection("rekam_medises");
