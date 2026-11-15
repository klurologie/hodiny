import { STORAGE_KEY, VERSION, parseDuration, fmtDuration, computeRecord, validDate, normalizeRecord, isoWeekKey, totals, monthKey, localISODate } from './core.mjs';

const $ = id => document.getElementById(id);
const csMonths = ['leden','únor','březen','duben','květen','červen','červenec','srpen','září','říjen','listopad','prosinec'];
const shortMonths = ['Led','Úno','Bře','Dub','Kvě','Čer','Čvc','Srp','Zář','Říj','Lis','Pro'];
const navNames = {zapis:'Nový zápis',databaze:'Databáze',prehled:'Přehled hodin',zaloha:'Záloha a import'};
let records = [];
let editOriginalDate = null;
let toastTimer;

function loadData() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) throw Error('Neplatná lokální databáze');
    records = raw.map(normalizeRecord);
  } catch (err) {
    console.warn('Nepodařilo se načíst lokální záznamy:', err);
    records = [];
    toast('Databázi se nepodařilo načíst. Obnov ji z poslední zálohy JSON.', true);
  }
}
function persist(next) {
  const sorted = [...next].sort((a,b)=>a.date.localeCompare(b.date));
  try {localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted)); records=sorted;return true;}
  catch(err) {toast('Nelze uložit: úložiště prohlížeče je nedostupné nebo plné. Proveď export dat.', true); return false;}
}
function formatDate(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  return `${d}. ${m}. ${y}`;
}
function durationLabel(minutes) {return `${fmtDuration(minutes)} h`;}
function escapeHTML(value) {return String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(msg, error=false) {const el=$('toast');el.textContent=msg;el.style.background=error?'#85434c':'#153249';el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),4600);}
function getDateWeekLabel(iso) {return isoWeekKey(iso);}
function showTab(name) {
  const tab = navNames[name] ? name : 'zapis';
  document.querySelectorAll('.page').forEach(el=>el.classList.toggle('active',el.id===`page-${tab}`));
  document.querySelectorAll('.nav-link').forEach(el=>{el.classList.toggle('active',el.dataset.tab===tab);if(el.dataset.tab===tab)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
  $('breadcrumb-label').textContent=navNames[tab];
  document.title=`${navNames[tab]} · Hodiny`;
  document.querySelector('.sidebar').classList.remove('open');
  $('mobile-overlay').classList.remove('open');
  if(tab==='databaze')renderDatabase();
  if(tab==='prehled')renderOverview();
  if(tab==='zapis')renderTopStats();
  window.scrollTo({top:0,behavior:'instant'});
}
function goto(tab) {if(location.hash!==`#${tab}`)location.hash=`#${tab}`;else showTab(tab);}
function handleHash() {showTab(location.hash.slice(1));}
function renderTopStats() {
  const today=localISODate(), wk=getDateWeekLabel(today), mo=monthKey(today);
  $('today-chip').textContent=new Date().toLocaleDateString('cs-CZ',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  $('stat-today').textContent=fmtDuration(totals(records.filter(r=>r.date===today)).total);
  $('stat-week').textContent=fmtDuration(totals(records.filter(r=>getDateWeekLabel(r.date)===wk)).total);
  $('stat-month').textContent=fmtDuration(totals(records.filter(r=>monthKey(r.date)===mo)).total);
  $('nav-count').textContent=String(records.length);
}
function readForm() {
  const date=$('entry-date').value;
  if(!validDate(date)) throw Error('Vyber platné datum.');
  const record={date,
    arrival:$('arrival').value,departure:$('departure').value,
    dutyStart:$('duty-start').value,dutyEnd:$('duty-end').value,
    dutyNextDay:$('duty-next').checked,type:$('entry-type').value,
    note:$('entry-note').value.trim(),source:'Webová aplikace'};
  for (const [a,b,label] of [['arrival','departure','příchod a odchod'],['dutyStart','dutyEnd','Dienst Come a Dienst GO']]) {
    if(Boolean(record[a])!==Boolean(record[b])) throw Error(`Vyplň oba časy pro ${label}.`);
  }
  const credit=$('credited').value.trim();
  const creditMinutes=parseDuration(credit);
  if(creditMinutes===null) throw Error('Započtené hodiny musí být ve formátu H:MM, např. 5:30.');
  record.creditedMinutes=creditMinutes;
  if(!record.arrival&&!record.dutyStart&&!record.creditedMinutes&&!record.note&&!record.type) throw Error('Zadej čas, započtené hodiny nebo poznámku.');
  return normalizeRecord(record);
}
function previewForm() {
  try {
    const r=readForm();const v=computeRecord(r);
    paintPreview(v);
    $('form-message').textContent='';
  } catch(err) {
    const tmp={arrival:$('arrival').value,departure:$('departure').value,dutyStart:$('duty-start').value,dutyEnd:$('duty-end').value,dutyNextDay:$('duty-next').checked,creditedMinutes:parseDuration($('credited').value.trim())||0};
    paintPreview(computeRecord(tmp));
  }
}
function paintPreview(v) {
  $('regular-preview').textContent=durationLabel(v.regularMinutes);
  $('duty-preview').textContent=durationLabel(v.dutyMinutes);
  $('result-total').textContent=fmtDuration(v.totalMinutes);
  $('sum-regular').textContent=fmtDuration(v.regularMinutes);
  $('sum-duty').textContent=fmtDuration(v.dutyMinutes);
  $('sum-credit').textContent=fmtDuration(v.creditedMinutes);
  $('overlap-warning').hidden=!v.overlapMinutes;
  $('overnight-info').hidden=!v.isOvernightDuty;
}
function resetForm(date = localISODate()) {
  $('entry-form').reset();
  $('entry-date').value=date;
  $('save-btn').innerHTML='Uložit záznam <span aria-hidden="true">↗</span>';
  $('form-message').textContent='';
  editOriginalDate=null;
  previewForm();
}
function editRecord(date) {
  const r=records.find(x=>x.date===date);if(!r)return;
  resetForm(r.date);
  editOriginalDate=r.date;
  $('arrival').value=r.arrival;
  $('departure').value=r.departure;
  $('duty-start').value=r.dutyStart;
  $('duty-end').value=r.dutyEnd;
  $('duty-next').checked=r.dutyNextDay;
  $('entry-type').value=['','Urlaub','Krank','Feiertag','Jiné'].includes(r.type)?r.type:'Jiné';
  $('credited').value=r.creditedMinutes ? fmtDuration(r.creditedMinutes):'';
  $('entry-note').value=r.note;
  $('save-btn').innerHTML='Uložit změny <span aria-hidden="true">↗</span>';
  goto('zapis');previewForm();
  toast(`Upravuješ záznam ${formatDate(r.date)}.`);
}
function saveForm(evt) {
  evt.preventDefault();
  let record;
  try{record=readForm();}catch(err){$('form-message').textContent=err.message;toast(err.message,true);return;}
  const existing=records.find(r=>r.date===record.date);
  if(existing && record.date!==editOriginalDate && !confirm(`Pro ${formatDate(record.date)} již existuje záznam. Chceš jej nahradit novým?`))return;
  const newList=records.filter(r=>r.date!==record.date && r.date!==editOriginalDate);
  newList.push(record);
  if(persist(newList)) {renderTopStats();toast(`Záznam ${formatDate(record.date)} byl uložen.`);resetForm(record.date);}
}
function getFilteredRecords() {
  const q=$('db-search').value.trim().toLocaleLowerCase('cs');
  const month=$('db-month').value,type=$('db-type').value;
  return records.filter(r=>{
    if(month && monthKey(r.date)!==month)return false;
    const c=computeRecord(r);
    if(type==='duty'&&!c.isDuty)return false;
    if(type==='credit'&&!c.creditedMinutes)return false;
    if(q && ![r.date,formatDate(r.date),r.note,r.type].join(' ').toLocaleLowerCase('cs').includes(q))return false;
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date));
}
function refreshMonthOptions() {
  const selector=$('db-month'),previous=selector.value;
  const months=[...new Set(records.map(r=>monthKey(r.date)))].sort().reverse();
  selector.innerHTML='<option value="">Všechny měsíce</option>'+months.map(month=>{const [year,m]=month.split('-');return `<option value="${month}">${csMonths[Number(m)-1]} ${year}</option>`;}).join('');
  if(months.includes(previous))selector.value=previous;
}
function renderDatabase() {
  refreshMonthOptions();
  const rows=getFilteredRecords();
  $('records-body').innerHTML=rows.map(r=>{
    const c=computeRecord(r);
    const note=r.note?`<div class="record-note" title="${escapeHTML(r.note)}">${escapeHTML(r.note)}</div>`:'';
    return `<tr><td>${formatDate(r.date)}${note}</td><td>${escapeHTML(r.arrival)||'–'}</td><td>${escapeHTML(r.departure)||'–'}</td><td>${escapeHTML(r.dutyStart)||'–'}</td><td>${r.dutyEnd?`<span class="${c.isOvernightDuty?'service-tag':''}">${escapeHTML(r.dutyEnd)}${c.isOvernightDuty?' +1 den':''}</span>`:'–'}</td><td>${fmtDuration(c.regularMinutes)}</td><td>${fmtDuration(c.dutyMinutes)}</td><td class="total-col">${fmtDuration(c.totalMinutes)}</td><td><div class="row-actions"><button type="button" data-edit="${r.date}" aria-label="Upravit ${formatDate(r.date)}">Upravit</button><button type="button" class="delete" data-delete="${r.date}" aria-label="Smazat ${formatDate(r.date)}">×</button></div></td></tr>`;
  }).join('');
  const summary=totals(rows);
  $('db-info').textContent=`Zobrazeno ${rows.length} z ${records.length} záznamů`;
  $('db-total').textContent=`Celkem ${fmtDuration(summary.total)} h`;
  $('db-empty').hidden=rows.length>0;
  $('nav-count').textContent=String(records.length);
}
function availableYears(){return [...new Set([...records.map(r=>Number(r.date.slice(0,4))),new Date().getFullYear()])].sort((a,b)=>b-a);}
function refreshYearSelect() {
  const sel=$('year-select'),old=Number(sel.value),years=availableYears();
  sel.innerHTML=years.map(y=>`<option value="${y}">${y}</option>`).join('');
  if(years.includes(old))sel.value=String(old);
  else sel.value=String(years.includes(new Date().getFullYear())?new Date().getFullYear():years[0]);
}
function renderOverview() {
  refreshYearSelect();
  const year=Number($('year-select').value),filtered=records.filter(r=>Number(r.date.slice(0,4))===year);
  const sum=totals(filtered);
  $('year-total').textContent=fmtDuration(sum.total);
  $('year-regular').textContent=fmtDuration(sum.regular);
  $('year-duty').textContent=fmtDuration(sum.duty);
  $('year-credit').textContent=fmtDuration(sum.credited);
  $('year-dutycount').textContent=String(sum.duties);
  const months=Array.from({length:12},(_,i)=>totals(filtered.filter(r=>Number(r.date.slice(5,7))===i+1)));
  const max=Math.max(1,...months.map(x=>x.regular+x.duty+x.credited));
  $('month-chart').innerHTML=months.map((m,i)=>{
    const scale=185/max;
    return `<div class="chart-column" title="${csMonths[i]} ${year}: ${fmtDuration(m.total)} h"><output>${m.total?Math.round(m.total/60)+' h':''}</output><div class="bar-stack"><span class="bar credit" style="height:${m.credited*scale}px"></span><span class="bar duty" style="height:${m.duty*scale}px"></span><span class="bar reg" style="height:${m.regular*scale}px"></span></div><label>${shortMonths[i]}</label></div>`;
  }).join('');
  $('month-body').innerHTML=months.map((m,i)=>`<tr><td>${csMonths[i][0].toUpperCase()+csMonths[i].slice(1)}</td><td>${fmtDuration(m.regular)}</td><td>${fmtDuration(m.duty)}</td><td>${fmtDuration(m.total)}</td></tr>`).join('');
  const weekly=new Map();
  for(const r of filtered){const w=isoWeekKey(r.date);if(!weekly.has(w))weekly.set(w,[]);weekly.get(w).push(r);}
  $('week-body').innerHTML=[...weekly.entries()].sort((a,b)=>b[0].localeCompare(a[0])).map(([w,list])=>{const t=totals(list);return `<tr><td>${w}</td><td>${t.duties}</td><td>${fmtDuration(t.total)}</td></tr>`;}).join('')||'<tr><td colspan="3">Pro tento rok nejsou žádné záznamy.</td></tr>';
}
function triggerDownload(filename,content,mime){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function exportJSON(){const data={app:'Hodiny',schemaVersion:VERSION,exportedAt:new Date().toISOString(),records};triggerDownload(`hodiny-zaloha-${localISODate()}.json`,JSON.stringify(data,null,2),'application/json;charset=utf-8');toast('Záloha JSON byla vytvořena.');}
function exportCSV(){const headers=['Datum','Příchod','Odchod','Dienst Come','Dienst GO','Dienst do dalšího dne','Pracovní doba','Služba','Započteno','Celkem','Typ dne','Poznámka'];const lines=[headers];
 for(const r of [...records].sort((a,b)=>a.date.localeCompare(b.date))){const c=computeRecord(r);lines.push([r.date,r.arrival,r.departure,r.dutyStart,r.dutyEnd,r.dutyNextDay?'ANO':'NE',fmtDuration(c.regularMinutes),fmtDuration(c.dutyMinutes),fmtDuration(c.creditedMinutes),fmtDuration(c.totalMinutes),r.type,r.note]);}
 const csv='\ufeff'+lines.map(line=>line.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\r\n');triggerDownload(`hodiny-${localISODate()}.csv`,csv,'text/csv;charset=utf-8');toast('CSV bylo vytvořeno.');}
async function importFile(file){if(!file)return;
 if(file.size>10*1024*1024){toast('Soubor je příliš velký (maximum 10 MB).',true);return;}
 try {
  const obj=JSON.parse(await file.text());
  if(!obj||!Array.isArray(obj.records)||obj.records.length>25000)throw Error('Soubor nemá platný formát zálohy Hodiny.');
  const excelYear=Number($('import-year').value);
  if(obj.source==='Hodiny.xlsx' && (!Number.isInteger(excelYear) || excelYear<2000 || excelYear>2100))throw Error('Pro import Excelu vyber platný rok.');
  const prepared=obj.records.map(raw=>normalizeRecord(obj.source==='Hodiny.xlsx' ? {...raw, date:String(excelYear)+raw.date.slice(4)} : raw));
  const importedMap=new Map(prepared.map(r=>[r.date,r]));
  const existingDates=new Set(records.map(r=>r.date));
  const conflicts=[...importedMap.keys()].filter(d=>existingDates.has(d));
  let overwrite=false;
  if(conflicts.length){overwrite=confirm(`V importu se nachází ${conflicts.length} již uložených dnů. Chceš je přepsat údaji z importovaného souboru?\n\nOK = přepsat konflikty, Zrušit = zachovat existující dny.`);}
  const merged=new Map(records.map(r=>[r.date,r]));let added=0,updated=0;
  for(const [day,r] of importedMap){if(merged.has(day)){if(overwrite){merged.set(day,r);updated++;}}else{merged.set(day,r);added++;}}
  if(persist([...merged.values()])){
    const message=`Import dokončen: ${added} nových záznamů, ${updated} aktualizovaných. Celkem ${records.length} dnů.`;
    $('import-result').textContent=message;toast(message);renderTopStats();renderDatabase();renderOverview();
  }
 }catch(err){$('import-result').textContent=`Import selhal: ${err.message}`;toast(`Import selhal: ${err.message}`,true);}
 finally{$('import-file').value='';}
}
function init() {
  loadData();resetForm();
  window.addEventListener('hashchange',handleHash);
  $('mobile-menu').addEventListener('click',()=>{document.querySelector('.sidebar').classList.toggle('open');$('mobile-overlay').classList.toggle('open');});
  $('mobile-overlay').addEventListener('click',()=>{document.querySelector('.sidebar').classList.remove('open');$('mobile-overlay').classList.remove('open');});
  ['entry-date','arrival','departure','duty-start','duty-end','duty-next','entry-type','credited','entry-note'].forEach(id=>$(id).addEventListener('input',previewForm));
  $('entry-form').addEventListener('submit',saveForm);
  $('set-today').addEventListener('click',()=>{$('entry-date').value=localISODate();previewForm();});
  $('reset-form').addEventListener('click',()=>resetForm());
  $('db-new').addEventListener('click',()=>{resetForm();goto('zapis');});
  $('db-search').addEventListener('input',renderDatabase);
  $('db-month').addEventListener('change',renderDatabase);
  $('db-type').addEventListener('change',renderDatabase);
  $('records-body').addEventListener('click',event=>{
    const button=event.target.closest('button');if(!button)return;
    if(button.dataset.edit)editRecord(button.dataset.edit);
    if(button.dataset.delete){const date=button.dataset.delete;if(confirm(`Opravdu smazat záznam ${formatDate(date)}?`)){
      if(persist(records.filter(r=>r.date!==date))){renderDatabase();renderTopStats();toast('Záznam byl smazán.');}
    }}
  });
  $('year-select').addEventListener('change',renderOverview);
  $('import-file').addEventListener('change',event=>importFile(event.target.files?.[0]));
  $('export-json').addEventListener('click',exportJSON);
  $('export-csv').addEventListener('click',exportCSV);
  renderTopStats();handleHash();
  if('serviceWorker' in navigator && location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
init();
