// Cálculos financieros de SOLO LECTURA. Semana igual a Pagos: sábado a viernes.
// Las obligaciones reales vienen de listapagos/finanzas/cheques, NO de cheques_public_shared.
export const numero = (val) => {
    if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
    if (typeof val !== 'string' || !val.trim()) return NaN;
    const text=val.replace(/\s|\$/g,'').trim();
    const normalized=text.includes(',')?text.replace(/\./g,'').replace(',','.'):text;
    const n=Number(normalized);
    return Number.isFinite(n)?n:NaN;
};

export const validarFecha = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const [year,month,day]=value.split('-').map(Number);
    const date=new Date(Date.UTC(year,month-1,day));
    return date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day ? value : '';
};
const fromUTC = d => d.toISOString().slice(0,10);
export const sumarDias = (fecha,dias) => {
    const safe=validarFecha(fecha);if(!safe)return '';
    const date=new Date(safe+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+dias);
    return fromUTC(date);
};
export const sabadoDeSemana = dateValue => {
    const safe=validarFecha(dateValue);if(!safe)return '';
    const date=new Date(safe+'T12:00:00Z');
    const day=date.getUTCDay();
    const offset=day===6?0:day+1;
    return sumarDias(safe,-offset);
};
export const rangoSemana = fecha => {
    const inicio=sabadoDeSemana(fecha);
    return inicio?{inicio,fin:sumarDias(inicio,6)}:null;
};
export const hoyLocal = () => {
    const now=new Date();
    return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
};
export const pesos = n => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:0,maximumFractionDigits:2}).format(Number.isFinite(n)?n:0);
export const fechaCorta = s => {const [year,month,day]=String(s||'').split('-');return year&&month&&day?day+'/'+month+'/'+year:'—';};
export const escapeHtml = s => String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

export const pendienteCobro = i => {
    const total=numero(i.amount);
    const paid=i.paidAmount===undefined||i.paidAmount===null?0:numero(i.paidAmount);
    if(!Number.isFinite(total)||!Number.isFinite(paid))return NaN;
    if(String(i.status||'').toLowerCase()==='paid')return 0;
    return Math.max(0,total-paid);
};
export const esFactura = i => ['','invoice','factura'].includes(String(i.subtype??'').toLowerCase());

export function categoriasPagos(items) {
    const map=new Map();
    for(const item of items) {
        const importe=numero(item.importe);
        if(!Number.isFinite(importe))continue;
        const categoria=String(item.categoria||'SIN CATEGORÍA').trim()||'SIN CATEGORÍA';
        const key=categoria.toLocaleUpperCase('es-AR');
        if(!map.has(key)) map.set(key,{categoria:key,total:0,pagado:0,deuda:0,items:[]});
        const row=map.get(key);
        const estado=String(item.estado||'PENDIENTE').toUpperCase();
        row.total+=importe;
        if(estado==='PAGADO')row.pagado+=importe;
        else row.deuda+=importe;
        row.items.push(item);
    }
    return [...map.values()].sort((a,b)=>a.categoria.localeCompare(b.categoria,'es'));
}

export function construirBalance({pagos=[],cobros=[],inicio=hoyLocal(),semanas=8}) {
    const first=sabadoDeSemana(inicio);
    if(!first || !Number.isInteger(semanas) || semanas<1 || semanas>52) throw Error('Período semanal inválido');
    const last=sumarDias(first,semanas*7-1);
    const rows=Array.from({length:semanas},(_,n)=>{
        const desde=sumarDias(first,n*7);
        return {desde,hasta:sumarDias(desde,6),cobros:0,pagos:0,neto:0,acumulado:0,itemsCobro:[],itemsPago:[]};
    });
    const byWeek=new Map(rows.map(r=>[r.desde,r]));
    const alertas={pagosSinFecha:[],cobrosSinFecha:[],pagosSinImporte:[],cobrosSinImporte:[],estadosInesperados:[],pagosVencidos:[],cobrosVencidos:[]};
    let totalDeuda=0, totalPorCobrar=0;

    for(const item of pagos) {
        const estado=String(item.estado||'PENDIENTE').toUpperCase();
        if(estado==='PAGADO')continue;
        if(!['PENDIENTE','VENCIDO'].includes(estado)) {alertas.estadosInesperados.push(item);continue;}
        const importe=numero(item.importe);
        if(!Number.isFinite(importe)) {alertas.pagosSinImporte.push(item);continue;}
        if(importe<=0)continue;
        totalDeuda+=importe;
        const date=validarFecha(item.fecha);
        if(!date) {alertas.pagosSinFecha.push(item);continue;}
        if(date<inicio)alertas.pagosVencidos.push(item);
        const week=byWeek.get(sabadoDeSemana(date));
        if(week) {week.pagos+=importe;week.itemsPago.push({...item,importe});}
    }

    for(const item of cobros) {
        if(!esFactura(item) && !['cheque','transfer','cash'].includes(String(item.subtype||'').toLowerCase())) {
            // Cobros registra varios tipos; se agregan todos para representar pendientes por cobrar.
        }
        const importe=pendienteCobro(item);
        if(!Number.isFinite(importe)) {alertas.cobrosSinImporte.push(item);continue;}
        if(importe<=0)continue;
        totalPorCobrar+=importe;
        const date=validarFecha(item.dueDate||item.date);
        if(!date){alertas.cobrosSinFecha.push(item);continue;}
        if(date<inicio)alertas.cobrosVencidos.push(item);
        const week=byWeek.get(sabadoDeSemana(date));
        if(week){week.cobros+=importe;week.itemsCobro.push({...item,pendiente:importe});}
    }
    let acumulado=0;
    for(const row of rows){
        row.neto=row.cobros-row.pagos;
        acumulado+=row.neto;
        row.acumulado=acumulado;
        row.itemsPago.sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)));
        row.itemsCobro.sort((a,b)=>String(a.dueDate||'').localeCompare(String(b.dueDate||'')));
    }
    const sumar=(items,key)=>items.reduce((sum,item)=>sum+item[key],0);
    const totalPagosPeriodo=sumar(rows,'pagos');
    const totalCobrosPeriodo=sumar(rows,'cobros');
    return {
        desde:first,hasta:last,semanas:rows,alertas,
        totalPagosPeriodo,totalCobrosPeriodo,netoPeriodo:totalCobrosPeriodo-totalPagosPeriodo,
        deudaPendienteTotal:totalDeuda,cobrosPendientesTotal:totalPorCobrar,
        pagosFueraPeriodo:totalDeuda-totalPagosPeriodo,
        cobrosFueraPeriodo:totalPorCobrar-totalCobrosPeriodo
    };
}

export function htmlReporteCategoria(categorias) {
    const row=(c)=>`<tr><td>${escapeHtml(c.categoria)}</td><td class="number">${pesos(c.total)}</td><td class="number">${pesos(c.pagado)}</td><td class="number">${pesos(c.deuda)}</td></tr>`;
    const sum=key=>categorias.reduce((acc,c)=>acc+c[key],0);
    return `<div class="reporte-categorias">
      <style>@page{size:A4 portrait;margin:15mm}.reporte-categorias{font-family:Arial,sans-serif;color:#1e293b;padding:8px}.reporte-categorias h1{font-size:21px;margin:0 0 4px;color:#1d4ed8}.reporte-categorias p{color:#64748b;font-size:11px}.reporte-categorias table{border-collapse:collapse;width:100%;font-size:11px;margin-top:20px}.reporte-categorias th{background:#dbeafe;padding:10px 8px;text-align:left}.reporte-categorias td{border-bottom:1px solid #e2e8f0;padding:9px 8px}.reporte-categorias .number{text-align:right;white-space:nowrap}.reporte-categorias tfoot{font-weight:800;background:#eff6ff}</style>
      <h1>SII PALLETS · Pagos por categoría</h1>
      <p>Resumen de obligaciones registradas · Generado: ${new Date().toLocaleDateString('es-AR')}</p>
      <table><thead><tr><th>Categoría</th><th>Total histórico</th><th>Pagado</th><th>Deuda pendiente</th></tr></thead>
      <tbody>${categorias.map(row).join('')}</tbody>
      <tfoot><tr><td>TOTAL GENERAL</td><td class="number">${pesos(sum('total'))}</td><td class="number">${pesos(sum('pagado'))}</td><td class="number">${pesos(sum('deuda'))}</td></tr></tfoot></table>
      <p>Fuente: módulo Pagos, datos consultados en el momento de generar el informe.</p>
      </div>`;
}


// Documento de una semana: desglose de ambos lados y resultado neto, sin datos ficticios.
export function htmlReporteSemana(week) {
    if (!week || !validarFecha(week.desde) || !validarFecha(week.hasta)) throw Error('Semana inválida');
    const rowsCobros=(week.itemsCobro||[]).map(i=>`<tr><td>${fechaCorta(i.dueDate||i.date)}</td><td>${escapeHtml(i.payee||'Sin cliente')}</td><td>${escapeHtml(i.number||'—')}</td><td class="money">${pesos(i.pendiente)}</td></tr>`).join('');
    const rowsPagos=(week.itemsPago||[]).map(i=>`<tr><td>${fechaCorta(i.fecha)}</td><td>${escapeHtml(i.nombre||'Sin beneficiario')}<small>${escapeHtml(i.categoria||'Sin categoría')}</small></td><td>${escapeHtml(i.nro||'—')}</td><td class="money">${pesos(numero(i.importe))}</td></tr>`).join('');
    const empty='<tr><td colspan="4" class="empty">Sin movimientos previstos esta semana</td></tr>';
    const table=(title,items,rows,total,cls)=>`<section class="column ${cls}"><h2>${title}<span>${pesos(total)}</span></h2><table><thead><tr><th>Fecha</th><th>Cliente / Concepto</th><th>N°</th><th class="money">Importe</th></tr></thead><tbody>${items.length?rows:empty}</tbody><tfoot><tr><td colspan="3">TOTAL</td><td class="money">${pesos(total)}</td></tr></tfoot></table></section>`;
    return `<style>
        @page{size:A4 landscape;margin:12mm}
        body,.report-container{padding:0!important;font-family:Arial,sans-serif!important;color:#1e293b!important;font-size:11px!important}
        .weekly-report h1{font-size:19px!important;border-bottom:3px solid #4f46e5!important;width:100%!important;color:#1e293b!important;padding-bottom:8px!important}
        .weekly-report .intro{font-size:11px;color:#64748b;margin:8px 0 15px}
        .weekly-report .summary{width:100%;border-collapse:separate;border-spacing:8px;margin:0 -8px 14px}
        .weekly-report .summary td{border:1px solid #e2e8f0;border-radius:6px;padding:10px;width:33%;vertical-align:top}
        .weekly-report .summary small{display:block;color:#64748b;font-weight:700;text-transform:uppercase}
        .weekly-report .summary strong{font-size:16px;display:block;margin-top:5px}
        .weekly-report .columns{display:table;width:100%;table-layout:fixed;border-spacing:12px 0;margin-left:-12px}
        .weekly-report .column{display:table-cell;width:50%;vertical-align:top}
        .weekly-report .column h2{background:#dcfce7;color:#166534;font-size:13px;margin:0;padding:10px;display:flex;justify-content:space-between;gap:12px}
        .weekly-report .column.pay h2{background:#fee2e2;color:#991b1b}
        .weekly-report table{width:100%;border-collapse:collapse;margin:0}
        .weekly-report th{background:#f1f5f9!important;text-align:left;font-size:10px!important}
        .weekly-report th,.weekly-report .column td{padding:7px 5px;border-bottom:1px solid #e2e8f0;overflow-wrap:anywhere}
        .weekly-report .money{text-align:right!important;white-space:nowrap}
        .weekly-report small{display:block;color:#94a3b8}
        .weekly-report tfoot td{font-weight:bold;border-top:2px solid #94a3b8;background:#f8fafc}
        .weekly-report .empty{color:#94a3b8;text-align:center;padding:16px}
        .weekly-report tr{break-inside:avoid;page-break-inside:avoid}
        .weekly-report thead{display:table-header-group}
        .weekly-report .footer{font-size:10px;color:#64748b;margin-top:14px;border-top:1px solid #cbd5e1;padding-top:8px}
    </style>
    <div class="weekly-report">
        <h1>SII PALLETS · Balance semanal</h1>
        <p class="intro"><strong>Semana del sábado ${fechaCorta(week.desde)} al viernes ${fechaCorta(week.hasta)}</strong> · Generado: ${new Date().toLocaleDateString('es-AR')}</p>
        <table class="summary"><tr>
            <td><small>Cobranzas previstas</small><strong>${pesos(week.cobros)}</strong></td>
            <td><small>Pagos comprometidos</small><strong>${pesos(week.pagos)}</strong></td>
            <td><small>Diferencia semanal</small><strong>${pesos(week.neto)}</strong></td>
        </tr></table>
        <div class="columns">
            ${table('COBROS',week.itemsCobro||[],rowsCobros,week.cobros,'collect')}
            ${table('PAGOS',week.itemsPago||[],rowsPagos,week.pagos,'pay')}
        </div>
        <p class="footer">Proyección basada en saldos pendientes de Cobros y compromisos no pagados de Pagos Avanzado. Los importes indican vencimientos previstos, no dinero disponible.</p>
    </div>`;
}
