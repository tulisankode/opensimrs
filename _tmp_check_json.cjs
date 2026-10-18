const fs = require('fs');
JSON.parse(fs.readFileSync('database/data/katalog-modul.json', 'utf8'));
console.log('JSON OK');
