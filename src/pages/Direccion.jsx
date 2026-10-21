// Centro de Control — módulo aditivo; no altera la lógica histórica de Cobros, Pagos ni Pallets.
import React, { useState, useMemo } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { formatMoney } from '../utils/helpers';
import {
    numberValue, sumOf, localToday, invoiceSummary, monthlyInvoiceTrend,
    clientAccounts, cashFlow, modelMargins, auditItems, downloadCsv, downloadFile,
    outstanding, invoiceLike, isoDay
} from '../utils/gestion30';

const MENU = [
    {id:'resumen',label:'Dirección',emoji:'📊'},
    {id:'flujo',label:'Flujo de fondos',emoji:'📆'},
    {id:'clientes',label:'Cuentas corrientes',emoji:'👥'},
    {id:'rentabilidad',label:'Rentabilidad',emoji:'🪵'},
    {id:'auditoria',label:'Auditoría',emoji:'🔍'},
    {id:'respaldo',label:'Respaldos',emoji:'🔐'}
];

const MONEY = (value) => formatMoney(Number.isFinite(value) ? value : 0);
const INPUT = 'w-full border border-slate-200 bg-white rounded-xl px-3 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300';
const BTN = 'rounded-xl px-3 py-2 text-xs font-bold border transition-colors hover:bg-slate-100';
const PANEL = 'rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm';

function Metric({label,amount,subtitle,onClick,accent='indigo'}) {
    const colors = {indigo:'text-indigo-700',green:'text-emerald-700',rose:'text-rose-700',amber:'text-amber-700'};
    return (
        <div className={PANEL + ' flex flex-col gap-1'}>
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-500">{label}</p>
            <p className={'text-xl md:text-2xl font-black break-words ' + (colors[accent] || colors.indigo)}>{MONEY(amount)}</p>
            <p className="text-xs text-slate-500">{subtitle}</p>
            {onClick && <button type="button" onClick={onClick} className="text-xs font-bold text-indigo-700 text-left mt-2 hover:underline">Ver detalle →</button>}
        </div>
    );
}

function Empty({text='Sin registros para mostrar'}) {
    return <p className="text-sm text-slate-500 py-7 text-center">{text}</p>;
}

function TableWrap({children}) {
    return <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="min-w-full text-xs text-left">{children}</table></div>;
}

const HEAD = 'bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider';
const TH = 'px-3 py-3 whitespace-nowrap';
const TD = 'px-3 py-3 border-t border-slate-100';

function Resumen({month,collectItems,expenseItems,payItems,walletItems,cashItems,onNavigate,onEditInvoice}) {
    const summary = useMemo(() => invoiceSummary(collectItems,month),[collectItems,month]);
    const trend = useMemo(() => monthlyInvoiceTrend(collectItems,6,month + '-15'),[collectItems,month]);
    const pending = collectItems.filter(invoiceLike).reduce((s,i)=>s+outstanding(i),0);
    const payPending = [...payItems,...expenseItems].reduce((s,i)=>s+outstanding(i),0);
    const walletPending = walletItems.reduce((s,i)=>s+outstanding(i),0);
    const cashMonth = cashItems.filter(i=>String(i.date||'').startsWith(month));
    const cashIncome = cashMonth.filter(i=>i.cashType==='income').reduce((s,i)=>s+numberValue(i.amount),0);
    const cashExpense = cashMonth.filter(i=>i.cashType==='expense').reduce((s,i)=>s+numberValue(i.amount),0);
    const max = Math.max(1,...trend.map(t=>t.amount));
    const recent = [...summary.invoices].sort((a,b)=>String(b.issueDate||b.dueDate||'').localeCompare(String(a.issueDate||a.dueDate||''))).slice(0,8);
    return (
        <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Metric label="Facturas emitidas (con IVA)" amount={summary.amount} subtitle={summary.count + ' facturas del mes seleccionado'} onClick={()=>onNavigate('clientes')} />
                <Metric label="Facturas pendientes" amount={pending} subtitle="Saldo acumulado en Cobros; no solo el mes" accent="amber" onClick={()=>onNavigate('clientes')} />
                <Metric label="Compromisos por pagar" amount={payPending} subtitle="Cheques y gastos pendientes, todas las fechas" accent="rose" onClick={()=>onNavigate('flujo')} />
                <Metric label="Cartera pendiente" amount={walletPending} subtitle="Cheques en cartera, sin conciliar contra facturas" accent="green" onClick={()=>onNavigate('flujo')}/>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className={PANEL + ' lg:col-span-2'}>
                    <h3 className="text-sm font-bold text-slate-800">Facturación emitida: últimos 6 meses</h3>
                    <p className="text-xs text-slate-500 mb-5">Totales con IVA por fecha de emisión, no por fecha de cobro.</p>
                    <div className="grid grid-cols-6 gap-2 items-end h-48 pt-3">
                        {trend.map(t=>(
                            <div key={t.month} className="flex flex-col justify-end items-center gap-2 h-full" title={t.month + ': ' + MONEY(t.amount)}>
                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-500">{t.amount > 0 ? (t.amount/1000000).toFixed(1) + 'M' : '0'}</span>
                                <div className="w-full bg-indigo-100 rounded-t-lg flex items-end overflow-hidden" style={{height:'100%',maxHeight: '150px'}}>
                                    <div className="w-full rounded-t-lg bg-indigo-500" style={{height:(t.amount <= 0 ? 0 : Math.max(4,(t.amount/max)*100)) + '%'}}></div>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-600 capitalize">{t.label}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div className={PANEL}>
                    <h3 className="text-sm font-bold text-slate-800">Movimientos de Caja · {month}</h3>
                    <p className="text-xs text-slate-500 mb-5">Solo asientos de Caja, no todos los movimientos bancarios.</p>
                    <div className="space-y-4">
                        <div><p className="text-xs text-slate-500">Ingresos de Caja</p><p className="font-black text-xl text-emerald-700">{MONEY(cashIncome)}</p></div>
                        <div><p className="text-xs text-slate-500">Egresos de Caja</p><p className="font-black text-xl text-rose-700">{MONEY(cashExpense)}</p></div>
                        <div className="pt-3 border-t"><p className="text-xs text-slate-500">Diferencia de movimientos</p><p className="font-black text-xl">{MONEY(cashIncome-cashExpense)}</p></div>
                        <p className="text-[11px] text-slate-500">No equivale a utilidad neta ni a saldo bancario.</p>
                    </div>
                </div>
            </div>
            <div className={PANEL}>
                <div className="flex flex-wrap gap-2 justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-slate-800">Últimas facturas del mes</h3>
                    <button type="button" onClick={()=>onNavigate('clientes')} className={BTN}>Ver cuentas corrientes →</button>
                </div>
                {recent.length===0 ? <Empty text="No hay facturas emitidas en este período" /> :
                <TableWrap>
                    <thead className={HEAD}><tr><th className={TH}>Emisión</th><th className={TH}>Factura</th><th className={TH}>Cliente</th><th className={TH + ' text-right'}>Total con IVA</th><th className={TH}>Acción</th></tr></thead>
                    <tbody>{recent.map(i=><tr key={i.id}>
                        <td className={TD}>{isoDay(i.issueDate || i.dueDate)}</td><td className={TD}>{i.number||'—'}</td>
                        <td className={TD + ' font-semibold'}>{i.payee||'Sin cliente'}</td><td className={TD+' text-right font-bold'}>{MONEY(numberValue(i.amount))}</td>
                        <td className={TD}><button type="button" onClick={()=>onEditInvoice(i)} className="font-bold text-indigo-700 hover:underline">Editar</button></td>
                    </tr>)}</tbody>
                </TableWrap>}
            </div>
        </div>
    );
}

function Flujo({payItems,collectItems,walletItems,expenseItems,cashItems}) {
    const [days,setDays]=useState(30);
    const [opening,setOpening]=useState('0');
    const [showEvents,setShowEvents]=useState(false);
    const cashAvailable = cashItems.reduce((s,i)=>s+((i.cashType==='open'||i.cashType==='income') ? numberValue(i.amount) : (i.cashType==='expense' ? -numberValue(i.amount) : 0)),0);
    const data = useMemo(()=>cashFlow({payItems,collectItems,walletItems,expenseItems,days,opening:numberValue(opening)}),[payItems,collectItems,walletItems,expenseItems,days,opening]);
    const populated = data.days.filter(d=>d.events.length>0);
    const extended = data.events.concat(data.overdue).sort((a,b)=>a.date.localeCompare(b.date));
    const exportData=()=>downloadCsv('SII_Flujo_de_fondos_'+localToday()+'.csv',
        extended.map(x=>({date:x.date,type:x.label,client:x.payee,number:x.number,side:x.side,amount:x.amount})),
        [['Fecha','date'],['Tipo','type'],['Cliente / concepto','client'],['Número','number'],['Flujo','side'],['Importe','amount']]);
    return (
        <div className="space-y-4">
            <div className={PANEL}>
                <h3 className="font-bold text-slate-800 text-sm">Proyección de liquidez</h3>
                <p className="text-xs text-slate-500 mt-1">Se calculan importes pendientes por vencer. Es un escenario, no una conciliación bancaria; no se descuentan cobros ya cancelados.</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                    <label className="text-xs font-bold text-slate-600">Horizonte
                        <select className={INPUT+' mt-1'} value={days} onChange={e=>setDays(Number(e.target.value))}><option value={7}>7 días</option><option value={15}>15 días</option><option value={30}>30 días</option><option value={60}>60 días</option><option value={90}>90 días</option></select>
                    </label>
                    <label className="text-xs font-bold text-slate-600">Saldo inicial del escenario ($)
                        <input className={INPUT+' mt-1'} type="number" step="0.01" value={opening} onChange={e=>setOpening(e.target.value)}/>
                    </label>
                    <div className="flex flex-col justify-end gap-1">
                        <button type="button" className={BTN+' text-indigo-700'} onClick={()=>setOpening(String(cashAvailable))}>Usar saldo teórico de Caja ({MONEY(cashAvailable)})</button>
                        <span className="text-[10px] text-slate-500">No incluye cuentas bancarias ni conciliación.</span>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Metric label="Ingresos a vencer" amount={data.incomes} subtitle={days+' días futuros'} accent="green"/>
                <Metric label="Egresos a vencer" amount={data.expenses} subtitle={days+' días futuros'} accent="rose"/>
                <Metric label="Saldo al cierre" amount={data.closing} subtitle={'Proyección al '+data.end}/>
                <Metric label="Mínimo proyectado" amount={data.lowest} subtitle="Alerta de posible tensión de caja" accent={data.lowest<0?'rose':'green'}/>
            </div>
            {(data.overdue.length>0 || data.invalid.length>0) && <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
                <strong>Revisar:</strong> {data.overdue.length} obligaciones vencidas ({MONEY(sumOf(data.overdue))}) y {data.invalid.length} sin fecha válida.
                No se incluyen en el saldo proyectado futuro; revisalas antes de tomar decisiones.
            </div>}
            <div className={PANEL}>
                <div className="flex flex-wrap gap-2 justify-between items-center mb-3">
                    <h3 className="text-sm font-bold text-slate-800">Calendario de vencimientos · {data.today} a {data.end}</h3>
                    <button type="button" className={BTN} onClick={exportData}>Exportar CSV</button>
                </div>
                {populated.length === 0 ? <Empty text="No hay vencimientos próximos en el período seleccionado"/> :
                <TableWrap><thead className={HEAD}><tr>
                    <th className={TH}>Fecha</th><th className={TH + ' text-right'}>A cobrar</th><th className={TH+' text-right'}>A pagar</th><th className={TH+' text-right'}>Saldo estimado</th><th className={TH}>Detalle</th>
                </tr></thead><tbody>{populated.map(d=><tr key={d.date}>
                    <td className={TD+' font-bold'}>{d.date}</td><td className={TD+' text-right text-emerald-700'}>{MONEY(d.income)}</td>
                    <td className={TD+' text-right text-rose-700'}>{MONEY(d.expenses)}</td>
                    <td className={TD+' text-right font-bold '+(d.balance<0?'text-rose-700':'')}>{MONEY(d.balance)}</td>
                    <td className={TD}>{d.events.map(e=><div key={e.id} className="py-1"><span className={e.side==='ingreso'?'text-emerald-700':'text-rose-700'}>{e.side==='ingreso'?'+':'−'} {MONEY(e.amount)}</span>{' · '}{e.payee}{' · '}{e.label}</div>)}</td>
                </tr>)}</tbody></TableWrap>}
                <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-slate-500">{extended.length} compromisos pendientes identificados (incluidos vencidos)</span>
                    <button type="button" className="text-xs font-bold text-indigo-700 hover:underline" onClick={()=>setShowEvents(!showEvents)}>{showEvents?'Ocultar vencidos':'Ver vencidos y observaciones'}</button>
                </div>
                {showEvents && <div className="mt-3 space-y-2">
                    {data.overdue.length===0?<Empty text="No se detectan vencidos"/>:
                    data.overdue.slice(0,50).map(e=><div key={e.id} className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-xs">{e.date} · {e.payee} · {e.label} · <strong>{MONEY(e.amount)}</strong></div>)}
                </div>}
            </div>
        </div>
    );
}

function Clientes({collectItems,onEditInvoice}) {
    const clients = useMemo(()=>clientAccounts(collectItems),[collectItems]);
    const [search,setSearch]=useState('');
    const [expanded,setExpanded]=useState(null);
    const filtered=clients.filter(c=>c.name.toLocaleLowerCase('es-AR').includes(search.toLocaleLowerCase('es-AR')));
    const exportCsv=()=>downloadCsv('SII_Cuenta_Corriente_'+localToday()+'.csv',
        clients.flatMap(c=>c.items.map(i=>({client:c.name,number:i.number,date:isoDay(i.issueDate),due:isoDay(i.dueDate),amount:numberValue(i.amount),paid:numberValue(i.paidAmount),pending:outstanding(i),status:i.status}))),
        [['Cliente','client'],['Factura','number'],['Emisión','date'],['Vencimiento','due'],['Importe','amount'],['Cobrado','paid'],['Pendiente','pending'],['Estado','status']]);
    return <div className="space-y-4">
        <div className={PANEL}>
            <div className="flex flex-wrap justify-between gap-3 items-start">
                <div><h3 className="text-sm font-bold text-slate-800">Cuentas corrientes por cliente</h3><p className="text-xs text-slate-500 mt-1">Vista consolidada de facturas y cobros ya registrados; no crea saldos ni facturas duplicadas.</p></div>
                <button type="button" onClick={exportCsv} className={BTN}>Exportar CSV</button>
            </div>
            <input type="search" className={INPUT+' mt-4'} placeholder="Buscar cliente..." value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Metric label="Facturación histórica" amount={clients.reduce((s,c)=>s+c.invoiced,0)} subtitle="Total bruto de facturas registradas"/>
            <Metric label="Cobrado acumulado" amount={clients.reduce((s,c)=>s+c.paid,0)} subtitle="Pagos registrados por factura" accent="green"/>
            <Metric label="Saldo pendiente" amount={clients.reduce((s,c)=>s+c.pending,0)} subtitle={clients.length + ' clientes'} accent="amber"/>
        </div>
        <div className="space-y-2">
            {filtered.length===0?<div className={PANEL}><Empty text="No se encontraron clientes"/></div>:filtered.map(c=>(
                <div key={c.key} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                    <button type="button" className="w-full flex flex-wrap items-center justify-between text-left gap-2 p-4 hover:bg-slate-50" onClick={()=>setExpanded(expanded===c.key?null:c.key)} aria-expanded={expanded===c.key}>
                        <div><p className="font-bold text-slate-800">{c.name}</p><p className="text-xs text-slate-500">{c.items.length} facturas · cobrado {MONEY(c.paid)}</p></div>
                        <div className="text-right"><p className="text-xs text-slate-500">Pendiente</p><p className="text-lg font-black text-amber-700">{MONEY(c.pending)}</p></div>
                    </button>
                    {expanded===c.key && <div className="px-3 pb-3">
                        <TableWrap><thead className={HEAD}><tr><th className={TH}>Factura</th><th className={TH}>Emisión</th><th className={TH}>Vence</th><th className={TH+' text-right'}>Total</th><th className={TH+' text-right'}>Cobrado</th><th className={TH+' text-right'}>Pendiente</th><th className={TH}>Acción</th></tr></thead>
                        <tbody>{[...c.items].sort((a,b)=>String(b.issueDate||'').localeCompare(String(a.issueDate||''))).map(i=><tr key={i.id}>
                            <td className={TD+' font-semibold'}>{i.number||'S/N'}</td><td className={TD}>{isoDay(i.issueDate)||'—'}</td><td className={TD}>{isoDay(i.dueDate)||'—'}</td>
                            <td className={TD+' text-right'}>{MONEY(numberValue(i.amount))}</td><td className={TD+' text-right text-emerald-700'}>{MONEY(numberValue(i.paidAmount))}</td>
                            <td className={TD+' text-right font-bold'}>{MONEY(outstanding(i))}</td>
                            <td className={TD}><button type="button" onClick={()=>onEditInvoice(i)} className="text-indigo-700 font-bold hover:underline">Editar en Cobros</button></td>
                        </tr>)}</tbody></TableWrap>
                    </div>}
                </div>
            ))}
        </div>
        <p className="text-xs text-slate-500">Los importes cobrados son acumulados históricos por factura, no cobranzas del mes. Las aplicaciones de cheques en cartera no se concilian automáticamente con Cobros para evitar duplicar ingresos.</p>
    </div>;
}

function Rentabilidad({palletsTemplates,costosMadres,presupuestos,produccionMensual}) {
    const [prices,setPrices]=useState({});
    const [quantities,setQuantities]=useState({});
    const models=useMemo(()=>modelMargins(palletsTemplates,costosMadres,prices),[palletsTemplates,costosMadres,prices]);
    const totalCost=models.reduce((s,m)=>s+m.cost*numberValue(quantities[m.id]),0);
    const totalRevenue=models.reduce((s,m)=>s+m.salePrice*numberValue(quantities[m.id]),0);
    const totalQty=models.reduce((s,m)=>s+numberValue(quantities[m.id]),0);
    const exportModels=()=>downloadCsv('SII_Simulacion_Margenes_'+localToday()+'.csv',models.map(m=>({name:m.nombre,cost:m.cost,price:m.salePrice,qty:numberValue(quantities[m.id]),margin:m.margin,percent:m.marginPercent||0,missing:m.missing.length})),
        [['Modelo','name'],['Costo unitario','cost'],['Precio venta estimado','price'],['Cantidad simulada','qty'],['Margen unitario','margin'],['Margen %','percent'],['Materiales faltantes','missing']]);
    return <div className="space-y-4">
        <div className={PANEL}>
            <div className="flex gap-3 items-center justify-between flex-wrap">
                <div><h3 className="text-sm font-bold text-slate-800">Simulador de rentabilidad por modelo</h3>
                <p className="text-xs text-slate-500 mt-1">Reutiliza los costos madre y modelos actuales. Los precios y cantidades que ingreses son simulaciones locales: no modifican Firebase.</p></div>
                <button type="button" className={BTN} onClick={exportModels}>Exportar simulación CSV</button>
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Metric label="Ventas simuladas" amount={totalRevenue} subtitle={totalQty+' pallets seleccionados'} accent="green"/>
            <Metric label="Costos simulados" amount={totalCost} subtitle="A valores actuales de materiales" accent="rose"/>
            <Metric label="Margen bruto simulado" amount={totalRevenue-totalCost} subtitle="Antes de impuestos y costos no imputados"/>
        </div>
        <div className={PANEL}>
            {models.length===0?<Empty text="Cargá modelos y costos madre en la pestaña Pallets para calcular rentabilidad."/>:
            <div className="space-y-3">{models.map(m=>(
                <div key={m.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex justify-between flex-wrap gap-2 mb-3">
                        <div><h4 className="font-bold text-slate-800">{m.nombre}</h4><p className="text-xs text-slate-500">Costo unitario actual {MONEY(m.cost)} · Guardado en modelo {MONEY(numberValue(m.totalCosto))}</p></div>
                        {m.missing.length>0 && <span className="rounded-lg bg-rose-50 text-rose-700 text-xs px-2 py-1">Faltan {m.missing.length} costos vinculados</span>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                        <div><label className="text-xs font-bold text-slate-500">Precio de venta sin IVA ($)</label><input type="number" min="0" step="0.01" className={INPUT+' mt-1'} value={prices[m.id]||''} placeholder="Ingresá precio" onChange={e=>setPrices({...prices,[m.id]:e.target.value})}/></div>
                        <div><label className="text-xs font-bold text-slate-500">Cantidad proyectada</label><input type="number" min="0" step="1" className={INPUT+' mt-1'} value={quantities[m.id]||''} placeholder="0" onChange={e=>setQuantities({...quantities,[m.id]:e.target.value})}/></div>
                        <div><p className="text-xs text-slate-500">Margen unitario</p><p className={'font-black text-lg '+(m.margin<0?'text-rose-700':'text-emerald-700')}>{m.salePrice>0?MONEY(m.margin):'—'}</p></div>
                        <div><p className="text-xs text-slate-500">Margen sobre venta</p><p className={'font-black text-lg '+(m.margin<0?'text-rose-700':'text-emerald-700')}>{m.marginPercent===null?'—':m.marginPercent.toFixed(1)+'%'}</p></div>
                    </div>
                </div>
            ))}</div>}
        </div>
        <div className="text-xs text-amber-900 rounded-xl bg-amber-50 border border-amber-200 p-3">
            <strong>Alcance:</strong> la app tiene costos por modelo, pero no existe aún un enlace entre cada factura y los pallets vendidos. Por eso no mostramos una utilidad neta contable ni rentabilidad histórica por cliente. Producción mensual de referencia: {produccionMensual} pallets. Hay {presupuestos.length} presupuestos de costo cargados; no se consideran ventas realizadas.
        </div>
    </div>;
}

function Auditoria({collectItems,payItems,walletItems,expenseItems,onEditInvoice,onNavigate}) {
    const issues=useMemo(()=>auditItems({collectItems,payItems,walletItems,expenseItems}),[collectItems,payItems,walletItems,expenseItems]);
    const [kind,setKind]=useState('all');
    const filtered=issues.filter(x=>kind==='all'||kind===x.kind);
    const exportIssues=()=>downloadCsv('SII_Auditoria_'+localToday()+'.csv',
        issues.map(x=>({tipo:x.kind,source:x.source,number:x.item.number,client:x.item.payee,message:x.message,id:x.item.id})),
        [['Tipo','tipo'],['Módulo','source'],['Número','number'],['Cliente','client'],['Observación','message'],['ID','id']]);
    return <div className="space-y-4">
        <div className={PANEL}>
            <h3 className="text-sm font-bold text-slate-800">Control de calidad de registros</h3>
            <p className="text-xs text-slate-500 mt-1">Detecta posibles duplicados, faltantes de datos, importes inconsistentes y fechas inválidas. Son alertas preventivas; no modifica registros.</p>
            <div className="mt-4 flex flex-wrap gap-2">
                <select className={INPUT+' max-w-xs'} value={kind} onChange={e=>setKind(e.target.value)}>
                    <option value="all">Todas las alertas</option><option value="duplicada">Posibles duplicados</option><option value="importe">Importes</option><option value="cobranza">Pagos</option><option value="fecha">Fechas</option><option value="numero">Numeración</option><option value="cliente">Clientes</option>
                </select>
                <button type="button" onClick={exportIssues} className={BTN}>Exportar incidencias CSV</button>
            </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={PANEL}><p className="text-xs text-slate-500">Incidencias encontradas</p><p className="text-3xl font-black text-amber-700">{issues.length}</p></div>
            <div className={PANEL}><p className="text-xs text-slate-500">Posibles duplicados</p><p className="text-3xl font-black">{issues.filter(i=>i.kind==='duplicada').length}</p></div>
            <div className={PANEL}><p className="text-xs text-slate-500">Facturas sin número</p><p className="text-3xl font-black">{issues.filter(i=>i.kind==='numero').length}</p></div>
        </div>
        <div className={PANEL}>
            {filtered.length===0?<Empty text="Sin incidencias para el filtro seleccionado"/>:
            <TableWrap><thead className={HEAD}><tr><th className={TH}>Observación</th><th className={TH}>Origen</th><th className={TH}>Registro</th><th className={TH}>Acción</th></tr></thead>
            <tbody>{filtered.slice(0,200).map((x,index)=><tr key={x.source+'-'+x.item.id+'-'+x.kind+'-'+index}>
                <td className={TD+' font-medium text-amber-800'}>{x.message}</td><td className={TD}>{x.source}</td><td className={TD}>{x.item.payee||'Sin nombre'} · {x.item.number||'S/N'} · {MONEY(numberValue(x.item.amount))}</td>
                <td className={TD}>{x.source==='collect'?<button type="button" className="text-indigo-700 font-bold hover:underline" onClick={()=>onEditInvoice(x.item)}>Editar factura</button>:
                    <button type="button" className="text-indigo-700 font-bold hover:underline" onClick={()=>onNavigate(x.source)}>Ir al módulo</button>}</td>
            </tr>)}</tbody></TableWrap>}
            {filtered.length>200 && <p className="text-xs text-slate-500 mt-3">Se muestran las primeras 200. Exportá CSV para ver todas.</p>}
        </div>
        <p className="text-xs text-slate-500">Esto no es un historial de quién editó qué: los registros anteriores no cuentan con bitácora de auditoría. Se requerirá control de usuarios para registrar cambios futuros.</p>
    </div>;
}

const BACKUP_COLLECTIONS = [
    'cheques_public_shared/main_list/items','cobros_public_shared/main_list/items',
    'cartera_public_shared/main_list/items','gastos_public_shared/main_list/items',
    'caja_public_shared/main_list/items','bancos_sii/main_list/items',
    'costos_madres_sii/main_list/items','pallets_templates_sii/main_list/items',
    'presupuestos_sii/main_list/items','config_sii'
];

function Respaldo() {
    const [busy,setBusy]=useState(false);
    const [feedback,setFeedback]=useState('');
    const [error,setError]=useState('');
    const runBackup=async()=>{
        if (busy) return;
        if (!window.confirm('Se descargará una copia local con información comercial sensible. Guardala en un lugar seguro. ¿Continuar?')) return;
        setBusy(true);setError('');setFeedback('');
        try {
            const result=await Promise.allSettled(BACKUP_COLLECTIONS.map(async path=>{
                const snap=await getDocs(collection(db,...path.split('/')));
                return {path,items:snap.docs.map(doc=>({id:doc.id,data:doc.data()}))};
            }));
            const errors=result.flatMap((x,index)=>x.status==='rejected'?[BACKUP_COLLECTIONS[index]+': '+String(x.reason?.message||x.reason)]:[]);
            if (errors.length) {
                setError('No se descargó una copia incompleta. Fallaron: '+errors.join(' | '));
                return;
            }
            const collections=result.map(x=>x.value);
            const manifest={
                format:'SII-PALLETS-EXPORT-1',version:'3.0-preview',createdAt:new Date().toISOString(),
                scope:'10 colecciones conocidas de ControlCheque (incluye config_sii); excluye aplicaciones externas como Pagos avanzado',
                paths:collections.map(c=>({path:c.path,count:c.items.length})),
                restoreNote:'Copia de lectura. No restaurar directamente sin validación y entorno de pruebas.'
            };
            const date=localToday();
            const content=JSON.stringify({manifest,collections},(key,value)=>{
                if(value&&typeof value.toDate==='function')return {__firestoreTimestamp:value.toDate().toISOString()};
                return value;
            },2);
            downloadFile('SII_PALLETS_BACKUP_'+date+'.json',content,'application/json;charset=utf-8');
            setFeedback('Archivo generado: '+collections.reduce((s,c)=>s+c.items.length,0)+' documentos en '+collections.length+' colecciones. Verificá su almacenamiento.');
        } catch(e) {
            setError('No se pudo generar el archivo: '+String(e?.message||e));
        } finally {setBusy(false);}
    };
    return <div className="space-y-4">
        <div className={PANEL}>
            <h3 className="font-bold text-slate-800">Exportación de seguridad · solo lectura</h3>
            <p className="text-xs text-slate-500 mt-1">Genera un JSON local de las colecciones conocidas desde Firestore sin modificar ningún registro. Incluye datos de Cobros, Cartera, Gastos, Caja, Costos, Modelos, Presupuestos y configuraciones accesibles.</p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={runBackup} disabled={busy} className="rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-sm px-5 py-3 disabled:opacity-50">{busy?'Consultando Firebase…':'Descargar respaldo JSON'}</button>
                <span className="text-xs text-slate-500">{BACKUP_COLLECTIONS.length} rutas de colecciones verificadas al exportar</span>
            </div>
            {feedback && <p role="status" className="text-xs font-bold text-emerald-700 mt-3">{feedback}</p>}
            {error && <p role="alert" className="text-xs font-bold text-rose-700 mt-3">{error}</p>}
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 space-y-2">
            <p className="font-bold">Protección de datos y restauración</p>
            <p>La restauración automática NO está habilitada en esta etapa: podría sobrescribir datos reales mientras la vista previa comparte Firebase con producción. Antes de activarla hay que preparar autenticación administrativa, una base de pruebas separada, validación de archivos y restauración transaccional con vista previa.</p>
            <p>La sección Pagos avanzado carga una aplicación externa dentro de un iframe; su base de datos no está incluida aquí. Este respaldo tampoco asegura descubrir colecciones desconocidas fuera de las rutas enumeradas.</p>
            <p>El JSON puede contener información sensible de clientes y proveedores: no lo compartas públicamente.</p>
        </div>
    </div>;
}

export default function Direccion({
    collectItems=[],payItems=[],walletItems=[],expenseItems=[],cashItems=[],
    palletsTemplates=[],costosMadres=[],presupuestos=[],produccionMensual=0,
    onEditInvoice, onOpenModule
}) {
    const [pane,setPane]=useState('resumen');
    const [month,setMonth]=useState(localToday().slice(0,7));
    const navigate=(target)=>{
        if (['collect','pay','wallet','expense'].includes(target)) onOpenModule?.(target==='expense'?'expenses':target);
        else setPane(target);
    };
    return <div className="animate-fade-in space-y-4 max-w-[1600px] mx-auto">
        <div className="rounded-2xl bg-slate-900 text-white p-5 md:p-7 shadow-xl">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div><p className="text-xs uppercase tracking-[0.2em] text-indigo-300 font-bold">SII PALLETS · Versión experimental</p>
                    <h2 className="text-2xl md:text-3xl font-black mt-2">Centro de Control 3.0</h2>
                    <p className="text-sm text-slate-300 mt-2 max-w-2xl">Dirección, liquidez, cuentas corrientes, rentabilidad y auditoría. Lectura integrada de los mismos registros que ya utiliza la app.</p>
                </div>
                <div className="bg-white/10 border border-white/20 rounded-xl px-3 py-2">
                    <label htmlFor="direccion-mes" className="text-[10px] text-slate-300 font-bold block mb-1">PERÍODO PARA RESUMEN</label>
                    <input id="direccion-mes" type="month" value={month} onChange={e=>setMonth(e.target.value)} className="text-slate-900 bg-white rounded-md px-2 py-1"/>
                </div>
            </div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            <strong>Modo de prueba:</strong> estas pantallas nuevas consultan datos reales compartidos con producción. Las secciones clásicas conservan sus acciones de escritura, por lo que cualquier cambio que hagas allí también modifica la base real. Los controles de simulación de Dirección no escriben en Firebase.
        </div>
        <nav className="bg-white border border-slate-200 shadow-sm rounded-xl p-1.5 flex gap-1.5 overflow-x-auto scrollbar-hide" aria-label="Centro de control">
            {MENU.map(m=><button key={m.id} type="button" onClick={()=>setPane(m.id)}
                className={'px-3 py-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors '+(pane===m.id?'bg-indigo-700 text-white shadow-sm':'text-slate-600 hover:bg-slate-100')}
                aria-current={pane===m.id?'page':undefined}>{m.emoji} {m.label}</button>)}
        </nav>
        {pane==='resumen' && <Resumen month={month} collectItems={collectItems} expenseItems={expenseItems} payItems={payItems} walletItems={walletItems} cashItems={cashItems} onNavigate={navigate} onEditInvoice={onEditInvoice}/>}
        {pane==='flujo' && <Flujo payItems={payItems} collectItems={collectItems} walletItems={walletItems} expenseItems={expenseItems} cashItems={cashItems}/>}
        {pane==='clientes' && <Clientes collectItems={collectItems} onEditInvoice={onEditInvoice}/>}
        {pane==='rentabilidad' && <Rentabilidad palletsTemplates={palletsTemplates} costosMadres={costosMadres} presupuestos={presupuestos} produccionMensual={produccionMensual}/>}
        {pane==='auditoria' && <Auditoria collectItems={collectItems} payItems={payItems} walletItems={walletItems} expenseItems={expenseItems} onEditInvoice={onEditInvoice} onNavigate={navigate}/>}
        {pane==='respaldo' && <Respaldo/>}
    </div>;
}
