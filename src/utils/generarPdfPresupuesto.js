import { EMISOR, fechaAR, pesosPDF, validarPresupuesto, nombreArchivo } from '../utils/presupuestosSii';
import { LOGO_PRESUPUESTO } from '../assets/logoPresupuesto';

const MM={ancho:210,alto:297,izquierda:8,derecha:202};
const t=(pdf,text,x,y,size=8,options={})=>{
  pdf.setFont('helvetica',options.bold?'bold':'normal');
  pdf.setFontSize(size);
  pdf.setTextColor(20,32,50);
  pdf.text(String(text??''),x,y,{align:options.align||'left'});
};
const money=(pdf,value,x,y,size=7)=>t(pdf,pesosPDF(value),x,y,size,{align:'right'});

async function imagenLogoPNG() {
  return await new Promise((resolve,reject)=>{
    const image=new Image();
    image.onload=()=>{
      try{
        const canvas=document.createElement('canvas');
        canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
        const ctx=canvas.getContext('2d');
        if(!ctx)throw Error('No se pudo preparar el logo');
        ctx.drawImage(image,0,0);
        resolve(canvas.toDataURL('image/png'));
      }catch(error){reject(error);}
    };
    image.onerror=()=>reject(Error('No se pudo cargar el logo actual'));
    image.src=LOGO_PRESUPUESTO;
  });
}

const dibujarCabeceraTabla=(pdf,y)=>{
  const xs=[8,20,104,119,136,152,178,202];
  pdf.setDrawColor(75,88,107);pdf.setLineWidth(.18);
  pdf.setFillColor(230,234,240);pdf.rect(8,y,194,8,'FD');
  const headers=['Ítem','Descripción','Alíc. %','Cantidad','Bultos','Precio Unit.','Subtotal'];
  const alignments=['left','left','center','center','center','right','right'];
  headers.forEach((h,i)=>{
    if(i>0)pdf.line(xs[i],y,xs[i],y+8);
    t(pdf,h,alignments[i]==='right'?xs[i+1]-1.5:alignments[i]==='center'?(xs[i]+xs[i+1])/2:xs[i]+1.5,y+5,6.1,
      {bold:true,align:alignments[i]});
  });
  return xs;
};
function primeraPagina(pdf,quote,logo) {
  pdf.setDrawColor(40,49,61);pdf.setLineWidth(.25);
  pdf.rect(8,8,194,281);
  pdf.line(8,15,202,15);
  t(pdf,'ORIGINAL',105,12.8,7,{align:'center',bold:true});
  pdf.line(8,73,202,73);
  pdf.line(105,15,105,73);
  pdf.addImage(logo,'PNG',11,20,30,30);
  t(pdf,'SOLUCIONES INDUSTRIALES',61,27,7,{bold:true,align:'center'});
  t(pdf,'INTEGRALES EN PALLETS',61,32,7,{bold:true,align:'center'});
  t(pdf,'Razón Social: '+EMISOR.razonSocial,10.5,53,7.1,{bold:true});
  t(pdf,'Domicilio Comercial: '+EMISOR.domicilio,10.5,58,6.7);
  t(pdf,EMISOR.localidad,10.5,62,6.7);
  t(pdf,'Condición frente al IVA: '+EMISOR.iva,10.5,66,6.6);
  t(pdf,'Tel.: '+EMISOR.telefono,10.5,70.2,6.5);
  t(pdf,'PRESUPUESTO',154,28,13,{bold:true,align:'center'});
  t(pdf,'Compr. Nro.: '+quote.numero,111,37,8,{bold:true});
  t(pdf,'Fecha de Emisión: '+fechaAR(quote.fecha),111,43,8);
  t(pdf,'CUIT: '+EMISOR.cuit,111,51,8,{bold:true});
  t(pdf,'Ingresos Brutos:',111,57,7.5);
  t(pdf,'Fecha de Inicio de Actividades:  /  /',111,63,7.2);
  pdf.line(8,91,202,91);
  t(pdf,'Sr(es): '+quote.cliente.razonSocial,10,79,8,{bold:true});
  t(pdf,'Domicilio: '+(quote.cliente.domicilio||'—'),111,79,7.4);
  t(pdf,'CUIT: '+(quote.cliente.cuit||'—'),10,85,7.4);
  t(pdf,'Condición frente al IVA: '+(quote.cliente.condicionIVA||'—'),111,85,7.1);
  if(quote.cliente.telefono) t(pdf,'Tel.: '+quote.cliente.telefono,10,89,6.2);
  dibujarCabeceraTabla(pdf,94);
  pdf.line(8,102,202,102);
  return 102;
}
function paginaSiguiente(pdf,quote,page) {
  pdf.addPage('a4','p');
  pdf.setDrawColor(60,72,90);pdf.setLineWidth(.25);
  pdf.rect(8,8,194,281);
  t(pdf,'SII PALLETS · PRESUPUESTO '+quote.numero,10,15,9,{bold:true});
  t(pdf,'Continuación · página '+page,200,15,7,{align:'right'});
  pdf.line(8,20,202,20);
  dibujarCabeceraTabla(pdf,24);
  return 32;
}
function escribirRenglon(pdf,row,index,y,cuenta) {
  const descripcion=String(row.descripcion||'');
  pdf.setFont('helvetica','normal');pdf.setFontSize(7);
  const descriptionLines=pdf.splitTextToSize(descripcion,81);
  const alto=Math.max(8,descriptionLines.length*3.75+3);
  pdf.setDrawColor(213,219,227);pdf.setLineWidth(.12);
  pdf.line(8,y+alto,202,y+alto);
  const xs=[20,104,119,136,152,178];
  xs.forEach(x=>pdf.line(x,y,x,y+alto));
  t(pdf,String(row.codigo||String(index+1).padStart(4,'0')).slice(0,8),9.5,y+4.5,6.3);
  pdf.setFontSize(7);pdf.text(descriptionLines,21.5,y+4.5);
  t(pdf,cuenta==='1'?'21,00':'—',111.5,y+4.5,7,{align:'center'});
  t(pdf,Number(row.cantidad).toLocaleString('es-AR'),127.5,y+4.5,7,{align:'center'});
  t(pdf,Number(row.bultos).toLocaleString('es-AR'),144,y+4.5,7,{align:'center'});
  money(pdf,row.precioCentavos,176.3,y+4.5,6.7);
  money(pdf,row.subtotalCentavos,200.5,y+4.5,6.7);
  return y+alto;
}
function ponerTotales(pdf,totals,cuenta,y) {
  // Preserva la composición del modelo: total a la derecha, base e IVA al pie.
  const top=Math.max(y+10,266);
  pdf.setDrawColor(44,56,72);pdf.setLineWidth(.22);
  pdf.line(8,top,202,top);
  pdf.line(161,top,161,289);
  t(pdf,'SUBTOTAL',11,top+6,7,{bold:true});
  money(pdf,totals.subtotalCentavos,85,top+6,7.5);
  if(cuenta==='1') {
    t(pdf,'IVA 21 %',11,top+12,7,{bold:true});
    money(pdf,totals.ivaCentavos,85,top+12,7.5);
  }
  t(pdf,'TOTAL ($)',181.5,top+8,8,{bold:true,align:'center'});
  money(pdf,totals.totalCentavos,200,top+17,11);
}
export async function generarPdfPresupuesto(data) {
  const totals=validarPresupuesto(data);
  const [{jsPDF},logo]=await Promise.all([import('jspdf'),imagenLogoPNG()]);
  const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true});
  pdf.setProperties({title:'Presupuesto '+data.numero,subject:'Presupuesto comercial SII PALLETS',author:EMISOR.razonSocial});
  let y=primeraPagina(pdf,data,logo),page=1;
  for(let i=0;i<totals.lineas.length;i++){
    const row=totals.lineas[i];
    pdf.setFont('helvetica','normal');pdf.setFontSize(7);
    const height=Math.max(8,pdf.splitTextToSize(row.descripcion,81).length*3.75+3);
    if(y+height>255) {page++;y=paginaSiguiente(pdf,data,page);}
    y=escribirRenglon(pdf,row,i,y,totals.cuenta);
  }
  if(y>254) {page++;y=paginaSiguiente(pdf,data,page);}
  ponerTotales(pdf,totals,totals.cuenta,y);
  return {blob:pdf.output('blob'),filename:nombreArchivo(data),totals};
}
export function descargarPdf(blob,filename) {
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),120000);
}
