'use strict';

// Data demo: satu faskes fiktif per segmen Manajemen Modul. Nama orang & faskes fiktif; wilayah Jawa Timur.
// Dipakai database/demo/seed-demo.cjs. Harga dalam rupiah; `skala` mengalikan tarif tindakan/lab per segmen.

// ── Faskes per segmen ───────────────────────────────────────────────────
// poli: [kode antrian, nama, jenis_poli, kd_poli_bpjs]; dokter: [nama, gelar depan, gelar belakang, gender, kode poli[]]
const FASKES = [
  {
    kode: 'PMD', prefix: 'pm', segmen: 'praktik_mandiri', nama: 'Praktik dr. Andi Wijaya',
    kab: '3578', kabNama: 'KOTA SURABAYA', kec: 'GUBENG', alamat: 'Jl. Kalibokor Selatan No. 27', kodePos: '60284',
    telp: '0315021734', email: 'praktik.andiwijaya@contoh.id', web: '-', skala: 1,
    poli: [['PU', 'Poli Umum', 'umum', '001']],
    dokter: [['Andi Wijaya', 'dr.', null, 'Laki-laki', ['PU']]],
    jam: ['17:00', '21:00'],
    staf: [['Siti Nurhaliza', null, 'A.Md.Kep', 'Perempuan', 'asisten']],
    depo: [['LOP', 'Lemari Obat Praktik', 'depo', '1']],
  },
  {
    kode: 'KPS', prefix: 'kp', segmen: 'klinik_pratama', nama: 'Klinik Pratama Sehat Sentosa',
    kab: '3515', kabNama: 'KAB. SIDOARJO', kec: 'SIDOARJO', alamat: 'Jl. Raya Gelam No. 88', kodePos: '61271',
    telp: '0318962214', email: 'klinik.sehatsentosa@contoh.id', web: 'sehatsentosa.co.id', skala: 1.2,
    poli: [['PU', 'Poli Umum', 'umum', '001'], ['PG', 'Poli Gigi', 'gigi', '002'], ['KI', 'Poli KIA / KB', 'kia_kb', '003']],
    dokter: [
      ['Rina Kusumawati', 'dr.', null, 'Perempuan', ['PU', 'KI']],
      ['Bayu Saputra', 'dr.', null, 'Laki-laki', ['PU']],
      ['Maya Lestari', 'drg.', null, 'Perempuan', ['PG']],
    ],
    jam: ['08:00', '20:00'],
    staf: [
      ['Dewi Anggraini', null, 'S.Kep., Ns.', 'Perempuan', 'perawat'],
      ['Yuliana Pratiwi', null, 'A.Md.Keb', 'Perempuan', 'perawat'],
      ['Fajar Ramadhan', 'apt.', 'S.Farm.', 'Laki-laki', 'apoteker'],
      ['Nurul Aini', null, 'A.Md.AK', 'Perempuan', 'lab'],
      ['Putri Wulandari', null, null, 'Perempuan', 'admisi'],
      ['Rizky Firmansyah', null, 'S.E.', 'Laki-laki', 'kasir'],
      ['Hendra Gunawan', null, null, 'Laki-laki', 'gudang'],
    ],
    depo: [['GDF', 'Gudang Farmasi', 'gudang', null], ['APK', 'Apotek Klinik', 'depo', '1']],
  },
  {
    kode: 'KUM', prefix: 'ku', segmen: 'klinik_utama', nama: 'Klinik Utama Mitra Medika',
    kab: '3578', kabNama: 'KOTA SURABAYA', kec: 'WONOKROMO', alamat: 'Jl. Raya Darmo No. 140', kodePos: '60241',
    telp: '0315678120', email: 'info@mitramedika-sby.co.id', web: 'mitramedika-sby.co.id', skala: 1.6,
    poli: [
      ['PD', 'Poli Penyakit Dalam', 'penyakit_dalam', 'INT'], ['PA', 'Poli Anak', 'anak', 'ANA'],
      ['PK', 'Poli Kandungan', 'kandungan', 'OBG'], ['PM', 'Poli Mata', 'mata', 'MAT'], ['PT', 'Poli THT', 'tht', 'THT'],
    ],
    dokter: [
      ['Hendro Wibisono', 'dr.', 'Sp.PD', 'Laki-laki', ['PD']],
      ['Larasati Putri', 'dr.', 'Sp.A', 'Perempuan', ['PA']],
      ['Agus Salim', 'dr.', 'Sp.OG', 'Laki-laki', ['PK']],
      ['Melinda Hartono', 'dr.', 'Sp.M', 'Perempuan', ['PM']],
      ['Rudi Hartanto', 'dr.', 'Sp.THT-KL', 'Laki-laki', ['PT']],
    ],
    jam: ['08:00', '20:00'],
    staf: [
      ['Wahyuni Setyaningsih', null, 'S.Kep., Ns.', 'Perempuan', 'perawat'],
      ['Arief Budiman', null, 'S.Kep., Ns.', 'Laki-laki', 'perawat'],
      ['Diana Puspitasari', 'apt.', 'S.Farm.', 'Perempuan', 'apoteker'],
      ['Eko Prasetyo', null, 'A.Md.AK', 'Laki-laki', 'lab'],
      ['Ratna Sari', null, null, 'Perempuan', 'admisi'],
      ['Doni Kurniawan', null, 'S.E.', 'Laki-laki', 'kasir'],
      ['Slamet Riyadi', null, null, 'Laki-laki', 'gudang'],
    ],
    depo: [['GDF', 'Gudang Farmasi', 'gudang', null], ['DRJ', 'Depo Farmasi Rawat Jalan', 'depo', '1'], ['DRI', 'Depo Farmasi Rawat Inap', 'depo', '0']],
    rawatInap: [['MEL', 'Ruang Melati', 'Kelas 1', 2, 350000], ['MAW', 'Ruang Mawar', 'Kelas 2', 4, 225000]],
  },
  {
    kode: 'PKM', prefix: 'pkm', segmen: 'puskesmas', nama: 'UPT Puskesmas Tambak Wedi Asri',
    kab: '3578', kabNama: 'KOTA SURABAYA', kec: 'KENJERAN', alamat: 'Jl. Tambak Wedi Baru No. 12', kodePos: '60126',
    telp: '0313819402', email: 'pkm.tambakwediasri@contoh.id', web: '-', skala: 0.6,
    poli: [
      ['PU', 'Poli Umum', 'umum', '001'], ['PG', 'Poli Gigi', 'gigi', '002'],
      ['KI', 'Poli KIA / KB', 'kia_kb', '003'], ['PL', 'Poli Lansia', 'lainnya', '001'],
    ],
    dokter: [
      ['Fitri Handayani', 'dr.', null, 'Perempuan', ['PU', 'PL']],
      ['Yusuf Maulana', 'dr.', null, 'Laki-laki', ['PU', 'KI']],
      ['Anisa Rahmawati', 'drg.', null, 'Perempuan', ['PG']],
    ],
    jam: ['07:30', '14:00'],
    staf: [
      ['Sri Mulyani', null, 'S.Kep., Ns.', 'Perempuan', 'perawat'],
      ['Endang Susilowati', null, 'A.Md.Keb', 'Perempuan', 'perawat'],
      ['Lukman Hakim', 'apt.', 'S.Farm.', 'Laki-laki', 'apoteker'],
      ['Indah Permatasari', null, 'A.Md.AK', 'Perempuan', 'lab'],
      ['Bambang Sutrisno', null, null, 'Laki-laki', 'admisi'],
      ['Novi Andriani', null, null, 'Perempuan', 'kasir'],
      ['Teguh Santoso', null, null, 'Laki-laki', 'gudang'],
    ],
    depo: [['GOP', 'Gudang Obat Puskesmas', 'gudang', null], ['APP', 'Ruang Farmasi Puskesmas', 'depo', '1']],
  },
  {
    kode: 'RSD', prefix: 'rsd', segmen: 'rs_d', nama: 'RSU Bhakti Husada',
    kab: '3515', kabNama: 'KAB. SIDOARJO', kec: 'KRIAN', alamat: 'Jl. Raya Krian No. 210', kodePos: '61262',
    telp: '0318971155', email: 'rsu.bhaktihusada@contoh.id', web: 'rsubhaktihusada.co.id', skala: 1.8,
    poli: [
      ['PU', 'Poli Umum', 'umum', 'UMU'], ['PD', 'Poli Penyakit Dalam', 'penyakit_dalam', 'INT'],
      ['PA', 'Poli Anak', 'anak', 'ANA'], ['PK', 'Poli Kandungan', 'kandungan', 'OBG'],
      ['PB', 'Poli Bedah', 'bedah', 'BED'], ['PG', 'Poli Gigi', 'gigi', 'GIG'],
    ],
    dokter: [
      ['Galih Prakoso', 'dr.', null, 'Laki-laki', ['PU']],
      ['Sinta Maharani', 'dr.', 'Sp.PD', 'Perempuan', ['PD']],
      ['Dimas Aditya', 'dr.', 'Sp.A', 'Laki-laki', ['PA']],
      ['Kartika Sari', 'dr.', 'Sp.OG', 'Perempuan', ['PK']],
      ['Bagus Setiawan', 'dr.', 'Sp.B', 'Laki-laki', ['PB']],
      ['Lina Marlina', 'drg.', null, 'Perempuan', ['PG']],
    ],
    jam: ['08:00', '16:00'],
    staf: [
      ['Yanti Kusuma', null, 'S.Kep., Ns.', 'Perempuan', 'perawat'],
      ['Joko Susilo', null, 'S.Kep., Ns.', 'Laki-laki', 'perawat'],
      ['Mega Ayu Lestari', 'apt.', 'S.Farm.', 'Perempuan', 'apoteker'],
      ['Ahmad Fauzi', null, 'S.Tr.Kes', 'Laki-laki', 'lab'],
      ['Wulan Dari', null, null, 'Perempuan', 'admisi'],
      ['Irfan Hidayat', null, 'S.E.', 'Laki-laki', 'kasir'],
      ['Sugeng Raharjo', null, null, 'Laki-laki', 'gudang'],
    ],
    depo: [
      ['GDF', 'Gudang Farmasi', 'gudang', null], ['DRJ', 'Depo Farmasi Rawat Jalan', 'depo', '1'],
      ['DRI', 'Depo Farmasi Rawat Inap', 'depo', '0'], ['DGD', 'Depo Farmasi IGD', 'depo', '2'],
    ],
    igd: true,
    rawatInap: [['ANG', 'Ruang Anggrek', 'Kelas 1', 4, 400000], ['KEN', 'Ruang Kenanga', 'Kelas 2', 6, 275000], ['TER', 'Ruang Teratai', 'Kelas 3', 8, 150000]],
  },
  {
    kode: 'RSC', prefix: 'rsc', segmen: 'rs_c', nama: 'RSU Citra Medika Malang',
    kab: '3573', kabNama: 'KOTA MALANG', kec: 'KLOJEN', alamat: 'Jl. Ijen Raya No. 56', kodePos: '65112',
    telp: '0341556720', email: 'humas@citramedika-malang.co.id', web: 'citramedika-malang.co.id', skala: 2.2,
    poli: [
      ['PU', 'Poli Umum', 'umum', 'UMU'], ['PD', 'Poli Penyakit Dalam', 'penyakit_dalam', 'INT'],
      ['PA', 'Poli Anak', 'anak', 'ANA'], ['PK', 'Poli Kandungan', 'kandungan', 'OBG'],
      ['PB', 'Poli Bedah', 'bedah', 'BED'], ['PS', 'Poli Saraf', 'saraf', 'SAR'],
      ['PM', 'Poli Mata', 'mata', 'MAT'], ['PT', 'Poli THT', 'tht', 'THT'], ['PG', 'Poli Gigi', 'gigi', 'GIG'],
    ],
    dokter: [
      ['Yoga Pratama', 'dr.', null, 'Laki-laki', ['PU']],
      ['Ayu Ningsih', 'dr.', 'Sp.PD', 'Perempuan', ['PD']],
      ['Reza Mahendra', 'dr.', 'Sp.A', 'Laki-laki', ['PA']],
      ['Citra Anggraeni', 'dr.', 'Sp.OG', 'Perempuan', ['PK']],
      ['Hari Purnomo', 'dr.', 'Sp.B', 'Laki-laki', ['PB']],
      ['Novia Kartini', 'dr.', 'Sp.N', 'Perempuan', ['PS']],
      ['Bima Sakti', 'dr.', 'Sp.M', 'Laki-laki', ['PM']],
      ['Tari Wulandari', 'dr.', 'Sp.THT-KL', 'Perempuan', ['PT']],
      ['Farhan Akbar', 'drg.', null, 'Laki-laki', ['PG']],
    ],
    jam: ['08:00', '16:00'],
    staf: [
      ['Lilis Suryani', null, 'S.Kep., Ns.', 'Perempuan', 'perawat'],
      ['Andika Putra', null, 'S.Kep., Ns.', 'Laki-laki', 'perawat'],
      ['Rahmi Fadhilah', 'apt.', 'S.Farm.', 'Perempuan', 'apoteker'],
      ['Wahyu Hidayat', null, 'S.Tr.Kes', 'Laki-laki', 'lab'],
      ['Desi Ratnasari', null, null, 'Perempuan', 'admisi'],
      ['Yudi Prasetya', null, 'S.E.', 'Laki-laki', 'kasir'],
      ['Darmawan', null, null, 'Laki-laki', 'gudang'],
    ],
    depo: [
      ['GDF', 'Gudang Farmasi', 'gudang', null], ['DRJ', 'Depo Farmasi Rawat Jalan', 'depo', '1'],
      ['DRI', 'Depo Farmasi Rawat Inap', 'depo', '0'], ['DGD', 'Depo Farmasi IGD', 'depo', '2'],
    ],
    igd: true,
    rawatInap: [['VIP', 'Ruang Wijaya Kusuma', 'VIP', 2, 750000], ['DAH', 'Ruang Dahlia', 'Kelas 1', 4, 450000], ['SER', 'Ruang Seruni', 'Kelas 2', 6, 300000], ['FLA', 'Ruang Flamboyan', 'Kelas 3', 8, 175000]],
  },
  {
    kode: 'RSB', prefix: 'rsb', segmen: 'rs_b', nama: 'RS Permata Husada Surabaya',
    kab: '3578', kabNama: 'KOTA SURABAYA', kec: 'SUKOLILO', alamat: 'Jl. Arief Rahman Hakim No. 150', kodePos: '60117',
    telp: '0315947788', email: 'info@permatahusada-sby.co.id', web: 'permatahusada-sby.co.id', skala: 2.6,
    poli: [
      ['PU', 'Poli Umum', 'umum', 'UMU'], ['PD', 'Poli Penyakit Dalam', 'penyakit_dalam', 'INT'],
      ['PA', 'Poli Anak', 'anak', 'ANA'], ['PK', 'Poli Kandungan', 'kandungan', 'OBG'],
      ['PB', 'Poli Bedah', 'bedah', 'BED'], ['PS', 'Poli Saraf', 'saraf', 'SAR'],
      ['PM', 'Poli Mata', 'mata', 'MAT'], ['PT', 'Poli THT', 'tht', 'THT'],
      ['PR', 'Poli Kulit & Kelamin', 'kulit', 'KLT'], ['PJ', 'Poli Jiwa', 'jiwa', 'JIW'], ['PG', 'Poli Gigi', 'gigi', 'GIG'],
    ],
    dokter: [
      ['Adi Nugroho', 'dr.', null, 'Laki-laki', ['PU']],
      ['Wening Prameswari', 'dr.', 'Sp.PD', 'Perempuan', ['PD']],
      ['Fikri Ramadhan', 'dr.', 'Sp.A', 'Laki-laki', ['PA']],
      ['Intan Permata', 'dr.', 'Sp.OG', 'Perempuan', ['PK']],
      ['Rangga Saputra', 'dr.', 'Sp.B', 'Laki-laki', ['PB']],
      ['Sekar Arum', 'dr.', 'Sp.N', 'Perempuan', ['PS']],
      ['Taufik Hidayat', 'dr.', 'Sp.M', 'Laki-laki', ['PM']],
      ['Rara Anjani', 'dr.', 'Sp.THT-KL', 'Perempuan', ['PT']],
      ['Bayu Aji', 'dr.', 'Sp.DVE', 'Laki-laki', ['PR']],
      ['Nadia Safitri', 'dr.', 'Sp.KJ', 'Perempuan', ['PJ']],
      ['Raka Wiratama', 'drg.', null, 'Laki-laki', ['PG']],
    ],
    jam: ['07:30', '20:00'],
    staf: [
      ['Kurniasih', null, 'S.Kep., Ns.', 'Perempuan', 'perawat'],
      ['Setyo Budi', null, 'S.Kep., Ns.', 'Laki-laki', 'perawat'],
      ['Annisa Fitri', 'apt.', 'S.Farm.', 'Perempuan', 'apoteker'],
      ['Ilham Saputra', null, 'S.Tr.Kes', 'Laki-laki', 'lab'],
      ['Mira Andayani', null, null, 'Perempuan', 'admisi'],
      ['Satria Wibowo', null, 'S.E.', 'Laki-laki', 'kasir'],
      ['Supriyadi', null, null, 'Laki-laki', 'gudang'],
    ],
    depo: [
      ['GDF', 'Gudang Farmasi', 'gudang', null], ['DRJ', 'Depo Farmasi Rawat Jalan', 'depo', '1'],
      ['DRI', 'Depo Farmasi Rawat Inap', 'depo', '0'], ['DGD', 'Depo Farmasi IGD', 'depo', '2'],
    ],
    igd: true,
    rawatInap: [['VIP', 'Ruang Paviliun Cendana', 'VIP', 4, 950000], ['KEM', 'Ruang Kemuning', 'Kelas 1', 6, 500000], ['SAK', 'Ruang Sakura', 'Kelas 2', 8, 325000], ['TUL', 'Ruang Tulip', 'Kelas 3', 10, 200000]],
  },
  {
    kode: 'RSA', prefix: 'rsa', segmen: 'rs_a', nama: 'RSUP Dharma Nusantara',
    kab: '3578', kabNama: 'KOTA SURABAYA', kec: 'TAMBAKSARI', alamat: 'Jl. Prof. Dr. Moestopo No. 9', kodePos: '60131',
    telp: '0315501100', email: 'humas@rsupdharmanusantara.go.id', web: 'rsupdharmanusantara.go.id', skala: 3,
    poli: [
      ['PU', 'Poli Umum', 'umum', 'UMU'], ['PD', 'Poli Penyakit Dalam', 'penyakit_dalam', 'INT'],
      ['PA', 'Poli Anak', 'anak', 'ANA'], ['PK', 'Poli Kandungan', 'kandungan', 'OBG'],
      ['PB', 'Poli Bedah', 'bedah', 'BED'], ['PS', 'Poli Saraf', 'saraf', 'SAR'],
      ['PM', 'Poli Mata', 'mata', 'MAT'], ['PT', 'Poli THT', 'tht', 'THT'],
      ['PR', 'Poli Kulit & Kelamin', 'kulit', 'KLT'], ['PJ', 'Poli Jiwa', 'jiwa', 'JIW'],
      ['PG', 'Poli Gigi', 'gigi', 'GIG'], ['PC', 'Poli Jantung', 'lainnya', 'JAN'], ['PP', 'Poli Paru', 'lainnya', 'PAR'],
    ],
    dokter: [
      ['Arya Dwipangga', 'dr.', null, 'Laki-laki', ['PU']],
      ['Ratih Purwasih', 'dr.', 'Sp.PD-KGEH', 'Perempuan', ['PD']],
      ['Bagas Wicaksono', 'dr.', 'Sp.A(K)', 'Laki-laki', ['PA']],
      ['Lestari Wulan', 'dr.', 'Sp.OG(K)', 'Perempuan', ['PK']],
      ['Danang Prasetyo', 'dr.', 'Sp.B-KBD', 'Laki-laki', ['PB']],
      ['Yasmin Azzahra', 'dr.', 'Sp.N', 'Perempuan', ['PS']],
      ['Haris Munandar', 'dr.', 'Sp.M(K)', 'Laki-laki', ['PM']],
      ['Puspa Dewi', 'dr.', 'Sp.THT-KL', 'Perempuan', ['PT']],
      ['Ardi Kusuma', 'dr.', 'Sp.DVE', 'Laki-laki', ['PR']],
      ['Melati Suci', 'dr.', 'Sp.KJ', 'Perempuan', ['PJ']],
      ['Gilang Ramadhan', 'drg.', 'Sp.BM', 'Laki-laki', ['PG']],
      ['Sutanto Wijaya', 'dr.', 'Sp.JP(K)', 'Laki-laki', ['PC']],
      ['Hana Pertiwi', 'dr.', 'Sp.P', 'Perempuan', ['PP']],
    ],
    jam: ['07:00', '20:00'],
    staf: [
      ['Murniati', null, 'S.Kep., Ns., M.Kep.', 'Perempuan', 'perawat'],
      ['Agung Laksono', null, 'S.Kep., Ns.', 'Laki-laki', 'perawat'],
      ['Febrianti', 'apt.', 'S.Farm., M.Farm.', 'Perempuan', 'apoteker'],
      ['Yudha Pranata', null, 'S.Tr.Kes', 'Laki-laki', 'lab'],
      ['Ika Rahayu', null, null, 'Perempuan', 'admisi'],
      ['Benny Saputra', null, 'S.Ak.', 'Laki-laki', 'kasir'],
      ['Wahyudi', null, null, 'Laki-laki', 'gudang'],
    ],
    depo: [
      ['GDF', 'Gudang Farmasi Pusat', 'gudang', null], ['DRJ', 'Depo Farmasi Rawat Jalan', 'depo', '1'],
      ['DRI', 'Depo Farmasi Rawat Inap', 'depo', '0'], ['DGD', 'Depo Farmasi IGD', 'depo', '2'],
    ],
    igd: true,
    rawatInap: [['VVI', 'Paviliun Garuda', 'VVIP', 2, 1500000], ['VIP', 'Paviliun Rajawali', 'VIP', 4, 1000000], ['KAS', 'Ruang Kasuari', 'Kelas 1', 6, 550000], ['MER', 'Ruang Merak', 'Kelas 2', 8, 350000], ['NUR', 'Ruang Nuri', 'Kelas 3', 12, 225000]],
  },
];

// ── Penjamin ────────────────────────────────────────────────────────────
// TUNAI wajib identik di semua faskes: admisi mencarinya tanpa filter faskes (insurance-admission-repository).
const PENJAMIN_TUNAI = ['A-1', 'TUNAI/UMUM'];
const PENJAMIN_LAIN = [['BPJS', 'BPJS Kesehatan'], ['INH', 'Mandiri Inhealth'], ['ADM', 'Admedika']];

// ── Tindakan ────────────────────────────────────────────────────────────
// [kode, nama, harga dasar, unit pelayanan, minimal level] level: 1 praktik, 2 klinik/puskesmas, 3 klinik utama/RS
const TINDAKAN = [
  ['KONS-UM', 'Konsultasi Dokter Umum', 60000, ['Rawat Jalan', 'IGD'], 1],
  ['KONS-SP', 'Konsultasi Dokter Spesialis', 150000, ['Rawat Jalan'], 3],
  ['KONS-GI', 'Konsultasi Dokter Gigi', 75000, ['Rawat Jalan'], 2],
  ['INJ-IM', 'Injeksi Intramuskular', 25000, ['Rawat Jalan', 'IGD', 'Rawat Inap'], 1],
  ['RWT-LK', 'Perawatan Luka Kecil', 50000, ['Rawat Jalan', 'IGD'], 1],
  ['HCT-JL', 'Hecting (Jahit Luka) per Jahitan', 20000, ['Rawat Jalan', 'IGD'], 1],
  ['NEBU', 'Nebulizer', 60000, ['Rawat Jalan', 'IGD', 'Rawat Inap'], 1],
  ['EKG', 'Elektrokardiografi (EKG)', 85000, ['Rawat Jalan', 'IGD', 'Rawat Inap'], 2],
  ['EXT-GI', 'Pencabutan Gigi Permanen', 150000, ['Rawat Jalan'], 2],
  ['TBL-GI', 'Penambalan Gigi Komposit', 175000, ['Rawat Jalan'], 2],
  ['SCL-GI', 'Scaling Gigi per Rahang', 200000, ['Rawat Jalan'], 2],
  ['ANC', 'Pemeriksaan Kehamilan (ANC)', 50000, ['Rawat Jalan'], 2],
  ['KB-SNT', 'Suntik KB 3 Bulan', 35000, ['Rawat Jalan'], 2],
  ['KB-IMP', 'Pemasangan Implan KB', 250000, ['Rawat Jalan'], 2],
  ['USG-OB', 'USG Kebidanan', 200000, ['Rawat Jalan'], 3],
  ['VISUS', 'Pemeriksaan Visus & Refraksi', 50000, ['Rawat Jalan'], 3],
  ['IRG-TL', 'Irigasi Telinga', 75000, ['Rawat Jalan'], 3],
  ['INFUS', 'Pemasangan Infus', 75000, ['IGD', 'Rawat Inap'], 3],
  ['KATET', 'Pemasangan Kateter Urin', 85000, ['IGD', 'Rawat Inap'], 3],
  ['OBS-IGD', 'Observasi IGD per 6 Jam', 150000, ['IGD'], 3],
  ['VIS-DU', 'Visite Dokter Umum', 75000, ['Rawat Inap'], 3],
  ['VIS-SP', 'Visite Dokter Spesialis', 150000, ['Rawat Inap'], 3],
  ['ASKEP', 'Asuhan Keperawatan per Hari', 60000, ['Rawat Inap'], 3],
];

// ── Obat & BMHP ─────────────────────────────────────────────────────────
// [kode, nama, bentuk, dosis, satuan dosis, satuan pakai, isi/kemasan, satuan kemasan, kategori, harga/satuan pakai, jenis, zat aktif, minimal level]
const OBAT = [
  ['PCT500', 'Paracetamol 500 mg Tablet', 'TAB', 500, 'MG', 'TAB', 100, 'BOX', 'ANALG', 150, 'obat', 'Paracetamol', 1],
  ['PCT-SR', 'Paracetamol Sirup 120 mg/5 ml', 'SIR', 120, 'MG', 'BTL', 1, 'BTL', 'ANALG', 6500, 'obat', 'Paracetamol', 1],
  ['IBU400', 'Ibuprofen 400 mg Tablet', 'TAB', 400, 'MG', 'TAB', 100, 'BOX', 'ANALG', 300, 'obat', 'Ibuprofen', 1],
  ['ASM500', 'Asam Mefenamat 500 mg Tablet', 'TAB', 500, 'MG', 'TAB', 100, 'BOX', 'ANALG', 250, 'obat', 'Asam Mefenamat', 1],
  ['NAD50', 'Natrium Diklofenak 50 mg Tablet', 'TAB', 50, 'MG', 'TAB', 100, 'BOX', 'ANALG', 350, 'obat', 'Natrium Diklofenak', 2],
  ['AMX500', 'Amoksisilin 500 mg Kapsul', 'KAP', 500, 'MG', 'KAP', 100, 'BOX', 'ANTIB', 450, 'obat', 'Amoksisilin', 1],
  ['AMX-SR', 'Amoksisilin Sirup Kering 125 mg/5 ml', 'SIR', 125, 'MG', 'BTL', 1, 'BTL', 'ANTIB', 8500, 'obat', 'Amoksisilin', 1],
  ['CFD500', 'Sefadroksil 500 mg Kapsul', 'KAP', 500, 'MG', 'KAP', 100, 'BOX', 'ANTIB', 900, 'obat', 'Sefadroksil', 2],
  ['CIP500', 'Siprofloksasin 500 mg Tablet', 'TAB', 500, 'MG', 'TAB', 100, 'BOX', 'ANTIB', 700, 'obat', 'Siprofloksasin', 2],
  ['MTZ500', 'Metronidazol 500 mg Tablet', 'TAB', 500, 'MG', 'TAB', 100, 'BOX', 'ANTIB', 400, 'obat', 'Metronidazol', 2],
  ['CTM4', 'Klorfeniramin Maleat 4 mg Tablet', 'TAB', 4, 'MG', 'TAB', 100, 'BOX', 'ANTIH', 60, 'obat', 'Klorfeniramin Maleat', 1],
  ['CTZ10', 'Setirizin 10 mg Tablet', 'TAB', 10, 'MG', 'TAB', 100, 'BOX', 'ANTIH', 250, 'obat', 'Setirizin', 1],
  ['LRT10', 'Loratadin 10 mg Tablet', 'TAB', 10, 'MG', 'TAB', 100, 'BOX', 'ANTIH', 300, 'obat', 'Loratadin', 2],
  ['AML5', 'Amlodipin 5 mg Tablet', 'TAB', 5, 'MG', 'TAB', 100, 'BOX', 'ANTHT', 200, 'obat', 'Amlodipin', 1],
  ['AML10', 'Amlodipin 10 mg Tablet', 'TAB', 10, 'MG', 'TAB', 100, 'BOX', 'ANTHT', 350, 'obat', 'Amlodipin', 2],
  ['CAP25', 'Kaptopril 25 mg Tablet', 'TAB', 25, 'MG', 'TAB', 100, 'BOX', 'ANTHT', 120, 'obat', 'Kaptopril', 1],
  ['MTF500', 'Metformin 500 mg Tablet', 'TAB', 500, 'MG', 'TAB', 100, 'BOX', 'ANTDM', 180, 'obat', 'Metformin', 1],
  ['GLB5', 'Glibenklamid 5 mg Tablet', 'TAB', 5, 'MG', 'TAB', 100, 'BOX', 'ANTDM', 100, 'obat', 'Glibenklamid', 1],
  ['SIM20', 'Simvastatin 20 mg Tablet', 'TAB', 20, 'MG', 'TAB', 100, 'BOX', 'ANTHT', 300, 'obat', 'Simvastatin', 2],
  ['ALP100', 'Alopurinol 100 mg Tablet', 'TAB', 100, 'MG', 'TAB', 100, 'BOX', 'ANALG', 150, 'obat', 'Alopurinol', 2],
  ['OMZ20', 'Omeprazol 20 mg Kapsul', 'KAP', 20, 'MG', 'KAP', 100, 'BOX', 'GASTR', 400, 'obat', 'Omeprazol', 1],
  ['ANT-DOE', 'Antasida Doen Tablet Kunyah', 'TAB', 1, 'TAB', 'TAB', 100, 'BOX', 'GASTR', 100, 'obat', 'Aluminium Hidroksida', 1],
  ['DOM10', 'Domperidon 10 mg Tablet', 'TAB', 10, 'MG', 'TAB', 100, 'BOX', 'GASTR', 250, 'obat', 'Domperidon', 1],
  ['ORALIT', 'Oralit 200 ml Serbuk', 'SRB', 1, 'SACH', 'SACH', 100, 'BOX', 'GASTR', 600, 'obat', 'Garam Rehidrasi Oral', 1],
  ['ZNC20', 'Zinc 20 mg Tablet Dispersibel', 'TAB', 20, 'MG', 'TAB', 100, 'BOX', 'VIT', 350, 'obat', 'Zinc', 1],
  ['DXM05', 'Deksametason 0,5 mg Tablet', 'TAB', 0.5, 'MG', 'TAB', 100, 'BOX', 'KORT', 80, 'obat', 'Deksametason', 1],
  ['MPD4', 'Metilprednisolon 4 mg Tablet', 'TAB', 4, 'MG', 'TAB', 100, 'BOX', 'KORT', 400, 'obat', 'Metilprednisolon', 2],
  ['SAL2', 'Salbutamol 2 mg Tablet', 'TAB', 2, 'MG', 'TAB', 100, 'BOX', 'NAPAS', 120, 'obat', 'Salbutamol', 1],
  ['AMB30', 'Ambroksol 30 mg Tablet', 'TAB', 30, 'MG', 'TAB', 100, 'BOX', 'NAPAS', 150, 'obat', 'Ambroksol', 1],
  ['OBH-SR', 'OBH Sirup 100 ml', 'SIR', 100, 'ML', 'BTL', 1, 'BTL', 'NAPAS', 9000, 'obat', 'Succus Liquiritiae', 1],
  ['VTB-CO', 'Vitamin B Kompleks Tablet', 'TAB', 1, 'TAB', 'TAB', 100, 'BOX', 'VIT', 60, 'obat', 'Vitamin B Kompleks', 1],
  ['VTC50', 'Vitamin C 50 mg Tablet', 'TAB', 50, 'MG', 'TAB', 100, 'BOX', 'VIT', 50, 'obat', 'Asam Askorbat', 1],
  ['GNT-SL', 'Gentamisin Salep Kulit 0,1%', 'SLP', 5, 'GR', 'TUB', 1, 'TUB', 'TOPIK', 7500, 'obat', 'Gentamisin', 1],
  ['KTZ-KR', 'Ketokonazol Krim 2%', 'SLP', 10, 'GR', 'TUB', 1, 'TUB', 'TOPIK', 9500, 'obat', 'Ketokonazol', 2],
  ['RL500', 'Ringer Laktat 500 ml', 'INF', 500, 'ML', 'BTL', 1, 'BTL', 'CAIR', 12000, 'obat', 'Ringer Laktat', 3],
  ['NS500', 'Natrium Klorida 0,9% 500 ml', 'INF', 500, 'ML', 'BTL', 1, 'BTL', 'CAIR', 11000, 'obat', 'Natrium Klorida', 3],
  ['CFT1G', 'Seftriakson 1 g Injeksi', 'INJ', 1000, 'MG', 'VIA', 1, 'VIA', 'ANTIB', 15000, 'obat', 'Seftriakson', 3],
  ['RAN-INJ', 'Ranitidin 50 mg/2 ml Injeksi', 'INJ', 50, 'MG', 'AMP', 1, 'AMP', 'GASTR', 5000, 'obat', 'Ranitidin', 3],
  ['SPT3', 'Spuit 3 ml', 'BMHP', 1, 'PCS', 'PCS', 100, 'BOX', 'ALKES', 1500, 'alkes', null, 1],
  ['KASA', 'Kasa Steril 16x16 cm', 'BMHP', 1, 'PCS', 'PCS', 10, 'BOX', 'ALKES', 1200, 'alkes', null, 1],
  ['HSC', 'Sarung Tangan Periksa (Handscoon)', 'BMHP', 1, 'PCS', 'PCS', 100, 'BOX', 'ALKES', 700, 'alkes', null, 1],
  ['ALC-SW', 'Alcohol Swab', 'BMHP', 1, 'PCS', 'PCS', 100, 'BOX', 'ALKES', 300, 'alkes', null, 1],
  ['PLS', 'Plester Luka', 'BMHP', 1, 'PCS', 'PCS', 100, 'BOX', 'ALKES', 400, 'alkes', null, 1],
  ['INF-SET', 'Infus Set Dewasa', 'BMHP', 1, 'PCS', 'PCS', 1, 'PCS', 'ALKES', 9500, 'alkes', null, 3],
  ['IV-22', 'IV Kateter 22G', 'BMHP', 1, 'PCS', 'PCS', 1, 'PCS', 'ALKES', 8500, 'alkes', null, 3],
];

const SATUAN = [
  // [kode, nama, satuan dosis?]
  ['MG', 'Miligram', true], ['GR', 'Gram', true], ['ML', 'Mililiter', true], ['MCG', 'Mikrogram', true], ['IU', 'International Unit', true],
  ['TAB', 'Tablet', false], ['KAP', 'Kapsul', false], ['BTL', 'Botol', false], ['TUB', 'Tube', false], ['AMP', 'Ampul', false],
  ['VIA', 'Vial', false], ['SACH', 'Sachet', false], ['STRIP', 'Strip', false], ['BOX', 'Box', false], ['PCS', 'Pieces', false],
];
const BENTUK_SEDIAAN = [['TAB', 'Tablet'], ['KAP', 'Kapsul'], ['SIR', 'Sirup'], ['SLP', 'Salep / Krim'], ['INJ', 'Injeksi'],
  ['INF', 'Cairan Infus'], ['SRB', 'Serbuk'], ['TTS', 'Tetes'], ['BMHP', 'Bahan Medis Habis Pakai']];
const KATEGORI_OBAT = [['ANALG', 'Analgesik & Antipiretik'], ['ANTIB', 'Antibiotik'], ['ANTIH', 'Antihistamin'], ['ANTHT', 'Kardiovaskular'],
  ['ANTDM', 'Antidiabetes'], ['GASTR', 'Saluran Cerna'], ['KORT', 'Kortikosteroid'], ['NAPAS', 'Saluran Napas'], ['VIT', 'Vitamin & Mineral'],
  ['TOPIK', 'Obat Kulit (Topikal)'], ['CAIR', 'Cairan & Elektrolit'], ['ALKES', 'Alat Kesehatan & BMHP']];
const PRODUSEN = [
  // [kode, nama, kode kabupaten, kode pos] — alamat dicari dari wilayah saat seeding
  ['KF', 'PT Kimia Farma Tbk', '3171', '10110', 'Jl. Veteran No. 9'],
  ['KLB', 'PT Kalbe Farma Tbk', '3172', '13210', 'Jl. Let. Jend. Suprapto Kav. 4'],
  ['SNB', 'PT Sanbe Farma', '3273', '40115', 'Jl. Taman Sari No. 10'],
  ['IDF', 'PT Indofarma Tbk', '3216', '17530', 'Jl. Indofarma No. 1'],
  ['ONM', 'PT Intisumber Hasil Sempurna (OneMed)', '3578', '60183', 'Jl. Margomulyo Indah Blok C'],
];
const SUPPLIER = [
  ['KFTD', 'PT Kimia Farma Trading & Distribution', '3578', '031-5321100', 'Jl. Tidar No. 1'],
  ['APL', 'PT Anugrah Pharmindo Lestari', '3578', '031-7491200', 'Jl. Rungkut Industri III No. 6'],
  ['ENS', 'PT Enseval Putera Megatrading', '3515', '031-8910330', 'Jl. Raya Waru No. 7'],
];
const ATURAN_PAKAI = [
  // [kode, nama, periode_unit, periode, frekuensi]
  ['1X1', '1 x sehari', 'hari', 1, 1], ['2X1', '2 x sehari', 'hari', 1, 2], ['3X1', '3 x sehari', 'hari', 1, 3],
  ['4X1', '4 x sehari', 'hari', 1, 4], ['T8J', 'Tiap 8 jam', 'tiap', 8, 1], ['PRN', 'Bila perlu', 'khusus', 1, null],
];
const CARA_PAKAI = [['ORL', 'Diminum'], ['TPK', 'Dioleskan'], ['SUB', 'Di bawah lidah'], ['INH', 'Dihirup'], ['IV', 'Intravena'], ['IM', 'Intramuskular']];
const BENTUK_RACIKAN = [['Puyer', 10, 500, 1000], ['Kapsul Racikan', 10, 500, 1500], ['Salep Racikan', 1, 1000, 3000]];

// ── Laboratorium ────────────────────────────────────────────────────────
// Dipakai database/demo/seed-lab.cjs. Kelengkapan mengikuti jenis faskes lewat kolom `tingkat` (minimal):
//   0 dasar     — praktik mandiri (bila modul lab diaktifkan), klinik pratama, puskesmas
//   1 menengah  — klinik utama, RS kelas D
//   2 lengkap   — RS kelas C, B, A (elektrolit, retikulosit, eGFR, TPHA, pewarnaan Gram, …)
// Kode LOINC wajib ada di tabel `loinc` (referensi SATUSEHAT). Kode berawalan X adalah kode lokal SATUSEHAT pada tabel
// yang sama, dipakai bila kode LOINC-nya tidak tersedia (panel Hitung Jenis, Feses Lengkap, Widal, eritrosit feses).
const TINGKAT_LAB = { praktik_mandiri: 0, klinik_pratama: 0, puskesmas: 0, klinik_utama: 1, rs_d: 1, rs_c: 2, rs_b: 2, rs_a: 2 };
const KATEGORI_LAB = [['HEM', 'Hematologi'], ['KK', 'Kimia Klinik'], ['IMS', 'Imunoserologi'], ['URI', 'Urinalisis'], ['FES', 'Feses'],
  ['MIK', 'Mikrobiologi']];
// Nilai rujukan:
//  - angka  : [[jenis kelamin (Male/Female/General), bawah, atas, tampilan], …]; bawah null = "< atas", atas null = "≥ bawah".
//             Kolom batas di DB bertipe integer (penanda H/L membandingkan bilangan bulat); nilai desimal utuh di `tampilan`.
//  - pilihan: { pilihan: [...], normal: [...] } → pilihan hasil + nilai rujukan teks (penanda N/TN) bila `normal` diisi.
const P = (pilihan, normal) => ({ pilihan, normal });
const REAKTIF = P(['Non Reaktif', 'Reaktif'], ['Non Reaktif']);
const NEGPOS = P(['Negatif', 'Positif'], ['Negatif']);
const CARIK = (...lain) => P(['Negatif', ...lain], ['Negatif']);
const TITER = P(['Negatif', '1/80', '1/160', '1/320', '1/640'], ['Negatif', '1/80']);
// [kode, nama, kategori, loinc, satuan, jenis input, rujukan, tingkat]
const ITEM_LAB = [
  // Hematologi
  ['HB', 'Hemoglobin', 'HEM', '718-7', 'g/dL', 'angka', [['Male', 13, 17, '13,0 - 17,0 g/dL'], ['Female', 12, 15, '12,0 - 15,0 g/dL']], 0],
  ['LEU', 'Leukosit', 'HEM', '6690-2', 'ribu/uL', 'angka', [['General', 4, 10, '4,0 - 10,0 ribu/uL']], 0],
  ['TRO', 'Trombosit', 'HEM', '777-3', 'ribu/uL', 'angka', [['General', 150, 400, '150 - 400 ribu/uL']], 0],
  ['HCT', 'Hematokrit', 'HEM', '4544-3', '%', 'angka', [['Male', 40, 50, '40 - 50 %'], ['Female', 35, 45, '35 - 45 %']], 0],
  ['ERI', 'Eritrosit', 'HEM', '789-8', 'juta/uL', 'angka', [['Male', 4.5, 5.9, '4,5 - 5,9 juta/uL'], ['Female', 4.0, 5.2, '4,0 - 5,2 juta/uL']], 0],
  ['LED', 'Laju Endap Darah', 'HEM', '30341-2', 'mm/jam', 'angka', [['Male', 0, 15, '0 - 15 mm/jam'], ['Female', 0, 20, '0 - 20 mm/jam']], 0],
  ['MCV', 'MCV', 'HEM', '787-2', 'fL', 'angka', [['General', 80, 100, '80 - 100 fL']], 0],
  ['MCH', 'MCH', 'HEM', '785-6', 'pg', 'angka', [['General', 27, 34, '27 - 34 pg']], 0],
  ['MCHC', 'MCHC', 'HEM', '786-4', 'g/dL', 'angka', [['General', 32, 36, '32 - 36 g/dL']], 0],
  ['RDW', 'RDW-CV', 'HEM', '788-0', '%', 'angka', [['General', 11.5, 14.5, '11,5 - 14,5 %']], 0],
  ['BASO', 'Basofil', 'HEM', '30180-4', '%', 'angka', [['General', 0, 1, '0 - 1 %']], 0],
  ['EOS', 'Eosinofil', 'HEM', '713-8', '%', 'angka', [['General', 1, 3, '1 - 3 %']], 0],
  ['NBAT', 'Neutrofil Batang', 'HEM', '764-1', '%', 'angka', [['General', 2, 6, '2 - 6 %']], 0],
  ['NSEG', 'Neutrofil Segmen', 'HEM', '769-0', '%', 'angka', [['General', 50, 70, '50 - 70 %']], 0],
  ['LIMF', 'Limfosit', 'HEM', '736-9', '%', 'angka', [['General', 20, 40, '20 - 40 %']], 0],
  ['MONO', 'Monosit', 'HEM', '5905-5', '%', 'angka', [['General', 2, 8, '2 - 8 %']], 0],
  ['BT', 'Masa Perdarahan (BT)', 'HEM', '3178-1', 'menit', 'angka', [['General', 1, 3, '1 - 3 menit']], 0],
  ['CT', 'Masa Pembekuan (CT)', 'HEM', '3183-1', 'menit', 'angka', [['General', 5, 15, '5 - 15 menit']], 0],
  ['RETIK', 'Retikulosit', 'HEM', '4679-7', '%', 'angka', [['General', 0.5, 2.5, '0,5 - 2,5 %']], 2],
  // Kimia klinik
  ['GDS', 'Glukosa Darah Sewaktu', 'KK', '2345-7', 'mg/dL', 'angka', [['General', 70, 139, '70 - 139 mg/dL']], 0],
  ['GDP', 'Glukosa Darah Puasa', 'KK', '1558-6', 'mg/dL', 'angka', [['General', 70, 99, '70 - 99 mg/dL']], 0],
  ['G2PP', 'Glukosa 2 Jam Post Prandial', 'KK', '1521-4', 'mg/dL', 'angka', [['General', null, 140, '< 140 mg/dL']], 0],
  ['HBA1C', 'HbA1c', 'KK', '4548-4', '%', 'angka', [['General', null, 5.7, '< 5,7 %']], 0],
  ['CHOL', 'Kolesterol Total', 'KK', '2093-3', 'mg/dL', 'angka', [['General', null, 200, '< 200 mg/dL']], 0],
  ['HDL', 'Kolesterol HDL', 'KK', '2085-9', 'mg/dL', 'angka', [['Male', 40, null, '≥ 40 mg/dL'], ['Female', 50, null, '≥ 50 mg/dL']], 0],
  ['LDL', 'Kolesterol LDL', 'KK', '2089-1', 'mg/dL', 'angka', [['General', null, 100, '< 100 mg/dL']], 0],
  ['TG', 'Trigliserida', 'KK', '2571-8', 'mg/dL', 'angka', [['General', null, 150, '< 150 mg/dL']], 0],
  ['UA', 'Asam Urat', 'KK', '3084-1', 'mg/dL', 'angka', [['Male', 3.4, 7.0, '3,4 - 7,0 mg/dL'], ['Female', 2.4, 5.7, '2,4 - 5,7 mg/dL']], 0],
  ['SGOT', 'SGOT (AST)', 'KK', '1920-8', 'U/L', 'angka', [['Male', null, 40, '< 40 U/L'], ['Female', null, 32, '< 32 U/L']], 0],
  ['SGPT', 'SGPT (ALT)', 'KK', '1742-6', 'U/L', 'angka', [['Male', null, 41, '< 41 U/L'], ['Female', null, 33, '< 33 U/L']], 0],
  ['BUN', 'Ureum (BUN)', 'KK', '3094-0', 'mg/dL', 'angka', [['General', 7, 20, '7 - 20 mg/dL']], 0],
  ['CREA', 'Kreatinin', 'KK', '2160-0', 'mg/dL', 'angka', [['Male', 0.7, 1.3, '0,7 - 1,3 mg/dL'], ['Female', 0.6, 1.1, '0,6 - 1,1 mg/dL']], 0],
  ['ALP', 'Alkali Fosfatase (ALP)', 'KK', '6768-6', 'U/L', 'angka', [['Male', 40, 129, '40 - 129 U/L'], ['Female', 35, 104, '35 - 104 U/L']], 1],
  ['GGT', 'Gamma GT (GGT)', 'KK', '2324-2', 'U/L', 'angka', [['Male', 10, 71, '10 - 71 U/L'], ['Female', 6, 42, '6 - 42 U/L']], 1],
  ['BILT', 'Bilirubin Total', 'KK', '1975-2', 'mg/dL', 'angka', [['General', 0.1, 1.2, '0,1 - 1,2 mg/dL']], 1],
  ['BILD', 'Bilirubin Direk', 'KK', '1968-7', 'mg/dL', 'angka', [['General', null, 0.3, '< 0,3 mg/dL']], 1],
  ['BILI', 'Bilirubin Indirek', 'KK', '1971-1', 'mg/dL', 'angka', [['General', 0.1, 1.0, '0,1 - 1,0 mg/dL']], 1],
  ['TP', 'Protein Total', 'KK', '2885-2', 'g/dL', 'angka', [['General', 6.4, 8.3, '6,4 - 8,3 g/dL']], 1],
  ['ALB', 'Albumin', 'KK', '1751-7', 'g/dL', 'angka', [['General', 3.5, 5.2, '3,5 - 5,2 g/dL']], 1],
  ['GLOB', 'Globulin', 'KK', '10834-0', 'g/dL', 'angka', [['General', 2.0, 3.5, '2,0 - 3,5 g/dL']], 1],
  ['EGFR', 'eGFR (CKD-EPI)', 'KK', '62238-1', 'mL/menit/1,73m²', 'angka', [['General', 90, null, '≥ 90 mL/menit/1,73m²']], 2],
  ['NA', 'Natrium (Na)', 'KK', '2947-0', 'mmol/L', 'angka', [['General', 135, 145, '135 - 145 mmol/L']], 2],
  ['K', 'Kalium (K)', 'KK', '6298-4', 'mmol/L', 'angka', [['General', 3.5, 5.1, '3,5 - 5,1 mmol/L']], 2],
  ['CL', 'Klorida (Cl)', 'KK', '2069-3', 'mmol/L', 'angka', [['General', 98, 107, '98 - 107 mmol/L']], 2],
  ['CA', 'Kalsium (Ca)', 'KK', '17861-6', 'mg/dL', 'angka', [['General', 8.6, 10.3, '8,6 - 10,3 mg/dL']], 2],
  // Imunoserologi
  ['HBSAG', 'HBsAg', 'IMS', '5196-1', null, 'pilihan', REAKTIF, 0],
  ['GOLDA', 'Golongan Darah & Rhesus', 'IMS', '882-1', null, 'pilihan', P(['A Rh+', 'B Rh+', 'AB Rh+', 'O Rh+', 'A Rh-', 'B Rh-', 'AB Rh-', 'O Rh-']), 0],
  ['HIV', 'Anti-HIV (Rapid)', 'IMS', '80387-4', null, 'pilihan', REAKTIF, 0],
  ['VDRL', 'VDRL / RPR (Sifilis)', 'IMS', '5292-8', null, 'pilihan', REAKTIF, 0],
  ['WTO', 'Widal S. typhi O', 'IMS', '17566-1', 'titer', 'pilihan', TITER, 0],
  ['WTH', 'Widal S. typhi H', 'IMS', '22529-2', 'titer', 'pilihan', TITER, 0],
  ['WPAO', 'Widal S. paratyphi AO', 'IMS', '22519-3', 'titer', 'pilihan', TITER, 0],
  ['WPBO', 'Widal S. paratyphi BO', 'IMS', '22523-5', 'titer', 'pilihan', TITER, 0],
  ['NS1', 'Antigen NS1 Dengue', 'IMS', '75377-2', null, 'pilihan', NEGPOS, 0],
  ['HCG', 'Tes Kehamilan (β-hCG Urin)', 'IMS', '2112-1', null, 'pilihan', P(['Negatif', 'Positif']), 0],
  ['MAL', 'Malaria (RDT)', 'IMS', '70569-9', null, 'pilihan', CARIK('Positif P. falciparum', 'Positif P. vivax', 'Positif Mix (Pf/Pv)'), 0],
  ['AHBS', 'Anti-HBs', 'IMS', '16935-9', 'mIU/mL', 'angka', [['General', 10, null, '≥ 10 mIU/mL (protektif)']], 1],
  ['AHCV', 'Anti-HCV', 'IMS', '13955-0', null, 'pilihan', REAKTIF, 1],
  ['TYIGM', 'IgM Anti-Salmonella typhi (Tubex TF)', 'IMS', '9674-3', 'skor', 'angka', [['General', null, 3, '≤ 2 (Negatif)']], 1],
  ['TYIGG', 'IgG Anti-Salmonella typhi', 'IMS', '9673-5', null, 'pilihan', NEGPOS, 1],
  ['DIGG', 'IgG Anti-Dengue', 'IMS', '29676-4', null, 'pilihan', NEGPOS, 1],
  ['DIGM', 'IgM Anti-Dengue', 'IMS', '25338-5', null, 'pilihan', NEGPOS, 1],
  ['CRP', 'C-Reactive Protein (CRP)', 'IMS', '1988-5', 'mg/L', 'angka', [['General', null, 6, '< 6 mg/L']], 1],
  ['ASTO', 'ASTO', 'IMS', '5370-2', 'IU/mL', 'angka', [['General', null, 200, '< 200 IU/mL']], 1],
  ['RF', 'Rheumatoid Factor (RF)', 'IMS', '5297-7', null, 'pilihan', NEGPOS, 1],
  ['TPHA', 'TPHA', 'IMS', '8041-6', null, 'pilihan', REAKTIF, 2],
  // Urinalisis (makroskopis, kimia carik celup, sedimen)
  ['UWARNA', 'Warna Urin', 'URI', '5778-6', null, 'pilihan', P(['Kuning Muda', 'Kuning', 'Kuning Tua', 'Merah', 'Coklat'], ['Kuning Muda', 'Kuning']), 0],
  ['UJERNIH', 'Kejernihan Urin', 'URI', '32167-9', null, 'pilihan', P(['Jernih', 'Agak Keruh', 'Keruh'], ['Jernih']), 0],
  ['UBJ', 'Berat Jenis Urin', 'URI', '5811-5', null, 'pilihan',
    P(['1,000', '1,005', '1,010', '1,015', '1,020', '1,025', '1,030'], ['1,005', '1,010', '1,015', '1,020', '1,025', '1,030']), 0],
  ['UPH', 'pH Urin', 'URI', '5803-2', null, 'angka', [['General', 4.5, 8.0, '4,5 - 8,0']], 0],
  ['UPROT', 'Protein Urin', 'URI', '5804-0', null, 'pilihan', CARIK('Trace', '+1', '+2', '+3', '+4'), 0],
  ['UGLU', 'Glukosa Urin', 'URI', '2350-7', null, 'pilihan', CARIK('Trace', '+1', '+2', '+3', '+4'), 0],
  ['UKET', 'Keton Urin', 'URI', '2514-8', null, 'pilihan', CARIK('Trace', '+1', '+2', '+3'), 0],
  ['UBIL', 'Bilirubin Urin', 'URI', '5770-3', null, 'pilihan', CARIK('+1', '+2', '+3'), 0],
  ['UROB', 'Urobilinogen', 'URI', '20405-7', null, 'pilihan', P(['Normal', '+1', '+2', '+3'], ['Normal']), 0],
  ['UNIT', 'Nitrit', 'URI', '5802-4', null, 'pilihan', NEGPOS, 0],
  ['ULE', 'Leukosit Esterase', 'URI', '5799-2', null, 'pilihan', CARIK('Trace', '+1', '+2', '+3'), 0],
  ['UBLD', 'Darah (Hb) Urin', 'URI', '5794-3', null, 'pilihan', CARIK('Trace', '+1', '+2', '+3'), 0],
  ['SEDERI', 'Sedimen Eritrosit', 'URI', '13945-1', '/LPB', 'angka', [['General', 0, 2, '0 - 2 /LPB']], 0],
  ['SEDLEU', 'Sedimen Leukosit', 'URI', '5821-4', '/LPB', 'angka', [['General', 0, 5, '0 - 5 /LPB']], 0],
  ['SEDEPI', 'Sedimen Epitel', 'URI', '5787-7', '/LPK', 'pilihan', P(['Negatif', '+1 (Sedikit)', '+2 (Sedang)', '+3 (Banyak)'], ['Negatif', '+1 (Sedikit)']), 0],
  ['SEDSIL', 'Sedimen Silinder', 'URI', '58436-7', null, 'pilihan', CARIK('Hialin', 'Granuler', 'Eritrosit', 'Leukosit', 'Epitel'), 0],
  ['SEDKRI', 'Sedimen Kristal', 'URI', '5782-8', null, 'pilihan', CARIK('Kalsium Oksalat', 'Asam Urat', 'Triple Fosfat', 'Amorf'), 0],
  ['SEDBAK', 'Sedimen Bakteri', 'URI', '25145-4', null, 'pilihan', CARIK('+1', '+2', '+3'), 0],
  // Feses
  ['FKONS', 'Konsistensi Feses', 'FES', '11029-6', null, 'pilihan', P(['Padat', 'Lembek', 'Setengah Cair', 'Cair'], ['Padat', 'Lembek']), 0],
  ['FWARNA', 'Warna Feses', 'FES', '9397-1', null, 'pilihan',
    P(['Kuning', 'Kuning Kecoklatan', 'Coklat', 'Hijau', 'Hitam', 'Merah', 'Pucat (Dempul)'], ['Kuning', 'Kuning Kecoklatan', 'Coklat']), 0],
  ['FLENDIR', 'Lendir Feses', 'FES', '42524-9', null, 'pilihan', NEGPOS, 0],
  ['FDARAH', 'Darah Feses (Makroskopis)', 'FES', '41278-3', null, 'pilihan', NEGPOS, 0],
  ['FTELUR', 'Telur Cacing', 'FES', '10704-5', null, 'pilihan',
    CARIK('Ascaris lumbricoides', 'Trichuris trichiura', 'Cacing Tambang', 'Enterobius vermicularis', 'Taenia sp.'), 0],
  ['FAMOEBA', 'Amoeba', 'FES', '87998-1', null, 'pilihan',
    CARIK('E. histolytica (trofozoit)', 'E. histolytica (kista)', 'E. coli (kista)', 'Giardia lamblia'), 0],
  ['FLEU', 'Leukosit Feses', 'FES', '51770-6', '/LPB', 'angka', [['General', 0, 1, '0 - 1 /LPB']], 0],
  ['FERI', 'Eritrosit Feses', 'FES', 'X099192', '/LPB', 'angka', [['General', 0, 1, '0 - 1 /LPB']], 0],
  ['FOBT', 'Darah Samar Feses (FOBT)', 'FES', '14563-1', null, 'pilihan', NEGPOS, 1],
  // Mikrobiologi
  ['BTA', 'BTA Sputum (Ziehl-Neelsen)', 'MIK', '11477-7', null, 'pilihan', P(['Negatif', 'Scanty', '+1', '+2', '+3'], ['Negatif']), 0],
  ['GRAM', 'Pewarnaan Gram', 'MIK', '664-3', null, 'text', null, 2],
];
// Kelompok (panel): [kode, nama, kategori, loinc panel, item, tingkat]. Anggota yang tingkatnya di atas faskes dilewati
// (mis. eGFR hanya masuk Fungsi Ginjal di RS kelas C ke atas). Fungsi Hati memakai LOINC ALT karena panel hati tidak ada di tabel.
const KELOMPOK_LAB = [
  ['DR', 'Darah Rutin', 'HEM', '58410-2', ['HB', 'LEU', 'TRO', 'HCT'], 0],
  ['DL', 'Darah Lengkap', 'HEM', '57021-8',
    ['HB', 'LEU', 'TRO', 'HCT', 'ERI', 'MCV', 'MCH', 'MCHC', 'RDW', 'BASO', 'EOS', 'NBAT', 'NSEG', 'LIMF', 'MONO', 'LED'], 0],
  ['HJ', 'Hitung Jenis Leukosit', 'HEM', 'X099112', ['BASO', 'EOS', 'NBAT', 'NSEG', 'LIMF', 'MONO'], 0],
  ['UL', 'Urin Lengkap', 'URI', '24356-8', ['UWARNA', 'UJERNIH', 'UBJ', 'UPH', 'UPROT', 'UGLU', 'UKET', 'UBIL', 'UROB', 'UNIT', 'ULE', 'UBLD',
    'SEDERI', 'SEDLEU', 'SEDEPI', 'SEDSIL', 'SEDKRI', 'SEDBAK'], 0],
  ['FL', 'Feses Lengkap', 'FES', 'X099187', ['FKONS', 'FWARNA', 'FLENDIR', 'FDARAH', 'FTELUR', 'FAMOEBA', 'FLEU', 'FERI'], 0],
  ['LIPID', 'Profil Lipid', 'KK', '100898-6', ['CHOL', 'HDL', 'LDL', 'TG'], 0],
  ['FG', 'Fungsi Ginjal', 'KK', '45066-8', ['BUN', 'CREA', 'UA', 'EGFR'], 0],
  ['WIDAL', 'Widal', 'IMS', 'X099312', ['WTO', 'WTH', 'WPAO', 'WPBO'], 0],
  ['FH', 'Fungsi Hati', 'KK', '1742-6', ['SGOT', 'SGPT', 'ALP', 'GGT', 'TP', 'ALB', 'GLOB'], 1],
  ['BIL', 'Bilirubin', 'KK', '34543-9', ['BILT', 'BILD', 'BILI'], 1],
  ['DENG', 'Serologi Dengue', 'IMS', '87546-8', ['NS1', 'DIGG', 'DIGM'], 1],
  ['ELEK', 'Elektrolit', 'KK', '55231-5', ['NA', 'K', 'CL'], 2],
];
// Tarif satuan: [kode, nama, harga dasar, { item } | { kelompok }, tingkat]. Harga × F.skala, dibulatkan rupiah().
const TARIF_LAB = [
  ['T-DL', 'Darah Lengkap', 70000, { kelompok: 'DL' }, 0], ['T-UL', 'Urin Lengkap', 40000, { kelompok: 'UL' }, 0],
  ['T-LED', 'Laju Endap Darah', 20000, { item: 'LED' }, 0], ['T-GDS', 'Glukosa Darah Sewaktu', 20000, { item: 'GDS' }, 0],
  ['T-GDP', 'Glukosa Darah Puasa', 20000, { item: 'GDP' }, 0], ['T-G2PP', 'Glukosa 2 Jam PP', 20000, { item: 'G2PP' }, 0],
  ['T-HBA1C', 'HbA1c', 150000, { item: 'HBA1C' }, 0], ['T-CHOL', 'Kolesterol Total', 35000, { item: 'CHOL' }, 0],
  ['T-HDL', 'Kolesterol HDL', 45000, { item: 'HDL' }, 0], ['T-TG', 'Trigliserida', 40000, { item: 'TG' }, 0],
  ['T-UA', 'Asam Urat', 25000, { item: 'UA' }, 0], ['T-SGOT', 'SGOT', 35000, { item: 'SGOT' }, 0], ['T-SGPT', 'SGPT', 35000, { item: 'SGPT' }, 0],
  ['T-BUN', 'Ureum', 35000, { item: 'BUN' }, 0], ['T-CREA', 'Kreatinin', 35000, { item: 'CREA' }, 0],
  ['T-HBSAG', 'HBsAg', 60000, { item: 'HBSAG' }, 0], ['T-GOLDA', 'Golongan Darah', 20000, { item: 'GOLDA' }, 0],
  ['T-DR', 'Darah Rutin', 50000, { kelompok: 'DR' }, 0], ['T-HJ', 'Hitung Jenis Leukosit', 35000, { kelompok: 'HJ' }, 0],
  ['T-HB', 'Hemoglobin', 20000, { item: 'HB' }, 0], ['T-TRO', 'Trombosit', 25000, { item: 'TRO' }, 0],
  ['T-BT', 'Masa Perdarahan (BT)', 15000, { item: 'BT' }, 0], ['T-CT', 'Masa Pembekuan (CT)', 15000, { item: 'CT' }, 0],
  ['T-LDL', 'Kolesterol LDL', 50000, { item: 'LDL' }, 0], ['T-FG', 'Fungsi Ginjal', 85000, { kelompok: 'FG' }, 0],
  ['T-HIV', 'Anti-HIV (Rapid)', 75000, { item: 'HIV' }, 0], ['T-VDRL', 'VDRL / RPR', 45000, { item: 'VDRL' }, 0],
  ['T-WIDAL', 'Widal', 60000, { kelompok: 'WIDAL' }, 0], ['T-NS1', 'Antigen NS1 Dengue', 150000, { item: 'NS1' }, 0],
  ['T-HCG', 'Tes Kehamilan (β-hCG Urin)', 35000, { item: 'HCG' }, 0], ['T-MAL', 'Malaria (RDT)', 75000, { item: 'MAL' }, 0],
  ['T-FL', 'Feses Lengkap', 40000, { kelompok: 'FL' }, 0], ['T-BTA', 'BTA Sputum', 30000, { item: 'BTA' }, 0],
  // Tingkat menengah
  ['T-FH', 'Fungsi Hati', 150000, { kelompok: 'FH' }, 1], ['T-BIL', 'Bilirubin (Total, Direk, Indirek)', 70000, { kelompok: 'BIL' }, 1],
  ['T-ALP', 'Alkali Fosfatase (ALP)', 40000, { item: 'ALP' }, 1], ['T-GGT', 'Gamma GT', 45000, { item: 'GGT' }, 1],
  ['T-ALB', 'Albumin', 30000, { item: 'ALB' }, 1], ['T-TP', 'Protein Total', 30000, { item: 'TP' }, 1],
  ['T-AHBS', 'Anti-HBs', 90000, { item: 'AHBS' }, 1], ['T-AHCV', 'Anti-HCV', 100000, { item: 'AHCV' }, 1],
  ['T-TUBEX', 'IgM Salmonella (Tubex TF)', 200000, { item: 'TYIGM' }, 1], ['T-TYIGG', 'IgG Salmonella typhi', 150000, { item: 'TYIGG' }, 1],
  ['T-DENG', 'Serologi Dengue (NS1, IgG, IgM)', 300000, { kelompok: 'DENG' }, 1], ['T-CRP', 'CRP', 70000, { item: 'CRP' }, 1],
  ['T-ASTO', 'ASTO', 70000, { item: 'ASTO' }, 1], ['T-RF', 'Rheumatoid Factor', 60000, { item: 'RF' }, 1],
  ['T-FOBT', 'Darah Samar Feses (FOBT)', 60000, { item: 'FOBT' }, 1],
  // Tingkat lengkap (RS kelas C ke atas)
  ['T-RETIK', 'Retikulosit', 40000, { item: 'RETIK' }, 2], ['T-ELEK', 'Elektrolit (Na, K, Cl)', 120000, { kelompok: 'ELEK' }, 2],
  ['T-CA', 'Kalsium', 45000, { item: 'CA' }, 2], ['T-TPHA', 'TPHA', 75000, { item: 'TPHA' }, 2],
  ['T-GRAM', 'Pewarnaan Gram', 50000, { item: 'GRAM' }, 2],
];
// Paket: satu tarif berisi beberapa item/kelompok (beberapa baris tarif_lab_item), lebih murah dari jumlah satuannya.
// [kode, nama, harga dasar, isi, tingkat]. Isi tidak boleh tumpang tindih (order lab menolak item pemeriksaan ganda).
const I = (item) => ({ item });
const G = (kelompok) => ({ kelompok });
const PAKET_LAB = [
  ['PKT-DM', 'Paket Diabetes', 165000, [I('GDP'), I('G2PP'), I('HBA1C')], 0],
  ['PKT-LIPID', 'Paket Profil Lipid', 140000, [I('CHOL'), I('HDL'), I('LDL'), I('TG')], 0],
  ['PKT-GINJAL', 'Paket Fungsi Ginjal', 110000, [G('FG'), G('UL')], 0],
  ['PKT-DEMAM', 'Paket Demam (Tifoid-DBD)', 225000, [G('DR'), G('WIDAL'), I('NS1')], 0],
  ['PKT-ANC', 'Paket Kehamilan (ANC)', 260000, [G('DR'), I('GOLDA'), I('HBSAG'), I('HIV'), I('VDRL'), G('UL'), I('GDS')], 0],
  ['PKT-NIKAH', 'Paket Pranikah', 230000, [G('DR'), I('GOLDA'), I('GDS'), I('HBSAG'), I('HIV'), I('VDRL')], 0],
  ['PKT-CU1', 'Paket Check-Up Dasar', 145000, [G('DR'), G('UL'), I('GDS'), I('CHOL'), I('UA')], 0],
  ['PKT-HATI', 'Paket Fungsi Hati', 190000, [G('FH'), G('BIL')], 1],
  ['PKT-CU2', 'Paket Check-Up Lengkap', 690000,
    [G('DL'), G('UL'), I('GDP'), I('HBA1C'), G('LIPID'), G('FH'), G('BIL'), G('FG'), I('HBSAG')], 1],
];
const SPESIMEN = [['DV', 'Darah Vena'], ['DK', 'Darah Kapiler'], ['SRM', 'Serum'], ['URN', 'Urin'], ['FES', 'Feses'], ['SPT', 'Sputum'],
  ['PLS', 'Plasma'], ['SWB', 'Swab']];

const GENERAL_CONSENT = `<p>Saya yang bertanda tangan di bawah ini, <b>{{ nama }}</b>, umur {{ umur }}, alamat {{ alamat }},
menyatakan telah mendapat penjelasan mengenai hak dan kewajiban sebagai pasien serta tata tertib pelayanan di fasilitas ini.</p>
<p>Dengan ini saya menyetujui pemeriksaan dan tindakan medis rutin yang diperlukan, serta penggunaan data rekam medis saya
untuk keperluan pelayanan, penjaminan biaya, dan pelaporan sesuai ketentuan perundang-undangan.</p>`;

module.exports = {
  FASKES, PENJAMIN_TUNAI, PENJAMIN_LAIN, TINDAKAN, OBAT, SATUAN, BENTUK_SEDIAAN, KATEGORI_OBAT, PRODUSEN, SUPPLIER,
  ATURAN_PAKAI, CARA_PAKAI, BENTUK_RACIKAN, TINGKAT_LAB, KATEGORI_LAB, ITEM_LAB, KELOMPOK_LAB, TARIF_LAB, PAKET_LAB, SPESIMEN,
  GENERAL_CONSENT,
};
