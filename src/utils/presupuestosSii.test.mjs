import test from 'node:test';
import assert from 'node:assert/strict';
import { EMISOR, ITEM_VACIO, calcularPresupuesto, validarPresupuesto,numeroCotizacion, nombreArchivo,fechaAR, pesosPDF, COTIZACION_INICIO } from './presupuestosSii.js';

const quote = {
 numero:'0005-00000502',fecha:'2026-11-16',cuenta:'1',
 cliente:{razonSocial:'Industrias Río',cuit:'20123456789',domicilio:'Gualeguaychú',condicionIVA:'Responsable Inscripto'},
 items:[{id:'a',codigo:'P-01',descripcion:'Pallet nuevo',cantidad:'2',bultos:'0',precioUnitario:'1000'},
        {id:'b',codigo:'P-02',descripcion:'Pallet usado',cantidad:'3',bultos:'1',precioUnitario:'500.25'}]
};
test('Cuenta 1 incorpora IVA 21 % sobre el subtotal de renglones',()=>{
 const res=validarPresupuesto(quote);
 assert.equal(res.lineas.length,2);
 assert.equal(res.lineas[0].subtotalCentavos,200000);
 assert.equal(res.lineas[1].subtotalCentavos,150075);
 assert.equal(res.subtotalCentavos,350075);
 assert.equal(res.ivaCentavos,73516);
 assert.equal(res.totalCentavos,423591);
});
test('Cuenta 2 no incorpora IVA ni altera precios, unidades o datos',()=>{
 const snapshot=JSON.stringify(quote);
 const res=validarPresupuesto({...quote,cuenta:'2'});
 assert.equal(res.ivaCentavos,0);
 assert.equal(res.totalCentavos,350075);
 assert.equal(JSON.stringify(quote),snapshot);
});
test('Cálculo por cantidad y moneda con decimales',()=>{
 const res=calcularPresupuesto({...quote,items:[{descripcion:'Corte',cantidad:'2.5',bultos:'0',precioUnitario:'10,80'}]});
 assert.equal(res.subtotalCentavos,2700);
 assert.equal(res.totalCentavos,3267);
});
test('Error si faltan cliente, productos, precios o cantidad',()=>{
 assert.throws(()=>validarPresupuesto({...quote,cliente:{}}),/razón social/);
 assert.throws(()=>validarPresupuesto({...quote,items:[]}),/al menos/);
 assert.throws(()=>validarPresupuesto({...quote,items:[{descripcion:'Item',cantidad:0,precioUnitario:'10'}]}),/Cantidad inválida/);
 assert.throws(()=>validarPresupuesto({...quote,items:[{descripcion:'Item',cantidad:1,precioUnitario:''}]}),/Precio inválido/);
});
test('Número de comprobante y fechas válidos',()=>{
 assert.equal(numeroCotizacion(COTIZACION_INICIO),'0005-00000502');
 assert.equal(fechaAR('2026-11-16'),'16/11/2026');
 assert.throws(()=>validarPresupuesto({...quote,numero:'1'}),/numeración/);
 assert.throws(()=>validarPresupuesto({...quote,fecha:'2026-02-30'}),/Fecha de emisión/);
});
test('No se toma el número del ejemplo previo como fijo y nombres son seguros',()=>{
 assert.equal(numeroCotizacion(510),'0005-00000510');
 const name=nombreArchivo({...quote,cliente:{razonSocial:'Cliente / Ñandú S.A.'}});
 assert.ok(name.endsWith('.pdf'));
 assert.ok(!name.includes('/'));
});
test('Datos fijos del emisor y formato ARS',()=>{
 assert.equal(EMISOR.razonSocial,'RIOLFO MARTIN GUSTAVO');
 assert.equal(EMISOR.localidad,'GUALEGUAYCHÚ');
 assert.ok(pesosPDF(123456).includes('1.234,56'));
 assert.equal(ITEM_VACIO().cantidad,'1');
});
