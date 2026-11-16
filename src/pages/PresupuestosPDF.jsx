import React, {useMemo,useState} from 'react';
import { LOGO_PRESUPUESTO } from '../assets/logoPresupuesto';
import {
  EMISOR,ITEM_VACIO,COTIZACION_INICIO,numeroCotizacion,fechaHoyLocal,
  fechaAR,calcularPresupuesto,validarPresupuesto,pesosPDF
} from '../utils/presupuestosSii';
import {generarPdfPresupuesto,descargarPdf} from '../utils/generarPdfPresupuesto';

const SERIE_KEY='sii_presupuesto_pdf_correlativo_v1';
const getSequence=()=>{
  try{
    const n=Number(localStorage.getItem(SERIE_KEY));
    return Number.isSafeInteger(n)&&n>=COTIZACION_INICIO?n:COTIZACION_INICIO;
  }catch{return COTIZACION_INICIO;}
};
const initial=()=>({
  numero:numeroCotizacion(getSequence()),fecha:fechaHoyLocal(),cuenta:'1',
  cliente:{razonSocial:'',cuit:'',domicilio:'',condicionIVA:'Responsable Inscripto',telefono:'',email:''},
  items:[ITEM_VACIO()]
});
const input='block w-full border border-slate-200 rounded-xl px-3 py-2.5 bg-white text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400';
const label='block text-xs font-bold text-slate-600 mb-1';
const peso = n => pesosPDF(n);
const userNotice='La numeración se guarda en este dispositivo. Si emitís presupuestos desde varios equipos, verificá manualmente que no se repita.';
export default function PresupuestosPDF() {
  const [quote,setQuote]=useState(initial);
  const [busy,setBusy]=useState('');
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [showPreview,setShowPreview]=useState(true);
  const totals=useMemo(()=>{
    try{return {data:calcularPresupuesto(quote),error:''};}
    catch(e){return {data:null,error:e.message};}
  },[quote]);
  const setCustomer=(key,value)=>setQuote(q=>({...q,cliente:{...q.cliente,[key]:value}}));
  const updateLine=(id,key,value)=>setQuote(q=>({...q,items:q.items.map(i=>i.id===id?{...i,[key]:value}:i)}));
  const addLine=()=>setQuote(q=>({...q,items:[...q.items,ITEM_VACIO()]}));
  const deleteLine=id=>setQuote(q=>({...q,items:q.items.length>1?q.items.filter(i=>i.id!==id):[ITEM_VACIO()]}));
  const recordNumber=()=> {
    const match=quote.numero.match(/^0005-(\d{8})$/);
    if(!match)return;
    const next=Number(match[1])+1;
    if(next>getSequence()) {
      try {localStorage.setItem(SERIE_KEY,String(next));}catch{/* Storage opcional */}
    }
  };
  const newQuote=()=>{
    const n=Math.max(getSequence(),Number(quote.numero?.split('-')[1]) + 1 || COTIZACION_INICIO);
    try {localStorage.setItem(SERIE_KEY,String(n));}catch{/* Storage opcional */}
    setQuote({...initial(),numero:numeroCotizacion(n)});
    setError('');setNotice('Nuevo presupuesto listo.');
  };
  const run=async(action)=>{
    if(busy)return;
    setError('');setNotice('');
    try {
      validarPresupuesto(quote);
      setBusy(action);
      const {blob,filename}=await generarPdfPresupuesto(quote);
      if(action==='download'){
        descargarPdf(blob,filename);
        recordNumber();
        setNotice('PDF generado. Podés compartir el archivo por WhatsApp o correo.');
      }else if(action==='share'){
        const file=new File([blob],filename,{type:'application/pdf'});
        if(navigator.share && (!navigator.canShare || navigator.canShare({files:[file]}))){
          try{
            await navigator.share({title:'Presupuesto SII PALLETS',text:'Adjunto presupuesto comercial.',files:[file]});
            recordNumber();
            setNotice('Se abrió la opción de compartir el PDF.');
          }catch(err){
            if(err?.name==='AbortError'){setNotice('Compartir cancelado. El presupuesto sigue disponible.');}
            else throw err;
          }
        }else{
          descargarPdf(blob,filename);
          recordNumber();
          setNotice('El dispositivo no admite compartir PDFs directamente. Se descargó el archivo: adjuntalo desde WhatsApp o tu correo.');
        }
      }
    }catch(err){setError(err?.message||'No se pudo generar el presupuesto.');}
    finally{setBusy('');}
  };

  return <div className="animate-fade-in mx-auto max-w-[1700px] space-y-4">
    <div className="flex items-center justify-between flex-wrap gap-2">
      <div>
        <h2 className="text-2xl sm:text-3xl font-black text-slate-800">Presupuestos</h2>
        <p className="text-sm text-slate-500 mt-1">Generá presupuestos en PDF con el formato comercial de SII PALLETS.</p>
      </div>
      <button type="button" onClick={newQuote} className="px-4 py-2.5 rounded-xl border border-blue-200 text-blue-800 bg-white font-bold text-sm hover:bg-blue-50">+ Nuevo presupuesto</button>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 items-start">
      <section className="space-y-4 min-w-0">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3"><h3 className="font-extrabold text-slate-800">1. Datos del presupuesto</h3><span className="text-[11px] text-slate-500">Datos del emisor fijos</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label><span className={label}>N° de presupuesto</span><input className={input} value={quote.numero} onChange={e=>setQuote(q=>({...q,numero:e.target.value}))} placeholder="0005-00000502" maxLength={13}/></label>
            <label><span className={label}>Fecha de emisión</span><input className={input} type="date" value={quote.fecha} onChange={e=>setQuote(q=>({...q,fecha:e.target.value}))}/></label>
          </div>
          <p className="text-[11px] text-slate-500">{userNotice}</p>
          <div className="pt-3 border-t border-slate-100">
            <p className="font-bold text-sm text-slate-800 mb-3">Cuenta aplicable</p>
            <div className="grid grid-cols-2 gap-2">
              {[{id:'1',label:'Cuenta 1',detail:'Con IVA 21 %'},{id:'2',label:'Cuenta 2',detail:'Sin IVA'}].map(option=>
                <label key={option.id} className={'flex items-start gap-2 rounded-xl border-2 p-3 cursor-pointer '+(quote.cuenta===option.id?'border-blue-600 bg-blue-50':'border-slate-200 bg-white')}>
                  <input type="radio" name="presupuesto-cuenta" className="mt-1 accent-blue-700" checked={quote.cuenta===option.id} onChange={()=>setQuote(q=>({...q,cuenta:option.id}))}/>
                  <span><strong className="block text-sm text-slate-800">{option.label}</strong><span className="text-xs text-slate-500">{option.detail}</span></span>
                </label>)}
            </div>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <h3 className="font-extrabold text-slate-800">2. Datos del cliente</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="sm:col-span-2"><span className={label}>Razón social / Nombre *</span><input className={input} value={quote.cliente.razonSocial} onChange={e=>setCustomer('razonSocial',e.target.value)} placeholder="Nombre o empresa cliente"/></label>
            <label><span className={label}>CUIT / DNI</span><input className={input} value={quote.cliente.cuit} onChange={e=>setCustomer('cuit',e.target.value)} placeholder="Número de identificación"/></label>
            <label><span className={label}>Condición frente al IVA</span><select className={input} value={quote.cliente.condicionIVA} onChange={e=>setCustomer('condicionIVA',e.target.value)}>
              {['Responsable Inscripto','Monotributista','Consumidor Final','Exento','No especificado'].map(t=><option key={t} value={t}>{t}</option>)}
            </select></label>
            <label className="sm:col-span-2"><span className={label}>Domicilio</span><input className={input} value={quote.cliente.domicilio} onChange={e=>setCustomer('domicilio',e.target.value)} placeholder="Calle, número, localidad"/></label>
            <label><span className={label}>Teléfono (opcional)</span><input className={input} inputMode="tel" value={quote.cliente.telefono} onChange={e=>setCustomer('telefono',e.target.value)}/></label>
            <label><span className={label}>Correo (opcional)</span><input className={input} type="email" value={quote.cliente.email} onChange={e=>setCustomer('email',e.target.value)} placeholder="cliente@empresa.com"/></label>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2"><h3 className="font-extrabold text-slate-800">3. Productos e ítems</h3><button type="button" onClick={addLine} disabled={quote.items.length>=100} className="rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-xs font-bold px-3 py-2">+ Agregar ítem</button></div>
          <p className="text-xs text-slate-500">Ingresá el precio unitario antes de IVA. La cantidad y el precio determinan el subtotal del renglón.</p>
          <div className="space-y-3">
            {quote.items.map((row,index)=><div key={row.id} className="border border-slate-200 rounded-xl p-3 space-y-3 bg-slate-50">
              <div className="flex justify-between items-center"><p className="text-xs font-bold text-slate-700">Ítem {index+1}</p><button type="button" className="text-xs font-bold text-rose-600 hover:underline" onClick={()=>deleteLine(row.id)}>Quitar</button></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label><span className={label}>Código</span><input className={input} placeholder={String(index+1).padStart(4,'0')} value={row.codigo} onChange={e=>updateLine(row.id,'codigo',e.target.value)}/></label>
                <label className="sm:col-span-2"><span className={label}>Descripción *</span><input className={input} placeholder="Pallet de madera..." value={row.descripcion} onChange={e=>updateLine(row.id,'descripcion',e.target.value)}/></label>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <label><span className={label}>Unidades *</span><input className={input} type="number" inputMode="decimal" min=".001" step="any" value={row.cantidad} onChange={e=>updateLine(row.id,'cantidad',e.target.value)}/></label>
                <label><span className={label}>Bultos</span><input className={input} type="number" inputMode="decimal" min="0" step="any" value={row.bultos} onChange={e=>updateLine(row.id,'bultos',e.target.value)}/></label>
                <label className="col-span-2"><span className={label}>Precio unitario ($) *</span><input className={input} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0,00" value={row.precioUnitario} onChange={e=>updateLine(row.id,'precioUnitario',e.target.value)}/></label>
              </div>
              <div className="text-right text-sm font-bold text-slate-800">Subtotal: {totals.data?.lineas.find(x=>x.id===row.id) ? peso(totals.data.lineas.find(x=>x.id===row.id).subtotalCentavos) : '—'}</div>
            </div>)}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm">
          <div className="flex justify-between gap-3 text-sm mb-2"><span>Subtotal</span><strong>{totals.data?peso(totals.data.subtotalCentavos):'—'}</strong></div>
          {quote.cuenta==='1'&&<div className="flex justify-between gap-3 text-sm mb-2"><span>IVA 21 %</span><strong>{totals.data?peso(totals.data.ivaCentavos):'—'}</strong></div>}
          <div className="flex items-center justify-between gap-3 border-t pt-3"><span className="font-bold text-slate-900">TOTAL</span><strong className="text-2xl text-blue-800">{totals.data?peso(totals.data.totalCentavos):'—'}</strong></div>
          {error&&<p role="alert" className="text-xs mt-3 rounded-lg bg-rose-50 text-rose-700 p-2">{error}</p>}
          {notice&&<p role="status" className="text-xs mt-3 rounded-lg bg-emerald-50 text-emerald-800 p-2">{notice}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4">
            <button type="button" onClick={()=>run('download')} disabled={!!busy} className="rounded-xl px-4 py-3 bg-blue-800 hover:bg-blue-900 disabled:opacity-40 text-white font-bold text-sm">{busy==='download'?'Generando…':'Descargar PDF'}</button>
            <button type="button" onClick={()=>run('share')} disabled={!!busy} className="rounded-xl px-4 py-3 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white font-bold text-sm">{busy==='share'?'Preparando…':'Compartir PDF'}</button>
          </div>
          <p className="text-[11px] text-slate-500 mt-3">En celulares compatibles, «Compartir PDF» abre el menú del dispositivo para elegir WhatsApp, correo u otra app. Si no admite adjuntar archivos, descargá el PDF y adjuntalo manualmente.</p>
        </div>
      </section>

      <section className="min-w-0 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden xl:sticky xl:top-3">
        <div className="flex justify-between items-center gap-2 px-4 py-3 border-b">
          <h3 className="font-bold text-slate-800">Vista previa del presupuesto</h3>
          <button type="button" onClick={()=>setShowPreview(v=>!v)} className="text-xs font-bold text-blue-800">{showPreview?'Ocultar':'Mostrar'}</button>
        </div>
        {showPreview&&<div className="overflow-x-auto p-3 bg-slate-100">
          <div className="bg-white mx-auto shadow-sm border border-slate-600 text-slate-800" style={{minWidth:650,maxWidth:790,aspectRatio:'210 / 297'}}>
            <div className="text-center border-b border-slate-700 font-bold text-[10px] py-1">ORIGINAL</div>
            <div className="grid grid-cols-2 border-b border-slate-700">
              <div className="border-r border-slate-700 p-2">
                <div className="flex items-center gap-2 mb-3">
                  <img src={LOGO_PRESUPUESTO} className="h-[72px] w-[72px] object-contain" alt="Logo actual de SII PALLETS"/>
                  <span className="text-[10px] font-black text-center flex-1 leading-4">SOLUCIONES INDUSTRIALES<br/>INTEGRALES EN PALLETS</span>
                </div>
                <div className="text-[10px] leading-[1.45]">
                  <div><strong>Razón Social:</strong> {EMISOR.razonSocial}</div>
                  <div><strong>Domicilio Comercial:</strong> {EMISOR.domicilio}</div>
                  <div>{EMISOR.localidad}</div>
                  <div><strong>Condición frente al IVA:</strong> {EMISOR.iva}</div>
                  <div><strong>Tel.:</strong> {EMISOR.telefono}</div>
                </div>
              </div>
              <div className="p-2">
                <h3 className="text-center text-base font-black mt-1 mb-4">PRESUPUESTO</h3>
                <div className="text-[10px] leading-5">
                  <p><strong>Compr. Nro.:</strong> {quote.numero}</p>
                  <p><strong>Fecha de Emisión:</strong> {fechaAR(quote.fecha)}</p>
                  <p><strong>CUIT:</strong> {EMISOR.cuit}</p>
                  <p><strong>Ingresos Brutos:</strong></p>
                  <p><strong>Fecha de Inicio de Actividades:</strong> / /</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 border-b border-slate-700 p-2 text-[10px] gap-2">
              <div><strong>Sr(es):</strong> {quote.cliente.razonSocial||'____________________'}<p><strong>CUIT:</strong> {quote.cliente.cuit||'—'}</p></div>
              <div><strong>Domicilio:</strong> {quote.cliente.domicilio||'—'}<p><strong>Condición frente al IVA:</strong> {quote.cliente.condicionIVA}</p></div>
            </div>
            <table className="w-full table-fixed border-collapse text-[9px]">
              <colgroup><col style={{width:'7%'}}/><col style={{width:'40%'}}/><col style={{width:'9%'}}/><col style={{width:'9%'}}/><col style={{width:'9%'}}/><col style={{width:'13%'}}/><col style={{width:'13%'}}/></colgroup>
              <thead><tr className="bg-slate-200 border-b border-slate-700">{['Ítem','Descripción','Alíc. %','Cantidad','Bultos','Precio Unit.','Subtotal'].map(x=><th key={x} className="border-r border-slate-500 px-1 py-2 text-left">{x}</th>)}</tr></thead>
              <tbody>{(totals.data?.lineas||quote.items).map((item,i)=><tr key={item.id||i} className="border-b border-slate-100">
                <td className="align-top p-1 border-r border-slate-100 break-all">{item.codigo||String(i+1).padStart(4,'0')}</td>
                <td className="align-top p-1 border-r border-slate-100 break-words">{item.descripcion||'—'}</td>
                <td className="align-top p-1 border-r border-slate-100 text-center">{quote.cuenta==='1'?'21,00':'—'}</td>
                <td className="align-top p-1 border-r border-slate-100 text-center">{item.cantidad}</td>
                <td className="align-top p-1 border-r border-slate-100 text-center">{item.bultos}</td>
                <td className="align-top p-1 border-r border-slate-100 text-right">{Number.isFinite(item.precioCentavos)?peso(item.precioCentavos):'—'}</td>
                <td className="align-top p-1 text-right">{Number.isFinite(item.subtotalCentavos)?peso(item.subtotalCentavos):'—'}</td>
              </tr>)}</tbody>
            </table>
            <div className="mt-auto"/>
            <div className="p-3 text-[11px] mt-12 border-t border-slate-500">
              <div className="flex justify-between"><span>SUBTOTAL</span><strong>{totals.data?peso(totals.data.subtotalCentavos):'—'}</strong></div>
              {quote.cuenta==='1'&&<div className="flex justify-between mt-1"><span>IVA 21 %</span><strong>{totals.data?peso(totals.data.ivaCentavos):'—'}</strong></div>}
              <div className="flex justify-between font-black text-base mt-2 border-t pt-2"><span>TOTAL ($)</span><span>{totals.data?peso(totals.data.totalCentavos):'—'}</span></div>
            </div>
          </div>
        </div>}
        <p className="text-[11px] text-slate-500 px-4 pb-4 pt-1">Vista orientativa. El PDF descargado se genera en A4 y divide automáticamente los productos entre páginas cuando es necesario.</p>
      </section>
    </div>
  </div>;
}
