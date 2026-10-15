# 📚 OpenSIMRS API Documentation

> Complete API Reference for OpenSIMRS Healthcare Information System

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [Base URLs & Ports](#base-urls--ports)
5. [API Services](#api-services)
   - [Auth Service](#1-auth-service)
   - [Datamaster Service](#2-datamaster-service)
   - [Admisi Service](#3-admisi-service)
   - [Antrian Service](#4-antrian-service)
   - [Rawat Jalan Service](#5-rawat-jalan-service)
   - [Rawat Inap Service](#6-rawat-inap-service)
   - [IGD Service](#7-igd-service)
   - [Rekam Medis Service](#8-rekam-medis-service)
   - [Farmasi Service](#9-farmasi-service)
   - [Stok Farmasi Service](#10-stok-farmasi-service)
   - [Inventory Service](#11-inventory-service)
   - [Lab Service](#12-lab-service)
   - [Payment Service](#13-payment-service)
   - [Laporan Service](#14-laporan-service)
   - [Setting Service](#15-setting-service)
6. [Response Format](#response-format)
7. [Error Codes](#error-codes)
8. [Pagination](#pagination)

---

## Overview

OpenSIMRS adalah platform Sistem Informasi Klinik & Rumah Sakit berbasis microservices yang terdiri dari 18 layanan backend (dokumen ini mencakup 15 layanan inti; SATUSEHAT, BPJS, dan penunjang belum didokumentasikan di sini). Setiap layanan memiliki tanggung jawab spesifik dan berkomunikasi melalui REST API.

### Technology Stack
- **Backend**: Node.js/Express dengan TypeScript/JavaScript (ES Modules)
- **Database**: PostgreSQL (primary), MongoDB (beberapa service), Redis (caching)
- **Common SDK**: `@opensimrs/model-sdk`, `@opensimrs/authorization-sdk`, `@opensimrs/permission-sdk` (di folder `packages/` monorepo)
- **Frontend**: Vue 3 + Vite + PrimeVue + Tailwind CSS
- **Authentication**: JWT + Redis session management

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Vue 3)                          │
│                         Port: 5520                               │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      MICROSERVICES LAYER                         │
├──────────────┬──────────────┬──────────────┬───────────────────┤
│ Auth :8083   │ Admisi :8081 │ Antrian :8082│ Datamaster :8096  │
├──────────────┼──────────────┼──────────────┼───────────────────┤
│ Farmasi :8084│ IGD :8085    │ Inventory    │ Lab :8087         │
│              │              │ :8086        │                   │
├──────────────┼──────────────┼──────────────┼───────────────────┤
│ Laporan :8088│ Payment :8089│ Rawat Inap   │ Rawat Jalan :8092 │
│              │              │ :8091        │                   │
├──────────────┼──────────────┼──────────────┼───────────────────┤
│ Rekam Medis  │ Setting :8094│ Stok Farmasi │                   │
│ :8093        │              │ :8095        │                   │
└──────────────┴──────────────┴──────────────┴───────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATABASE LAYER                             │
├──────────────────┬──────────────────┬───────────────────────────┤
│ PostgreSQL :5432 │ MongoDB :27017   │ Redis :6379               │
└──────────────────┴──────────────────┴───────────────────────────┘
```

---

## Authentication

### JWT Token Authentication

Semua protected endpoints memerlukan JWT token di header:

```http
Authorization: Bearer <access_token>
```

### Login Flow

```http
POST /api/v3/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "uuid": "xxx-xxx-xxx",
      "username": "admin",
      "name": "Administrator"
    }
  }
}
```

### Refresh Token

```http
POST /api/v3/auth/refresh-token
Content-Type: application/json

{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

---

## Base URLs & Ports

| Service | Port | Base URL |
|---------|------|----------|
| Frontend | 5520 | `http://localhost:5520` |
| Auth Service | 8083 | `http://localhost:8083/api/v3/auth` |
| Admisi Service | 8081 | `http://localhost:8081/api/v3/admisi` |
| Antrian Service | 8082 | `http://localhost:8082/api/v3/antrian` |
| Datamaster Service | 8096 | `http://localhost:8096/api/v3/datamaster` |
| Farmasi Service | 8084 | `http://localhost:8084/api/v3/farmasi` |
| IGD Service | 8085 | `http://localhost:8085/api/v3/pelayanan` |
| Inventory Service | 8086 | `http://localhost:8086/api/v3/inventory` |
| Lab Service | 8087 | `http://localhost:8087/api/v3/lab` |
| Laporan Service | 8088 | `http://localhost:8088/api/v3/laporan` |
| Payment Service | 8089 | `http://localhost:8089/api/v3/payment` |
| Rawat Inap Service | 8091 | `http://localhost:8091/api/v3/ranap` |
| Rawat Jalan Service | 8092 | `http://localhost:8092/api/v3/rajal` |
| Rekam Medis Service | 8093 | `http://localhost:8093/api/v3/rekam-medis` |
| Setting Service | 8094 | `http://localhost:8094/api/v1/setting` |
| Stok Farmasi Service | 8095 | `http://localhost:8095/api/v1/stok` |

> **Note:** Base URL dapat dikonfigurasi melalui environment variables `API_BASE`, `API_VERSION`, dan `API_MODULE`. Nilai default yang ditampilkan di atas digunakan jika environment variables tidak diset.

---

## API Services

---

## 1. Auth Service

**Base URL:** `http://localhost:8083/api/v3/auth`

Mengelola autentikasi, otorisasi, dan manajemen pengguna.

### Public Endpoints (No Auth Required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/login` | Login user |
| POST | `/refresh-token` | Refresh access token |

### Private Endpoints (Auth Required)

#### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| DELETE | `/logout` | Logout user |
| PUT | `/token/:faskes` | Switch token for different facility |

#### User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/user` | Create new user |
| GET | `/user` | Get all users (paginated) |
| PUT | `/user/:uuid` | Update user data |
| PATCH | `/user/:uuid` | Update user password |
| DELETE | `/user/:uuid` | Delete user (soft delete) |
| GET | `/user/:uuid/user-role` | Get user with role info |
| GET | `/user/deleted` | Get deleted users |
| POST | `/user/import` | Import users from Excel |
| GET | `/user/export` | Export users to Excel |

#### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

---

## 2. Datamaster Service

**Base URL:** `http://localhost:8096/api/v3/datamaster`

Mengelola semua data master sistem (diagnosis, organisasi, lokasi, tarif, dll).

### Diagnosis (ICD-10)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/diagnosis` | Create diagnosis |
| GET | `/diagnosis` | Get all diagnoses |
| GET | `/diagnosis/aktif` | Get active diagnoses |
| GET | `/diagnosis/:uuid` | Get diagnosis by ID |
| PUT | `/diagnosis/:uuid` | Update diagnosis |
| DELETE | `/diagnosis/:uuid` | Delete diagnosis |
| POST | `/diagnosis/import` | Import diagnoses |
| GET | `/diagnosis/export` | Export diagnoses |

### Organization
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/organization` | Create organization |
| GET | `/organization` | Get all organizations |
| GET | `/organization/part-of` | Get parent organizations |
| GET | `/organization/aktif` | Get active organizations |
| GET | `/organization/:uuid` | Get organization by ID |
| PUT | `/organization/:uuid` | Update organization |
| DELETE | `/organization/:uuid` | Delete organization |
| POST | `/organization/import` | Import organizations |
| GET | `/organization/export` | Export organizations |

### Faskes (Healthcare Facilities)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/faskes` | Create faskes |
| GET | `/faskes` | Get all faskes |
| GET | `/faskes/aktif` | Get active faskes |
| GET | `/faskes/:uuid` | Get faskes by ID |
| PUT | `/faskes/:uuid` | Update faskes |
| DELETE | `/faskes/:uuid` | Delete faskes |
| POST | `/faskes/import` | Import faskes |
| GET | `/faskes/export` | Export faskes |

### Lokasi (Location)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/lokasi` | Create location |
| GET | `/lokasi` | Get all locations |
| GET | `/lokasi/part_of` | Get parent locations |
| GET | `/lokasi/part_of/:part_of_uuid` | Get locations by parent |
| GET | `/lokasi/code/:code` | Get location by code |
| GET | `/lokasi/aktif` | Get active locations |
| GET | `/lokasi/poli/aktif` | Get active clinics |
| GET | `/lokasi/:uuid` | Get location by ID |
| PUT | `/lokasi/:uuid` | Update location |
| DELETE | `/lokasi/:uuid` | Delete location |
| POST | `/lokasi/import` | Import locations |
| GET | `/lokasi/export` | Export locations |

### Penjamin (Insurer/Guarantor)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/penjamin` | Create insurer |
| GET | `/penjamin` | Get all insurers |
| GET | `/penjamin/aktif` | Get active insurers |
| GET | `/penjamin/:uuid` | Get insurer by ID |
| PUT | `/penjamin/:uuid` | Update insurer |
| DELETE | `/penjamin/:uuid` | Delete insurer |
| POST | `/penjamin/import` | Import insurers |
| GET | `/penjamin/export` | Export insurers |

### Tindakan (Medical Procedures)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tindakan` | Create procedure |
| GET | `/tindakan` | Get all procedures |
| GET | `/tindakan/aktif` | Get active procedures |
| GET | `/tindakan/:uuid` | Get procedure by ID |
| PUT | `/tindakan/:uuid` | Update procedure |
| DELETE | `/tindakan/:uuid` | Delete procedure |
| POST | `/tindakan/import` | Import procedures |
| GET | `/tindakan/export` | Export procedures |

### Tarif (Service Rates)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tarif` | Create tariff |
| GET | `/tarif` | Get all tariffs |
| GET | `/tarif/aktif` | Get active tariffs |
| GET | `/tarif/:uuid` | Get tariff by ID |
| PUT | `/tarif/:uuid` | Update tariff |
| DELETE | `/tarif/:uuid` | Delete tariff |
| POST | `/tarif/import` | Import tariffs |
| GET | `/tarif/export` | Export tariffs |

### Ruangan (Rooms)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/ruangan` | Create room |
| GET | `/ruangan` | Get all rooms |
| GET | `/ruangan/aktif` | Get active rooms |
| GET | `/ruangan/:uuid` | Get room by ID |
| PUT | `/ruangan/:uuid` | Update room |
| DELETE | `/ruangan/:uuid` | Delete room |
| POST | `/ruangan/import` | Import rooms |
| GET | `/ruangan/export` | Export rooms |

### Practitioner (Doctors/Staff)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/practitioner` | Create practitioner |
| GET | `/practitioner` | Get all practitioners |
| GET | `/practitioner/aktif` | Get active practitioners |
| GET | `/practitioner/poli/aktif` | Get practitioners by clinic |
| GET | `/practitioner/:uuid` | Get practitioner by ID |
| PUT | `/practitioner/:uuid` | Update practitioner |
| DELETE | `/practitioner/:uuid` | Delete practitioner |
| GET | `/practitioner/export` | Export practitioners |
| POST | `/practitioner/import` | Import practitioners (Excel, multipart field `file`) |

### Role & User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/role` | Create role |
| GET | `/role` | Get all roles |
| GET | `/role/aktif` | Get active roles |
| GET | `/role/:uuid` | Get role by ID |
| PUT | `/role/:uuid` | Update role |
| DELETE | `/role/:uuid` | Delete role |
| POST | `/user` | Create user |
| GET | `/user` | Get all users |
| GET | `/user/:uuid` | Get user by ID |
| PUT | `/user/:uuid` | Update user |
| PATCH | `/user/:uuid` | Update password |
| DELETE | `/user/:uuid` | Delete user |

### Additional Master Data
- **ICD9**: `/icd9/*` - Medical procedure codes
- **LOINC**: `/loinc/*` - Lab test codes
- **SNOMED**: `/snomed/*` - Clinical terminology
- **Gigi (Dental)**: `/gigi/*`, `/kategori_gigi/*`, `/oklusi_gigi/*`, `/item_gigi/*`
- **Voucher**: `/voucher/*` - Discount vouchers
- **Menu Management**: `/main_menu/*`, `/sub_menu/*`
- **Geographic**: `/provinsi/*`, `/kabupaten/*`, `/kecamatan/*`, `/kelurahan/*`

### Mobile API (API Key Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/mobile/faskes` | Get all faskes for mobile |
| GET | `/mobile/faskes/:uuid` | Get faskes detail |
| GET | `/mobile/lokasi/poli/aktif` | Get active clinics |
| GET | `/mobile/practitioner/poli/aktif` | Get practitioners |
| GET | `/mobile/provinsi` | Get provinces |
| GET | `/mobile/kabupaten` | Get districts |
| GET | `/mobile/kecamatan` | Get sub-districts |
| GET | `/mobile/kelurahan` | Get villages |

---

## 3. Admisi Service

**Base URL:** `http://localhost:8081/api/v3/admisi`

Mengelola pendaftaran pasien, kunjungan rawat jalan, rawat inap, dan IGD.

### Patient Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patient` | Get all patients |
| GET | `/patient/:uuid` | Get patient by UUID |
| POST | `/patient` | Create patient |
| PUT | `/patient/:uuid` | Update patient |
| DELETE | `/patient/cancel` | Delete patient |
| GET | `/patient/history/:uuid` | Get patient history |
| GET | `/patient/internal/identity-check` | Check ID number |
| POST | `/patient/check-patient/apm` | Check patient (APM) |
| POST | `/patient/import` | Import patients |
| GET | `/download` | Download import template |

### Rawat Jalan (Outpatient)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rawat-jalan` | Get all outpatient visits |
| GET | `/rawat-jalan/today` | Get today's visits |
| POST | `/rawat-jalan` | Register outpatient visit |
| POST | `/rawat-jalan/apm` | Register via APM |
| GET | `/rawat-jalan/jadwal-dokter` | Get doctor schedules |
| GET | `/rawat-jalan/:uuid` | Get visit detail |
| PUT | `/rawat-jalan/:uuid` | Update visit |
| PUT | `/rawat-jalan/farmasi/:uuid` | Update pharmacy info |
| POST | `/rawat-jalan/check-booking` | Check booking availability |
| POST | `/rawat-jalan/print-booking` | Print booking |
| DELETE | `/rawat-jalan/cancel` | Cancel visit |

### IGD (Emergency)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/igd` | Register emergency visit |
| PUT | `/igd/:uuid` | Update emergency visit |
| GET | `/igd` | Get all emergency visits |
| GET | `/igd/:uuid` | Get emergency detail |
| DELETE | `/igd/cancel` | Cancel emergency visit |

### Rawat Inap (Inpatient)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/rawat-inap` | Register inpatient |
| POST | `/rawat-inap/spri` | Register SPRI patient |
| PUT | `/rawat-inap/:uuid` | Update inpatient |
| GET | `/rawat-inap/:uuid` | Get inpatient detail |
| GET | `/rawat-inap` | Get all inpatients |
| DELETE | `/rawat-inap/cancel` | Cancel inpatient |

### Patient Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/file/:uuid` | Get patient file |
| PUT | `/file/:uuid` | Upload patient file |
| DELETE | `/file/:uuid` | Delete patient file |

### Monitoring Room
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/monitoring-rooms` | Get all rooms |
| GET | `/monitoring-rooms/:uuid` | Get room detail |
| PATCH | `/monitoring-rooms/:uuid` | Update bed status |

### General Consent
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/general-consent/:uuid` | Create consent |
| GET | `/general-consent/:uuid` | Get all consents |
| GET | `/general-consent/detail/:uuid` | Get consent detail |
| DELETE | `/general-consent/:uuid` | Delete consent |

### Reports & Export
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/report/kunjungan` | Visit report |
| GET | `/report/cancel-visit` | Cancelled visit report |
| GET | `/report/room` | Room status report |
| GET | `/report/rawat-inap` | Inpatient report |
| GET | `/report/new-born` | Newborn report |
| GET | `/export/kunjungan` | Export visit data |
| GET | `/export/batal-kunjungan` | Export cancelled visits |
| GET | `/export/status-kamar` | Export room status |
| GET | `/export/keperawatan-inap` | Export nursing data |
| GET | `/export/new-born` | Export newborn data |

### Recap
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rekap/jenis-kunjungan` | Visit type recap |
| GET | `/rekap/dokter` | Doctor recap |
| GET | `/rekap/penjamin` | Guarantor recap |

### Queue Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/antrian-call` | Get all queue calls |
| PUT | `/antrian-call/:uuid` | Update queue call |

### Mobile API (API Key Required)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/patient/check-patient` | Check patient (mobile) |
| GET | `/rawat-jalan/mobile` | Get visits (mobile) |
| GET | `/rawat-jalan/mobile/today` | Today's visits (mobile) |
| POST | `/rawat-jalan/mobile` | Register visit (mobile) |
| DELETE | `/rawat-jalan/mobile/cancel` | Cancel visit (mobile) |
| GET | `/rawat-jalan/mobile/jadwal-pemeriksaan/:uuid` | Get schedule (mobile) |

---

## 4. Antrian Service

**Base URL:** `http://localhost:8082/api/v3/antrian`

Mengelola sistem antrian pasien dan penjadwalan dokter.

### Jadwal Dokter (Doctor Schedule)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/jadwal-dokter/` | Get all schedules |
| GET | `/jadwal-dokter/all` | Get all (no pagination) |
| GET | `/jadwal-dokter/:doctor_uuid/:location_uuid` | Get by doctor & location |
| POST | `/jadwal-dokter/` | Create schedule |
| PUT | `/jadwal-dokter/:doctor_uuid/:location_uuid` | Update schedule |
| DELETE | `/jadwal-dokter/:doctor_uuid/:location_uuid` | Delete schedule |

### Layar Antrian (Queue Display)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/layar-antrian/` | Get all displays |
| GET | `/layar-antrian/:layar_antrian_uuid` | Get display by ID |
| POST | `/layar-antrian/` | Create display |
| PUT | `/layar-antrian/:layar_antrian_uuid` | Update display |
| DELETE | `/layar-antrian/:layar_antrian_uuid` | Delete display |

### Data Antrian (Queue Data)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/data-antrian/process-registration` | Process registration |
| POST | `/data-antrian/admisi-registration` | Admisi registration |
| POST | `/data-antrian/farmasi` | Create pharmacy queue |

### APM (Appointment)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/apm/register` | Register patient |
| POST | `/apm/check-in` | Check-in patient |
| POST | `/apm/print-antrian` | Print queue ticket |
| POST | `/apm/antrian-farmasi` | Pharmacy queue |

### Admisi Antrian
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admisi-antrian/` | Get all admisi queues |
| GET | `/admisi-antrian/all` | Get all (no pagination) |
| GET | `/admisi-antrian/:uuid` | Get by UUID |
| POST | `/admisi-antrian/` | Create admisi queue |
| PUT | `/admisi-antrian/:uuid` | Update admisi queue |

### Mobile API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/mobile/jadwal-dokter/` | Get schedules |
| GET | `/mobile/jadwal-dokter/all` | Get all schedules |
| GET | `/mobile/jadwal-dokter/available-kuota` | Get available quota |
| POST | `/mobile/apm/process-registration` | Mobile registration |
| PUT | `/mobile/apm/update-patient/:appointmentUuid` | Update patient |
| POST | `/mobile/admisi-antrian/` | Create queue |
| DELETE | `/mobile/report-antrian/cancel-booking` | Cancel booking |

---

## 5. Rawat Jalan Service

**Base URL:** `http://localhost:8092/api/v3/rajal`

Mengelola layanan rawat jalan dan antrian poliklinik.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/antrian-call` | Get all patient queues |
| PUT | `/antrian-call/:uuid` | Update queue status |
| GET | `/laporan-tindakan` | Get procedure report |
| GET | `/report/kunjungan` | Get visit report |
| GET | `/report/batal-kunjungan` | Get cancelled visits |

---

## 6. Rawat Inap Service

**Base URL:** `http://localhost:8091/api/v3/ranap`

Mengelola layanan rawat inap dan perpindahan tempat tidur.

### Transfer Bed
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/transfer-bed/current-bed/:uuid` | Get current bed |
| POST | `/transfer-bed/request/:uuid` | Request bed transfer |
| PUT | `/transfer-bed/reject/:uuid` | Reject transfer |
| PUT | `/transfer-bed/approve/:uuid` | Approve transfer |
| GET | `/transfer-bed/all` | Get all transfers |
| GET | `/transfer-bed/history/:uuid` | Get transfer history |
| GET | `/transfer-bed/request/detail/:uuid` | Get request detail |
| GET | `/transfer-bed/total-pending` | Get pending count |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/report/kunjungan` | Get visit report |
| GET | `/report/batal-kunjungan` | Get cancelled visits |
| GET | `/report/perpindahan` | Get transfer report |

---

## 7. IGD Service

**Base URL:** `http://localhost:8085/api/v3/pelayanan`

Mengelola layanan unit gawat darurat.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/igd/report/kunjungan` | Get visit report |
| GET | `/igd/report/batal-kunjungan` | Get cancelled visits |

> **Note:** IGD Service menggunakan base path `/api/v3/pelayanan` dengan prefix `/igd/` untuk endpoint-nya.

---

## 8. Rekam Medis Service

**Base URL:** `http://localhost:8093/api/v3/rekam-medis`

Mengelola rekam medis elektronik dan assessment klinis.

### FPO (Formularium Pemberian Obat)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/fpo` | Get FPO records |
| POST | `/fpo` | Create FPO |
| PUT | `/fpo` | Update FPO |

### Medical Records
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/patient` | Get patient records |
| POST | `/patient` | Create patient record |
| POST | `/record` | Add medical record |
| GET | `/pelayanan/history` | Get service history |

### Session
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/session` | Create session |
| DELETE | `/session` | Delete session |
| GET | `/chat/instruksi` | Get medical instructions |
| GET | `/chat/catatan` | Get nursing notes |

### Assessment
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/assessment` | Create assessment |
| POST | `/chat/catatan` | Insert nursing note |
| PUT | `/chat/catatan` | Update nursing note |
| POST | `/chat/instruksi` | Insert instruction |
| PUT | `/chat/instruksi` | Update instruction |
| POST | `/tindakan` | Insert procedure |
| GET | `/item-before` | Get previous items |
| POST | `/order-obat` | Push drug order |

### Inform Consent
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/inform-consent` | Get all consents |
| GET | `/inform-consent/:uuid` | Get consent detail |
| POST | `/inform-consent` | Create consent |
| DELETE | `/inform-consent/:uuid` | Delete consent |

### Pelayanan (Services)
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/pelayanan/resume` | Update service resume |
| GET | `/pelayanan/resume` | Get service resume |
| PUT | `/pelayanan/discharge` | Discharge patient |
| POST | `/pelayanan/billing-layanan` | Create billing |
| GET | `/pelayanan/files` | Get all files |
| POST | `/pelayanan/files` | Upload file |
| PUT | `/pelayanan/files` | Update file |
| DELETE | `/pelayanan/files` | Delete file |
| GET | `/pelayanan/files/letters` | Get letters |
| GET | `/pelayanan/files/letter/download` | Download letter |
| GET | `/pelayanan/files/generate-code` | Generate letter code |

---

## 9. Farmasi Service

**Base URL:** `http://localhost:8084/api/v3/farmasi`

Mengelola farmasi, resep obat, dan penjualan obat.

### Datamaster Farmasi
Setiap endpoint memiliki operasi CRUD standar:

#### Satuan (Unit)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/datamaster/satuan` | Create unit |
| GET | `/datamaster/satuan` | Get all units |
| PUT | `/datamaster/satuan/:uuid` | Update unit |
| DELETE | `/datamaster/satuan/:uuid` | Delete unit |
| POST | `/datamaster/satuan/import` | Import units |
| GET | `/datamaster/satuan/export` | Export units |

#### Bentuk Sediaan (Dosage Form)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/datamaster/bentuk-sediaan` | Create form |
| GET | `/datamaster/bentuk-sediaan` | Get all forms |
| PUT | `/datamaster/bentuk-sediaan/:uuid` | Update form |
| DELETE | `/datamaster/bentuk-sediaan/:uuid` | Delete form |

#### Kategori Obat (Drug Category)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/datamaster/kategori-obat` | Create category |
| GET | `/datamaster/kategori-obat` | Get all categories |
| PUT | `/datamaster/kategori-obat/:uuid` | Update category |
| DELETE | `/datamaster/kategori-obat/:uuid` | Delete category |

#### Item Medis (Medical Item)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/datamaster/item-medis` | Create item |
| GET | `/datamaster/item-medis/all` | Get all items |
| GET | `/datamaster/item-medis/jenis-stok` | Get by stock type |
| GET | `/datamaster/item-medis/pengadaan` | Get for procurement |
| GET | `/datamaster/item-medis/export` | Export items |
| PUT | `/datamaster/item-medis/:uuid` | Update item |
| DELETE | `/datamaster/item-medis/:uuid` | Delete item |
| POST | `/datamaster/item-medis/import` | Import items |
| GET | `/datamaster/item-medis/:uuid/conversions` | Get conversions |
| GET | `/datamaster/item-medis/without-pagination` | Get all (no pagination) |

#### Konfigurasi Harga (Price Configuration)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/datamaster/konfig-harga` | Get price config |
| PUT | `/datamaster/konfig-harga` | Update price config |
| GET | `/datamaster/harga-item` | Get item prices |
| GET | `/datamaster/harga-item/:uuid` | Get price by ID |

### Prescriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/prescriptions/first-order` | Create first order |
| POST | `/prescriptions/add-obat` | Add drug to prescription |
| DELETE | `/prescriptions/obat/:prescription_item_uuid` | Delete drug |
| GET | `/prescriptions/fpo` | Get prescriptions for FPO |
| PATCH | `/prescriptions/:prescription_item_uuid` | Edit remaining drug |
| GET | `/prescriptions/:uuid` | Get prescription |
| PUT | `/prescriptions/substitution` | Substitute item |
| PUT | `/prescriptions/:uuid` | Update prescription |
| PUT | `/prescriptions/obat/:uuid` | Update drug |
| GET | `/prescriptions/obat/history` | Get drug history |
| POST | `/prescriptions/some-order` | Get by multiple UUIDs |
| POST | `/prescriptions/status-telaah` | Update review status |
| POST | `/prescriptions/batal-order` | Cancel order |
| POST | `/prescriptions/status-siap-diserahkan` | Set ready status |
| POST | `/prescriptions/status-verifikasi` | Set verified status |
| POST | `/prescriptions/status-diserahkan` | Set delivered status |
| POST | `/prescriptions/batal-siap-diserahkan` | Cancel ready status |
| POST | `/prescriptions/lokasi-stok` | Update stock location |
| POST | `/prescriptions/all` | Get all prescriptions |

### Penjualan Obat (OTC Sales)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/penjualan-obat` | Create sale |
| GET | `/penjualan-obat` | Get all sales |
| GET | `/penjualan-obat/all` | Get all (no pagination) |
| GET | `/penjualan-obat/code` | Get sale code |
| GET | `/penjualan-obat/:uuid` | Get sale detail |
| PUT | `/penjualan-obat/:uuid/cancel` | Cancel sale |

### Alkes (Medical Equipment)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/alkes` | Order equipment |
| GET | `/alkes/some-order` | Get by medical record |
| POST | `/alkes/all` | Get all for pharmacy |
| PUT | `/alkes/lokasi-stok` | Update stock location |
| PUT | `/alkes/update-verifikasi` | Update verification |
| PUT | `/alkes/siap-diserahkan` | Set ready status |
| PUT | `/alkes/diserahkan` | Set delivered status |
| POST | `/alkes/:uuid/items` | Add items |
| GET | `/alkes/:uuid` | Get by UUID |
| PUT | `/alkes/:uuid` | Update order |
| DELETE | `/alkes/:uuid` | Cancel order |
| DELETE | `/alkes/items/:alkes_item_uuid` | Delete item |
| PUT | `/alkes/items/:uuid` | Update item |

### Return
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/retur` | Create return |
| GET | `/retur/detail` | Get return detail |
| GET | `/retur/all` | Get all returns |

### Print
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cetak/e-ticket/:uuid` | Get e-ticket |
| GET | `/cetak/e-resep/:uuid` | Get e-prescription |
| GET | `/cetak/invoice/:uuid` | Get invoice |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rekap/pendapatan` | Get revenue report |
| GET | `/rekap/tat` | Get TAT report |
| GET | `/rekap/pendapatan-apotik` | Get pharmacy revenue |

---

## 10. Stok Farmasi Service

**Base URL:** `http://localhost:8095/api/v1/stok`

Mengelola stok farmasi antar unit.

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Service health check |

### Permintaan Unit (Requisition)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/permintaan-unit` | Create requisition |
| GET | `/permintaan-unit` | Get all requisitions |
| GET | `/permintaan-unit/search-item` | Search items |
| GET | `/permintaan-unit/:uuid` | Get by UUID |
| GET | `/permintaan-unit/:uuid/cetak` | Print requisition |
| PUT | `/permintaan-unit/:uuid/status` | Update status |

### Pengeluaran Unit (Withdrawal)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/pengeluaran-unit` | Create withdrawal |
| GET | `/pengeluaran-unit` | Get all withdrawals |
| GET | `/pengeluaran-unit/search-item` | Search items |
| GET | `/pengeluaran-unit/:uuid` | Get by UUID |

### Retur Unit (Return)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/retur-unit` | Create return |
| GET | `/retur-unit` | Get all returns |
| GET | `/retur-unit/:uuid` | Get by UUID |

---

## 11. Inventory Service

**Base URL:** `http://localhost:8086/api/v3/inventory`

Mengelola inventaris, pengadaan, penerimaan, dan pengeluaran barang.

### Datamaster - Supplier
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/datamaster/supplier/` | Create supplier |
| GET | `/datamaster/supplier/` | Get all suppliers |
| GET | `/datamaster/supplier/aktif` | Get active suppliers |
| GET | `/datamaster/supplier/:uuid` | Get by UUID |
| PUT | `/datamaster/supplier/:uuid` | Update supplier |
| DELETE | `/datamaster/supplier/:uuid` | Delete supplier |
| POST | `/datamaster/supplier/import` | Import suppliers |

### Datamaster - Lokasi Gudang
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/datamaster/lokasi-gudang` | Get warehouse locations |

### Pengadaan (Procurement)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/pengadaan/pembelian-barang` | Create purchase order |
| GET | `/pengadaan/pembelian-barang` | Get all POs |
| GET | `/pengadaan/pembelian-barang/:uuid` | Get PO detail |
| PUT | `/pengadaan/pembelian-barang/:uuid` | Update PO |
| PUT | `/pengadaan/pembelian-barang-batal/:uuid` | Cancel PO |
| PUT | `/pengadaan/verifikasi-barang/:uuid` | Verify purchase |
| GET | `/pengadaan/available-items` | Get available items |
| GET | `/pengadaan/supplier-kategori` | Get suppliers by category |
| GET | `/pengadaan/retur-supplier` | Get supplier returns |
| GET | `/pengadaan/retur-supplier/available-faktur` | Get invoices |
| GET | `/pengadaan/retur-supplier/available-faktur/:uuid` | Get invoice |
| GET | `/pengadaan/retur-supplier/:uuid` | Get return detail |
| POST | `/pengadaan/retur-supplier` | Create return |
| PUT | `/pengadaan/retur-supplier/:uuid` | Accept replacement |

### Penerimaan (Receipt)
| Method | Endpoint | Description |
|--------|----------|-------------|
| PUT | `/penerimaan/pembelian/:uuid` | Create goods receipt |
| GET | `/penerimaan/retur-unit` | Get unit returns |
| GET | `/penerimaan/retur-unit/:uuid` | Get return detail |

### Pengeluaran (Goods Issued)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pengeluaran/pengiriman-unit` | Get shipment requests |
| GET | `/pengeluaran/pengiriman-unit/:uuid` | Get request detail |
| PUT | `/pengeluaran/pengiriman-unit/batal/:uuid` | Cancel request |
| PUT | `/pengeluaran/pengiriman-unit/verifikasi/:uuid` | Verify request |
| PUT | `/pengeluaran/pengiriman-unit/kirim/:uuid` | Send shipment |
| GET | `/pengeluaran/pengeluaran-unit/available-stock` | Get available stock |
| POST | `/pengeluaran/pengeluaran-unit` | Create goods issued |
| GET | `/pengeluaran/pengeluaran-unit` | Get all issued |
| GET | `/pengeluaran/pengeluaran-unit/:uuid` | Get issued detail |

### Mutasi & Kartu Stok
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/mutasi/kartu-stok` | Get stock cards |
| GET | `/mutasi/mutasi` | Get mutations |
| POST | `/mutasi/mutasi` | Create mutation |

### Stok Adjustment
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stok-adjustment/` | Get adjustments |
| PUT | `/stok-adjustment/` | Update adjustment |
| GET | `/stok-adjustment/:uuid` | Get detail |

### Stok Opname
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stok-opname/` | Get all opnames |
| POST | `/stok-opname/` | Create opname |
| GET | `/stok-opname/kartu-stok` | Get stock card |
| POST | `/stok-opname/import` | Import stock card |
| GET | `/stok-opname/:stok_opname_uuid` | Get opname detail |

### Stock Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stok/` | Get available stock |
| POST | `/stok/reduce` | Reduce stock |
| POST | `/stok/increase` | Increase stock |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/laporan/barang-expired` | Get expired items |
| GET | `/laporan/persediaan` | Get inventory report |

---

## 12. Lab Service

**Base URL:** `http://localhost:8087/api/v3/lab`

Mengelola laboratorium, pemeriksaan, dan hasil lab.

### Category Pemeriksaan
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/category-pemeriksaan` | Create category |
| GET | `/category-pemeriksaan` | Get all categories |
| GET | `/category-pemeriksaan/active` | Get active categories |
| GET | `/category-pemeriksaan/:uuid` | Get by ID |
| PUT | `/category-pemeriksaan/:uuid` | Update category |
| DELETE | `/category-pemeriksaan/:uuid` | Delete category |
| POST | `/category-pemeriksaan/import` | Import categories |

### Item Pemeriksaan
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/item-pemeriksaan` | Create item |
| GET | `/item-pemeriksaan` | Get all items |
| GET | `/item-pemeriksaan/active` | Get active items |
| GET | `/item-pemeriksaan/:uuid` | Get by ID |
| PUT | `/item-pemeriksaan/:uuid` | Update item |
| DELETE | `/item-pemeriksaan/:uuid` | Delete item |
| POST | `/item-pemeriksaan/import` | Import items |

### Spesimen
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/spesimen` | Create specimen |
| GET | `/spesimen` | Get all specimens |
| GET | `/spesimen/active` | Get active specimens |
| GET | `/spesimen/:uuid` | Get by ID |
| PUT | `/spesimen/:uuid` | Update specimen |
| DELETE | `/spesimen/:uuid` | Delete specimen |
| POST | `/spesimen/import` | Import specimens |

### Kelompok Pemeriksaan
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/kelompok-pemeriksaan` | Create group |
| GET | `/kelompok-pemeriksaan` | Get all groups |
| GET | `/kelompok-pemeriksaan/active` | Get active groups |
| GET | `/kelompok-pemeriksaan/:uuid` | Get by ID |
| PUT | `/kelompok-pemeriksaan/:uuid` | Update group |
| DELETE | `/kelompok-pemeriksaan/:uuid` | Delete group |
| POST | `/kelompok-pemeriksaan/import` | Import groups |

### Tarif Lab
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/tarif-lab` | Create tariff |
| GET | `/tarif-lab` | Get all tariffs |
| GET | `/tarif-lab/active` | Get active tariffs |
| GET | `/tarif-lab/:uuid` | Get by ID |
| PUT | `/tarif-lab/:uuid` | Update tariff |
| DELETE | `/tarif-lab/:uuid` | Delete tariff |
| POST | `/tarif-lab/import` | Import tariffs |

### Nilai Rujukan (Reference Values)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/nilai-rujukan` | Create reference value |
| GET | `/nilai-rujukan/:item_pemeriksaan_uuid` | Get by item |
| GET | `/nilai-rujukan/show/:uuid` | Get by ID |
| PUT | `/nilai-rujukan/:uuid` | Update reference |
| DELETE | `/nilai-rujukan/:uuid` | Delete reference |

### Order Lab
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/order-lab` | Create lab order |
| GET | `/order-lab` | Get all orders |
| GET | `/order-lab/:uuid` | Get by ID |
| PUT | `/order-lab/:uuid` | Update order |
| PUT | `/order-lab-batal` | Cancel order |
| PUT | `/order-lab-selesai-periksa/:uuid` | Complete exam |
| PUT | `/order-lab-validasi/:uuid` | Validate order |
| PUT | `/order-lab-batal-validasi` | Cancel validation |

### Hasil Pemeriksaan (Results)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/hasil-pemeriksaan` | Input results |
| GET | `/hasil-pemeriksaan/:uuid` | Get results |
| POST | `/expertise/:uuid` | Add expertise |
| PUT | `/batal-expertise/:uuid` | Cancel expertise |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/laporan-kunjungan` | Get visit report |
| GET | `/laporan-tat` | Get TAT report |
| GET | `/rekap-pemeriksaan-per-tanggal` | Get recap by date |
| GET | `/rekap-pemeriksaan` | Get exam summary |

---

## 13. Payment Service

**Base URL:** `http://localhost:8089/api/v3/payment`

Mengelola billing, pembayaran, dan kasir.

### Payment
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payment` | Search payments |
| GET | `/closed-bills` | Get closed bills |
| GET | `/closed-bills/:uuid/history` | Get payment history |
| GET | `/aps-otc` | Get APS OTC list |
| GET | `/pelayanan` | Get services |
| GET | `/:uuid` | Get bill details |
| GET | `/:uuid/items` | Get bill items |
| GET | `/:uuid/detail` | Get payment details |
| GET | `/:uuid/pasien` | Get patient bill |
| POST | `/:uuid/voucher` | Apply voucher |
| POST | `/:uuid/discount` | Apply discount |
| POST | `/:uuid/close` | Close bill |
| POST | `/:uuid/payment` | Process payment |
| POST | `/closed-bills/:uuid/pay` | Pay debt |

### Cashier
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/cashier/check` | Check cashier status |
| GET | `/cashier/close-day/check` | Get close day info |
| POST | `/cashier/open` | Open shift |
| POST | `/cashier/close` | Close shift |
| POST | `/cashier/close/day` | Close day |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/report/cashier` | Cashier report |
| GET | `/report/payment` | Payment report |
| GET | `/report/revenue` | Revenue report |

### Mobile Patient
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/mobile-patient/bills` | Get patient bills |
| POST | `/internal/bills` | Create bill (internal) |

---

## 14. Laporan Service

**Base URL:** `http://localhost:8088/api/v3/laporan`

Mengelola laporan dan dashboard analytics.

### Rekap (Reports)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/rekap/status-rawat` | Visit status recap |
| GET | `/rekap/tindakan` | Procedure recap |
| GET | `/rekap/pemeriksaan-lab` | Lab exam recap |
| GET | `/rekap/diagnosis` | Diagnosis recap |
| GET | `/rekap/status-rawat/export` | Export visit status |
| GET | `/rekap/tindakan/export` | Export procedures |
| GET | `/rekap/pemeriksaan-lab/export` | Export lab exams |
| GET | `/rekap/diagnosis/export` | Export diagnoses |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard/rekap` | Complete dashboard recap |
| GET | `/dashboard/rekap/rawat-jalan` | Outpatient total |
| GET | `/dashboard/rekap/status-rawat` | Visit status total |
| GET | `/dashboard/rekap/pasien` | Patient visit total |
| GET | `/dashboard/rekap/gender` | Visit by gender |
| GET | `/dashboard/rekap/pendapatan` | Total revenue |
| GET | `/dashboard/rekap/poli` | Top clinic recap |
| GET | `/dashboard/rekap/dpjp` | Top doctor recap |

---

## 15. Setting Service

**Base URL:** `http://localhost:8094/api/v1/setting`

Mengelola konfigurasi sistem dan integrasi.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/profil-faskes` | Get faskes profile |
| PUT | `/profil-faskes` | Update faskes profile |
| GET | `/ppn` | Get PPN settings |
| PUT | `/ppn` | Update PPN settings |
| GET | `/biaya-administrasi` | Get admin fee settings |
| PUT | `/biaya-administrasi` | Update admin fee |
| GET | `/-/profile-faskes/:faskesUuid` | Get faskes by UUID |
| GET | `/-/profile-faskes` | Get all faskes |
| GET | `/integrasi` | Get integration settings |
| PUT | `/integrasi-vclaim` | Update VClaim settings |
| PUT | `/integrasi-satu-sehat` | Update Satu Sehat |
| PUT | `/integrasi-other` | Update other integrations |
| GET | `/profile` | Get user profile |
| PUT | `/profile` | Update user profile |
| GET | `/printer` | Get printer settings |
| PUT | `/printer` | Update printer settings |

---

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  },
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": {
    "code": "ERROR_CODE",
    "details": "Detailed error description"
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Token tidak valid atau expired |
| FORBIDDEN | 403 | Tidak memiliki akses |
| NOT_FOUND | 404 | Resource tidak ditemukan |
| VALIDATION_ERROR | 400 | Data tidak valid |
| INTERNAL_ERROR | 500 | Error internal server |
| DUPLICATE_ENTRY | 409 | Data sudah ada |
| TOKEN_EXPIRED | 401 | Token sudah kadaluarsa |

---

## Pagination

Semua endpoint yang mengembalikan list data mendukung pagination:

### Query Parameters
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Nomor halaman |
| limit | number | 10 | Jumlah data per halaman |
| search | string | - | Kata kunci pencarian |
| sort | string | createdAt | Field untuk sorting |
| order | string | desc | Urutan sorting (asc/desc) |

### Example Request
```http
GET /api/v3/admisi/patient?page=1&limit=20&search=john&sort=name&order=asc
```

### Pagination Response
```json
{
  "success": true,
  "data": [...],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

---

## Rate Limiting

API menerapkan rate limiting untuk mencegah abuse:
- **Default**: 100 requests per menit per IP
- **Authenticated**: 1000 requests per menit per user

Header response:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1609459200
```

---

## Changelog

### Version 1.0.0
- Initial release dengan semua modul core
- Support untuk rawat jalan, rawat inap, IGD
- Integrasi farmasi dan laboratorium
- Sistem billing dan pembayaran

---

> **Note**: Dokumentasi ini di-generate otomatis berdasarkan struktur kode. Untuk informasi lebih detail tentang setiap endpoint, silakan lihat source code atau hubungi tim pengembang.
