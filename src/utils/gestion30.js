// SII PALLETS 3.0 — cálculos puros, sin escritura en Firebase.
export const numberValue = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'string') {
        const raw = value.trim().replace(/\s/g, '');
        const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
        const parsed = Number(normalized);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
};

export const sumOf = (items, key = 'amount') => items.reduce((sum, item) => sum + numberValue(item[key]), 0);

export const isoDay = (date) => {
    if (!date) return '';
    const raw = String(date).trim();
    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return iso[1] + '-' + iso[2].padStart(2, '0') + '-' + iso[3].padStart(2, '0');
    const legacy = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (legacy) return legacy[3] + '-' + legacy[2].padStart(2, '0') + '-' + legacy[1].padStart(2, '0');
    return '';
};

export const localToday = () => {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
};

export const plusDays = (day, count) => {
    const [year, month, date] = day.split('-').map(Number);
    const result = new Date(year, month - 1, date + count);
    return [result.getFullYear(), String(result.getMonth()+1).padStart(2,'0'), String(result.getDate()).padStart(2,'0')].join('-');
};

export const invoiceLike = (item) => {
    const kind = String(item?.subtype || 'invoice').trim().toLowerCase();
    return kind === 'invoice' || kind === 'factura';
};

export const invoiceDate = (item) => isoDay(item.issueDate || item.dueDate || item.date);
export const outstanding = (item) => Math.max(0, numberValue(item.amount) - numberValue(item.paidAmount));

export function invoiceSummary(items, month) {
    const invoices = items.filter(i => invoiceLike(i) && invoiceDate(i).slice(0,7) === month);
    return { invoices, amount: sumOf(invoices), estimatedNet21: sumOf(invoices)/1.21, count: invoices.length };
}

export function monthlyInvoiceTrend(items, months = 6, today = localToday()) {
    const baseYear = Number(today.slice(0, 4));
    const baseMonth = Number(today.slice(5, 7));
    return Array.from({length:months}, (_, index) => {
        const date = new Date(baseYear, baseMonth - months + index + 1, 1);
        const month = [date.getFullYear(), String(date.getMonth()+1).padStart(2, '0')].join('-');
        const summary = invoiceSummary(items, month);
        return { month, label: date.toLocaleDateString('es-AR', {month:'short'}), ...summary };
    });
}

export function clientAccounts(collectItems) {
    const map = new Map();
    for (const item of collectItems.filter(invoiceLike)) {
        const key = String(item.payee || 'Sin cliente').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-AR');
        if (!map.has(key)) map.set(key, {key, name: String(item.payee || 'Sin cliente').trim(), items:[], invoiced:0, paid:0, pending:0});
        const client = map.get(key);
        client.items.push(item);
        client.invoiced += numberValue(item.amount);
        client.paid += numberValue(item.paidAmount);
        client.pending += outstanding(item);
    }
    return [...map.values()].sort((a,b) => b.pending-a.pending || a.name.localeCompare(b.name,'es'));
}

export function forecastEvents({payItems = [], collectItems = [], walletItems = [], expenseItems = []}) {
    const defs = [
        ['Cheque a pagar','egreso','pay',payItems],
        ['Factura por cobrar','ingreso','collect',collectItems.filter(invoiceLike)],
        ['Cheque en cartera','ingreso','wallet',walletItems],
        ['Gasto por pagar','egreso','expense',expenseItems]
    ];
    return defs.flatMap(([label,side,origin,items]) => items.map(item => ({
        id: origin+'-'+item.id,
        origin, label, side,
        payee: item.payee || item.description || 'Sin descripción',
        number: item.number || '',
        date: isoDay(item.dueDate || item.date),
        amount: outstanding(item),
        original: item
    })).filter(event => event.amount > 0));
}

export function cashFlow({payItems = [], collectItems = [], walletItems = [], expenseItems = [], today = localToday(), days = 30, opening = 0}) {
    const end = plusDays(today, days - 1);
    const events = forecastEvents({payItems, collectItems, walletItems, expenseItems});
    const invalid = events.filter(e => !e.date);
    const overdue = events.filter(e => e.date && e.date < today);
    const upcoming = events.filter(e => e.date && e.date >= today && e.date <= end);
    const buckets = new Map();
    upcoming.forEach(e => {
        const bucket = buckets.get(e.date) || {date:e.date, income:0, expenses:0, events:[]};
        if (e.side === 'ingreso') bucket.income += e.amount;
        else bucket.expenses += e.amount;
        bucket.events.push(e);
        buckets.set(e.date,bucket);
    });
    let balance = numberValue(opening);
    const daysDetail = Array.from({length:days}, (_, index) => {
        const date = plusDays(today,index);
        const bucket = buckets.get(date) || {date, income:0, expenses:0, events:[]};
        balance += bucket.income - bucket.expenses;
        return {...bucket, balance};
    });
    return {
        today, end, days:daysDetail, events:upcoming,
        overdue, invalid, opening:numberValue(opening),
        incomes:upcoming.filter(e=>e.side==='ingreso').reduce((s,e)=>s+e.amount,0),
        expenses:upcoming.filter(e=>e.side==='egreso').reduce((s,e)=>s+e.amount,0),
        closing:balance,
        lowest:Math.min(numberValue(opening), ...daysDetail.map(d=>d.balance))
    };
}

export function modelMargins(models, costItems, priceByModel = {}) {
    const costs = new Map(costItems.map(c => [c.id,c]));
    return models.map(model => {
        const missing = [];
        let cost = 0;
        (model.items || []).forEach(part => {
            const found = costs.get(part.costoId);
            if (!found) missing.push(part.costoId);
            else cost += numberValue(found.costo_unitario) * numberValue(part.qty);
        });
        const salePrice = numberValue(priceByModel[model.id]);
        return {...model, cost, salePrice, missing, margin:salePrice-cost, marginPercent:salePrice > 0 ? (salePrice-cost)/salePrice*100 : null};
    });
}

export function auditItems({collectItems=[],payItems=[],walletItems=[],expenseItems=[]}) {
    const issues = [];
    const invoices = collectItems.filter(invoiceLike);
    const seen = new Map();
    for (const item of invoices) {
        const ref = String(item.number || '').trim().toUpperCase();
        const client = String(item.payee || '').trim().toUpperCase();
        const key = client + '|' + ref;
        if (ref && seen.has(key)) issues.push({kind:'duplicada',source:'collect',item,message:'Mismo cliente y número de factura que otro registro'});
        else if (ref) seen.set(key,item.id);
    }
    for (const [source,items] of Object.entries({collect:collectItems,pay:payItems,wallet:walletItems,expense:expenseItems})) {
        for (const item of items) {
            if (!item.id) continue;
            const amount=numberValue(item.amount),paid=numberValue(item.paidAmount);
            if (!Number.isFinite(Number(item.amount)) || amount <= 0) issues.push({kind:'importe',source,item,message:'Importe vacío, inválido o no positivo'});
            if (paid > amount + 0.01) issues.push({kind:'cobranza',source,item,message:'Importe cobrado/pagado mayor que el total'});
            if (paid < -0.01) issues.push({kind:'cobranza',source,item,message:'Importe cobrado/pagado negativo'});
            if (!isoDay(item.dueDate || item.date)) issues.push({kind:'fecha',source,item,message:'No tiene vencimiento válido'});
            if (source === 'collect' && invoiceLike(item)) {
                if (!isoDay(item.issueDate)) issues.push({kind:'fecha',source,item,message:'Factura sin fecha de emisión válida'});
                if (!String(item.number||'').trim()) issues.push({kind:'numero',source,item,message:'Factura sin numeración'});
                if (!String(item.payee||'').trim()) issues.push({kind:'cliente',source,item,message:'Factura sin cliente'});
            }
        }
    }
    return issues;
}

export function downloadFile(name, content, type) {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadCsv(name, rows, headers) {
    const safe = value => {
        const v = String(value ?? '');
        const escaped = /^[=+@\-]/.test(v) && !/^-?\d+(?:\.\d+)?$/.test(v) ? "'" + v : v;
        return '"' + escaped.replace(/"/g, '""') + '"';
    };
    const body = [headers.map(h=>safe(h[0])).join(';'), ...rows.map(r=>headers.map(h=>safe(r[h[1]])).join(';'))].join('\r\n');
    downloadFile(name, '\uFEFF' + body, 'text/csv;charset=utf-8');
}
