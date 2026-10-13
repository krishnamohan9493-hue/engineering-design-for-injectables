/* Project workflows. Browser-local data; no GMP record approval or electronic signatures. */
'use strict';
const WORKFLOW_RELEASE='2026.10.14';
S.studio.internal=S.studio.internal||[
  {tag:'LDB-GF-01',area:'Production corridor',type:'Lighting',qty:24,watts:36,circuits:3,pf:.95,df:1,length:35,phase:'1',category:'N'},
  {tag:'PDB-LAB-01',area:'QC laboratory sockets',type:'Power sockets',qty:12,watts:200,circuits:3,pf:.9,df:.6,length:40,phase:'1',category:'E'},
  {tag:'ELDB-01',area:'Emergency escape lighting',type:'Emergency lighting',qty:16,watts:8,circuits:2,pf:.9,df:1,length:45,phase:'1',category:'C'}
];
S.studio.external=S.studio.external||[
  {tag:'SLDB-01',area:'Perimeter road poles',type:'Road lighting',qty:20,watts:90,circuits:4,pf:.95,df:1,length:180,phase:'1',category:'E'},
  {tag:'FLDB-01',area:'Transformer yard floodlights',type:'Floodlighting',qty:8,watts:120,circuits:2,pf:.95,df:1,length:85,phase:'1',category:'E'},
  {tag:'PDB-EXT-01',area:'Utility yard outlets',type:'Power sockets',qty:6,watts:500,circuits:2,pf:.9,df:.7,length:100,phase:'1',category:'N'}
];
S.studio.distribution=Object.assign({voltage:230,drop:3,derating:.7,fault:3,time:.1,allowance:10,earthing:'TN-S; confirm source and measured loop impedance'},S.studio.distribution||{});
S.studio.instruments=S.studio.instruments||[
  {tag:'DPT-R106',service:'Filling room differential pressure',lrv:0,urv:50,ma:8.8,unit:'Pa',fail:'Alarm on loss of signal; retain defined fan safe state',drawing:'PID-HVAC-001'},
  {tag:'TT-WFI-01',service:'WFI return temperature',lrv:0,urv:150,ma:12.53,unit:'°C',fail:'Alarm; assess quality impact and divert per approved sequence',drawing:'PID-WFI-001'}
];
S.studio.utilityDemand=S.studio.utilityDemand||[
  {tag:'WFI filling + compounding',utility:'WFI',rate:1.5,qty:2,coincidence:.8,unit:'m³/h'},
  {tag:'PW wash stations',utility:'PW',rate:.4,qty:6,coincidence:.7,unit:'m³/h'},
  {tag:'Autoclaves + SIP',utility:'Clean steam',rate:250,qty:3,coincidence:.8,unit:'kg/h'},
  {tag:'Instrument + process air',utility:'Compressed air',rate:80,qty:6,coincidence:.75,unit:'Nm³/h'},
  {tag:'Blanketing stations',utility:'Nitrogen',rate:12,qty:8,coincidence:.6,unit:'Nm³/h'}
];
S.studio.draft=S.studio.draft||{title:'Basis of design and calculation summary',purpose:'Concept and detailed design development for an injectable facility in Hyderabad.',assumptions:'Example inputs are initial design assumptions. Confirm production capacity, equipment duties, simultaneous demand, installation methods, soil tests and site weather before issue.',conclusions:'Resolve outstanding calculation checks, obtain vendor data and complete independent design review. Link critical parameters to qualification protocols.',exclusions:'Drawings, vendor selections, protection coordination, CFD/containment evidence, photometric modelling, regulatory approvals and executed qualification remain project deliverables.',snapshot:''};
const IMPORT_SHAPE=JSON.parse(JSON.stringify(S));
const additions=[['workflow','Start / workflows'],['internal','Internal electrification'],['external','External electrification'],['instruments','Instrument index & scaling'],['utilityd','Utility demand schedule'],['drafts','Editable draft report']];
additions.forEach(t=>TABS.push(t));
GROUPS[0][1].unshift('workflow');GROUPS[0][1].push('drafts');GROUPS.find(x=>x[0]==='Electrical')[1].push('internal','external');
GROUPS.find(x=>x[0]==='Automation & lifecycle')[1].unshift('instruments');GROUPS.find(x=>x[0]==='Utilities & process')[1].unshift('utilityd');
S.studio.reportTabs=S.studio.reportTabs.filter(id=>TABS.some(t=>t[0]===id)&&!['workflow','dash','reports'].includes(id));

// Parameter constraints are specific to each calculation; motor multipliers and aging factors can exceed one.
const factorKeys={cab:['ie','pf','gr','spf'],dg:['der','me','mp'],ups:['pf','ie','dod'],ltg:['uf','mf'],hvac:['fe'],fan:['ef','me'],pfc:['p1','p2']};
const positiveKeys={p:['V','rho'],tr:['ld','z'],dg:['ld','der','me','mp','xd'],ups:['pf','ie','vd','dod','ml','eod','rt'],cab:['ie','pf','rn','gr','spf'],efli:['V','in','cs','ce','kc'],ltg:['l','w','hm','fl','uf','mf'],hvac:['a','h','dt','hf','fe'],earth:['A','L','h','rl','rd','t','k','dc','ts','rs'],ctrl:['mai','mao','mdi','mdo','slots'],his:['si','cyc','lk'],alm:['sd','rec'],relay:['is','tms','ctp','cts'],fan:['q','ef']};
validateInput=function(sc,k,v){
  const definition=M[sc]?.f.find(f=>f[0]===k)||(sc==='p'?PF.find(f=>f[0]===k):null);
  if(definition&&typeof definition[2]==='number'&&typeof v!=='number')return false;
  if(typeof v!=='number')return typeof v==='string'&&v.length<=50000;
  if(!Number.isFinite(v))return false;
  if((factorKeys[sc]||[]).includes(k))return v>0&&v<=1;
  if(sc==='ups'&&['ag','tf'].includes(k))return v>=1&&v<=10;
  if(sc==='p'&&k==='alt')return v>=-500&&v<=9000;
  if(sc==='p'&&k==='amb')return v>=-50&&v<=80;
  if((positiveKeys[sc]||[]).includes(k)&&v<=0)return false;
  const field=M[sc]?.f.find(f=>f[0]===k)||PF.find(f=>sc==='p'&&f[0]===k);
  if(field){
    if(/°C|temperature|trend mean/i.test((field[1]||'')+' '+(field[3]||'')))return v>=-100&&v<=1000;
    if(/RH|power factor/i.test(field[1])&&field[3]==='%')return v>=0&&v<=100;
    if(field[3]==='%'&&/loading|share|saving|spare|efficien|percent/i.test(field[1]))return v>=0&&v<=100;
    if(['nos','pts'].includes(field[3])&&!Number.isInteger(v))return false;
  }
  return v>=0;
};

function distributionCalc(r,c=S.studio.distribution){
  if(![r.qty,r.watts,r.circuits,r.pf,r.df,r.length,c.voltage,c.derating,c.fault,c.time,c.drop,c.allowance].every(Number.isFinite)||r.qty<1||r.watts<=0||r.circuits<1||!Number.isInteger(r.circuits)||!Number.isInteger(r.qty)||r.pf<=0||r.pf>1||r.df<0||r.df>1||r.length<=0||c.voltage<=0||c.derating<=0||c.derating>1||c.fault<=0||c.time<=0||c.drop<=0||c.allowance<0)return {valid:false,reason:'Enter positive quantities, integer circuits, physical PF / factors and source fault data.'};
  const connected=r.qty*r.watts/1000,demand=connected*r.df;
  const perCircuit=Math.ceil(r.qty/r.circuits)*r.watts/1000;
  const three=r.phase==='3',voltage=three?S.p.V:c.voltage;
  const current=perCircuit*1000/((three?R3:1)*voltage*r.pf);
  const breaker=[6,10,16,20,25,32,40,50,63,80,100,125,160,200,250].find(x=>x>=current*1.25);
  const minimum=c.fault*1000*Math.sqrt(c.time)/143;
  const cable=LIB.find(([size,amps,resistance])=>{
    const drop=(three?R3:2)*current*r.length/1000*(resistance*1.275*r.pf+.08*Math.sqrt(1-r.pf*r.pf))/voltage*100;
    return amps*c.derating>=(breaker||Infinity)&&size>=minimum&&drop<=c.drop;
  });
  const vd=cable?(three?R3:2)*current*r.length/1000*(cable[2]*1.275*r.pf+.08*Math.sqrt(1-r.pf*r.pf))/voltage*100:null;
  return {valid:true,connected,demand,perCircuit,current,breaker,cable:cable?.[0],capacity:cable?cable[1]*c.derating:null,vd,minimum,cableMetres:r.length*r.circuits*(1+c.allowance/100),cores:three?5:3,ok:!!cable&&!!breaker};
}
const resultTable=rows=>`<div class="sc"><table class="o">${rows.map(([a,b,u])=>`<tr><td>${esc(a)}</td><td>${esc(b)}</td><td>${esc(u||'')}</td></tr>`).join('')}</table></div>`;
function distributionView(kind){
  const c=S.studio.distribution,rows=S.studio[kind],calcs=rows.map(r=>distributionCalc(r));
  const cols=[['tag','DB / circuit group','text'],['area','Area / service','text'],['type','Duty','text'],['qty','Points','number'],['watts','W per point','number'],['circuits','Circuits','number'],['pf','PF','number'],['df','Demand factor','number'],['length','Route m / circuit','number']];
  return `<section class="c"><h2>${kind==='internal'?'Internal distribution and final circuits':'External distribution and site lighting'}</h2><p class="mu">Size each group at the largest evenly divided circuit connected load; diversity applies only to upstream demand. Cu/XLPE, one-way route, 75 °C resistance approximation, k=143. Example ampacities need manufacturer verification.</p><div class="g">${[['voltage','Single-phase voltage','V'],['drop','Maximum circuit voltage drop','%'],['derating','Combined cable derating','0–1'],['fault','Local fault current','kA'],['time','Clearing time','s'],['allowance','Length allowance','%']].map(([k,l,u])=>`<label>${l} (${u})<input type="number" step="any" data-distribution="${k}" value="${esc(c[k])}"></label>`).join('')}</div><label>Supply / earthing basis<input data-distribution="earthing" value="${esc(c.earthing)}"></label><div class="sc" style="margin-top:20px"><table><thead><tr>${cols.map(x=>`<th>${x[1]}</th>`).join('')}<th>Phase</th><th>Supply</th><th>Ib A/circuit</th><th>Breaker A</th><th>Cable mm²</th><th>Drop %</th><th>Procurement m</th><th>Screen</th><th></th></tr></thead><tbody>${rows.map((r,i)=>{const x=calcs[i];return `<tr>${cols.map(([k,l,t])=>`<td><input data-work="${kind}" data-index="${i}" data-field="${k}" type="${t}" step="any" value="${esc(r[k])}"></td>`).join('')}<td><select data-work="${kind}" data-index="${i}" data-field="phase">${['1','3'].map(v=>`<option${r.phase===v?' selected':''}>${v}</option>`).join('')}</select></td><td><select data-work="${kind}" data-index="${i}" data-field="category">${['N','E','C'].map(v=>`<option${r.category===v?' selected':''}>${v}</option>`).join('')}</select></td><td>${n2(x.current)}</td><td>${x.breaker||'—'}</td><td>${x.cable?x.cores+'C × '+x.cable:'No size'}</td><td>${n2(x.vd??NaN)}</td><td>${n2(x.cableMetres,0)}</td><td><span class="pill${x.ok?'':' warn'}">${x.ok?'Sizing checks pass':'Review'}</span></td><td><button data-work-action="remove" data-kind="${kind}" data-index="${i}">Remove</button></td></tr>`}).join('')}</tbody></table></div><div class="row"><button data-work-action="add" data-kind="${kind}">Add circuit group</button><button class="p" data-work-action="sync-distribution" data-kind="${kind}">Update load & cable schedules</button><button data-work-action="csv" data-kind="${kind}">Export circuit CSV</button></div>${resultTable([['Connected load',n2(calcs.reduce((a,x)=>a+(x.connected||0),0)),'kW'],['Diversified demand',n2(calcs.reduce((a,x)=>a+(x.demand||0),0)),'kW'],['Cable assemblies including allowance',n2(calcs.reduce((a,x)=>a+(x.cableMetres||0),0),0),'m']])}<div class="help-note">${kind==='external'?'Verify road and yard illuminance, pole spacing and glare using luminaire photometry; assess trench separation, cable mechanical protection, earthing, bonding, SPDs and weatherproof equipment.':'Confirm phase balance, RCD / RCBO selection, emergency supply duration, fire stopping, conduit fill and segregation against drawings.'} Upstream voltage drop and automatic disconnection require separate checks. A selected breaker rating does not establish protection coordination.</div></section>`;
}
function syncDistribution(kind){
  const rows=S.studio[kind].map(r=>({r,x:distributionCalc(r)}));
  if(rows.some(({x})=>!x.valid||!x.ok))throw new Error('Resolve circuit sizing checks before transferring schedules.');
  S.loads=S.loads.filter(l=>l.src!==kind);S.cabs=S.cabs.filter(l=>l.src!==kind);
  rows.forEach(({r,x})=>{
    S.loads.push({a:r.area,d:r.tag+' '+r.type,kw:x.connected,ef:1,pf:r.pf,df:r.df,c:r.category,src:kind});
    S.cabs.push({t:r.tag+' final circuits',kw:x.perCircuit,len:r.length,mat:'Cu',rn:1,sm:1,src:kind,phase:r.phase,pf:r.pf,ie:1,circuits:r.circuits,selected:x.cable,vd:x.vd,current:x.current,cores:x.cores,procurement:x.cableMetres});
  });log(kind,'schedule transfer','','replaced linked rows');
}
function scalingCalc(r){if(![r.lrv,r.urv,r.ma].every(Number.isFinite)||r.urv<=r.lrv)return {valid:false,value:NaN,status:'Invalid range'};return {valid:true,value:r.lrv+(r.ma-4)/16*(r.urv-r.lrv),status:r.ma<4||r.ma>20?'Outside nominal signal range':'Nominal range'};}
function instrumentsView(){const cols=[['tag','Tag'],['service','Service'],['lrv','LRV','number'],['urv','URV','number'],['ma','Input mA','number'],['unit','Units'],['fail','Fail / safe state'],['drawing','P&ID / loop ref.']];return `<section class="c"><h2>Instrument index and 4–20 mA scaling</h2><p class="mu">Linear conversion: LRV + (mA − 4) / 16 × (URV − LRV). Outside 4–20 mA is flagged; fault thresholds and fail actions require the selected transmitter specification and approved cause-and-effect.</p><div class="sc"><table><tr>${cols.map(x=>`<th>${x[1]}</th>`).join('')}<th>Engineering value</th><th>Screen</th><th></th></tr>${S.studio.instruments.map((r,i)=>{const x=scalingCalc(r);return `<tr>${cols.map(([k,l,t])=>`<td><input data-work="instruments" data-index="${i}" data-field="${k}" type="${t||'text'}" step="any" value="${esc(r[k])}"></td>`).join('')}<td>${n2(x.value,3)} ${esc(r.unit)}</td><td>${x.status}</td><td><button data-work-action="remove" data-kind="instruments" data-index="${i}">Remove</button></td></tr>`}).join('')}</table></div><div class="row"><button data-work-action="add" data-kind="instruments">Add instrument</button><button data-work-action="csv" data-kind="instruments">Export index CSV</button><button data-tab="io">I/O assignment →</button><button data-tab="calibration">Calibration points →</button></div></section>`;}
const utilityUnits={PW:'m³/h',WFI:'m³/h','Clean steam':'kg/h','Compressed air':'Nm³/h',Nitrogen:'Nm³/h'};
function utilitySummary(){const out={};for(const r of S.studio.utilityDemand){if(![r.rate,r.qty,r.coincidence].every(Number.isFinite)||r.rate<0||r.qty<1||!Number.isInteger(r.qty)||r.coincidence<0||r.coincidence>1||r.unit!==utilityUnits[r.utility])throw new Error('Check utility demand units, quantity and coincidence.');out[r.utility]=(out[r.utility]||0)+r.rate*r.qty*r.coincidence}return out;}
function utilityDemandView(){const total=utilitySummary();return `<section class="c"><h2>Concurrent utility demand schedule</h2><p class="mu">Demand = rate per consumer × number of consumers × coincidence. These peak process inputs feed generation sizing; storage, recirculation, warm-up and redundancy need separate checks.</p><div class="sc"><table><tr><th>Consumer</th><th>Utility</th><th>Rate</th><th>Consumers</th><th>Coincidence</th><th>Unit</th><th>Demand</th><th></th></tr>${S.studio.utilityDemand.map((r,i)=>`<tr><td><input data-work="utilityDemand" data-index="${i}" data-field="tag" value="${esc(r.tag)}"></td><td><select data-work="utilityDemand" data-index="${i}" data-field="utility">${Object.keys(utilityUnits).map(u=>`<option${u===r.utility?' selected':''}>${u}</option>`).join('')}</select></td>${['rate','qty','coincidence'].map(k=>`<td><input data-work="utilityDemand" data-index="${i}" data-field="${k}" type="number" step="any" value="${esc(r[k])}"></td>`).join('')}<td>${esc(r.unit)}</td><td>${n2(r.rate*r.qty*r.coincidence)}</td><td><button data-work-action="remove" data-kind="utilityDemand" data-index="${i}">Remove</button></td></tr>`).join('')}</table></div><div class="row"><button data-work-action="add" data-kind="utilityDemand">Add consumer</button><button class="p" data-work-action="sync-utility">Update PW / WFI / clean steam inputs</button><button data-work-action="csv" data-kind="utilityDemand">Export demand CSV</button></div>${resultTable(Object.entries(total).map(([u,v])=>[u,n2(v),utilityUnits[u]]))}<div class="help-note">Gas flows are normal-volume examples; define reference temperature and pressure, actual use pressure, leakage allowance and receiver autonomy in the Piping design basis. Sync transfers PW, WFI and clean steam only. Gas demand remains available for manual piping entry.</div></section>`;}
function workflowView(){const paths=[['01','Define the project','Set the plant profile, voltage, expansion and product / grade strategy.','proj','Project inputs'],['02','Power and distribution','Edit loads, size transformer / DG / UPS, develop internal and external circuits.','loads','Power workflow'],['03','Cleanrooms and air systems','Build room data; send total airflow to AHU / fan and review the duct critical path.','rooms','HVAC workflow'],['04','Utilities and instrumentation','Set concurrent demands, size loops, assign I/O and check instrument scaling.','utilityd','Utility workflow'],['05','Estimate and schedule','Review cable and lighting quantities, replace budgetary rates, and schedule design / qualification.','est','Estimation'],['06','Review and issue a draft','Record assumptions, run known-answer checks, edit the report and export the calculation book.','drafts','Draft reports']];return `<section class="c"><div class="eyebrow">DESIGN STUDY • EXAMPLE PLANT</div><h2>Move from inputs to a reviewable design</h2><p class="mu">Start with the editable Hyderabad example. Changes save in this browser; export a project JSON for backup or transfer. Private hosting controls access to the app; it does not synchronise project data between devices.</p><div class="discipline-grid">${paths.map(([n,t,p,id,l])=>`<button class="discipline-card" data-tab="${id}"><div class="disc-icon">${n}</div><strong>${t}</strong><p>${p}</p><small>${l} →</small></button>`).join('')}</div></section><section class="c"><h2>Linked workflow actions</h2><p class="mu">Transfers replace their own linked rows, so repeated transfers do not add duplicates. Refresh after changing a source schedule.</p>${tbl(['Source','Action','Destination'],[['Internal / external circuits','Update load & cable schedules','Load list and cable schedule'],['Room data sheet','Send total airflow','AHU psychrometrics and fan'],['Duct network','Send critical path loss','Fan duct pressure'],['Utility demand','Update generation inputs','PW / WFI / clean steam sizing'],['I/O list','Sync with I/O list','Controller and historian inputs'],['UPS','Sync with critical loads','UPS critical kW']])}<div class="help-note">All example inputs, project statuses, reports and browser edit history remain design drafts. No action in this app records engineering approval, qualification or a GMP electronic signature.</div></section>`;}
function makeDraftSnapshot(){compute();return [`Project: ${S.p.name}\nDocument: ${S.p.doc} | Rev ${S.p.rev}\nLocation: ${S.p.loc}\nGenerated: ${new Date().toISOString()}\nStatus: DRAFT — FOR INDEPENDENT REVIEW`,...['tr','dg','ups','hvac','wtr','ctrl'].map(id=>`${M[id].t}\n${R[id].o.map(o=>`${o[0]}: ${o[1]} ${o[2]}`).join('\n')}\nChecks: ${R[id].c.map(c=>`${c[0]?'PASS':'REVIEW'} — ${c[1]}`).join('; ')}`)].join('\n\n');}
function draftText(){const d=S.studio.draft;return [`DRAFT — NOT APPROVED ENGINEERING`,d.title,`Project: ${S.p.name} | ${S.p.doc} | Rev ${S.p.rev}`,`PURPOSE\n${d.purpose}`,`ASSUMPTIONS\n${d.assumptions}`,`CALCULATION SNAPSHOT\n${d.snapshot||'Generate a snapshot to capture current results.'}`,`CONCLUSIONS AND OPEN ACTIONS\n${d.conclusions}`,`EXCLUSIONS / REQUIRED EVIDENCE\n${d.exclusions}`,`REFERENCES\n${SOURCES.map(s=>s[0]+'\n'+s[2]).join('\n')}`].join('\n\n');}
function draftsView(){const d=S.studio.draft;return `<section class="c"><h2>Editable draft design report</h2><p class="mu">Narrative edits stay with your project. Generate a calculation snapshot explicitly to replace that section with current values. The snapshot is dated and stays fixed until refreshed.</p><label>Report title<input data-draft="title" value="${esc(d.title)}"></label>${[['purpose','Purpose and design stage'],['assumptions','Assumptions and input evidence'],['snapshot','Dated calculation snapshot'],['conclusions','Conclusions / unresolved actions'],['exclusions','Exclusions and required specialist evidence']].map(([k,l])=>`<label style="margin-top:15px">${l}<textarea data-draft="${k}" style="min-height:${k==='snapshot'?220:95}px">${esc(d[k])}</textarea></label>`).join('')}<div class="row"><button class="p" data-work-action="draft-refresh">Refresh calculation snapshot</button><button data-work-action="draft-download">Download editable text</button><button data-tab="reports">Select calculation sheets →</button></div><div class="help-note">Report status: DRAFT — FOR INDEPENDENT REVIEW. Reviewer names and review labels are planning metadata. Issuing a revision creates a browser-local snapshot only.</div></section>`;}
Object.assign(studioViews,{workflow:workflowView,internal:()=>distributionView('internal'),external:()=>distributionView('external'),instruments:instrumentsView,utilityd:utilityDemandView,drafts:draftsView});

// Use actual Cable sizing inputs for standalone cable schedule rows; preserve final-circuit phase and assembly data.
cabRows=function(){return S.cabs.map(c=>{if(c.src==='internal'||c.src==='external')return {c,r:{o:[],c:[[!!c.selected,'Final circuit sizing transferred from '+c.src]],x:c.selected?{s:c.selected,I:c.current,vd:c.vd,vs:0}:null}};return {c,r:M.cab.calc({...Object.fromEntries(M.cab.f.map(f=>[f[0],gv('cab',f[0],f[2])])),kw:c.kw,len:c.len,mat:c.mat,rn:c.rn,sm:c.sm},T,R)}});};
const priorCabs=cabsView;
cabsView=function(){const linked=S.cabs.filter(c=>c.src==='internal'||c.src==='external');let base=priorCabs();base=base.replace(/<tr>([\s\S]*?)<\/tr>/g,(full,row)=>{const idx=row.match(/data-cb="(\d+)"/);if(idx&&['internal','external'].includes(S.cabs[+idx[1]].src))return full.replace(/<input\b/g,'<input readonly').replace(/<select\b/g,'<select disabled');return full;});return base+`<section class="c"><h2>Final circuit cable assemblies</h2><p class="mu">Motor feeders above use three-phase sizing. Final circuits retain their source schedule sizing. Edit linked rows in Internal / External electrification and refresh the transfer. Procurement metres include all circuits and the source allowance.</p>${tbl(['Circuit group','Phase','Assembly','Circuits','Procurement m'],linked.map(c=>[c.t,c.phase,c.cores+'C × '+c.selected+' mm² Cu',c.circuits,n2(c.procurement,0)]))}<div class="row"><button data-work-action="cable-csv">Export complete cable schedule CSV</button><button data-tab="internal">Internal circuits</button><button data-tab="external">External circuits</button></div></section>`;};

const basicEstCalc=estCalc;
estCalc=function(){
  const e=basicEstCalc(),internal=S.studio.internal||[],external=S.studio.external||[];
  const extras=[['esocket','Internal / external socket outlets',[...internal,...external].filter(r=>r.type==='Power sockets').reduce((a,r)=>a+r.qty,0),'nos',650],['epole','Road lighting poles (one per point)',external.filter(r=>r.type==='Road lighting').reduce((a,r)=>a+r.qty,0),'nos',14000],['etrench','External trench route allowance',external.reduce((a,r)=>a+r.length*r.circuits,0),'m',700],['iconduit','Internal conduit route allowance',internal.reduce((a,r)=>a+r.length*r.circuits,0),'m',120]];
  let add=0;e.g={...e.g};
  for(const [id,desc,q0,unit,r0]of extras){const q=S.est.q[id]??q0,rate=S.est.r[id]??r0,amount=q*rate;add+=amount;e.rows+=`<tr><td>Electrification</td><td>${esc(desc)}</td><td><input data-eq="${id}" data-c="q" type="number" step="any" value="${q}"></td><td>${unit}</td><td><input data-eq="${id}" data-c="r" type="number" step="any" value="${rate}"></td><td>${inr(amount)}</td></tr>`;}
  e.g.Electrification=add;e.tot+=add;
  const f=k=>+gv('est',k,EF.find(x=>x[0]===k)[2]);
  e.inst=e.tot*f('ins')/100;e.eng=(e.tot+e.inst)*f('eg')/100;const subtotal=e.tot+e.inst+e.eng;e.ctg=subtotal*f('ct')/100;e.pre=subtotal+e.ctg;e.gst=e.pre*f('gs')/100;e.grand=e.pre+e.gst;return e;
};
const basicEstView=estView;
estView=function(){return `<section class="c"><h2>Reconcile quantities from schedules</h2><p class="mu">Replace preliminary cable, luminaire and I/O quantities with current schedules. Trench / conduit estimates initially sum circuit routes; edit for common routes and actual drawings. Rates include no live price feed.</p><button class="p" data-work-action="estimate-sync">Use cable, lighting and I/O schedules</button></section>`+basicEstView();};

const previousReports=reportsView;
reportsView=function(){return `<section class="c"><h2>Draft calculation book</h2><div class="row"><button data-work-action="report-download" class="p">Download report HTML</button><button data-tab="drafts">Edit report narrative</button></div><p class="mu">Download retains current sheet values and the draft narrative. Open the HTML in your browser to print or save as PDF. Choose sheets below.</p></section>`+previousReports();};
studioViews.reports=reportsView;
function collectReportHTML(){
  if(!S.studio.reportTabs.length)throw new Error('Select at least one calculation sheet.');
  const current=tab,wasAll=all,blocks=[];
  try{all=false;for(const id of S.studio.reportTabs){if(['workflow','reports','dash','drafts'].includes(id))continue;tab=id;render();blocks.push(`<section class="report-section"><h2>${esc(moduleName(id))}</h2>${$('#m').innerHTML}</section>`)}}finally{tab=current;all=wasAll;render()}
  const freeze=s=>s.replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi,'').replace(/<input\b([^>]*)>/gi,(m,a)=>{if(/type="checkbox"/.test(a))return /checked/.test(a)?'☑':'☐';if(/type="file"/.test(a))return '';return `<span class="report-value">${a.match(/value="([^"]*)"/)?.[1]||''}</span>`}).replace(/<select\b[^>]*>([\s\S]*?)<\/select>/gi,(m,o)=>o.match(/<option[^>]*selected[^>]*>([\s\S]*?)<\/option>/)?.[1]||o.match(/<option[^>]*>([\s\S]*?)<\/option>/)?.[1]||'').replace(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/gi,'<pre class="narrative">$1</pre>').replace(/<details\b[^>]*>/g,'<details open>').replace(/<div class="page-heading">[\s\S]*?<\/div><\/div>/g,'');
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(S.p.doc)} Draft design report</title><style>body{font:13px/1.6 system-ui;margin:30px;color:#142c42}h1,h2{line-height:1.25}h2{border-bottom:1px solid #ccd4dc;padding-bottom:8px}.c{border:1px solid #ddd;padding:16px;margin:18px 0}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}table{border-collapse:collapse;width:100%;font-size:11px}td,th{border:1px solid #ddd;padding:6px;text-align:left}.narrative{white-space:pre-wrap;font:inherit}.draft-banner{padding:12px;background:#fff3d6;border:1px solid #d6aa53;font-weight:700}.mu,.subtle{color:#526478}.k,.help-note{padding:10px;border:1px solid #ddd}.bad{color:#ac2020}.ok{color:#166842}.pill{font-size:11px}summary{font-weight:600}.review-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.sc{overflow:auto}@media print{body{margin:0}.report-section{break-before:page}summary{display:block}table{font-size:9px}.sc{overflow:visible}.g{grid-template-columns:repeat(3,1fr)}.c{break-inside:auto}.page-heading{display:none}a{color:inherit}}</style><div class="draft-banner">DRAFT — FOR INDEPENDENT REVIEW • NOT APPROVED ENGINEERING</div><h1>${esc(S.p.name)}</h1><p>${esc(S.p.doc)} | Revision ${esc(S.p.rev)} | ${new Date().toISOString()}<br>Prepared: ${esc(S.p.by)} | Reviewer: ${esc(S.p.chk)} (planning metadata)</p><pre class="narrative">${esc(draftText())}</pre>${blocks.map(freeze).join('')}</html>`;
}
reportPrint=function(){try{const html=collectReportHTML();const before=$('#m').innerHTML;$('#m').innerHTML=html.replace(/^[\s\S]*?<div class="draft-banner">/,'<div class="draft-banner">').replace(/<\/html>$/,'');document.body.classList.add('print-selected');try{window.print()}finally{document.body.classList.remove('print-selected');$('#m').innerHTML=before;render()}}catch(e){toast(e.message)}};

function validProject(j){
  const st=j?.state||j;if(!st||typeof st!=='object'||Array.isArray(st)||!st.p||typeof st.p!=='object'||!Array.isArray(st.loads)||st.loads.length>3000)throw new Error('Project JSON needs a plant profile and a load list.');
  const scan=(v,depth=0)=>{if(depth>25)throw new Error('Project nesting is too deep.');if(typeof v==='number'&&!Number.isFinite(v))throw new Error('Non-finite value in project.');if(typeof v==='string'&&v.length>1000000)throw new Error('Text field is too large.');if(Array.isArray(v)&&v.length>5000)throw new Error('Too many rows.');if(v&&typeof v==='object')for(const [k,x]of Object.entries(v)){if(['__proto__','prototype','constructor'].includes(k))throw new Error('Unsupported project key.');scan(x,depth+1)}};scan(st);
  const shape=(value,expected,path)=>{if(value===undefined)return;if(Array.isArray(expected)){if(!Array.isArray(value))throw new Error('Expected a schedule at '+path);if(expected.length)for(const row of value)shape(row,expected[0],path+'[]');return}if(expected&&typeof expected==='object'){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid object at '+path);for(const[k,v]of Object.entries(expected))shape(value[k],v,path+'.'+k);return}if(typeof value!==typeof expected)throw new Error('Wrong value type at '+path)};shape(st,IMPORT_SHAPE,'project');
  for(const [k,v]of Object.entries(st.p))if(!validateInput('p',k,v))throw new Error('Invalid project field: '+k);
  for(const l of st.loads)if(!l||![l.kw,l.ef,l.pf,l.df].every(Number.isFinite)||l.kw<0||l.ef<=0||l.ef>1||l.pf<=0||l.pf>1||l.df<0||l.df>1||!['N','E','C'].includes(l.c))throw new Error('Invalid load row.');
  for(const [id,values]of Object.entries(st.v||{})){if(!values||typeof values!=='object')throw new Error('Invalid module inputs.');for(const[k,v]of Object.entries(values))if(!validateInput(id,k,v))throw new Error('Invalid '+id+' input: '+k)}
  for(const key of ['rooms','pipe','cold','deadleg','cabs','io','urs','acts','revs','aud','lib','fmea'])if(st[key]!==undefined&&!Array.isArray(st[key]))throw new Error('Expected a schedule array: '+key);
  return st;
}
function acceptProject(st){validProject(st);localStorage.setItem(K,JSON.stringify(st));location.reload();}
function validateEdit(t){
  const d=t.dataset,v=t.type==='number'?Number(t.value):t.value;
  if(t.type==='number'&&(!t.value.trim()||!Number.isFinite(v)))return false;
  if(d.k&&d.n==='1')return validateInput(d.s,d.k,v);
  if(d.ld!==undefined){if(['ef','pf'].includes(d.c))return v>0&&v<=1;if(d.c==='df')return v>=0&&v<=1;if(d.c==='kw')return v>=0;}
  if(t.type==='number'){
    const k=d.field||d.c||d.distribution||d.energy||d.rc||d.ec||d.dc||d.lt||d.dx;
    if(d.work==='instruments')return true;
    if(['reference','observed'].includes(k)||['T','Tin','t'].includes(k)&&d.co!==undefined||d.rm!==undefined&&['t','dp'].includes(k))return true;
    if(['qty','circuits'].includes(k))return v>=1&&Number.isInteger(v);
    if(['df','coincidence'].includes(k))return v>=0&&v<=1;
    if(['pf','ef','derating','uf','mf'].includes(k))return v>0&&v<=1;
    if(d.rm!==undefined&&['a','h','ach'].includes(k))return v>0;
    if(d.dn!==undefined&&['q','d','w','h'].includes(k))return v>0;
    if(d.dc!==undefined&&['vt','ar','vl','fl'].includes(k))return v>0;
    if(d.energy&&['kw','hours','tariff','base'].includes(k))return v>0;
    if(d.distribution&&['voltage','fault','time','drop'].includes(k))return v>0;
    if(d.register==='calibration'&&k==='tolerance')return v>0;
    if(['rn','cs','ce','length','L','D','ins','run','dt','hf','flow'].includes(k))return v>0;
    return v>=0;
  }
  return true;
}
document.addEventListener('change',e=>{
  const t=e.target,d=t.dataset;
  if(t.id==='pf'){e.stopImmediatePropagation();const f=t.files?.[0];if(!f)return;if(f.size>10000000){toast('Project file exceeds 10 MB.');return}const fr=new FileReader();fr.onload=()=>{try{acceptProject(JSON.parse(fr.result))}catch(x){toast('Import rejected: '+x.message)}};fr.readAsText(f);return;}
  if(!validateEdit(t)){e.stopImmediatePropagation();t.classList.add('invalid-input');t.setAttribute('aria-invalid','true');toast('Value rejected. Check range, units and positive denominators.');return;}
  let handled=true;
  if(d.work){const row=S.studio[d.work][+d.index];const old=row[d.field];row[d.field]=t.type==='number'?+t.value:t.value;if(d.work==='utilityDemand'&&d.field==='utility')row.unit=utilityUnits[t.value];log(d.work,d.field,old,row[d.field]);}
  else if(d.distribution){const old=S.studio.distribution[d.distribution];S.studio.distribution[d.distribution]=t.type==='number'?+t.value:t.value;log('distribution',d.distribution,old,S.studio.distribution[d.distribution]);}
  else if(d.draft){log('report',d.draft,S.studio.draft[d.draft],t.value);S.studio.draft[d.draft]=t.value;}
  else handled=false;
  if(handled){e.stopImmediatePropagation();save();render();toast('Saved in this browser');}
},true);
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.act==='revrestore'){try{validProject(JSON.parse(S.revs[+b.dataset.i].data))}catch(x){e.stopImmediatePropagation();toast('Revision rejected: '+x.message);return;}}
  if(b.dataset.act==='load'){e.stopImmediatePropagation();try{acceptProject(JSON.parse($('#js').value))}catch(x){toast('Import rejected: '+x.message)}return;}
  if(b.dataset.act==='printall'){e.stopImmediatePropagation();const selection=S.studio.reportTabs;S.studio.reportTabs=TABS.filter(([id])=>!['workflow','reports','dash','cust','drafts'].includes(id)).map(t=>t[0]);try{reportPrint()}finally{S.studio.reportTabs=selection;render()}return;}
  const a=b.dataset.workAction;if(!a)return;e.stopImmediatePropagation();const kind=b.dataset.kind;
  try{
    if(a==='add'){
      if(['internal','external'].includes(kind))S.studio[kind].push({tag:'DB-NEW',area:'New service',type:'Lighting',qty:12,watts:36,circuits:2,pf:.95,df:1,length:30,phase:'1',category:'N'});
      if(kind==='instruments')S.studio.instruments.push({tag:'NEW-01',service:'',lrv:0,urv:100,ma:12,unit:'',fail:'',drawing:''});
      if(kind==='utilityDemand')S.studio.utilityDemand.push({tag:'New consumer',utility:'PW',rate:1,qty:1,coincidence:1,unit:'m³/h'});
    }
    if(a==='remove')S.studio[kind].splice(+b.dataset.index,1);
    if(a==='sync-distribution')syncDistribution(kind);
    if(a==='sync-utility'){const u=utilitySummary();S.v.wtr=S.v.wtr||{};for(const[n,k]of [['PW','pd'],['WFI','wd'],['Clean steam','cd']])if(u[n]!==undefined)S.v.wtr[k]=u[n];}
    if(a==='estimate-sync'){
      S.est.q.cab=S.cabs.reduce((a,c)=>a+(c.procurement??c.len*c.rn*1.1),0);
      S.est.q.lum=S.rooms.reduce((a,r)=>a+Math.ceil((r.lux||(r.g==='CNC'?300:500))*r.a/(S.lt.fl*S.lt.uf*S.lt.mf)),0)+[...S.studio.internal,...S.studio.external].filter(r=>/lighting/i.test(r.type)).reduce((a,r)=>a+r.qty,0);
      S.est.q.io=ioTot().tot;
    }
    if(a==='draft-refresh')S.studio.draft.snapshot=makeDraftSnapshot();
    if(a==='draft-download'){downloadText(S.p.doc+'-draft.txt',draftText(),'text/plain;charset=utf-8');return;}
    if(a==='report-download'){downloadText(S.p.doc+'-draft-report.html',collectReportHTML(),'text/html;charset=utf-8');return;}
    if(a==='csv'){const rows=S.studio[kind].map(r=>['internal','external'].includes(kind)?{...r,...distributionCalc(r)}:r);exportRows(kind,rows);return;}
    if(a==='cable-csv'){exportRows('cable-schedule',cabRows().map(({c,r})=>({...c,selected_mm2:r.x?.s??'No size',current_A:r.x?.I??'',drop_percent:r.x?.vd??'',starting_drop_percent:r.x?.vs??''})));return;}
    log('workflow',a,'','updated');save();render();toast('Project updated in this browser');
  }catch(x){toast(x.message);}
},true);
function exportRows(name,rows){const keys=[...new Set(rows.flatMap(Object.keys))];const quote=x=>'"'+String(x??'').replace(/"/g,'""').replace(/^[=+@]/,"'$&")+'"';downloadText(name+'.csv','\uFEFF'+[keys,...rows.map(r=>keys.map(k=>r[k]))].map(r=>r.map(quote).join(',')).join('\r\n'),'text/csv;charset=utf-8');}

const previousRender=render;
render=function(){previousRender();const panel=$('#m');panel.innerHTML=`<div class="workspace-status"><span>Engineering workspace</span><span>DRAFT • Independent review required</span><span>${document.documentElement.dataset.save==='failed'?'Save failed — export project':'Browser-local project • export JSON for backup'}</span></div>`+panel.innerHTML;
  history.replaceState(null,'','#'+tab);document.title='PharmaEng · '+moduleName(tab);
};
const hash=location.hash.slice(1);if(TABS.some(t=>t[0]===hash))tab=hash;
document.querySelector('.side-brand span').textContent='DESIGN STUDY';
VT.push(
 {n:'4–20 mA scaling: 12 mA on 0–100 range equals 50',e:50,t:0,u:'abs',a:()=>scalingCalc({lrv:0,urv:100,ma:12}).value},
 {n:'Internal circuits: 24 × 36 W connected equals 0.864 kW',e:.864,t:.00001,u:'abs',a:()=>distributionCalc({qty:24,watts:36,circuits:3,pf:.95,df:1,length:35,phase:'1'}).connected},
 {n:'Circuits sized without demand diversity: 8 × 36 W / (230 V × 0.95)',e:288/(230*.95),t:.00001,u:'abs',a:()=>distributionCalc({qty:24,watts:36,circuits:3,pf:.95,df:.2,length:35,phase:'1'},{...S.studio.distribution,voltage:230}).current}
);
render();
