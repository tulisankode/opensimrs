"use strict";

/**
 * Akun admin untuk lingkungan development/staging (dump schema.sql tidak memuat akun "admin" dari README).
 * Hanya berjalan bila SEED_ADMIN_PASSWORD diisi. Hak akses disalin dari akun template
 * (SEED_ADMIN_TEMPLATE, default "superadmin"). Tidak mengubah akun yang sudah ada.
 *
 *   SEED_ADMIN_PASSWORD=... npm run db:seed:admin
 */
const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const uuidv7 = () => {
  const b = crypto.randomBytes(16);
  const t = BigInt(Date.now());
  for (let i = 0; i < 6; i++) b[i] = Number((t >> BigInt(8 * (5 - i))) & 255n);
  b[6] = (b[6] & 0x0f) | 0x70;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};

module.exports = {
  async up(queryInterface) {
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password) {
      console.log("SEED_ADMIN_PASSWORD kosong → seeder admin dilewati.");
      return;
    }
    const username = process.env.SEED_ADMIN_USERNAME || "admin";
    const template = process.env.SEED_ADMIN_TEMPLATE || "superadmin";
    const [[existing]] = await queryInterface.sequelize.query("SELECT 1 FROM users WHERE username = :username", { replacements: { username } });
    if (existing) {
      console.log(`Akun ${username} sudah ada → dilewati.`);
      return;
    }
    const now = Math.floor(Date.now() / 1000);
    const [, count] = await queryInterface.sequelize.query(
      `INSERT INTO users (uuid, faskes_uuid, role_uuid, phone, email, username, password, permissions, status, created_at, updated_at)
       SELECT :uuid, faskes_uuid, role_uuid, '080000000000', :email, :username, :hash, permissions, true, :now, :now
       FROM users WHERE username = :template`,
      { replacements: { uuid: uuidv7(), email: `${username}@opensimrs.local`, username, hash: bcrypt.hashSync(password, 10), now, template } },
    );
    if (!count) throw new Error(`Akun template "${template}" tidak ditemukan.`);
    console.log(`Akun ${username} dibuat dari template ${template}.`);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query("DELETE FROM users WHERE username = :username", {
      replacements: { username: process.env.SEED_ADMIN_USERNAME || "admin" },
    });
  },
};
