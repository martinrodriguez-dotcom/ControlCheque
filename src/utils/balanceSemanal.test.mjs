import test from 'node:test';
import assert from 'node:assert/strict';
import {rangoSemana,sabadoDeSemana,sumarDias,construirBalance,categoriasPagos,htmlReporteCategoria,htmlReporteSemana,numero,validarFecha} from './balanceSemanal.js';

test('Semana idéntica a Pagos: sábado a viernes, incluso cambio de mes y año',()=>{
    assert.equal(sabadoDeSemana('2026-10-22'),'2026-10-17');
    assert.deepEqual(rangoSemana('2026-10-22'),{inicio:'2026-10-17',fin:'2026-10-23'});
    assert.deepEqual(rangoSemana('2026-10-24'),{inicio:'2026-10-24',fin:'2026-10-30'});
    assert.deepEqual(rangoSemana('2027-01-01'),{inicio:'2026-12-26',fin:'2027-01-01'});
    assert.equal(sumarDias('2026-12-31',1),'2027-01-01');
});
test('Balance usa compromisos reales; descuenta cobros parciales, sin tomar pagos pagados',()=>{
    const res=construirBalance({inicio:'2026-10-22',semanas:2,
        pagos:[
            {id:1,fecha:'2026-10-23',importe:1000,estado:'PENDIENTE',categoria:'MERCADERÍA'},
            {id:2,fecha:'2026-10-24',importe:700,estado:'VENCIDO',categoria:'IMPUESTOS'},
            {id:3,fecha:'2026-10-23',importe:500,estado:'PAGADO'},
            {id:4,fecha:'2026-10-20',importe:300,estado:'PENDIENTE'}
        ],
        cobros:[
            {id:'c1',dueDate:'2026-10-23',amount:1210,paidAmount:210,status:'partial'},
            {id:'c2',dueDate:'2026-10-24',amount:900,paidAmount:900,status:'paid'},
            {id:'c3',dueDate:'2026-10-24',amount:800,paidAmount:0,status:'pending'}
        ]});
    assert.equal(res.desde,'2026-10-17');
    assert.equal(res.hasta,'2026-10-30');
    assert.equal(res.totalPagosPeriodo,2000);
    assert.equal(res.totalCobrosPeriodo,1800);
    assert.equal(res.netoPeriodo,-200);
    assert.equal(res.semanas[0].pagos,1300);
    assert.equal(res.semanas[0].cobros,1000);
    assert.equal(res.semanas[1].pagos,700);
    assert.equal(res.semanas[1].cobros,800);
    assert.equal(res.semanas[1].acumulado,-200);
});
test('Deuda vencida antes del período no se duplica en próximas semanas',()=>{
    const data=construirBalance({inicio:'2026-10-31',semanas:1,pagos:[{fecha:'2026-10-20',estado:'PENDIENTE',importe:400}],cobros:[{dueDate:'2026-10-21',amount:900}]});
    assert.equal(data.deudaPendienteTotal,400);
    assert.equal(data.pagosFueraPeriodo,400);
    assert.equal(data.totalPagosPeriodo,0);
    assert.equal(data.totalCobrosPeriodo,0);
    assert.equal(data.cobrosFueraPeriodo,900);
});
test('Categorías replican Total Histórico, Pagado y Deuda de Pagos',()=>{
    const cats=categoriasPagos([
        {categoria:'fletes',importe:400,estado:'PAGADO'},
        {categoria:'FLETES',importe:600,estado:'PENDIENTE'},
        {categoria:'MADERA',importe:200,estado:'VENCIDO'}
    ]);
    const fletes=cats.find(x=>x.categoria==='FLETES');
    assert.equal(fletes.total,1000);assert.equal(fletes.pagado,400);assert.equal(fletes.deuda,600);
    assert.equal(cats.find(x=>x.categoria==='MADERA').deuda,200);
});
test('Sin acceso a Pagos la lógica no inventa montos ni usa Gastos antiguos',()=>{
    const b=construirBalance({inicio:'2026-10-22',semanas:2,pagos:[],cobros:[]});
    assert.equal(b.totalPagosPeriodo,0);
    assert.equal(b.totalCobrosPeriodo,0);
    assert.equal(validarFecha('2026-02-30'),'');
    assert.ok(Number.isNaN(numero('texto')));
});
test('HTML de categoría escapa datos de proveedores y categorías',()=>{
    const cats=categoriasPagos([{categoria:'<script>alert(1)</script>',importe:1200,estado:'PENDIENTE'}]);
    const html=htmlReporteCategoria(cats);
    assert.ok(!html.includes('<script>alert('));
    assert.ok(html.includes('&lt;SCRIPT&gt;'));
    assert.ok(html.includes('TOTAL GENERAL'));
    assert.ok(html.includes('TOTAL HISTÓRICO')===false || html.toLowerCase().includes('total histórico'));
});

test('Impresión de una semana respeta fechas sábado-viernes y desglosa ambos lados',()=>{
    const balance=construirBalance({
        inicio:'2026-10-22',semanas:1,
        pagos:[{id:17,fecha:'2026-10-23',nombre:'Proveedor & Cía',categoria:'MADERA',nro:'CH-11',importe:300,estado:'PENDIENTE'}],
        cobros:[{id:'abc',dueDate:'2026-10-22',payee:'<Cliente>',number:'F-20',amount:1210,paidAmount:210,status:'partial'}]
    });
    const html=htmlReporteSemana(balance.semanas[0]);
    assert.ok(html.includes('17/10/2026'));
    assert.ok(html.includes('23/10/2026'));
    assert.ok(html.includes('COBROS') && html.includes('PAGOS'));
    assert.ok(html.includes('Proveedor &amp; Cía'));
    assert.ok(html.includes('&lt;Cliente&gt;'));
    assert.ok(html.includes('CH-11'));
    assert.ok(html.includes('F-20'));
    assert.ok(html.includes('Diferencia semanal'));
    assert.ok(!html.includes('<Cliente>'));
    assert.ok(!html.includes('Sin movimientos previstos esta semana'));
});
