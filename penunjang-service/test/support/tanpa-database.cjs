'use strict';

// Pramuat untuk verifikasi lokal: cegah pembacaan .env dan seluruh koneksi PostgreSQL, termasuk dari uji lama.
const dotenv = require('dotenv');
dotenv.config = () => ({ parsed: {} });
const pg = require('pg');
const tolak = () => { throw new Error('Koneksi database dilarang pada pengujian ini'); };
pg.Pool.prototype.connect = tolak;
pg.Pool.prototype.query = tolak;
pg.Client.prototype.connect = tolak;
pg.Client.prototype.query = tolak;
