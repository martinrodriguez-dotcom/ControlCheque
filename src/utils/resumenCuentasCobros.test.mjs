import test from 'node:test';
import assert from 'node:assert/strict';
import { separarCuentasCobros, diaDelRegistro, htmlResumenCuentas, pesos, escapeHtml } from './resumenCuentasCobros.js';

const data = [
    {id:'a',payee:'Cliente Uno',number:'A-01',subtype:'invoice',amount:1210,issueDate:'2026-10-10',createdAt:'2026-10-11T03:00:00.000Z',status:'paid'},
    {id:'b',payee:'Cliente Dos',number:'A-02',subtype:'factura',amount:242,issueDate:'2026-10-20',createdAt:'2026-10-20T23:00:00.000Z',status:'pending'},
    {id:'c',payee:'Cliente Tres',number:'CH-1',subtype:'cheque',amount:400,issueDate:'2026-10-11',createdAt:'2026-10-12T11:00:00.000Z'},
    {id:'d',payee:'Cliente Cuatro',number:'TR-1',subtype:'transfer',amount:350.45,issueDate:'2026-10-21',createdAt:'2026-10-22T01:00:00.000Z'},
    {id:'e',payee:'Otro mes',number:'A-03',subtype:'invoice',amount:605,issueDate:'2026-09-30',createdAt:'2026-10-02T18:00:00.000Z'}
];

test('Clasifica facturas como Cuenta 1 y otros Cobros como Cuenta 2, sin filtrar pagados',()=>{
    const res=separarCuentasCobros(data,'2026-10-01','2026-10-21');
    assert.deepEqual(res.cuenta1.map(x=>x.id),['a','b']);
    assert.deepEqual(res.cuenta2.map(x=>x.id),['c','d']);
    assert.equal(res.totalBruto1Centavos,145200);
    assert.equal(res.totalCuenta1Centavos,120000);
    assert.equal(res.ivaCuenta1Centavos,25200);
    assert.equal(res.totalCuenta2Centavos,75045);
    assert.equal(res.totalGeneralCentavos,195045);
    assert.equal(res.count,4);
});

test('Filtra desde/hasta inclusive y no usa vencimiento como emisión',()=>{
    const res=separarCuentasCobros([
        {id:'1',subtype:'invoice',issueDate:'2026-10-01',dueDate:'2026-11-30',amount:121},
        {id:'2',subtype:'invoice',issueDate:'2026-10-21',dueDate:'2026-11-30',amount:121},
        {id:'3',subtype:'invoice',dueDate:'2026-10-02',amount:121},
        {id:'4',subtype:'cash',issueDate:'2026-10-22',amount:10}
    ],'2026-10-01','2026-10-21');
    assert.equal(res.count,2);
    assert.equal(res.sinFecha,1);
    assert.equal(res.totalCuenta1Centavos,20000);
});

test('Fecha de carga se interpreta en hora argentina y difiere de la emisión',()=>{
    assert.equal(diaDelRegistro('2026-10-22T01:00:00.000Z',true),'2026-10-21');
    assert.equal(diaDelRegistro('2026-10-22T04:00:00.000Z',true),'2026-10-22');
    const res=separarCuentasCobros(data,'2026-10-21','2026-10-21','createdAt');
    assert.deepEqual(res.cuenta2.map(x=>x.id),['d']);
});

test('Valores decimales de cuenta 1 se redondean individualmente antes de sumar',()=>{
    const res=separarCuentasCobros([
        {id:'1',subtype:'invoice',issueDate:'2026-10-01',amount:1.01},
        {id:'2',subtype:'invoice',issueDate:'2026-10-01',amount:1.01}
    ],'2026-10-01','2026-10-01');
    assert.equal(res.totalCuenta1Centavos,166); // 1,01 / 1,21 = 0,8347...; 0,83 cada factura.
});

test('Sin datos erróneos ni cambios a originales',()=>{
    const original=JSON.stringify(data);
    const res=separarCuentasCobros(data,'2026-10-01','2026-10-21');
    assert.equal(JSON.stringify(data),original);
    assert.equal(res.invalidos,0);
    const invalid=separarCuentasCobros([{id:'bad',subtype:'cash',issueDate:'2026-10-10',amount:''}],'2026-10-01','2026-10-21');
    assert.equal(invalid.invalidos,1);
});

test('Validación de rangos y fechas',()=>{
    assert.throws(()=>separarCuentasCobros(data,'2026-10-21','2026-10-01'),/rango/);
    assert.throws(()=>separarCuentasCobros(data,'2026-10-01','2026-10-21','otro'),/[Cc]riterio/);
    assert.equal(diaDelRegistro('32/10/2026'),'');
    assert.equal(diaDelRegistro('2026-02-30'),'');
});

test('Salida imprimible escapa datos de cliente',()=>{
    const res=separarCuentasCobros([{id:'u',subtype:'invoice',issueDate:'2026-10-02',payee:'<script>alert("x")</script>',number:'A&B',amount:121}],'2026-10-01','2026-10-21');
    const html=htmlResumenCuentas(res,'2026-10-01','2026-10-21','issueDate');
    assert.ok(!html.includes('<script>alert('));
    assert.ok(html.includes('&lt;script&gt;'));
    assert.ok(html.includes('A&amp;B'));
    assert.equal(escapeHtml(`<"'>`),'&lt;&quot;&#39;&gt;');
});

test('Formato monetario en pesos, dos decimales',()=>{
    assert.match(pesos(12345),/123,45/);
});
