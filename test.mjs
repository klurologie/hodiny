import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { computeRecord, normalizeRecord, fmtDuration, isoWeekKey, parseDuration, totals } from './core.mjs';

assert.equal(fmtDuration(1500),'25:00');
assert.equal(parseDuration('5:30'),330);
assert.equal(parseDuration('25:00'),1500);
assert.equal(parseDuration('5:60'),null);
assert.equal(isoWeekKey('2026-01-01'),'2026-W01');
assert.equal(isoWeekKey('2027-01-01'),'2026-W53');
assert.equal(computeRecord({dutyStart:'07:30',dutyEnd:'08:30',dutyNextDay:true}).dutyMinutes,1500);
assert.equal(computeRecord({dutyStart:'17:00',dutyEnd:'08:30'}).dutyMinutes,930);
assert.equal(computeRecord({arrival:'07:00',departure:'15:00',dutyStart:'14:00',dutyEnd:'20:00'}).totalMinutes,780);
assert.equal(computeRecord({creditedMinutes:330}).totalMinutes,330);
const privatePath=fileURLToPath(new URL('../hodiny_private_import.json',import.meta.url));
if (existsSync(privatePath)) {
  const data=JSON.parse(readFileSync(privatePath,'utf8')).records.map(normalizeRecord);
  assert.equal(data.length,193);
  assert.equal(new Set(data.map(x=>x.date)).size,193);
  const may14=data.find(x=>x.date==='2026-05-14');
  assert.equal(may14.dutyNextDay,true);
  assert.equal(computeRecord(may14).dutyMinutes,1500);
  assert.equal(computeRecord(may14).totalMinutes,1500);
  const may=totals(data.filter(x=>x.date.startsWith('2026-05')));
  assert.equal(may.total,9865);
  const expected={ '2026-03':10000, '2026-04':10430, '2026-05':9865, '2026-06':9940, '2026-07':11435, '2026-08':11445, '2026-09':10025, '2026-10':9965, '2026-11':4265 };
  for (const [ym,n] of Object.entries(expected)){
    const actual=totals(data.filter(x=>x.date.startsWith(ym))).total;
    assert.equal(actual,n,`monthly sum mismatch ${ym}: ${actual} vs ${n}`);
  }
  console.log('PASS: 193 importovaných dnů, 9 měsíčních součtů, 25h služba 14. 5., čas přes půlnoc, překryvy, formátování a ISO týdny.');
} else {
  console.log('PASS: výpočetní testy. Soukromý import soubor nebyl nalezen; test importované databáze přeskočen.');
}
