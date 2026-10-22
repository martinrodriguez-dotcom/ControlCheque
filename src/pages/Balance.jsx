import React, { useMemo, useState } from 'react';
import { IconChevronDown, IconCalendar, IconPrinter } from '../components/Icons';
import { construirBalance, categoriasPagos, fechaCorta, hoyLocal, numero, pesos, htmlReporteSemana } from '../utils/balanceSemanal';
import { handleReportAction } from '../utils/helpers';

const BOX='bg-white border border-slate-200 shadow-sm rounded-2xl p-4 sm:p-5';
const field='rounded-lg border border-slate-200 px-3 py-2.5 text-sm bg-white text-slate-800 focus:ring-2 focus:ring-violet-300 outline-none';
function Metric({title,value,sub,accent='text-slate-800'}) {
    return <div className={BOX}><div className="text-[10px] uppercase font-bold tracking-wide text-slate-500">{title}</div>
        <div className={'text-xl sm:text-2xl font-black mt-2 break-words '+accent}>{pesos(value)}</div>
        <p className="text-xs text-slate-500 mt-1">{sub}</p>
    </div>;
}
function Badge({color,children}) {
    return <span className={'inline-flex text-[10px] px-2 py-1 rounded-full font-bold '+color}>{children}</span>;
}

function WeekDetails({week}) {
    return <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 py-3 px-2 sm:px-4 bg-slate-50 border-t border-slate-200">
        <div className="min-w-0 bg-white rounded-xl border border-emerald-100 overflow-hidden">
            <div className="flex items-center justify-between gap-2 bg-emerald-50 px-3 py-3">
                <h4 className="font-bold text-sm text-emerald-900">Cobros esperados</h4>
                <span className="font-bold text-sm text-emerald-700">{pesos(week.cobros)}</span>
            </div>
            {week.itemsCobro.length===0?<p className="text-sm text-slate-400 text-center p-5">Sin cobranzas en esta semana</p>:
            <div className="divide-y divide-slate-100 max-h-80 overflow-auto">{week.itemsCobro.map((item,index)=>
                <div key={item.id||index} className="flex flex-wrap justify-between gap-2 px-3 py-2.5 text-xs">
                    <div><strong className="text-slate-700">{item.payee||'Sin cliente'}</strong>
                        <p className="text-[11px] text-slate-500 mt-0.5">{fechaCorta(item.dueDate||item.date)} · {item.number||'Sin número'}</p>
                    </div><span className="font-bold text-emerald-700">{pesos(item.pendiente)}</span>
                </div>)}</div>}
        </div>
        <div className="min-w-0 bg-white rounded-xl border border-rose-100 overflow-hidden">
            <div className="flex items-center justify-between gap-2 bg-rose-50 px-3 py-3">
                <h4 className="font-bold text-sm text-rose-900">Compromisos de Pagos</h4>
                <span className="font-bold text-sm text-rose-700">{pesos(week.pagos)}</span>
            </div>
            {week.itemsPago.length===0?<p className="text-sm text-slate-400 text-center p-5">Sin pagos en esta semana</p>:
            <div className="divide-y divide-slate-100 max-h-80 overflow-auto">{week.itemsPago.map((item,index)=>
                <div key={item.id||index} className="flex flex-wrap justify-between gap-2 px-3 py-2.5 text-xs">
                    <div><strong className="text-slate-700">{item.nombre||'Sin beneficiario'}</strong>
                        <p className="text-[11px] text-slate-500 mt-0.5">{fechaCorta(item.fecha)} · {item.categoria||'Sin categoría'} · {item.nro||'Sin número'}</p>
                    </div><span className="font-bold text-rose-700">{pesos(numero(item.importe))}</span>
                </div>)}</div>}
        </div>
    </div>;
}

export default function Balance({pagosAvanzados,collectItems=[]}) {
    const [start,setStart]=useState(hoyLocal);
    const [horizon,setHorizon]=useState(8);
    const [expanded,setExpanded]=useState('');
    const [categoryOpen,setCategoryOpen]=useState('');
    const [tab,setTab]=useState('semanas');

    const calculo=useMemo(()=>{
        if(!pagosAvanzados.ready)return null;
        try {return construirBalance({pagos:pagosAvanzados.items,cobros:collectItems,inicio:start,semanas:Number(horizon)});}
        catch{return null;}
    },[pagosAvanzados.ready,pagosAvanzados.items,collectItems,start,horizon]);
    const categorias=useMemo(()=>pagosAvanzados.ready?categoriasPagos(pagosAvanzados.items):[],[pagosAvanzados.items,pagosAvanzados.ready]);
    const maxBar=calculo?Math.max(1,...calculo.semanas.flatMap(w=>[w.cobros,w.pagos])):1;
    const today=hoyLocal();
    const pagosVencidos=calculo?.alertas.pagosVencidos?.reduce((acc,i)=>acc+(numero(i.importe)||0),0)||0;
    const cobrosVencidos=calculo?.alertas.cobrosVencidos?.reduce((acc,i)=>acc+Math.max(0,(numero(i.amount)||0)-(numero(i.paidAmount)||0)),0)||0;

    return <div className="space-y-4 animate-fade-in max-w-[1600px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div>
                <h2 className="text-2xl sm:text-3xl font-black text-slate-800">Balance</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">Cobros y compromisos por semana · Sábado a viernes</p>
            </div>
            <Badge color={pagosAvanzados.ready?'bg-emerald-50 text-emerald-800':pagosAvanzados.loading?'bg-amber-50 text-amber-800':'bg-rose-50 text-rose-800'}>
                {pagosAvanzados.loading?'Conectando Pagos…':pagosAvanzados.ready?'Pagos conectado':'Pagos sin conexión'}
            </Badge>
        </div>
        {pagosAvanzados.loading && <div className={BOX}><p className="text-sm text-slate-600">Consultando el Firebase de Pagos Avanzado…</p></div>}
        {!pagosAvanzados.loading&&!pagosAvanzados.ready && <div role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-rose-900">
            <p className="font-bold">No se pueden consultar los compromisos reales de Pagos.</p>
            <p className="text-sm mt-1">{pagosAvanzados.error || 'La lectura no está disponible.'}</p>
            <p className="text-xs mt-2">No mostramos un saldo financiero de 0 ni recurrimos a los registros antiguos de Gastos: eso ocultaría compromisos reales. La app de Pagos sigue funcionando de forma independiente.</p>
        </div>}
        {pagosAvanzados.bankError && <div className="text-xs text-amber-700">{pagosAvanzados.bankError}</div>}
        {calculo && <>
            <div className={BOX}>
                <div className="flex flex-wrap gap-3 items-end">
                    <label className="text-xs font-bold text-slate-600">Fecha de referencia
                        <input type="date" className={field+' block mt-1'} value={start} onChange={e=>setStart(e.target.value)}/>
                    </label>
                    <label className="text-xs font-bold text-slate-600">Período de comparación
                        <select className={field+' block mt-1'} value={horizon} onChange={e=>setHorizon(Number(e.target.value))}>
                            <option value={4}>4 semanas</option>
                            <option value={8}>8 semanas</option>
                            <option value={12}>12 semanas</option>
                            <option value={16}>16 semanas</option>
                            <option value={26}>26 semanas</option>
                        </select>
                    </label>
                    <div className="text-sm text-slate-500 pb-2">Del <strong className="text-slate-800">{fechaCorta(calculo.desde)}</strong> al <strong className="text-slate-800">{fechaCorta(calculo.hasta)}</strong></div>
                </div>
                <p className="text-[11px] mt-3 text-slate-500">Los valores reflejan importes aún pendientes: se descuentan los cobros parciales registrados y no se incluyen pagos marcados como pagados.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Metric title="Cobros del período" value={calculo.totalCobrosPeriodo} sub="Saldos pendientes con fecha de vencimiento" accent="text-emerald-700"/>
                <Metric title="Pagos del período" value={calculo.totalPagosPeriodo} sub="Obligaciones pendientes en Pagos Avanzado" accent="text-rose-700"/>
                <Metric title="Diferencia proyectada" value={calculo.netoPeriodo} sub="Cobros esperados menos pagos comprometidos" accent={calculo.netoPeriodo>=0?'text-emerald-700':'text-rose-700'}/>
                <Metric title="Deuda total cargada" value={calculo.deudaPendienteTotal} sub="Incluye compromisos fuera del período" accent="text-indigo-700"/>
            </div>
            {(pagosVencidos>0||cobrosVencidos>0||calculo.alertas.pagosSinFecha.length||calculo.alertas.cobrosSinFecha.length||calculo.alertas.pagosSinImporte.length||calculo.alertas.estadosInesperados.length)&&
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950 space-y-1">
                <p className="font-bold">Puntos a revisar antes de tomar decisiones:</p>
                {pagosVencidos>0 && <p>Pagos vencidos antes del {fechaCorta(today)}: {pesos(pagosVencidos)} (podrían estar incluidos en la semana actual o semanas anteriores)</p>}
                {cobrosVencidos>0 && <p>Cobros vencidos antes del {fechaCorta(today)}: {pesos(cobrosVencidos)}</p>}
                {calculo.alertas.pagosSinFecha.length>0&&<p>{calculo.alertas.pagosSinFecha.length} pagos pendientes sin fecha válida quedaron fuera de las semanas.</p>}
                {calculo.alertas.cobrosSinFecha.length>0&&<p>{calculo.alertas.cobrosSinFecha.length} cobros pendientes sin vencimiento válido quedaron fuera de las semanas.</p>}
                {calculo.alertas.pagosSinImporte.length>0&&<p>{calculo.alertas.pagosSinImporte.length} pagos tienen importes inválidos.</p>}
                {calculo.alertas.estadosInesperados.length>0&&<p>{calculo.alertas.estadosInesperados.length} pagos tienen estados no reconocidos y no se suman.</p>}
            </div>}
            <div className="bg-white rounded-xl border border-slate-200 p-1 flex gap-1 overflow-x-auto">
                <button type="button" onClick={()=>setTab('semanas')} className={'shrink-0 px-4 py-2.5 rounded-lg font-bold text-sm '+(tab==='semanas'?'bg-violet-700 text-white':'text-slate-600 hover:bg-slate-100')}>Semanas: cobros vs pagos</button>
                <button type="button" onClick={()=>setTab('categorias')} className={'shrink-0 px-4 py-2.5 rounded-lg font-bold text-sm '+(tab==='categorias'?'bg-violet-700 text-white':'text-slate-600 hover:bg-slate-100')}>Deuda por categoría</button>
            </div>
            {tab==='semanas' && <div className={BOX+' space-y-4'}>
                <div>
                    <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2"><IconCalendar className="w-5 h-5 text-violet-700"/> Comparación semanal</h3>
                    <p className="text-xs text-slate-500 mt-1">Seleccioná una semana para ver cada factura pendiente y compromiso, con sus fechas originales.</p>
                </div>
                <div className="flex gap-4 text-xs"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500"/> Cobros</span><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-rose-500"/> Pagos</span></div>
                <div className="space-y-2">
                    {calculo.semanas.map((w,index)=><div key={w.desde} className={'border rounded-xl overflow-hidden '+(expanded===w.desde?'border-violet-300':'border-slate-200')}>
                        <div className="relative">
                        <button type="button" onClick={()=>setExpanded(expanded===w.desde?'':w.desde)} className="w-full text-left p-3 sm:p-4 pr-24 sm:pr-32 hover:bg-slate-50" aria-expanded={expanded===w.desde}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-bold text-slate-800">Semana {index+1} <span className="font-medium text-slate-500 text-xs"> · Sáb {fechaCorta(w.desde)} – Vie {fechaCorta(w.hasta)}</span></div>
                                <div className="flex items-center gap-2">
                                    <Badge color={w.neto>=0?'bg-emerald-50 text-emerald-800':'bg-rose-50 text-rose-800'}>{w.neto>=0?'+':'−'}{pesos(Math.abs(w.neto))}</Badge>
                                    <IconChevronDown className={'w-4 h-4 text-slate-400 transition-transform '+(expanded===w.desde?'rotate-180':'')}/>
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-2 gap-2 mt-3 text-xs">
                                <div><div className="flex justify-between gap-2"><span className="text-emerald-800 font-bold">A cobrar</span><span className="font-bold">{pesos(w.cobros)}</span></div>
                                    <div className="mt-1.5 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{width:(w.cobros/maxBar*100)+'%'}}/></div></div>
                                <div><div className="flex justify-between gap-2"><span className="text-rose-800 font-bold">A pagar</span><span className="font-bold">{pesos(w.pagos)}</span></div>
                                    <div className="mt-1.5 h-2 bg-slate-100 rounded-full overflow-hidden"><div className="h-full bg-rose-500 rounded-full" style={{width:(w.pagos/maxBar*100)+'%'}}/></div></div>
                            </div>
                        </button>
                        <button type="button" title={'Imprimir semana '+fechaCorta(w.desde)+' a '+fechaCorta(w.hasta)}
                            onClick={() => handleReportAction('Balance semanal SII PALLETS', htmlReporteSemana(w),'print','')}
                            className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 inline-flex items-center gap-1.5 rounded-lg bg-white border border-violet-200 px-2.5 py-2 text-xs font-bold text-violet-800 shadow-sm hover:bg-violet-50">
                            <IconPrinter className="w-4 h-4"/><span className="hidden sm:inline">Imprimir</span>
                        </button>
                        </div>
                        {expanded===w.desde && <WeekDetails week={w}/>}
                    </div>)}
                </div>
                <div className="border-t border-slate-200 pt-3 flex flex-wrap justify-between gap-2 text-sm font-bold">
                    <span>Resultado acumulado del período</span>
                    <span className={calculo.netoPeriodo>=0?'text-emerald-700':'text-rose-700'}>{pesos(calculo.netoPeriodo)}</span>
                </div>
                <p className="text-xs text-slate-500">Esta proyección compara vencimientos, no dinero efectivamente disponible. No duplica importes de Cartera ni de Gastos. Pagos vencidos antes del período seleccionado no se trasladan artificialmente a semanas posteriores.</p>
            </div>}
            {tab==='categorias' && <div className={BOX+' space-y-4'}>
                <div><h3 className="font-bold text-slate-900 text-lg">Deuda de Pagos por categoría</h3>
                    <p className="text-xs text-slate-500 mt-1">Mismos campos que «Por Categorías» de Pagos: total histórico, pagado y deuda pendiente.</p>
                </div>
                {categorias.length===0?<p className="text-sm text-slate-500 p-4 text-center">No hay categorías cargadas.</p>:
                <div className="space-y-2">{categorias.map(cat=><div key={cat.categoria} className="border border-slate-200 rounded-xl overflow-hidden">
                    <button type="button" aria-expanded={categoryOpen===cat.categoria} onClick={()=>setCategoryOpen(categoryOpen===cat.categoria?'':cat.categoria)} className="w-full hover:bg-slate-50 px-4 py-3 flex items-center justify-between text-left gap-3">
                        <div><strong className="text-sm text-slate-800">{cat.categoria}</strong><p className="text-xs text-slate-500 mt-1">Histórico {pesos(cat.total)} · Pagado {pesos(cat.pagado)}</p></div>
                        <div className="flex items-center gap-2"><div className="text-right"><p className="text-[10px] text-slate-500">Pendiente</p><p className="text-sm font-black text-rose-700">{pesos(cat.deuda)}</p></div><IconChevronDown className={'w-4 h-4 text-slate-500 '+(categoryOpen===cat.categoria?'rotate-180':'')}/></div>
                    </button>
                    {categoryOpen===cat.categoria && <div className="border-t bg-slate-50 p-3">
                        <div className="max-h-80 overflow-y-auto divide-y divide-slate-200">
                            {cat.items.slice().sort((a,b)=>String(a.fecha||'').localeCompare(String(b.fecha||''))).map((x,i)=><div key={x.id||i} className="py-2 flex flex-wrap justify-between items-center gap-2 text-xs">
                                <div><strong className="text-slate-700">{x.nombre||'Sin proveedor'}</strong><p className="text-slate-500">{fechaCorta(x.fecha)} · {x.nro||'S/N'} · {x.estado||'PENDIENTE'}</p></div>
                                <span className="font-bold">{pesos(numero(x.importe))}</span>
                            </div>)}
                        </div>
                    </div>}
                </div>)}</div>}
            </div>}
            <div className="text-xs text-slate-500 leading-relaxed px-1">
                <strong>Fuentes:</strong> ingresos desde Cobros de ControlCheque; egresos desde el Firebase de Pagos Avanzado. No se modifica información. Las categorías y los importes se actualizan cuando cambian los registros de origen.
            </div>
        </>}
    </div>;
}
