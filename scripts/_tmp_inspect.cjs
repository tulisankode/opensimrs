const fs = require('fs');
const data = JSON.parse(fs.readFileSync('database/data/katalog-modul.json', 'utf8'));
const top = data.fitur.filter(f => f.modul);
console.log('top count', top.length, 'max urutan', Math.max(...top.map(f=>f.urutan)));
console.log(JSON.stringify(top[top.length-1], null, 2));
console.log(JSON.stringify(top.filter(f=>f.modul==='dashboard'), null, 2));
