import React, { useEffect, useMemo, useState } from 'react';
import { formatMoney } from '../utils/helpers';

// Vista de prueba: ninguna acción de esta pantalla escribe en Firestore.
const KEY = 'controlcheque_cuentas_preview_v1';
const categories = [
  {value:'invoice',label:'Factura'}, {value:'cta2',label:'Cta 2'},
  {value:'cheque',label:'Cheque'}, {value:'transfer',label:'Transferencia'},
  {value:'cash',label:'Efectivo'}, {value:'other',label:'Otro'}
];
const customerTypes = ['General','Factura','Cta 2','Cheque','Transferencia','Efectivo','Otro'];
const empty = {clients:{},movements:[],edits:{},audit:[]};
const pesos = value => formatMoney(Number(value) || 0);
const normal = text => String(text || 'SIN CLIENTE').trim().replace(/\s+/g,' ').toLocaleUpperCase('es-AR');
const onlyDate = val => String(val || '').slice(0,10);
const showDate = val => {
  const d=onlyDate(val);
  if(!d) return 'Sin fecha';
  const parsed=new Date(d+'T12:00:00');
  return Number.isNaN(parsed.getTime())?'Sin fecha':parsed.toLocaleDateString('es-AR');
};
const today = () => new Date().toLocaleDateString('en-CA');
const id = () => 'prueba-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
const typeName = v => categories.find(c=>c.value===v)?.label || v || 'Comprobante';
function savedData() {
  try {
    const raw=JSON.parse(localStorage.getItem(KEY));
    return raw&&typeof raw==='object' ? {
      clients:raw.clients&&typeof raw.clients==='object'?raw.clients:{},
      movements:Array.isArray(raw.movements)?raw.movements:[],
      edits:raw.edits&&typeof raw.edits==='object'?raw.edits:{},
      audit:Array.isArray(raw.audit)?raw.audit:[]
    } : empty;
  } catch { return empty; }
}
function compileAccounts(items,store) {
  const accounts=new Map();
  const ensure = name => {
    const key=normal(name), given=String(name||'Sin cliente').trim();
    if(!accounts.has(key)) accounts.set(key,{key,name:given,documents:[],payments:[],ledger:[],unallocated:0});
    return accounts.get(key);
  };
  for(const original of items) {
    const edit=store.edits[original.id]||{};
    const row={...original,...edit};
    const client=ensure(row.payee);
    const amount=Math.max(0,Number(row.amount)||0);
    const paidRaw=Math.max(0,Number(original.paidAmount)||0);
    const paid=original.status==='paid' && !paidRaw ? amount : Math.min(amount,paidRaw);
    const paymentHistory=Array.isArray(original.paymentHistory)?original.paymentHistory:[];
    const reference=String(row.number||'').trim();
    const docId='real-'+original.id;
    const date=onlyDate(row.issueDate||row.dueDate);
    const dueDate=onlyDate(row.dueDate);
    const doc={
      id:docId, originalId:original.id, source:'real', client:client.name,
      subtype:row.subtype||'invoice',number:reference,description:row.description||'Comprobante a cobrar',
      date,dueDate,amount,paid,applied:[],pending:Math.max(0,amount-paid),status:row.status||'pending'
    };
    client.documents.push(doc);
    client.ledger.push({id:'cargo-'+docId,source:'real',docId,kind:'debit',date,dueDate,
      concept:doc.description,reference,subtype:doc.subtype,amount,editable:true,originalId:original.id});
    let accounted=0;
    paymentHistory.forEach((payment,i)=>{
      const value=Math.max(0,Number(payment.amount)||0);
      if(!value) return;
      accounted+=value;
      const paymentRow={
        id:'pago-real-'+original.id+'-'+i,source:'real',kind:'credit',
        date:onlyDate(payment.date),amount:value,docId,reference,
        method:payment.method||'',proof:payment.proof||'',
        concept:'Pago aplicado a '+typeName(doc.subtype)+(reference?' Nº '+reference:''),
        allocationLabel:typeName(doc.subtype)+(reference?' Nº '+reference:''),
        editable:false
      };
      doc.applied.push(paymentRow);
      client.payments.push(paymentRow);
      client.ledger.push(paymentRow);
    });
    if(paid>accounted+0.005) {
      const inferred={
        id:'pago-anterior-'+original.id,source:'legacy',kind:'credit',
        date:'',amount:paid-accounted,docId,reference,method:'',proof:'',
        concept:'Pago histórico registrado (fecha no informada)',
        allocationLabel:typeName(doc.subtype)+(reference?' Nº '+reference:''),
        editable:false
      };
      doc.applied.push(inferred);client.payments.push(inferred);client.ledger.push(inferred);
    }
  }
  for(const move of store.movements) {
    if(move.archivedAt) continue;
    const acc=ensure(move.client);
    const row={...move,source:'preview',editable:true};
    if(move.kind==='debit') {
      const doc={id:move.id,originalId:'',source:'preview',client:acc.name,
        subtype:move.subtype||'invoice',number:move.reference||'',description:move.description||'Comprobante de prueba',
        date:onlyDate(move.date),dueDate:onlyDate(move.dueDate),amount:Number(move.amount)||0,
        paid:0,applied:[],pending:Number(move.amount)||0,status:'pending'};
      acc.documents.push(doc);
      acc.ledger.push({id:'cargo-'+move.id,source:'preview',kind:'debit',docId:doc.id,
        date:doc.date,dueDate:doc.dueDate,concept:doc.description,reference:doc.number,
        subtype:doc.subtype,amount:doc.amount,editable:true,movementId:move.id});
    } else {
      const target=acc.documents.find(doc=>doc.id===move.docId);
      const reference=target?.number||move.reference||'';
      const allocationLabel=target?(typeName(target.subtype)+(reference?' Nº '+reference:'')):'Sin imputación a un comprobante';
      const payment={id:'credito-'+move.id,source:'preview',kind:'credit',date:onlyDate(move.date),
        docId:target?.id||'',amount:Number(move.amount)||0,reference,proof:'',
        method:move.subtype||'',concept:move.description||'Cobro de prueba',
        allocationLabel,editable:true,movementId:move.id};
      acc.ledger.push(payment);acc.payments.push(payment);
      if(target) {target.applied.push(payment);target.pending=Math.max(0,target.pending-payment.amount);}
      else acc.unallocated+=payment.amount;
    }
  }
  for(const [key,metadata] of Object.entries(store.clients)) {
    if(!accounts.has(key)) accounts.set(key,{key,name:metadata.name||key,documents:[],payments:[],ledger:[],unallocated:0});
  }
  return [...accounts.values()].map(acc=>{
    const metadata=store.clients[acc.key]||{};
    const documents=acc.documents.map(doc=>({...doc,pending:Math.max(0,doc.pending)}));
    const current=documents.filter(doc=>doc.pending>0.005).sort((a,b)=>{
      const aa=a.dueDate||a.date||'9999-12-31',bb=b.dueDate||b.date||'9999-12-31';
      return aa.localeCompare(bb)||a.number.localeCompare(b.number);
    });
    const pendingTotal=current.reduce((s,d)=>s+d.pending,0);
    const total=pendingTotal-acc.unallocated;
    let running=0;
    const ledger=[...acc.ledger].sort((a,b)=>(a.date||'9999-12-31').localeCompare(b.date||'9999-12-31')||a.id.localeCompare(b.id))
      .map(row=>{running+=row.kind==='debit'?row.amount:-row.amount;return {...row,running};});
    const overdue=current.filter(d=>d.dueDate&&d.dueDate<today());
    return {...acc,name:metadata.name||acc.name,accountType:metadata.accountType||'General',note:metadata.note||'',
      documents,current,pendingTotal,balance:total,overdue:overdue.length,
      ledger,hasUndatedPayments:ledger.some(l=>!l.date)};
  }).sort((a,b)=>b.balance-a.balance||a.name.localeCompare(b.name));
}

function DocumentCard({doc,onEdit}) {
  return <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 hover:border-slate-300 transition">
    <div className="flex flex-wrap gap-3 justify-between items-start">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap gap-2 items-center mb-2">
          <span className="text-[11px] tracking-wide font-black uppercase px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md">{typeName(doc.subtype)}</span>
          <span className="font-bold text-slate-800">{doc.number ? 'Nº '+doc.number : 'Sin número'}</span>
          {doc.source==='preview'&&<span className="text-[10px] font-black uppercase bg-amber-100 text-amber-800 px-2 py-1 rounded">Prueba</span>}
        </div>
        <p className="text-xs text-slate-500">{doc.description} · Emisión: {showDate(doc.date)} · Vence: {showDate(doc.dueDate)}</p>
      </div>
      <div className="text-right shrink-0"><p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Saldo pendiente</p><p className="text-xl font-black text-slate-900">{pesos(doc.pending)}</p><p className="text-[11px] text-slate-500">Original: {pesos(doc.amount)}</p></div>
    </div>
    {doc.applied.length>0&&<div className="mt-3 pt-3 border-t border-dashed border-slate-200">
      <div className="text-[11px] font-black uppercase tracking-wide text-emerald-800 mb-1">Pagos aplicados</div>
      {doc.applied.map(p=><p key={p.id} className="text-xs text-slate-600 py-0.5">
        <span className="font-bold text-emerald-700">{pesos(p.amount)}</span> · {showDate(p.date)}{p.method?' · '+typeName(p.method):''}
        <span className="block text-[11px] text-slate-500 pl-2 border-l-2 border-emerald-200 ml-1">Aplicado a: {p.allocationLabel}</span>
      </p>)}
    </div>}
    {onEdit&&<div className="mt-3"><button className="text-xs font-bold text-blue-700 hover:underline" onClick={()=>onEdit(doc)}>Editar comprobante (prueba)</button></div>}
  </div>;
}
function ledgerDateSort(a,b) {
  return (b.date||'').localeCompare(a.date||'')||b.id.localeCompare(a.id);
}
function htmlEscape(value) {return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));}
function buildPdfHTML(clients,from,to,isGlobal) {
  const all=clients.filter(c=>c.current.length>0 || c.unallocated>0.005);
  const css='<style>*{box-sizing:border-box}body{margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;color:#192637;font-size:11px}.brand{background:#103c3a;color:#fff;padding:24px 26px}.brand h1{font-size:22px;margin:0 0 7px}.brand p{margin:0;font-size:11px;color:#c5e7df}.section{padding:18px 24px;border-bottom:1px solid #dfe7e8;break-inside:avoid}.clienthead{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}.clienthead h2{font-size:16px;margin:0}.clienthead strong{font-size:15px;color:#075b4b}.doc{padding:11px 0;border-top:1px solid #e7eded;break-inside:avoid}.top{display:flex;justify-content:space-between;gap:14px}.docname{font-size:12px;font-weight:bold}.muted{color:#5c6d77;font-size:10px;margin-top:4px}.amount{font-size:12px;font-weight:bold;text-align:right;white-space:nowrap}.payment{font-size:10px;color:#17755f;padding:7px 0 1px 15px}.allocation{color:#51636c;font-size:10px;margin:2px 0 4px 26px;padding-left:7px;border-left:2px solid #a8d8ca}.foot{display:flex;justify-content:space-between;background:#f1f7f6;padding:11px 12px;margin-top:12px;font-weight:bold}.total{margin:22px 24px 12px;padding:15px 18px;background:#103c3a;color:white;display:flex;justify-content:space-between;font-size:16px}.legend{margin:0 24px 24px;color:#536570;font-size:10px}.no-pagebreak{break-inside:avoid}</style>';
  const body=all.map(client=>{
    const pending=client.current.filter(doc=>(!from||doc.date>=from||doc.dueDate>=from)&&(!to||doc.date<=to||doc.dueDate<=to));
    if(!pending.length) return '';
    const subtotal=pending.reduce((s,d)=>s+d.pending,0);
    return '<section class="section"><div class="clienthead"><h2>'+htmlEscape(client.name)+'</h2><strong>'+pesos(subtotal-client.unallocated)+'</strong></div><div class="muted">Tipo de cuenta: '+htmlEscape(client.accountType)+' · '+pending.length+' comprobante(s) pendiente(s)</div>'+
      pending.map(doc=>'<div class="doc"><div class="top"><div><div class="docname">'+htmlEscape(typeName(doc.subtype))+' '+(doc.number?'Nº '+htmlEscape(doc.number):'')+'</div><div class="muted">Emisión '+showDate(doc.date)+' · Vencimiento '+showDate(doc.dueDate)+' · Importe original '+pesos(doc.amount)+'</div></div><div class="amount">Pendiente '+pesos(doc.pending)+'</div></div>'+
        doc.applied.map(p=>'<div class="payment">Pago aplicado · '+showDate(p.date)+' · '+pesos(p.amount)+(p.method?' · '+htmlEscape(p.method):'')+'</div><div class="allocation">Aplicado a: '+htmlEscape(p.allocationLabel)+'</div>').join('')+
      '</div>').join('')+
      (client.unallocated>0?'<div class="muted">Créditos a favor sin imputar: -'+pesos(client.unallocated)+'</div>':'')+
      '<div class="foot"><span>Saldo pendiente</span><span>'+pesos(subtotal-client.unallocated)+'</span></div></section>';
  }).join('');
  const grand=all.reduce((s,c)=>s+c.current.filter(doc=>(!from||doc.date>=from||doc.dueDate>=from)&&(!to||doc.date<=to||doc.dueDate<=to)).reduce((a,d)=>a+d.pending,0)-c.unallocated,0);
  const title=isGlobal?'Resumen general de cuentas por cobrar':'Resumen de cuenta corriente';
  return css+'<div class="brand"><h1>SII PALLETS · '+title+'</h1><p>Fecha de emisión: '+showDate(today())+' · Período: '+(from?showDate(from):'Todos')+' al '+(to?showDate(to):'actual')+'</p></div>'+body+'<div class="total"><span>SALDO TOTAL PENDIENTE</span><span>'+pesos(grand)+'</span></div><p class="legend">Los pagos registrados se identifican debajo de su comprobante, sin inferir asignaciones no registradas. Documento generado desde versión de prueba. Los cambios de ensayo solo se guardan en el navegador.</p>';
}
export default function CuentasCobrarV2({items=[]}) {
  const [store,setStore]=useState(savedData);
  const [opened,setOpened]=useState('');
  const [view,setView]=useState('summary');
  const [search,setSearch]=useState('');
  const [from,setFrom]=useState('');
  const [to,setTo]=useState('');
  const [draft,setDraft]=useState(null);
  const [clientDraft,setClientDraft]=useState(null);
  const [auditVisible,setAuditVisible]=useState(false);
  const [olderVisible,setOlderVisible]=useState(false);
  const [notice,setNotice]=useState('');
  const [busy,setBusy]=useState(false);
  const clients=useMemo(()=>compileAccounts(items,store),[items,store]);
  const filtered=useMemo(()=>clients.filter(c=>(c.name+' '+c.accountType).toLocaleLowerCase('es-AR').includes(search.toLocaleLowerCase('es-AR'))),[clients,search]);
  const active=clients.find(c=>c.key===opened);
  const grand=clients.reduce((s,c)=>s+c.balance,0);
  const countPending=clients.reduce((s,c)=>s+c.current.length,0);
  useEffect(()=>{try {localStorage.setItem(KEY,JSON.stringify(store));}catch{setNotice('Error al guardar en este navegador.');}},[store]);
  function save(action,fn) {
    setStore(prev=>{const next=fn(prev);return {...next,audit:[{id:id(),action,at:new Date().toISOString()},...prev.audit].slice(0,300)};});
    setNotice('Guardado como ensayo en este navegador. Firebase no se modificó.');
  }
  function choose(key,detail=false) {setOpened(prev=>prev===key&&!detail?'':key);setView(detail?'detail':'summary');setOlderVisible(false);setFrom('');setTo('');}
  function openMovement(client='',kind='debit',original=null) {
    setDraft({id:'',originalId:'',client,kind,date:today(),dueDate:'',amount:'',description:'',reference:'',subtype:'invoice',docId:'',...(original||{})});
  }
  function editDocument(doc,acc) {
    openMovement(acc.name,'debit',{id:doc.source==='preview'?doc.id:'',originalId:doc.originalId||'',client:acc.name,
      kind:'debit',date:doc.date||today(),dueDate:doc.dueDate||'',amount:doc.amount,
      description:doc.description,reference:doc.number,subtype:doc.subtype,docId:''});
  }
  function saveMovement(event) {
    event.preventDefault();
    const name=String(draft.client||'').trim(), amount=Number(draft.amount);
    if(!name||!draft.date||!Number.isFinite(amount)||amount<=0) {setNotice('Completá cliente, fecha e importe válido.');return;}
    const payload={client:name,kind:draft.kind,date:draft.date,dueDate:draft.dueDate,amount,
      description:draft.description.trim(),reference:draft.reference.trim(),subtype:draft.subtype,docId:draft.docId||''};
    if(payload.kind==='credit'&&payload.docId) {
      const target=clients.find(c=>c.key===normal(name))?.current.find(d=>d.id===payload.docId);
      if(!target||amount>target.pending+0.005){setNotice('El pago no puede superar el saldo pendiente del comprobante.');return;}
    }
    if(draft.originalId) {
      save('Edición de prueba de documento '+draft.originalId,s=>({...s,edits:{...s.edits,[draft.originalId]:{
        payee:name,amount,issueDate:payload.date,dueDate:payload.dueDate,number:payload.reference,
        description:payload.description,subtype:payload.subtype}}}));
    } else if(draft.id) {
      save('Edición de movimiento de prueba',s=>({...s,movements:s.movements.map(m=>m.id===draft.id?{...m,...payload,updatedAt:new Date().toISOString()}:m)}));
    } else {
      save('Nuevo '+(payload.kind==='credit'?'Haber':'Debe')+' de prueba para '+name,s=>({
        ...s,movements:[...s.movements,{...payload,id:id(),createdAt:new Date().toISOString()}]}));
    }
    setDraft(null);setOpened(normal(name));setView('summary');
  }
  function undoMovement(row) {
    if(row.source!=='preview'||!row.movementId) return;
    if(!window.confirm('¿Anular este movimiento de prueba? Se conservará el registro de auditoría.')) return;
    save('Anulación de ensayo '+row.movementId,s=>({...s,movements:s.movements.map(m=>m.id===row.movementId?{...m,archivedAt:new Date().toISOString()}:m)}));
  }
  function saveClient(event) {
    event.preventDefault();
    const name=String(clientDraft.name||'').trim();
    if(!name) return;
    const key=clientDraft.originalKey||normal(name);
    if(!clientDraft.originalKey&&clients.some(c=>c.key===key)){setNotice('Ese cliente ya existe. Abrí su ficha para editarla.');return;}
    save('Ficha de cliente '+name,s=>({...s,clients:{...s.clients,[key]:{
      name,accountType:clientDraft.accountType,note:clientDraft.note}}}));
    setClientDraft(null);setOpened(key);
  }
  async function downloadPDF(customers,isGlobal=false) {
    if(!customers.length) {setNotice('No hay clientes seleccionados para exportar.');return;}
    setBusy(true);setNotice('');
    let el;
    try {
      const module=await import('html2pdf.js');
      const html2pdf=module.default;
      // HTML completo en DOM real: evita que html2canvas genere páginas en blanco
      // con elementos position:fixed desplazados fuera del viewport.
      el=document.createElement('div');
      el.innerHTML=buildPdfHTML(customers,from,to,isGlobal);
      Object.assign(el.style,{width:'794px',background:'#ffffff',color:'#192637',
        position:'fixed',top:'0',left:'0',zIndex:'-1',pointerEvents:'none'});
      document.body.appendChild(el);
      const filename=isGlobal?'Cuentas_por_cobrar_Resumen.pdf':'Cuenta_'+(customers[0].name||'cliente').replace(/[^a-z0-9áéíóúñ_-]/gi,'_')+'.pdf';
      await html2pdf().set({margin:7,filename,image:{type:'jpeg',quality:0.96},
        html2canvas:{scale:2,backgroundColor:'#ffffff',scrollX:0,scrollY:0},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
        pagebreak:{mode:['css','legacy']}}).from(el).save();
      setNotice('PDF de cuentas pendientes generado.');
    } catch(error) {
      console.error('Error generando PDF',error);
      setNotice('No se pudo descargar el PDF. Revisá permisos de descargas del navegador.');
    } finally {el?.remove();setBusy(false);}
  }
  function csvReport(client) {
    const rows=[['Cliente',client.name],['Tipo de cuenta',client.accountType],
      ['Documento','Emisión','Vencimiento','Importe original','Pagos aplicados','Saldo pendiente']];
    client.current.forEach(d=>rows.push([typeName(d.subtype)+' '+d.number,showDate(d.date),showDate(d.dueDate),
      d.amount,d.applied.reduce((s,p)=>s+p.amount,0),d.pending]));
    rows.push(['SALDO TOTAL','','','','',client.balance]);
    const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
    const el=document.createElement('a');el.href=url;el.download='Cuenta_'+client.name.replace(/[^a-z0-9áéíóúñ_-]/gi,'_')+'.csv';
    document.body.appendChild(el);el.click();el.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  const input='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100';
  return <main className="min-h-screen bg-[#f5f7fa] text-slate-800">
    <div className="bg-[#102e38] text-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-7">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div><p className="text-[11px] font-semibold tracking-[.18em] uppercase text-teal-200">SII Pallets · Área financiera</p>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">Cuentas por cobrar</h1>
            <p className="text-sm text-slate-300 mt-1">Cartera de clientes, comprobantes y saldos actualizados</p></div>
          <span className="rounded-full px-3 py-1.5 text-xs font-extrabold bg-amber-100 text-amber-950">● ENTORNO DE PRUEBA</span>
        </div>
      </div>
    </div>
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-950 mb-6">
        <strong>Vista previa protegida:</strong> muestra los movimientos actuales, pero cualquier alta, modificación o imputación de prueba se guarda solo en este navegador. No se escribe en Firebase.
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm"><p className="text-xs text-slate-500 font-semibold">Saldo a cobrar</p><p className="text-xl sm:text-2xl font-black mt-1 text-teal-800">{pesos(grand)}</p></div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm"><p className="text-xs text-slate-500 font-semibold">Clientes</p><p className="text-2xl font-black mt-1">{clients.length}</p></div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm col-span-2 sm:col-span-1"><p className="text-xs text-slate-500 font-semibold">Comprobantes pendientes</p><p className="text-2xl font-black mt-1">{countPending}</p></div>
      </div>
      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <div><h2 className="text-xl font-black tracking-tight">Cartera de clientes</h2><p className="text-xs text-slate-500 mt-0.5">{filtered.length} clientes · Seleccioná uno para ver sus comprobantes</p></div>
        <div className="flex gap-2 flex-wrap">
          <button className="bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-slate-50" onClick={()=>setClientDraft({name:'',accountType:'General',note:'',originalKey:''})}>+ Cliente</button>
          <button className="bg-teal-700 text-white rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-teal-800" onClick={()=>openMovement()}>+ Movimiento</button>
          <button disabled={busy} className="bg-[#123541] text-white rounded-xl px-3 py-2.5 text-sm font-bold hover:bg-slate-800 disabled:opacity-50" onClick={()=>downloadPDF(clients,true)}>{busy?'Generando…':'↓ PDF general'}</button>
        </div>
      </div>
      <div className="relative mb-5"><input value={search} onChange={e=>setSearch(e.target.value)} className={input+' !bg-white !py-3.5 pl-4 shadow-sm'} placeholder="Buscar cliente por nombre o tipo de cuenta..." /></div>
      <div className="space-y-3">
        {filtered.map(client=>{
          const isOpen=opened===client.key;
          const ledgerRows=[...client.ledger].sort(ledgerDateSort);
          const currentDocIds=new Set(client.current.map(d=>d.id));
          const recentLines=ledgerRows.filter(l=>currentDocIds.has(l.docId));
          const otherLines=ledgerRows.filter(l=>!currentDocIds.has(l.docId));
          return <article key={client.key} className={'rounded-2xl border bg-white shadow-sm overflow-hidden transition '+(isOpen?'border-teal-500 ring-1 ring-teal-100':'border-slate-200 hover:border-slate-300')}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 sm:py-5">
              <button className="flex-1 min-w-0 text-left" onClick={()=>choose(client.key)}>
                <div className="flex gap-3 items-center">
                  <div className="bg-teal-50 text-teal-800 w-11 h-11 rounded-xl shrink-0 flex items-center justify-center font-black text-base">{client.name.trim().slice(0,1).toUpperCase()}</div>
                  <div className="min-w-0"><p className="font-black text-base sm:text-lg break-words">{client.name}</p><div className="flex flex-wrap gap-2 items-center mt-1 text-xs text-slate-500">
                    <span className="bg-slate-100 rounded-md px-2 py-0.5 font-semibold text-slate-600">{client.accountType}</span>
                    <span>{client.current.length} pendientes</span>
                    {client.overdue>0&&<span className="text-red-700 font-bold">{client.overdue} vencidos</span>}
                  </div></div>
                </div>
              </button>
              <div className="flex flex-wrap items-center gap-3 justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                <div className="text-left sm:text-right"><p className="text-[10px] tracking-wide uppercase text-slate-500 font-bold">Saldo pendiente</p><p className="text-xl sm:text-2xl font-black text-teal-800">{pesos(client.balance)}</p></div>
                <button className="bg-teal-50 border border-teal-100 hover:bg-teal-100 text-teal-800 font-bold text-xs rounded-lg px-3.5 py-2.5" onClick={()=>choose(client.key,false)}>{isOpen?'Cerrar':'Ver resumen'} <span className="ml-1">{isOpen?'⌃':'⌄'}</span></button>
              </div>
            </div>
            {isOpen&&<div className="border-t border-slate-200 bg-[#fbfcfd]">
              <div className="px-4 sm:px-6 py-4 flex flex-wrap gap-3 items-center justify-between">
                <div className="inline-flex gap-1 rounded-xl p-1 bg-slate-100 text-xs sm:text-sm font-bold">
                  <button className={'px-4 py-2 rounded-lg '+(view==='summary'?'bg-white shadow text-slate-900':'text-slate-500')} onClick={()=>setView('summary')}>Resumen</button>
                  <button className={'px-4 py-2 rounded-lg '+(view==='detail'?'bg-white shadow text-slate-900':'text-slate-500')} onClick={()=>setView('detail')}>Ver detalle</button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="border border-slate-200 bg-white text-slate-700 text-xs font-bold px-3 py-2.5 rounded-lg" onClick={()=>setClientDraft({originalKey:client.key,name:client.name,accountType:client.accountType,note:client.note})}>Editar cliente</button>
                  <button disabled={busy} className="border border-teal-200 bg-teal-50 text-teal-800 text-xs font-bold px-3 py-2.5 rounded-lg disabled:opacity-50" onClick={()=>downloadPDF([client])}>↓ PDF resumen</button>
                </div>
              </div>
              {view==='summary'?<div className="px-4 sm:px-6 pb-5">
                <div className="flex justify-between items-center gap-2 mb-3"><h3 className="font-black text-sm">Comprobantes pendientes de cobro</h3><span className="text-xs text-slate-500">{client.current.length} pendientes</span></div>
                <div className="space-y-2">
                  {client.current.map(doc=><DocumentCard key={doc.id} doc={doc}/>)}
                  {!client.current.length&&<div className="p-6 bg-white rounded-xl border text-center text-sm text-slate-500">Sin comprobantes pendientes de cobro.</div>}
                </div>
                {client.unallocated>0&&<div className="flex justify-between text-xs text-slate-600 mt-3"><span>Pagos a favor sin imputar</span><strong>-{pesos(client.unallocated)}</strong></div>}
                <div className="mt-3 bg-[#123c3c] text-white rounded-xl px-4 py-4 flex items-center justify-between"><strong className="text-sm">SALDO TOTAL PENDIENTE</strong><strong className="text-xl">{pesos(client.balance)}</strong></div>
                <button onClick={()=>setView('detail')} className="mt-3 w-full rounded-xl border border-teal-200 bg-white p-3 text-sm text-teal-800 font-bold hover:bg-teal-50">Ver detalle de movimientos y pagos →</button>
              </div>:<div className="px-4 sm:px-6 pb-5">
                <div className="flex flex-wrap gap-3 items-end justify-between mb-4">
                  <div><h3 className="font-black text-base">Detalle de cuenta</h3><p className="text-xs text-slate-500">Primero los saldos actuales; debajo, movimientos y pagos aplicados</p></div>
                  <div className="flex gap-2"><button onClick={()=>openMovement(client.name,'debit')} className="border border-slate-200 bg-white rounded-lg px-3 py-2 text-xs font-bold">+ Debe</button><button onClick={()=>openMovement(client.name,'credit')} className="bg-teal-700 text-white rounded-lg px-3 py-2 text-xs font-bold">+ Haber</button></div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="rounded-xl border bg-white p-3"><p className="text-[10px] uppercase text-slate-500">Debe total</p><p className="font-black text-xs sm:text-lg mt-1">{pesos(client.ledger.filter(l=>l.kind==='debit').reduce((s,l)=>s+l.amount,0))}</p></div>
                  <div className="rounded-xl border bg-white p-3"><p className="text-[10px] uppercase text-slate-500">Haber total</p><p className="font-black text-xs sm:text-lg mt-1">{pesos(client.ledger.filter(l=>l.kind==='credit').reduce((s,l)=>s+l.amount,0))}</p></div>
                  <div className="rounded-xl border border-teal-200 bg-teal-50 p-3"><p className="text-[10px] uppercase text-teal-900">Saldo actual</p><p className="font-black text-teal-900 text-xs sm:text-lg mt-1">{pesos(client.balance)}</p></div>
                </div>
                <h4 className="font-black text-sm mb-2">01. Documentos actuales / pendientes</h4>
                <div className="space-y-2 mb-5">{client.current.map(doc=><DocumentCard key={doc.id} doc={doc} onEdit={d=>editDocument(d,client)}/>)}
                  {!client.current.length&&<p className="p-5 border bg-white rounded-xl text-sm text-slate-500">Sin documentos pendientes.</p>}</div>
                <div className="border-t pt-4">
                  <div className="flex justify-between gap-2 flex-wrap items-center mb-3"><h4 className="font-black text-sm">02. Movimientos y pagos de documentos actuales</h4><button onClick={()=>csvReport(client)} className="text-xs text-teal-800 font-bold underline">Exportar CSV</button></div>
                  <div className="overflow-x-auto bg-white border rounded-xl mb-4"><table className="min-w-[660px] w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600"><tr><th className="p-3 text-left">Fecha</th><th className="p-3 text-left">Concepto / Documento</th><th className="p-3 text-right">Debe</th><th className="p-3 text-right">Haber</th><th className="p-3 text-right">Saldo acumulado</th><th className="p-3">Acciones</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">{recentLines.map(line=><tr key={line.id}><td className="p-3 whitespace-nowrap">{showDate(line.date)}</td><td className="p-3"><p className="font-semibold">{line.concept}</p><p className="text-slate-500 mt-1">{line.reference?'Nº '+line.reference+' · ':''}{line.kind==='credit'?'Aplicado a: '+line.allocationLabel:typeName(line.subtype)}</p></td><td className="p-3 text-right font-semibold">{line.kind==='debit'?pesos(line.amount):'—'}</td><td className="p-3 text-right text-teal-700 font-semibold">{line.kind==='credit'?pesos(line.amount):'—'}</td><td className="p-3 text-right font-black">{pesos(line.running)}</td><td className="p-3 text-center">{line.source==='preview'&&line.movementId&&<button onClick={()=>undoMovement(line)} className="text-red-700 font-bold">Anular</button>}</td></tr>)}
                      {!recentLines.length&&<tr><td colSpan="6" className="p-5 text-slate-500 text-center">Sin movimientos actuales.</td></tr>}</tbody>
                  </table></div>
                  <button className="w-full flex items-center justify-between px-4 py-3 bg-white border rounded-xl text-sm font-bold hover:bg-slate-50" onClick={()=>setOlderVisible(v=>!v)}>
                    <span>03. Historial completo / movimientos anteriores ({otherLines.length})</span><span>{olderVisible?'Ocultar −':'Mostrar +'}</span></button>
                  {olderVisible&&<div className="mt-2 bg-white border rounded-xl overflow-x-auto">
                    <div className="p-3 flex flex-wrap gap-2 items-end border-b bg-slate-50">
                      <label className="text-[11px] font-semibold">Desde<input type="date" className={input+' mt-1'} value={from} onChange={e=>setFrom(e.target.value)}/></label>
                      <label className="text-[11px] font-semibold">Hasta<input type="date" className={input+' mt-1'} value={to} onChange={e=>setTo(e.target.value)}/></label>
                      <button onClick={()=>{setFrom('');setTo('')}} className="text-xs px-3 py-2 border rounded-lg bg-white">Limpiar</button>
                    </div>
                    <table className="min-w-[660px] w-full text-xs"><thead className="bg-slate-100"><tr><th className="text-left p-3">Fecha</th><th className="text-left p-3">Detalle</th><th className="text-right p-3">Debe</th><th className="text-right p-3">Haber</th><th className="text-right p-3">Saldo acumulado</th><th className="p-3">Acción</th></tr></thead>
                      <tbody className="divide-y">{otherLines.filter(l=>(!from||(l.date&&l.date>=from))&&(!to||(l.date&&l.date<=to))).map(l=><tr key={l.id}><td className="p-3">{showDate(l.date)}</td><td className="p-3"><p className="font-semibold">{l.concept}</p><p className="text-slate-500">{l.kind==='credit'?'Aplicado a: '+l.allocationLabel:typeName(l.subtype)}</p></td><td className="p-3 text-right">{l.kind==='debit'?pesos(l.amount):'—'}</td><td className="p-3 text-right">{l.kind==='credit'?pesos(l.amount):'—'}</td><td className="p-3 text-right font-black">{pesos(l.running)}</td><td className="p-3">{l.source==='preview'&&l.movementId&&<button onClick={()=>undoMovement(l)} className="text-red-700">Anular</button>}</td></tr>)}</tbody></table>
                  </div>}
                  {client.hasUndatedPayments&&<p className="mt-3 bg-amber-50 rounded-lg p-3 text-xs text-amber-800">Algunos pagos históricos no tienen fecha guardada; se muestran como «Sin fecha» y no se les asigna una fecha inventada.</p>}
                </div>
              </div>}
            </div>}
          </article>;
        })}
        {!filtered.length&&<div className="bg-white border rounded-xl p-8 text-center text-slate-500">No hay clientes que coincidan con la búsqueda.</div>}
      </div>
      <div className="mt-5 flex flex-wrap gap-3 justify-between text-xs text-slate-500">
        <span role="status">{notice||'Todos los cambios hechos aquí son ensayos locales.'}</span>
        <button className="text-teal-900 underline font-semibold" onClick={()=>setAuditVisible(v=>!v)}>{auditVisible?'Ocultar':'Ver'} auditoría de prueba ({store.audit.length})</button>
      </div>
      {auditVisible&&<div className="mt-3 bg-white rounded-xl border p-4 text-xs max-h-56 overflow-auto">{store.audit.length?store.audit.map(a=><p className="py-2 border-b" key={a.id}>{showDate(a.at)} · {a.action}</p>):'Sin cambios de prueba.'}</div>}
    </div>
    {draft&&<div className="fixed inset-0 z-50 bg-slate-900/60 overflow-y-auto flex justify-center items-start p-4 sm:p-8">
      <form className="bg-white w-full max-w-xl rounded-2xl p-5 sm:p-7 shadow-2xl" onSubmit={saveMovement}>
        <div className="flex items-center justify-between mb-5"><h3 className="text-lg font-black">{draft.id||draft.originalId?'Editar':'Nuevo'} movimiento · Prueba</h3><button type="button" className="text-2xl" onClick={()=>setDraft(null)}>×</button></div>
        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-xs font-semibold">Cliente<input className={input+' mt-1'} required list="clientes-cuentas" value={draft.client} onChange={e=>setDraft({...draft,client:e.target.value,docId:''})}/><datalist id="clientes-cuentas">{clients.map(c=><option value={c.name} key={c.key}/>)}</datalist></label>
          <label className="text-xs font-semibold">Tipo de comprobante<select className={input+' mt-1'} value={draft.subtype} onChange={e=>setDraft({...draft,subtype:e.target.value})}>{categories.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
          {!draft.originalId&&<label className="text-xs font-semibold">Tipo de movimiento<select className={input+' mt-1'} value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value,docId:''})}><option value="debit">Debe · Nuevo cargo</option><option value="credit">Haber · Pago</option></select></label>}
          <label className="text-xs font-semibold">Importe<input className={input+' mt-1'} required type="number" min="0.01" step="0.01" value={draft.amount} onChange={e=>setDraft({...draft,amount:e.target.value})}/></label>
          <label className="text-xs font-semibold">Fecha<input className={input+' mt-1'} required type="date" value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>
          <label className="text-xs font-semibold">Vencimiento<input className={input+' mt-1'} type="date" value={draft.dueDate} onChange={e=>setDraft({...draft,dueDate:e.target.value})}/></label>
          {draft.kind==='credit'&&!draft.originalId&&<label className="text-xs font-semibold sm:col-span-2">Aplicar a documento<select className={input+' mt-1'} value={draft.docId} onChange={e=>setDraft({...draft,docId:e.target.value})}><option value="">Sin imputación (pago a cuenta)</option>{clients.find(c=>c.key===normal(draft.client))?.current.map(d=><option key={d.id} value={d.id}>{typeName(d.subtype)} {d.number} · pendiente {pesos(d.pending)}</option>)}</select></label>}
          <label className="text-xs font-semibold sm:col-span-2">Detalle<input className={input+' mt-1'} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
          <label className="text-xs font-semibold sm:col-span-2">Nº / Referencia<input className={input+' mt-1'} value={draft.reference} onChange={e=>setDraft({...draft,reference:e.target.value})}/></label>
        </div>
        <p className="text-xs bg-amber-50 text-amber-800 rounded-lg p-3 mt-4">El cambio se guarda únicamente en este navegador, sin modificar registros existentes de Firebase.</p>
        <div className="flex justify-end gap-2 mt-5"><button type="button" className="border rounded-lg px-4 py-2" onClick={()=>setDraft(null)}>Cancelar</button><button className="bg-teal-700 text-white rounded-lg px-5 py-2 font-bold">Guardar ensayo</button></div>
      </form>
    </div>}
    {clientDraft&&<div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-3"><form onSubmit={saveClient} className="bg-white p-6 w-full max-w-md rounded-2xl shadow-2xl">
      <div className="flex justify-between items-center"><h3 className="text-lg font-black">Ficha de cliente · Prueba</h3><button type="button" className="text-2xl" onClick={()=>setClientDraft(null)}>×</button></div>
      <label className="text-xs font-bold block mt-4">Nombre<input required className={input+' mt-1'} value={clientDraft.name} onChange={e=>setClientDraft({...clientDraft,name:e.target.value})}/></label>
      <label className="text-xs font-bold block mt-3">Tipo de cuenta<select className={input+' mt-1'} value={clientDraft.accountType} onChange={e=>setClientDraft({...clientDraft,accountType:e.target.value})}>{customerTypes.map(t=><option key={t}>{t}</option>)}</select></label>
      <label className="text-xs font-bold block mt-3">Observaciones<input className={input+' mt-1'} value={clientDraft.note} onChange={e=>setClientDraft({...clientDraft,note:e.target.value})}/></label>
      <div className="flex justify-end gap-2 mt-5"><button type="button" className="border rounded-lg px-4 py-2" onClick={()=>setClientDraft(null)}>Cancelar</button><button className="bg-teal-700 text-white rounded-lg px-5 py-2 font-bold">Guardar prueba</button></div>
    </form></div>}
  </main>;
}
