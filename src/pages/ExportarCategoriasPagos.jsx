import React, { useState } from 'react';
import { IconDownload, IconPrinter } from '../components/Icons';
import { categoriasPagos, htmlReporteCategoria, pesos } from '../utils/balanceSemanal';
import { handleReportAction } from '../utils/helpers';

// XLSX genuino (Office Open XML), con celdas numéricas editables en Excel.
const xmlEscape = value => String(value??'').replace(/[&<>"']/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const xcell=(ref,value,isNumber=false)=>isNumber
    ? `<c r="${ref}" s="1"><v>${Number(value)||0}</v></c>`
    : `<c r="${ref}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
const download=(blob,filename)=>{
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
};
export async function exportarExcelCategorias(categorias) {
    const { zipSync, strToU8 } = await import('fflate');
    const totals=['total','pagado','deuda'].map(k=>categorias.reduce((s,c)=>s+c[k],0));
    const rows=[
        ['CATEGORÍA','TOTAL HISTÓRICO','PAGADO','DEUDA PENDIENTE'],
        ...categorias.map(c=>[c.categoria,c.total,c.pagado,c.deuda]),
        ['TOTAL GENERAL',...totals]
    ];
    const sheetRows=rows.map((values,index)=>{
        const row=index+1;
        const cols=['A','B','C','D'];
        return `<row r="${row}">${values.map((v,col)=>xcell(cols[col]+row,v,index>0&&col>0)).join('')}</row>`;
    }).join('');
    const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <dimension ref="A1:D${rows.length}"/>
      <sheetViews><sheetView workbookViewId="0"/></sheetViews>
      <cols><col min="1" max="1" width="31" customWidth="1"/><col min="2" max="4" width="23" customWidth="1"/></cols>
      <sheetData>${sheetRows}</sheetData>
    </worksheet>`;
    const workbook=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Por categoría" sheetId="1" r:id="rId1"/></sheets></workbook>`;
    const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
      <numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00"/></numFmts>
      <fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>
      <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
      <borders count="1"><border/></borders>
      <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
      <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs>
    </styleSheet>`;
    const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
      <Default Extension="xml" ContentType="application/xml"/>
      <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
      <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
      <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
    </Types>`;
    const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
    </Relationships>`;
    const workbookRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
    </Relationships>`;
    const files={'[Content_Types].xml':contentTypes,'_rels/.rels':rootRels,
        'xl/workbook.xml':workbook,'xl/_rels/workbook.xml.rels':workbookRels,
        'xl/worksheets/sheet1.xml':sheet,'xl/styles.xml':styles};
    const bytes=zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)])));
    download(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),
        'SII_Pagos_por_Categoria.xlsx');
}

export async function exportarPdfCategorias(categorias) {
    const importer=await import('html2pdf.js');
    const html2pdf=importer.default || importer;
    const html=htmlReporteCategoria(categorias);
    await html2pdf().set({
        margin:10, filename:'SII_Pagos_por_Categoria.pdf',
        image:{type:'jpeg',quality:0.98},
        html2canvas:{scale:2,useCORS:true},
        jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},
        pagebreak:{mode:['css','legacy']}
    }).from(html,'string').save();
}

export default function ExportarCategoriasPagos({pagosState}) {
    const [working,setWorking]=useState('');
    const [error,setError]=useState('');
    const categories = pagosState.ready ? categoriasPagos(pagosState.items) : [];
    const disabled = !pagosState.ready || working.length>0;
    const excel=async()=>{
        setError('');setWorking('excel');
        try {await exportarExcelCategorias(categories);}catch(err){setError('Error generando Excel: '+(err.message||String(err)));}finally{setWorking('');}
    };
    const pdf=async()=>{
        setError('');setWorking('pdf');
        try{await exportarPdfCategorias(categories);}
        catch(err){setError('No se pudo generar PDF: '+(err.message||String(err)));}
        finally{setWorking('');}
    };
    const print=()=>{
        setError('');
        if(disabled)return;
        handleReportAction('SII PALLETS - Pagos por categoría',htmlReporteCategoria(categories),'print','');
    };
    return <div className="rounded-xl bg-white border border-slate-200 shadow-sm px-4 py-3 mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
            <p className="text-sm font-bold text-slate-800">Informe de Pagos · Por categoría</p>
            <p className="text-xs text-slate-500">{pagosState.loading ? 'Consultando Pagos…' :
                !pagosState.ready ? 'Datos de Pagos no disponibles.' :
                `${categories.length} categorías · Deuda pendiente ${pesos(categories.reduce((s,c)=>s+c.deuda,0))}`}</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
            <button type="button" disabled={disabled} onClick={excel} className="rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-xs font-bold px-3 py-2.5 flex items-center gap-1"><IconDownload className="w-4 h-4"/> {working==='excel'?'Generando…':'Excel (.xlsx)'}</button>
            <button type="button" disabled={disabled} onClick={pdf} className="rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-xs font-bold px-3 py-2.5 flex items-center gap-1"><IconDownload className="w-4 h-4"/> {working==='pdf'?'Generando…':'PDF'}</button>
            <button type="button" disabled={disabled} onClick={print} className="rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 text-slate-700 text-xs font-bold px-3 py-2.5 flex items-center gap-1"><IconPrinter className="w-4 h-4"/> Imprimir</button>
        </div>
        {(pagosState.error||error) && <p role="alert" className="basis-full text-xs font-bold text-rose-700">{pagosState.error||error}</p>}
        <p className="basis-full text-[11px] text-slate-500">Se exportan las categorías completas de Pagos, con total histórico, pagado y pendiente. Los datos se consultan en tiempo real y no se modifican.</p>
    </div>;
}
