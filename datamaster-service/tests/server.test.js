// const request = require('supertest');
// const assert = require('assert')
// const app = require('../server');
const Cripto = require('crypto-js');
require('dotenv/config');

// describe('GET /', () => {
//   it('responds responds to the world', async function() {
//     const res = await request(app)
//       .get('/')
//       .set('Accept', 'application/json');

//     assert.equal(res.status, 200);
//     assert.equal(res.type, 'application/json');
//     assert.equal(res.body.message, 'Hello World!');
//   });
// });

// describe('GET /404', () => {
//   it('responds with a 404', async function() {
//     const res = await request(app)
//       .get('/404')
//       .set('Accept', 'application/json');

//     assert.equal(res.status, 404);
//   });
// });


// describe("ENC", () => {
//     test("should return encrypted text", () => {
//         const text = "mobile pasien";
//         const key = process.env.API_KEY_SECRET;
//         const encrypted = Cripto.AES.encrypt(text, key).toString();
//         console.log(encrypted);
//     });
// })