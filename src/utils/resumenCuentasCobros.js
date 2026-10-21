// Cálculos del resumen de facturación de Cobros.
// No escribe en Firebase y no depende de filtros visuales ni del estado de cobro.
const TIMEZONE = 'America/Argentina/Buenos_Aires';

export function diaDelRegistro(value, isTimestamp = false) {
    if (!value) return '';
    let valueString = '';
    if (value instanceof Date) {
        if (Number.isNaN(value.getTime())) return '';
        valueString = value.toISOString();
        isTimestamp = true;
    } else if (typeof value?.toDate === 'function') {
        const d = value.toDate();
        if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
        valueString = d.toISOString();
        isTimestamp = true;
    } else if (typeof value === 'string') valueString = value.trim();
    else return '';
    const isoMatch = valueString.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
    const latMatch = valueString.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    let normalized = '';
    if (isoMatch) normalized = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    else if (latMatch) normalized = `${latMatch[3]}-${latMatch[2]}-${latMatch[1]}`;
    else return '';

    const [year, month, day] = normalized.split('-').map(Number);
    const dateCheck = new Date(Date.UTC(year, month - 1, day));
    if (dateCheck.getUTCFullYear() !== year || dateCheck.getUTCMonth() !== month - 1 || dateCheck.getUTCDate() !== day) return '';

    // createdAt tiene instante UTC; convertirlo al día de trabajo argentino.
    if (isTimestamp && /[T ]\d{2}:\d{2}/.test(valueString)) {
        const instant = new Date(valueString);
        if (!Number.isNaN(instant.getTime())) {
            const parts = new Intl.DateTimeFormat('en-US', {
                timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit'
            }).formatToParts(instant);
            const part = key => parts.find(x => x.type === key)?.value;
            return `${part('year')}-${part('month')}-${part('day')}`;
        }
    }
    return normalized;
}

export function monedaEnCentavos(value) {
    if (value === null || value === undefined || (typeof value === 'string' && !value.trim())) return null;
    const numeric = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
    if (!Number.isFinite(numeric)) return null;
    return Math.round((numeric + Math.sign(numeric)*Number.EPSILON) * 100);
}

export function separarCuentasCobros(items, startDate, endDate, field = 'issueDate') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || startDate > endDate) {
        throw new Error('Seleccioná un rango de fechas válido.');
    }
    if (field !== 'issueDate' && field !== 'createdAt') throw new Error('Criterio de fecha no admitido.');

    const cuenta1 = [], cuenta2 = [];
    let sinFecha = 0, invalidos = 0;

    for (const item of items) {
        const rawDate = field === 'createdAt' ? item.createdAt : item.issueDate;
        const date = diaDelRegistro(rawDate, field === 'createdAt');
        if (!date) { sinFecha++; continue; }
        if (date < startDate || date > endDate) continue;
        const cents = monedaEnCentavos(item.amount);
        if (cents === null) invalidos++;
        // "invoice" es la denominación de Factura en la app (también admite registros "factura").
        const factura = ['invoice', 'factura'].includes(String(item.subtype || '').trim().toLowerCase());
        const originalCents = cents ?? 0;
        const netCents = factura ? Math.round(originalCents / 1.21) : originalCents;
        const row = {
            id: item.id || `fila-${cuenta1.length + cuenta2.length}`,
            fecha: date, cliente: String(item.payee || 'Sin cliente'),
            numero: String(item.number || 'S/N'),
            tipo: String(item.subtype || 'Sin tipo'),
            brutoCentavos: originalCents,
            netoCentavos: netCents,
            importeValido: cents !== null
        };
        (factura ? cuenta1 : cuenta2).push(row);
    }
    const sort = (a,b) => a.fecha.localeCompare(b.fecha) || a.cliente.localeCompare(b.cliente,'es') || a.numero.localeCompare(b.numero,'es');
    cuenta1.sort(sort); cuenta2.sort(sort);
    const sum = (list,key) => list.reduce((acc,row) => acc + row[key],0);
    const totalBruto1 = sum(cuenta1,'brutoCentavos');
    const total1 = sum(cuenta1,'netoCentavos');
    const total2 = sum(cuenta2,'brutoCentavos');
    return {
        cuenta1,cuenta2,sinFecha,invalidos,
        totalBruto1Centavos:totalBruto1,
        totalCuenta1Centavos:total1,
        ivaCuenta1Centavos:totalBruto1-total1,
        totalCuenta2Centavos:total2,
        totalGeneralCentavos:total1+total2,
        count:cuenta1.length+cuenta2.length
    };
}

export const pesos = (cents) => new Intl.NumberFormat('es-AR', {
    style:'currency',currency:'ARS',minimumFractionDigits:2,maximumFractionDigits:2
}).format(cents/100);

export function escapeHtml(text) {
    return String(text ?? '').replace(/[&<>"']/g, ch => ({
        '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[ch]));
}

export const fechaAR = (date) => {
    const [yy,mm,dd] = String(date || '').split('-');
    return yy && mm && dd ? `${dd}/${mm}/${yy}` : '—';
};

export function htmlResumenCuentas(result,startDate,endDate,field) {
    const count = Math.max(result.cuenta1.length, result.cuenta2.length);
    const htmlCell = (row,cuenta) => {
        if (!row) return '<td class="detalle"></td><td class="money"></td>';
        return `<td class="detalle"><span class="fecha">${escapeHtml(fechaAR(row.fecha))}</span><br/>
            <strong>${escapeHtml(row.cliente)}</strong><br/>
            <span class="referencia">Nº ${escapeHtml(row.numero)}${cuenta===2?' · '+escapeHtml(row.tipo):''}${row.importeValido?'':' · IMPORTE INVÁLIDO'}</span>
        </td><td class="money">${pesos(cuenta===1?row.netoCentavos:row.brutoCentavos)}</td>`;
    };
    let rows = '';
    for (let i=0;i<count;i++) {
        rows += `<tr>${htmlCell(result.cuenta1[i],1)}${htmlCell(result.cuenta2[i],2)}</tr>`;
    }
    if (!rows) rows='<tr><td colspan="4" class="sin-movimientos">No se encontraron registros en este período.</td></tr>';
    const fechaTexto = field==='createdAt' ? 'Fecha de carga (hora argentina)' : 'Fecha de emisión';
    const style=`<style>
        @page { size: A4 landscape; margin: 11mm; }
        body,.report-container { padding: 0 !important; color: #1e293b; font-family: Arial, sans-serif; }
        h1 { font-size: 19px !important; color: #115e59 !important; border: none !important; margin: 2px 0 7px !important; width: auto !important; }
        .topline { border-top: 5px solid #0f766e; padding-top: 10px; }
        .brand { font-size: 12px; font-weight: 800; color: #0f766e; letter-spacing: 0.7px; }
        .subtitle { margin-top: 2px; color: #64748b; font-size: 10px; }
        .periodo { background: #f1f5f9; padding: 9px 11px; border-radius: 6px; font-size: 11px; margin: 12px 0; }
        .kpis { width: 100%; border-spacing: 7px; border-collapse: separate; margin: 6px -7px 12px; }
        .kpis td { width: 33.33%; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
        .kpi-label { color: #64748b; font-size: 9px; text-transform: uppercase; font-weight: bold; }
        .kpi-value { font-size: 17px; color: #0f172a; font-weight: 800; margin-top: 4px; white-space: nowrap; }
        .cuentas { width:100%; table-layout:fixed; border-collapse:collapse; }
        .cuentas th { background:#e2e8f0; padding:7px; border:1px solid #cbd5e1; font-size:11px; }
        .cuentas .section1 { background:#ccfbf1; color:#115e59; }
        .cuentas .section2 { background:#dbeafe; color:#1e40af; }
        .cuentas td { border:1px solid #e2e8f0; padding:6px; vertical-align:top; font-size:10px; }
        .cuentas .detalle { width:34%; overflow-wrap:anywhere; }
        .cuentas .money { width:16%; text-align:right; white-space:nowrap; font-weight:700; font-size:10px; }
        .cuentas .fecha { font-size:9px; color:#64748b; }
        .cuentas .referencia { font-size:9px; color:#64748b; }
        .cuentas thead { display:table-header-group; }
        .cuentas tr { break-inside:avoid; page-break-inside:avoid; }
        .cuentas tfoot td { padding:9px; border-top:2px solid #64748b; font-size:11px; font-weight:bold; background:#f8fafc; }
        .cuentas .sin-movimientos { text-align:center; padding:20px; color:#64748b; }
        .observaciones { font-size:9px; color:#475569; line-height:1.5; margin-top:12px; }
        .footer { margin-top:12px; border-top:1px solid #cbd5e1; padding-top:8px; font-size:9px; color:#94a3b8; text-align:right; }
    </style>`;
    return `${style}
        <div class="topline">
            <div class="brand">SII PALLETS</div>
            <div class="subtitle">Tu producción, nuestro compromiso.</div>
            <h1>Resumen de facturación · Cuenta 1 y Cuenta 2</h1>
        </div>
        <div class="periodo"><strong>Período:</strong> ${fechaAR(startDate)} al ${fechaAR(endDate)}
            &nbsp; · &nbsp; <strong>Filtro:</strong> ${fechaTexto}
            &nbsp; · &nbsp; <strong>Registros:</strong> ${result.count}
            &nbsp; · &nbsp; <strong>Generado:</strong> ${new Date().toLocaleDateString('es-AR')}
        </div>
        <table class="kpis"><tbody><tr>
            <td><div class="kpi-label">Cuenta 1 · Facturas (sin IVA)</div><div class="kpi-value">${pesos(result.totalCuenta1Centavos)}</div><div class="subtitle">${result.cuenta1.length} registros</div></td>
            <td><div class="kpi-label">Cuenta 2 · Otros movimientos</div><div class="kpi-value">${pesos(result.totalCuenta2Centavos)}</div><div class="subtitle">${result.cuenta2.length} registros</div></td>
            <td><div class="kpi-label">Total ambas cuentas</div><div class="kpi-value">${pesos(result.totalGeneralCentavos)}</div><div class="subtitle">Cuenta 1 neta + Cuenta 2 original</div></td>
        </tr></tbody></table>
        <table class="cuentas"><thead>
            <tr><th class="section1" colspan="2">CUENTA 1 — FACTURAS (SIN IVA)</th><th class="section2" colspan="2">CUENTA 2 — RESTO DE COBROS</th></tr>
            <tr><th style="width:34%">Fecha · Cliente · Comprobante</th><th style="width:16%;text-align:right">Neto sin IVA</th><th style="width:34%">Fecha · Cliente · Comprobante</th><th style="width:16%;text-align:right">Importe original</th></tr>
        </thead><tbody>${rows}</tbody>
        <tfoot><tr><td>TOTAL CUENTA 1</td><td class="money">${pesos(result.totalCuenta1Centavos)}</td>
                    <td>TOTAL CUENTA 2</td><td class="money">${pesos(result.totalCuenta2Centavos)}</td></tr></tfoot>
        </table>
        <div class="observaciones">
            <strong>Detalle Cuenta 1:</strong> bruto original ${pesos(result.totalBruto1Centavos)}; IVA estimado incluido (21 %) ${pesos(result.ivaCuenta1Centavos)};
            base sin IVA ${pesos(result.totalCuenta1Centavos)}. Cada factura se dividió por 1,21 y redondeó a centavos antes de sumar.
            <br/><strong>Cuenta 2:</strong> importes tal como fueron cargados, sin descuentos ni división por IVA.
            <br/>Se incluyen movimientos cobrados y pendientes, por su importe originalmente registrado; este reporte no es un estado de cobranzas.
            ${result.sinFecha ? `<br/><strong>Atención:</strong> ${result.sinFecha} registros no tenían la fecha necesaria para este criterio y quedaron fuera.` : ''}
            ${result.invalidos ? `<br/><strong>Atención:</strong> ${result.invalidos} registros del período tenían un importe inválido; se muestran con $ 0,00 para revisión.` : ''}
            <br/>El neto y el IVA de Cuenta 1 presuponen una alícuota uniforme del 21 %. Confirmar con comprobantes si existen otras tasas o notas de crédito.
        </div>
        <div class="footer">SII PALLETS · Informe generado desde Cobros</div>`;
}
