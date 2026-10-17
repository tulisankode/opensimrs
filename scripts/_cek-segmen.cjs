const d = require('../database/data/katalog-modul.json');
const preset = d.preset.segmen_modul;
for (const [seg, mods] of Object.entries(preset)) {
  console.log(seg, 'mcu=' + mods.includes('mcu'), 'bpjs_fktp=' + mods.includes('bpjs_fktp'));
}
