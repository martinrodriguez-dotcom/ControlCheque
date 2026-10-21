import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconPrinter, IconX } from '../components/Icons';
import { handleReportAction } from '../utils/helpers';
import { separarCuentasCobros, htmlResumenCuentas, pesos, fechaAR } from '../utils/resumenCuentasCobros';

const getToday = () => {
    const now = new Date();
    return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
};
const getFirstOfMonth = () => getToday().slice(0,7)+'-01';

export default function ResumenCuentasCobros({ collectItems = [] }) {
    const [open,setOpen] = useState(false);
    const modalRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        // El componente Cobros tiene una animación con transform; un modal fixed
        // dentro de ese contenedor se posiciona respecto del contenido, no del viewport.
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        modalRef.current?.focus({ preventScroll: true });
        const onEscape = (event) => {
            if (event.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', onEscape);
        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', onEscape);
        };
    }, [open]);
    const [startDate,setStartDate] = useState(getFirstOfMonth);
    const [endDate,setEndDate] = useState(getToday);
    const [dateField,setDateField] = useState('issueDate');

    const error = !startDate || !endDate ? 'Seleccioná ambas fechas.' :
        startDate>endDate ? 'La fecha de inicio no puede ser posterior a la fecha final.' : '';
    const report = useMemo(()=>{
        if (error) return null;
        try {return separarCuentasCobros(collectItems,startDate,endDate,dateField);}
        catch {return null;}
    },[collectItems,startDate,endDate,dateField,error]);

    const imprimir = () => {
        if(error || !report || report.count===0) return;
        const title = `SII PALLETS - Resumen de Cuentas ${startDate} al ${endDate}`;
        handleReportAction(title,htmlResumenCuentas(report,startDate,endDate,dateField),
            'print',`SII_Resumen_Cuentas_${startDate}_al_${endDate}`);
    };

    return <>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5 bg-white rounded-xl shadow-sm border border-emerald-200 p-3">
            <div>
                <p className="text-xs font-bold text-slate-800">Informe de facturación · Dos cuentas</p>
                <p className="text-[11px] text-slate-500">Resumen de Cuenta 1 y Cuenta 2 por período</p>
            </div>
            <button type="button" onClick={()=>setOpen(true)}
                className="inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm transition">
                <IconPrinter className="w-4 h-4"/> Imprimir resumen
            </button>
        </div>
        {open && createPortal(<div className="fixed inset-0 z-[9999] bg-slate-950/65 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-5" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false);}}>
            <div role="dialog" aria-modal="true" aria-labelledby="resumen-cobros-title" ref={modalRef} tabIndex={-1}
                className="w-full max-w-3xl max-h-[min(92dvh,900px)] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden outline-none">
                <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-4 sm:p-5">
                    <div>
                        <h2 id="resumen-cobros-title" className="text-lg font-black text-slate-800">Resumen de facturación por cuentas</h2>
                        <p className="text-xs text-slate-500 mt-1">Seleccioná las fechas y comprobá los totales antes de imprimir.</p>
                    </div>
                    <button type="button" aria-label="Cerrar" onClick={()=>setOpen(false)}
                        className="p-2 text-slate-500 rounded-lg hover:bg-slate-100"><IconX className="w-5 h-5"/></button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <label className="text-xs font-bold text-slate-600">Desde
                            <input type="date" value={startDate} max={endDate||undefined}
                                onChange={e=>setStartDate(e.target.value)} className="block w-full mt-1 border border-slate-200 bg-slate-50 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-300"/>
                        </label>
                        <label className="text-xs font-bold text-slate-600">Hasta
                            <input type="date" value={endDate} min={startDate||undefined}
                                onChange={e=>setEndDate(e.target.value)} className="block w-full mt-1 border border-slate-200 bg-slate-50 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-300"/>
                        </label>
                        <label className="text-xs font-bold text-slate-600">Filtrar por
                            <select value={dateField} onChange={e=>setDateField(e.target.value)}
                                className="block w-full mt-1 border border-slate-200 bg-slate-50 p-3 rounded-xl text-sm outline-none focus:ring-2 focus:ring-emerald-300">
                                <option value="issueDate">Fecha de emisión</option>
                                <option value="createdAt">Fecha de carga</option>
                            </select>
                        </label>
                    </div>
                    {error && <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 rounded-lg p-3 text-xs font-bold">{error}</p>}
                    {report && <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="rounded-xl border border-teal-200 bg-teal-50 p-3">
                                <p className="text-[10px] uppercase tracking-wide text-teal-700 font-bold">Cuenta 1 · Facturas sin IVA</p>
                                <p className="text-lg font-black text-teal-900 mt-1">{pesos(report.totalCuenta1Centavos)}</p>
                                <p className="text-[11px] text-teal-700">{report.cuenta1.length} comprobantes</p>
                            </div>
                            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
                                <p className="text-[10px] uppercase tracking-wide text-blue-700 font-bold">Cuenta 2 · Otros movimientos</p>
                                <p className="text-lg font-black text-blue-900 mt-1">{pesos(report.totalCuenta2Centavos)}</p>
                                <p className="text-[11px] text-blue-700">{report.cuenta2.length} registros</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-[10px] uppercase tracking-wide text-slate-600 font-bold">Total ambas cuentas</p>
                                <p className="text-lg font-black text-slate-900 mt-1">{pesos(report.totalGeneralCentavos)}</p>
                                <p className="text-[11px] text-slate-600">{report.count} registros en el período</p>
                            </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 overflow-hidden">
                            <div className="grid grid-cols-2 text-xs font-bold text-center">
                                <div className="bg-teal-100 text-teal-900 p-3 border-r border-slate-200">CUENTA 1 · FACTURAS</div>
                                <div className="bg-blue-100 text-blue-900 p-3">CUENTA 2 · RESTO</div>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-slate-200">
                                {[report.cuenta1,report.cuenta2].map((list,index)=>(
                                    <div key={index} className="min-w-0 divide-y divide-slate-100 text-xs">
                                        {list.length===0?<p className="p-4 text-slate-400 text-center">Sin registros</p>:
                                            list.slice(0,6).map(row=>(
                                                <div key={row.id} className="px-3 py-2 flex flex-col sm:flex-row sm:justify-between gap-1">
                                                    <div className="min-w-0">
                                                        <p className="text-slate-500 text-[10px]">{fechaAR(row.fecha)} · Nº {row.numero}</p>
                                                        <p className="font-semibold text-slate-700 break-words">{row.cliente}</p>
                                                    </div>
                                                    <p className="font-bold text-slate-900 whitespace-nowrap">{pesos(index===0?row.netoCentavos:row.brutoCentavos)}</p>
                                                </div>
                                            ))}
                                        {list.length>6 && <p className="text-center p-3 text-slate-500">Y {list.length-6} registros más en la impresión…</p>}
                                    </div>
                                ))}
                            </div>
                        </div>
                        {(report.sinFecha>0 || report.invalidos>0) && <div className="text-[11px] text-slate-600 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                            {report.sinFecha>0 && <p className="text-amber-800 font-bold">{report.sinFecha} registros sin {dateField==='createdAt'?'fecha de carga':'fecha de emisión'} quedaron fuera del período.</p>}
                            {report.invalidos>0 && <p className="text-rose-700 font-bold">{report.invalidos} registros tienen importes inválidos. Revisalos antes de imprimir.</p>}
                        </div>}
                    </>}
                </div>
                <div className="border-t border-slate-200 p-4 flex flex-wrap justify-between items-center gap-3 bg-white">
                    <span className="text-[11px] text-slate-500">Formato de impresión: A4 horizontal · Dos columnas</span>
                    <div className="flex gap-2">
                        <button type="button" onClick={()=>setOpen(false)} className="border border-slate-200 px-4 py-2.5 text-xs font-bold rounded-xl hover:bg-slate-50">Cancelar</button>
                        <button type="button" onClick={imprimir} disabled={!!error||!report||report.count===0||report.invalidos>0}
                            className="bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white px-4 py-2.5 rounded-xl inline-flex items-center gap-2 text-xs font-bold">
                            <IconPrinter className="w-4 h-4"/> Imprimir resumen
                        </button>
                    </div>
                </div>
            </div>
        </div>, document.body)}
    </>;
}
