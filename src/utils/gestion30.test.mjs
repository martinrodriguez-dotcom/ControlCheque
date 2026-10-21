import test from 'node:test';
import assert from 'node:assert/strict';
import {
    isoDay, invoiceSummary, monthlyInvoiceTrend, clientAccounts,
    outstanding, cashFlow, modelMargins, auditItems
} from './gestion30.js';

test('Fechas locales en distintos formatos sin cambio de día', () => {
    assert.equal(isoDay('2026-10-21'), '2026-10-21');
    assert.equal(isoDay('21/10/2026'), '2026-10-21');
    assert.equal(isoDay('21-10-2026'), '2026-10-21');
    assert.equal(isoDay(''), '');
});

test('Solo las facturas del mes integran la facturación', () => {
    const records = [
        {id:'1',subtype:'invoice',issueDate:'2026-10-12',amount:121},
        {id:'2',subtype:'cheque',issueDate:'2026-10-12',amount:300},
        {id:'3',subtype:'invoice',issueDate:'2026-09-12',amount:60},
        {id:'4',subtype:'factura',issueDate:'21/10/2026',amount:242}
    ];
    const summary=invoiceSummary(records,'2026-10');
    assert.equal(summary.count,2);
    assert.equal(summary.amount,363);
    assert.equal(summary.estimatedNet21,300);
});

test('Tendencia termina en el mes seleccionado', () => {
    const trend=monthlyInvoiceTrend([],6,'2026-10-21');
    assert.deepEqual(trend.map(x=>x.month),['2026-05','2026-06','2026-07','2026-08','2026-09','2026-10']);
});

test('Cuenta corriente agrupa clientes, descuenta cobros parciales sin duplicación', () => {
    const c=clientAccounts([
        {id:'1',subtype:'invoice',payee:'Empresa S.A.',amount:121000,paidAmount:21000},
        {id:'2',subtype:'invoice',payee:' empresa s.a. ',amount:120000,paidAmount:120000},
        {id:'3',subtype:'transfer',payee:'Empresa S.A.',amount:20000}
    ]);
    assert.equal(c.length,1);
    assert.equal(c[0].invoiced,241000);
    assert.equal(c[0].pending,100000);
});

test('Vencidos fuera del saldo futuro, y pagos parciales descontados', () => {
    const result=cashFlow({
        today:'2026-10-21',days:3,opening:500,
        collectItems:[{id:'f1',subtype:'invoice',dueDate:'2026-10-22',amount:2000,paidAmount:800}],
        payItems:[{id:'p1',dueDate:'2026-10-23',amount:1500,paidAmount:500},
                  {id:'p2',dueDate:'2026-10-15',amount:800,paidAmount:0}],
        expenseItems:[],walletItems:[]
    });
    assert.equal(result.incomes,1200);
    assert.equal(result.expenses,1000);
    assert.equal(result.closing,700);
    assert.equal(result.overdue.length,1);
    assert.equal(result.days[0].balance,500);
    assert.equal(result.days[1].balance,1700);
    assert.equal(result.days[2].balance,700);
});

test('Rentabilidad recalcula materiales actuales del modelo, no usa el costo histórico en caché', () => {
    const models=[{id:'m1',nombre:'EUR',totalCosto:400,items:[{costoId:'a',qty:2},{costoId:'b',qty:1}]}];
    const costs=[{id:'a',costo_unitario:300},{id:'b',costo_unitario:100}];
    const [result]=modelMargins(models,costs,{m1:1000});
    assert.equal(result.cost,700);
    assert.equal(result.margin,300);
    assert.equal(result.marginPercent,30);
    assert.deepEqual(result.missing,[]);
});

test('Auditoría detecta duplicado y pagos que exceden el total', () => {
    const list=[
        {id:'x',subtype:'invoice',payee:'Cliente',number:'A-1',issueDate:'2026-10-01',dueDate:'2026-10-31',amount:100,paidAmount:200},
        {id:'y',subtype:'invoice',payee:'Cliente',number:'A-1',issueDate:'2026-10-02',dueDate:'2026-10-31',amount:100,paidAmount:0}
    ];
    const issues=auditItems({collectItems:list});
    assert.equal(issues.filter(i=>i.kind==='duplicada').length,1);
    assert.equal(issues.filter(i=>i.kind==='cobranza').length,1);
});

test('Saldo pendiente nunca es negativo al superar pagos el total', () => {
    assert.equal(outstanding({amount:100,paidAmount:120}),0);
});
