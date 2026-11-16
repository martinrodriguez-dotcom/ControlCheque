// Presupuestos comerciales de SII PALLETS. Cálculos puros y sin escrituras en Firebase.
// Los datos de cabecera provienen del modelo físico aportado por la empresa.
export const EMISOR = Object.freeze({
  razonSocial: 'RIOLFO MARTIN GUSTAVO',
  domicilio: 'LUIS N PALMA 4227 (2820)',
  localidad: 'GUALEGUAYCHÚ',
  iva: 'IVA Responsable Inscripto',
  cuit: '20257113543',
  telefono: '344560271',
  marca: 'SII PALLETS',
  descripcion: 'SOLUCIONES INDUSTRIALES INTEGRALES EN PALLETS'
});
export const IVA = 0.21;
export const COTIZACION_SERIE = '0005';
export const COTIZACION_INICIO = 502; // Modelo suministrado: 0005-00000501.
export const numeroCotizacion = (n = COTIZACION_INICIO) => `${COTIZACION_SERIE}-${String(Math.max(1,Math.floor(Number(n)||COTIZACION_INICIO))).padStart(8,'0')}`;
export function fechaHoyLocal() {
  const today=new Date();
  return [today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-');
}
export const fechaAR = iso => {
  const m=String(iso||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m?`${m[3]}/${m[2]}/${m[1]}`:'—';
};
export const pesosPDF = cents => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',minimumFractionDigits:2,maximumFractionDigits:2}).format(cents/100);
export const numeroNatural = value => {
  if(typeof value === 'number') return Number.isFinite(value)?value:NaN;
  if(typeof value !== 'string' || !value.trim()) return NaN;
  const s=value.trim().replace(/\s|\$/g,'');
  return Number(s.includes(',')?s.replace(/\./g,'').replace(',','.'):s);
};
export const centavos = value => {
  const n=numeroNatural(value);
  return Number.isFinite(n)?Math.round(n*100):NaN;
};
export const ITEM_VACIO = () => ({id:`linea-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,codigo:'',descripcion:'',cantidad:'1',bultos:'0',precioUnitario:''});
export function calcularPresupuesto(data) {
  const cuenta=String(data.cuenta||'1');
  if(!['1','2'].includes(cuenta))throw Error('Cuenta de facturación inválida');
  const items=(data.items||[]).filter(i=>String(i.descripcion||'').trim() || String(i.precioUnitario||'').trim());
  if(!items.length)throw Error('Cargá al menos un producto.');
  if(items.length>100)throw Error('El presupuesto admite como máximo 100 renglones.');
  const lineas=items.map((item,index)=>{
    const cantidad=numeroNatural(item.cantidad);
    const bultos=String(item.bultos??'').trim()===''?0:numeroNatural(item.bultos);
    const unitario=centavos(item.precioUnitario);
    if(!String(item.descripcion||'').trim()) throw Error('Completá la descripción del ítem '+(index+1)+'.');
    if(!Number.isFinite(cantidad)||cantidad<=0||cantidad>1000000)throw Error('Cantidad inválida en ítem '+(index+1)+'.');
    if(!Number.isFinite(bultos)||bultos<0||bultos>1000000)throw Error('Bultos inválidos en ítem '+(index+1)+'.');
    if(!Number.isFinite(unitario)||unitario<0||unitario>1e13)throw Error('Precio inválido en ítem '+(index+1)+'.');
    const subtotalCentavos=Math.round(unitario*cantidad);
    return {
      ...item,cantidad,bultos,precioCentavos:unitario,subtotalCentavos,
      codigo:String(item.codigo||'').trim()||String(index+1).padStart(4,'0')
    };
  });
  const subtotalCentavos=lineas.reduce((s,l)=>s+l.subtotalCentavos,0);
  const ivaCentavos=cuenta==='1'?Math.round(subtotalCentavos*IVA):0;
  return {lineas,cuenta,subtotalCentavos,ivaCentavos,totalCentavos:subtotalCentavos+ivaCentavos};
}
export function validarPresupuesto(data) {
  if(!String(data.numero||'').trim())throw Error('Ingresá el número de presupuesto.');
  if(!/^\d{4}-\d{8}$/.test(String(data.numero||'').trim()))throw Error('Usá numeración 0005-00000502.');
  const [y,m,d]=String(data.fecha||'').split('-').map(Number);
  const date=new Date(Date.UTC(y,m-1,d));
  if(!y||date.getUTCFullYear()!==y||date.getUTCMonth()!==m-1||date.getUTCDate()!==d)throw Error('Fecha de emisión inválida.');
  if(!String(data.cliente?.razonSocial||'').trim())throw Error('Completá la razón social del cliente.');
  return calcularPresupuesto(data);
}
export const nombreArchivo = data => {
  const clean=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-_]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48);
  return `SII_Presupuesto_${clean(data.numero)}_${clean(data.cliente?.razonSocial)}.pdf`;
};
