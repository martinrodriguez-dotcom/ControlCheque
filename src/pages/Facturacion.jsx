// Archivo: src/pages/Facturacion.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from '../firebase';
import { formatMoney } from '../utils/helpers';
import { IconPencil, IconCheck, IconX, IconFileText } from '../components/Icons';

export default function Facturacion({ collectItems = [], theme }) {
    // Obtenemos el mes actual respetando la zona horaria (Formato YYYY-MM)
    const getLocalMonth = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    };
    
    const [selectedMonth, setSelectedMonth] = useState(getLocalMonth());
    const [dbData, setDbData] = useState({ creditoFiscal: 0, manualDebito: null, saldoAnterior: 0 });
    const [isEditingDebito, setIsEditingDebito] = useState(false);
    const [tempDebito, setTempDebito] = useState('');
    const [tempCredito, setTempCredito] = useState('');
    const [tempSaldoAnterior, setTempSaldoAnterior] = useState('');

    useEffect(() => {
        const docRef = doc(db, 'config_sii', `iva_${selectedMonth}`);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setDbData({
                    creditoFiscal: data.creditoFiscal || 0,
                    manualDebito: data.manualDebito !== undefined ? data.manualDebito : null,
                    saldoAnterior: data.saldoAnterior || 0
                });
                setTempCredito(data.creditoFiscal || '');
                setTempSaldoAnterior(data.saldoAnterior || '');
            } else {
                setDbData({ creditoFiscal: 0, manualDebito: null, saldoAnterior: 0 });
                setTempCredito('');
                setTempSaldoAnterior('');
            }
        });
        return () => unsubscribe();
    }, [selectedMonth]);

    // Métricas calculadas dinámicamente con las facturas de Cobros
    const calculos = useMemo(() => {
        const facturasDelMes = collectItems.filter(item => {
            const sub = (item.subtype || '').toLowerCase().trim();
            const isInvoice = sub === 'invoice' || sub === 'factura' || sub === '';
            
            const rawDate = item.issueDate || item.dueDate || item.date || '';
            if (!rawDate) return false;

            const cleanDate = rawDate.toString().replace(/\//g, '-').trim();
            const parts = cleanDate.split('-');
            
            let y = '';
            let m = '';

            if (parts.length >= 3) {
                if (parts[0].length === 4) {
                    y = parts[0]; m = parts[1];
                } else if (parts[2].length === 4) {
                    y = parts[2]; m = parts[1];
                }
            }

            if (!y || !m) return false;
            const itemYearMonth = `${y}-${String(m).padStart(2, '0')}`;

            return isInvoice && itemYearMonth === selectedMonth;
        });

        const totalConIva = facturasDelMes.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
        const facturacionSinIva = totalConIva / 1.21;
        const debitoCalculado = totalConIva - facturacionSinIva;

        return {
            cantidadFacturas: facturasDelMes.length,
            totalConIva,
            facturacionSinIva,
            debitoCalculado
        };
    }, [collectItems, selectedMonth]);

    // Consolidación de Valores Finales (Firebase + Cálculos)
    const debitoFinal = dbData.manualDebito !== null ? parseFloat(dbData.manualDebito) : calculos.debitoCalculado;
    const creditoFinal = parseFloat(dbData.creditoFiscal) || 0;
    const saldoAnteriorFinal = parseFloat(dbData.saldoAnterior) || 0;

    // Fórmula 1: Crédito Fiscal - Débito Fiscal = Saldo Técnico de este mes
    const saldoTecnico = creditoFinal - debitoFinal;

    // Fórmula 2: Saldo Técnico + Saldo Anterior (Manual de remanente viejo) = Posición Final
    const balanceFinal = saldoTecnico + saldoAnteriorFinal;

    // Métodos de Persistencia en Firebase por cada Mes
    const guardarCredito = async () => {
        const val = parseFloat(tempCredito) || 0;
        await setDoc(doc(db, 'config_sii', `iva_${selectedMonth}`), { creditoFiscal: val }, { merge: true });
        alert("Crédito Fiscal guardado exitosamente.");
    };

    const guardarSaldoAnterior = async () => {
        const val = parseFloat(tempSaldoAnterior) || 0;
        await setDoc(doc(db, 'config_sii', `iva_${selectedMonth}`), { saldoAnterior: val }, { merge: true });
        alert("Saldo Anterior acumulado guardado exitosamente.");
    };

    const guardarDebitoManual = async () => {
        const val = parseFloat(tempDebito);
        const dataToSave = isNaN(val) ? { manualDebito: null } : { manualDebito: val };
        await setDoc(doc(db, 'config_sii', `iva_${selectedMonth}`), dataToSave, { merge: true });
        setIsEditingDebito(false);
    };

    const resetearDebito = async () => {
        await setDoc(doc(db, 'config_sii', `iva_${selectedMonth}`), { manualDebito: null }, { merge: true });
        setIsEditingDebito(false);
    };

    return (
        <div className="animate-fade-in">
            {/* Header Selector */}
            <div className="bg-white p-5 rounded-2xl shadow-md border-l-8 mb-6 border-pink-500 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <IconFileText className="w-5 h-5 text-pink-500"/> Facturación e Impuestos
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">Análisis de IVA (21%) sobre facturas emitidas.</p>
                </div>
                <div>
                    <input 
                        type="month" 
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="p-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-pink-500 bg-gray-50 shadow-sm"
                    />
                </div>
            </div>

            {/* MÓDULO 1: FACTURAS EMITIDAS */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Facturación Sin IVA</span>
                    <span className="text-xl font-black text-gray-800">{formatMoney(calculos.facturacionSinIva)}</span>
                    <span className="text-[9px] text-gray-400 mt-1">Base imponible calculada</span>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Total Facturación Con IVA</span>
                    <span className="text-xl font-black text-blue-600">{formatMoney(calculos.totalConIva)}</span>
                    <span className="text-[9px] text-gray-400 mt-1">{calculos.cantidadFacturas} facturas en {selectedMonth}</span>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-pink-100 flex flex-col justify-center items-center text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-pink-500"></div>
                    <span className="text-[10px] font-bold text-pink-600 uppercase tracking-wider mb-1 flex items-center gap-1">
                        Débito Fiscal (IVA)
                        {!isEditingDebito && (
                            <button onClick={() => { setTempDebito(debitoFinal); setIsEditingDebito(true); }} className="text-gray-400 hover:text-pink-600 transition-colors">
                                <IconPencil className="w-3 h-3" />
                            </button>
                        )}
                    </span>

                    {isEditingDebito ? (
                        <div className="flex flex-col items-center gap-2 mt-1 w-full animate-fade-in">
                            <input 
                                type="number" 
                                step="0.01" 
                                className="w-full text-center p-1 border border-pink-300 rounded text-sm font-bold outline-none focus:ring-2 focus:ring-pink-500"
                                value={tempDebito}
                                onChange={(e) => setTempDebito(e.target.value)}
                            />
                            <div className="flex gap-1 w-full">
                                <button onClick={guardarDebitoManual} className="flex-1 bg-green-100 text-green-700 py-1 rounded flex justify-center hover:bg-green-200"><IconCheck className="w-4 h-4"/></button>
                                <button onClick={resetearDebito} className="flex-1 bg-gray-100 text-gray-600 py-1 rounded text-[9px] font-bold hover:bg-gray-200">Auto</button>
                                <button onClick={() => setIsEditingDebito(false)} className="flex-1 bg-red-100 text-red-700 py-1 rounded flex justify-center hover:bg-red-200"><IconX className="w-4 h-4"/></button>
                            </div>
                        </div>
                    ) : (
                        <div className="animate-fade-in flex flex-col items-center">
                            <span className="text-xl font-black text-pink-600">{formatMoney(debitoFinal)}</span>
                            {dbData.manualDebito !== null && <span className="text-[9px] bg-pink-100 text-pink-700 px-2 py-0.5 rounded-full mt-1 font-bold">Editado Manual</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* MÓDULO 2: DATOS COMPENSATORIOS MANUALES */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                {/* Crédito Manual */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide border-b pb-2">Crédito Fiscal (Compras)</h3>
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="text-[10px] text-gray-500 block mb-1">Ingresar monto IVA a favor de compras ($)</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                className="w-full p-3 bg-gray-50 rounded-lg border outline-none font-bold text-gray-800 focus:ring-2 focus:ring-emerald-500" 
                                placeholder="0.00" 
                                value={tempCredito}
                                onChange={(e) => setTempCredito(e.target.value)}
                            />
                        </div>
                        <button onClick={guardarCredito} className="bg-emerald-600 text-white px-4 py-3 rounded-lg font-bold text-sm hover:bg-emerald-700 transition-colors shadow-sm">
                            Guardar
                        </button>
                    </div>
                </div>

                {/* Saldo Técnico Anterior Manual */}
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                    <h3 className="text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide border-b pb-2">Saldo Técnico Anterior</h3>
                    <div className="flex gap-2 items-end">
                        <div className="flex-1">
                            <label className="text-[10px] text-gray-500 block mb-1">Arrastre de IVA a favor mes anterior ($)</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                className="w-full p-3 bg-gray-50 rounded-lg border outline-none font-bold text-gray-800 focus:ring-2 focus:ring-blue-500" 
                                placeholder="0.00" 
                                value={tempSaldoAnterior}
                                onChange={(e) => setTempSaldoAnterior(e.target.value)}
                            />
                        </div>
                        <button onClick={guardarSaldoAnterior} className="bg-blue-600 text-white px-4 py-3 rounded-lg font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm">
                            Guardar
                        </button>
                    </div>
                </div>
            </div>

            {/* MÓDULO 3: DETERMINACIÓN DE SALDOS Y VEREDICTO IMPOSITIVO */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Saldo Técnico del Periodo */}
                <div className="bg-white p-5 rounded-xl shadow-md border border-gray-200 flex flex-col justify-center items-center text-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Saldo Técnico del Mes</span>
                    <span className={`text-2xl font-black ${saldoTecnico >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {saldoTecnico >= 0 ? '+' : ''}{formatMoney(saldoTecnico)}
                    </span>
                    <span className="text-[9px] text-gray-400 mt-1.5 italic">(Crédito Fiscal - Débito Fiscal)</span>
                </div>

                {/* Posición Final con el Saldo Técnico Anterior acumulado */}
                <div className={`p-5 rounded-xl shadow-md border flex flex-col justify-center items-center text-center transition-colors duration-300 ${balanceFinal < 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Posición Final de IVA</span>
                    
                    {balanceFinal < 0 ? (
                        <div className="animate-fade-in flex flex-col items-center">
                            <span className="text-2xl font-black text-red-600">{formatMoney(Math.abs(balanceFinal))}</span>
                            <span className="mt-2 bg-red-600 text-white text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest shadow-sm animate-pulse">IVA A PAGAR</span>
                        </div>
                    ) : (
                        <div className="animate-fade-in flex flex-col items-center">
                            <span className="text-2xl font-black text-emerald-600">{formatMoney(balanceFinal)}</span>
                            <span className="mt-2 bg-emerald-600 text-white text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest shadow-sm">IVA A FAVOR</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
