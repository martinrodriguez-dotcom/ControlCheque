// Archivo: src/pages/Pallets.jsx

import React, { useState } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore";
import { db } from '../firebase';
import { formatMoney, handleReportAction } from '../utils/helpers';
import { 
    IconPlus, IconCheck, IconX, IconChevronDown, IconChevronUp, 
    IconPencil, IconTrash, IconPrinter, IconDownload, IconMessage 
} from '../components/Icons';

export default function Pallets({ theme, produccionMensual, costosMadres, palletsTemplates, presupuestos }) {
    // Estados locales exclusivos de la página Pallets
    const [palletTab, setPalletTab] = useState('costos'); // 'costos' | 'modelos' | 'presupuestos'
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState(null);

    const [newCosto, setNewCosto] = useState({ 
        nombre: '', tipo: 'Fijo', costoTotal: '', cantidad: 1, unidad: 'u', alto: '', ancho: '', largo: '' 
    });
    const [newPallet, setNewPallet] = useState({ nombre: '', items: [] });
    const [newQuote, setNewQuote] = useState({ cliente: '', items: [] });

    const [expandedPallets, setExpandedPallets] = useState({});
    const [expandedQuotes, setExpandedQuotes] = useState({});

    // ==========================================
    // LÓGICA DE COSTOS MADRES
    // ==========================================
    const editCostoMadre = (c) => {
        setNewCosto({...c});
        setEditingId(c.id);
        setShowAddForm(true);
    };

    const addCostoMadre = async (e) => {
        e.preventDefault();
        let pie2_unitario = 0;
        let costo_unitario = 0;
        
        const costoInput = parseFloat(newCosto.costoTotal);
        let cantFloat = 1;
        let unitText = newCosto.unidad;

        if (newCosto.tipo === 'Fijo') {
            cantFloat = produccionMensual;
            unitText = 'pallets';
            costo_unitario = costoInput / cantFloat;
        } else if (newCosto.tipo === 'Madera') {
            cantFloat = parseFloat(newCosto.cantidad) || 1;
            unitText = newCosto.unidad || 'u';
            
            const a = parseFloat(newCosto.alto) || 0;
            const w = parseFloat(newCosto.ancho) || 0;
            const l = parseFloat(newCosto.largo) || 0;
            pie2_unitario = (a * w * l) / 12;
            
            costo_unitario = costoInput * pie2_unitario;
        } else {
            cantFloat = parseFloat(newCosto.cantidad) || 1;
            costo_unitario = costoInput / cantFloat;
        }

        const dataToSave = {
            ...newCosto, 
            cantidad: cantFloat, 
            unidad: unitText,
            costoTotal: costoInput, 
            costo_unitario, 
            pie2_unitario,
            updatedAt: new Date().toISOString()
        };

        if (editingId) {
            await updateDoc(doc(db, 'costos_madres_sii', 'main_list', 'items', editingId), dataToSave);
        } else {
            dataToSave.createdAt = new Date().toISOString();
            await addDoc(collection(db, 'costos_madres_sii', 'main_list', 'items'), dataToSave);
        }
        
        setNewCosto({ nombre: '', tipo: 'Fijo', costoTotal: '', cantidad: 1, unidad: 'u', alto: '', ancho: '', largo: '' });
        setEditingId(null);
        setShowAddForm(false);
    };

    const deleteCostoMadre = async (id) => { 
        if(confirm('¿Eliminar Costo Madre?')) await deleteDoc(doc(db, 'costos_madres_sii', 'main_list', 'items', id)); 
    };

    // ==========================================
    // LÓGICA DE MODELOS DE PALLETS
    // ==========================================
    const editPalletTemplate = (p) => {
        setNewPallet({ nombre: p.nombre, items: p.items });
        setEditingId(p.id);
        setShowAddForm(true);
    };

    const getPalletTotals = (items) => {
        let totalCost = 0; 
        let totalPie2 = 0;
        items.forEach(i => {
            if (i.costoId) {
                const costObj = costosMadres.find(c => c.id === i.costoId);
                if (costObj) {
                    totalCost += (costObj.costo_unitario * (parseFloat(i.qty) || 0));
                    if (costObj.tipo === 'Madera') totalPie2 += (costObj.pie2_unitario * (parseFloat(i.qty) || 0));
                }
            }
        });
        return { totalCost, totalPie2 };
    };

    const savePalletTemplate = async () => {
        if (!newPallet.nombre) return alert('Ponle un nombre al pallet.');
        const totals = getPalletTotals(newPallet.items);
        const dataToSave = {
            nombre: newPallet.nombre,
            items: newPallet.items.filter(i => i.costoId),
            totalCosto: totals.totalCost,
            totalPie2: totals.totalPie2,
            updatedAt: new Date().toISOString()
        };

        if (editingId) {
            await updateDoc(doc(db, 'pallets_templates_sii', 'main_list', 'items', editingId), dataToSave);
        } else {
            dataToSave.createdAt = new Date().toISOString();
            await addDoc(collection(db, 'pallets_templates_sii', 'main_list', 'items'), dataToSave);
        }

        setNewPallet({ nombre: '', items: [] });
        setEditingId(null);
        setShowAddForm(false);
    };
    
    const deletePalletTemplate = async (id) => { 
        if(confirm('¿Eliminar modelo de Pallet?')) await deleteDoc(doc(db, 'pallets_templates_sii', 'main_list', 'items', id)); 
    };

    // ==========================================
    // LÓGICA DE PRESUPUESTOS
    // ==========================================
    const editQuote = (q) => {
        setNewQuote({ cliente: q.cliente, items: q.items });
        setEditingId(q.id);
        setShowAddForm(true);
    };

    const getQuoteTotals = (items) => {
        let quoteTotalCost = 0; 
        let quoteTotalPie2 = 0;
        items.forEach(i => {
            if (i.palletId) {
                const pObj = palletsTemplates.find(p => p.id === i.palletId);
                if (pObj) {
                    quoteTotalCost += (pObj.totalCosto * (parseFloat(i.qty) || 0));
                    quoteTotalPie2 += (pObj.totalPie2 * (parseFloat(i.qty) || 0));
                }
            }
        });
        return { quoteTotalCost, quoteTotalPie2 };
    };

    const saveQuote = async () => {
        if (!newQuote.cliente) return alert('Ingresa el cliente.');
        const totals = getQuoteTotals(newQuote.items);
        const dataToSave = {
            cliente: newQuote.cliente,
            items: newQuote.items.filter(i => i.palletId),
            totalCosto: totals.quoteTotalCost,
            totalPie2: totals.quoteTotalPie2,
            date: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString()
        };

        if (editingId) {
            await updateDoc(doc(db, 'presupuestos_sii', 'main_list', 'items', editingId), dataToSave);
        } else {
            dataToSave.createdAt = new Date().toISOString();
            await addDoc(collection(db, 'presupuestos_sii', 'main_list', 'items'), dataToSave);
        }

        setNewQuote({ cliente: '', items: [] });
        setEditingId(null);
        setShowAddForm(false);
    };
    
    const deleteQuote = async (id) => { 
        if(confirm('¿Eliminar Presupuesto?')) await deleteDoc(doc(db, 'presupuestos_sii', 'main_list', 'items', id)); 
    };

    const triggerQuoteReport = (quote, action) => {
        let bodyHTML = `
            <h1>Presupuesto</h1>
            <p class="meta">Fecha: ${new Date(quote.date+'T00:00:00').toLocaleDateString('es-AR')} • Cliente: <strong>${quote.cliente}</strong></p>
            <table style="width:100%; margin-top:20px; text-align:left;">
                <thead style="background:#f3f4f6;">
                    <tr>
                        <th style="padding:8px">Descripción (Pallet)</th>
                        <th style="padding:8px; text-align:center">Cant</th>
                        <th style="padding:8px; text-align:right">Costo Unit.</th>
                        <th style="padding:8px; text-align:right">Subtotal</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        quote.items.forEach(i => {
            const pObj = palletsTemplates.find(p => p.id === i.palletId);
            const name = pObj ? pObj.nombre : 'Pallet eliminado';
            const unitCost = pObj ? pObj.totalCosto : 0;
            const subtotal = unitCost * i.qty;
            bodyHTML += `
                <tr>
                    <td style="padding:8px; border-bottom:1px solid #eee">${name}</td>
                    <td style="padding:8px; text-align:center; border-bottom:1px solid #eee">${i.qty}</td>
                    <td style="padding:8px; text-align:right; border-bottom:1px solid #eee">${formatMoney(unitCost)}</td>
                    <td style="padding:8px; text-align:right; border-bottom:1px solid #eee; font-weight:bold">${formatMoney(subtotal)}</td>
                </tr>
            `;
        });
        
        bodyHTML += `
                </tbody>
            </table>
            <div style="margin-top:20px; padding:10px; background:#f0f9ff; border:1px solid #bae6fd; font-size:14px; display:flex; justify-content:space-between;">
                <span>Volumen Total Madera: <strong>${quote.totalPie2.toFixed(2)} Pie²</strong></span>
                <span style="color:#0369a1;">TOTAL GENERAL: <strong>${formatMoney(quote.totalCosto)}</strong></span>
            </div>
        `;
        handleReportAction(`Presupuesto - ${quote.cliente}`, bodyHTML, action, `Presupuesto_${quote.cliente.replace(/\s+/g, '_')}`);
    };

    const sendQuoteWP = (quote) => {
        let text = `*PRESUPUESTO - SII PALLETS*\nCliente: ${quote.cliente}\nFecha: ${new Date(quote.date+'T00:00:00').toLocaleDateString('es-AR')}\n\n*Detalle:*\n`;
        quote.items.forEach(i => {
            const pObj = palletsTemplates.find(p => p.id === i.palletId);
            text += `- ${i.qty}x ${pObj ? pObj.nombre : 'Item'} (${formatMoney((pObj?pObj.totalCosto:0)*i.qty)})\n`;
        });
        text += `\n*TOTAL: ${formatMoney(quote.totalCosto)}*\n*(Consumo de Madera: ${quote.totalPie2.toFixed(2)} Pie²)*\n\nSaludos!`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <div className="animate-fade-in">
            <div className="flex bg-teal-100 p-1 rounded-xl mb-6 shadow-inner text-sm font-bold">
                <button 
                    onClick={() => {
                        setPalletTab('costos'); 
                        setShowAddForm(false); 
                        setEditingId(null);
                    }} 
                    className={`flex-1 py-2 rounded-lg transition-all ${palletTab === 'costos' ? 'bg-white text-teal-800 shadow-sm' : 'text-teal-600 hover:bg-teal-50'}`}
                >
                    Costos Madres
                </button>
                <button 
                    onClick={() => {
                        setPalletTab('modelos'); 
                        setShowAddForm(false); 
                        setEditingId(null);
                    }} 
                    className={`flex-1 py-2 rounded-lg transition-all ${palletTab === 'modelos' ? 'bg-white text-teal-800 shadow-sm' : 'text-teal-600 hover:bg-teal-50'}`}
                >
                    Modelos Pallets
                </button>
                <button 
                    onClick={() => {
                        setPalletTab('presupuestos'); 
                        setShowAddForm(false); 
                        setEditingId(null);
                    }} 
                    className={`flex-1 py-2 rounded-lg transition-all ${palletTab === 'presupuestos' ? 'bg-white text-teal-800 shadow-sm' : 'text-teal-600 hover:bg-teal-50'}`}
                >
                    Presupuestar
                </button>
            </div>

            {/* TAB 1: COSTOS MADRES */}
            {palletTab === 'costos' && (
                <>
                    <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-teal-500 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h4 className="font-bold text-gray-800 text-sm">Producción Mensual Estimada (Pallets)</h4>
                            <p className="text-[10px] text-gray-500">Base para calcular la cuota de los Costos Fijos por pallet.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                className="w-24 p-2 bg-gray-50 border rounded-lg text-center font-black text-teal-700 outline-none focus:ring-2 focus:ring-teal-500" 
                                value={produccionMensual}
                                onChange={(e) => {
                                    // Esta función se puede mantener aquí para sincronizar la vista local, 
                                    // pero idealmente, se enviaría el dato al padre o se guarda directamente
                                    const value = parseInt(e.target.value) || 1;
                                    setDoc(doc(db, 'config_sii', 'general'), { produccionMensual: value }, { merge: true });
                                }}
                            />
                            <button 
                                onClick={() => alert('Producción mensual guardada correctamente.')}
                                className="bg-teal-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-teal-700 transition-colors shadow-sm"
                            >
                                Guardar
                            </button>
                        </div>
                    </div>

                    <button 
                        onClick={() => {
                            setNewCosto({nombre:'', tipo:'Fijo', costoTotal:'', cantidad:1, unidad:'u', alto:'', ancho:'', largo:''}); 
                            setEditingId(null); 
                            setShowAddForm(!showAddForm);
                        }} 
                        className={`w-full ${theme.btn} hover:opacity-90 text-white p-3 rounded-xl shadow-md mb-6 flex items-center justify-center gap-2 font-bold transition-all active:scale-95`}
                    >
                        <IconPlus className="w-5 h-5"/> {showAddForm && !editingId ? 'Cancelar' : 'Nuevo Costo / Material'}
                    </button>

                    {showAddForm && (
                        <form onSubmit={addCostoMadre} className="bg-white p-5 rounded-xl shadow-lg border border-gray-200 mb-6 animate-fade-in relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-1 h-full bg-teal-600"></div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-700">
                                    {editingId ? 'Editar Costo / Material' : 'Registrar Materia Prima o Costo Fijo'}
                                </h3>
                                {editingId && (
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setShowAddForm(false); 
                                            setEditingId(null);
                                        }} 
                                        className="text-red-500 text-xs font-bold"
                                    >
                                        Cancelar Edición
                                    </button>
                                )}
                            </div>
                            
                            <div className="space-y-3">
                                <div className="flex gap-2">
                                    <div className="w-1/3">
                                        <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                                        <select 
                                            className="w-full p-3 bg-gray-50 rounded-lg border outline-none text-sm" 
                                            value={newCosto.tipo} 
                                            onChange={e=>setNewCosto({...newCosto, tipo:e.target.value})}
                                        >
                                            <option value="Fijo">Costo Fijo</option>
                                            <option value="Madera">Madera</option>
                                            <option value="MOD">Mano de Obra</option>
                                            <option value="Flete">Flete</option>
                                            <option value="Insumo">Insumo/Clavos</option>
                                        </select>
                                    </div>
                                    <div className="flex-1">
                                        <label className="text-xs text-gray-500 block mb-1">Nombre / Descripción</label>
                                        <input 
                                            className="w-full p-3 bg-gray-50 rounded-lg border outline-none" 
                                            value={newCosto.nombre} 
                                            onChange={e=>setNewCosto({...newCosto, nombre:e.target.value})} 
                                            required 
                                            placeholder="Ej: Tabla Pino, Clavos, Sueldo x hr"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <div className="w-1/2">
                                        <label className="text-xs text-gray-500 block mb-1">
                                            {newCosto.tipo === 'Madera' ? 'Costo por Pie² ($)' : 'Costo Total ($)'}
                                        </label>
                                        <input 
                                            type="number" 
                                            step="0.01" 
                                            className="w-full p-3 bg-gray-50 rounded-lg border outline-none font-bold" 
                                            value={newCosto.costoTotal} 
                                            onChange={e=>setNewCosto({...newCosto, costoTotal:e.target.value})} 
                                            required 
                                        />
                                    </div>
                                    
                                    {newCosto.tipo === 'Fijo' ? (
                                        <>
                                            <div className="w-1/4">
                                                <label className="text-xs text-teal-600 font-bold block mb-1 text-center">Entre</label>
                                                <div className="p-3 bg-teal-50 rounded-lg border border-teal-200 text-sm font-bold text-teal-800 text-center">
                                                    {produccionMensual}
                                                </div>
                                            </div>
                                            <div className="w-1/4">
                                                <label className="text-xs text-gray-500 block mb-1 text-center">Unidad</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full p-3 bg-gray-100 rounded-lg border outline-none text-gray-500 text-center font-bold" 
                                                    value="pallets" 
                                                    readOnly 
                                                />
                                            </div>
                                        </>
                                    ) : newCosto.tipo !== 'Madera' ? (
                                        <>
                                            <div className="w-1/4">
                                                <label className="text-xs text-gray-500 block mb-1">Cantidad</label>
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    className="w-full p-3 bg-gray-50 rounded-lg border outline-none" 
                                                    value={newCosto.cantidad} 
                                                    onChange={e=>setNewCosto({...newCosto, cantidad:e.target.value})} 
                                                    required 
                                                />
                                            </div>
                                            <div className="w-1/4">
                                                <label className="text-xs text-gray-500 block mb-1">Unidad</label>
                                                <input 
                                                    type="text" 
                                                    className="w-full p-3 bg-gray-50 rounded-lg border outline-none" 
                                                    value={newCosto.unidad} 
                                                    onChange={e=>setNewCosto({...newCosto, unidad:e.target.value})} 
                                                    required 
                                                    placeholder="u, kg, hr"
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="w-1/2 flex items-end">
                                                <div className="w-full p-3 bg-teal-50 text-teal-800 rounded-lg border border-teal-200 text-xs font-bold text-center">Cálculo Automático por Pieza</div>
                                            </div>
                                        </>
                                    )}
                                </div>
                                
                                {newCosto.tipo === 'Madera' && (
                                    <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200 mt-2">
                                        <p className="text-xs font-bold text-yellow-800 mb-2">Medidas de LA PIEZA (para calcular su Pie²)</p>
                                        <div className="flex gap-2">
                                            <div>
                                                <label className="text-[10px] text-gray-500">Alto (pulg)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    className="w-full p-2 text-sm bg-white rounded border outline-none" 
                                                    value={newCosto.alto} 
                                                    onChange={e=>setNewCosto({...newCosto, alto:e.target.value})} 
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500">Ancho (pulg)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    className="w-full p-2 text-sm bg-white rounded border outline-none" 
                                                    value={newCosto.ancho} 
                                                    onChange={e=>setNewCosto({...newCosto, ancho:e.target.value})} 
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] text-gray-500">Largo (pies)</label>
                                                <input 
                                                    type="number" 
                                                    step="0.01" 
                                                    className="w-full p-2 text-sm bg-white rounded border outline-none" 
                                                    value={newCosto.largo} 
                                                    onChange={e=>setNewCosto({...newCosto, largo:e.target.value})} 
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-gray-500 mt-2 italic">* Fórmula: (Alto x Ancho x Largo) / 12 = Pie² de la pieza</p>
                                    </div>
                                )}

                                <button type="submit" className="w-full bg-teal-600 text-white p-3 rounded-lg font-bold mt-2 hover:bg-teal-700">
                                    Guardar Material/Costo
                                </button>
                            </div>
                        </form>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-3 bg-gray-50 border-b font-bold text-sm text-gray-600">Base de Costos y Materiales</div>
                        {costosMadres.length === 0 ? (
                            <p className="p-4 text-center text-xs text-gray-400">No hay costos registrados.</p>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {costosMadres.map(c => (
                                    <div key={c.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                        <div>
                                            <p className="font-bold text-gray-800 text-sm">
                                                {c.nombre} 
                                                <span className="text-[9px] bg-gray-200 text-gray-600 px-1 rounded uppercase ml-1">{c.tipo}</span>
                                            </p>
                                            {c.tipo === 'Madera' ? (
                                                <p className="text-xs text-gray-500">Costo Base: {formatMoney(c.costoTotal)} por Pie²</p>
                                            ) : (
                                                <p className="text-xs text-gray-500">Lote: {formatMoney(c.costoTotal)} / {c.cantidad} {c.unidad}</p>
                                            )}
                                            
                                            {c.tipo === 'Madera' && (
                                                <p className="text-[10px] text-orange-600 font-bold mt-0.5">
                                                    Rinde: {c.pie2_unitario.toFixed(2)} Pie²/pieza - Costo de la pieza: {formatMoney(c.costo_unitario)}
                                                </p>
                                            )}
                                        </div>
                                        <div className="text-right flex flex-col items-end">
                                            <p className="font-bold text-teal-700">
                                                {formatMoney(c.costo_unitario)} 
                                                <span className="text-[10px] font-normal text-gray-500 ml-1">c/u</span>
                                            </p>
                                            <div className="flex gap-2 mt-1">
                                                <button onClick={() => editCostoMadre(c)} className="text-blue-400 hover:text-blue-600">
                                                    <IconPencil className="w-4 h-4"/>
                                                </button>
                                                <button onClick={() => deleteCostoMadre(c.id)} className="text-red-400 hover:text-red-600">
                                                    <IconTrash className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* TAB 2: MODELOS DE PALLETS */}
            {palletTab === 'modelos' && (
                <>
                    <button 
                        onClick={() => {
                            setNewPallet({nombre:'', items:[]}); 
                            setEditingId(null); 
                            setShowAddForm(!showAddForm);
                        }} 
                        className={`w-full ${theme.btn} hover:opacity-90 text-white p-3 rounded-xl shadow-md mb-6 flex items-center justify-center gap-2 font-bold transition-all active:scale-95`}
                    >
                        <IconPlus className="w-5 h-5"/> {showAddForm && !editingId ? 'Cancelar' : 'Crear Modelo de Pallet'}
                    </button>

                    {showAddForm && (
                        <div className="bg-white p-5 rounded-xl shadow-lg border border-gray-200 mb-6 animate-fade-in relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-teal-600"></div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-700">
                                    {editingId ? 'Editar Receta del Pallet' : 'Armado de Receta (Pallet)'}
                                </h3>
                                {editingId && (
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setShowAddForm(false); 
                                            setEditingId(null);
                                        }} 
                                        className="text-red-500 text-xs font-bold"
                                    >
                                        Cancelar Edición
                                    </button>
                                )}
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Nombre del Modelo</label>
                                    <input 
                                        className="w-full p-3 bg-gray-50 rounded-lg border outline-none font-bold focus:ring-2 focus:ring-teal-500" 
                                        value={newPallet.nombre} 
                                        onChange={e=>setNewPallet({...newPallet, nombre:e.target.value})} 
                                        required 
                                        placeholder="Ej: Pallet Arcor 100x120" 
                                    />
                                </div>
                                
                                <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white">
                                    <div className="bg-gray-50 p-3 border-b border-gray-200 flex justify-between items-center">
                                        <h4 className="text-xs font-bold text-gray-600 uppercase flex items-center gap-2">
                                            <IconCheck className="w-4 h-4 text-teal-600"/> Seleccionar Insumos y Costos
                                        </h4>
                                        <span className="text-[10px] bg-teal-100 text-teal-800 px-2 py-1 rounded font-bold">
                                            {costosMadres.length} Disponibles
                                        </span>
                                    </div>
                                    <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                                        {costosMadres.length === 0 ? (
                                            <p className="p-4 text-xs text-gray-400 text-center">Primero debes registrar Costos Madres.</p>
                                        ) : null}
                                        {costosMadres.map(costo => {
                                            const isSelected = newPallet.items.some(i => i.costoId === costo.id);
                                            const currentItem = newPallet.items.find(i => i.costoId === costo.id);
                                            
                                            return (
                                                <div key={costo.id} className={`p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${isSelected ? 'bg-teal-50/50' : 'hover:bg-gray-50'}`}>
                                                    <label className="flex items-center gap-3 cursor-pointer flex-1">
                                                        <input 
                                                            type="checkbox" 
                                                            className="w-5 h-5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                if(e.target.checked) {
                                                                    setNewPallet({
                                                                        ...newPallet, 
                                                                        items: [...newPallet.items, {costoId: costo.id, qty: 1}]
                                                                    });
                                                                } else {
                                                                    setNewPallet({
                                                                        ...newPallet, 
                                                                        items: newPallet.items.filter(i => i.costoId !== costo.id)
                                                                    });
                                                                }
                                                            }}
                                                        />
                                                        <div>
                                                            <p className={`font-bold text-sm ${isSelected ? 'text-teal-900' : 'text-gray-700'}`}>
                                                                {costo.nombre}
                                                            </p>
                                                            <p className="text-[10px] text-gray-500 flex gap-2 mt-0.5">
                                                                <span>{formatMoney(costo.costo_unitario)} por pieza</span>
                                                                <span className="bg-gray-200 px-1 rounded uppercase">{costo.tipo}</span>
                                                            </p>
                                                        </div>
                                                    </label>
                                                    
                                                    {isSelected && (
                                                        <div className="flex items-center gap-2 ml-8 sm:ml-0 animate-fade-in">
                                                            <span className="text-[10px] text-teal-700 font-bold uppercase">Cant:</span>
                                                            <input 
                                                                type="number" 
                                                                step="0.01" 
                                                                min="0.01"
                                                                className="w-24 p-2 text-sm border border-teal-300 rounded-lg bg-white outline-none text-center font-bold text-teal-900 focus:ring-2 focus:ring-teal-500 shadow-inner" 
                                                                value={currentItem.qty} 
                                                                onChange={(e) => {
                                                                    const newItems = newPallet.items.map(i => i.costoId === costo.id ? {...i, qty: e.target.value} : i);
                                                                    setNewPallet({...newPallet, items: newItems});
                                                                }} 
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="bg-teal-50 p-4 rounded-xl border border-teal-200 flex justify-between items-center shadow-inner">
                                    <div>
                                        <p className="text-[10px] font-bold text-teal-800 uppercase">Resumen Armado</p>
                                        <p className="text-sm font-bold text-gray-700">
                                            Madera Total: <span className="text-orange-600">{getPalletTotals(newPallet.items).totalPie2.toFixed(2)} Pie²</span>
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-teal-800 uppercase">Costo Total Base</p>
                                        <p className="text-xl font-black text-teal-700">{formatMoney(getPalletTotals(newPallet.items).totalCost)}</p>
                                    </div>
                                </div>

                                <button onClick={savePalletTemplate} className="w-full bg-teal-600 text-white p-3 rounded-lg font-bold hover:bg-teal-700">
                                    Guardar Pallet
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-3 bg-gray-50 border-b font-bold text-sm text-gray-600">Modelos Guardados</div>
                        {palletsTemplates.length === 0 ? (
                            <p className="p-4 text-center text-xs text-gray-400">No hay pallets armados.</p>
                        ) : (
                            <div className="grid grid-cols-1 gap-3 p-3">
                                {palletsTemplates.map(p => {
                                    const isExp = expandedPallets[p.id];
                                    return (
                                    <div key={p.id} className="border rounded-lg shadow-sm bg-white overflow-hidden">
                                        <div className="p-4 flex justify-between items-start">
                                            <div className="flex-1 cursor-pointer" onClick={() => setExpandedPallets({...expandedPallets, [p.id]: !isExp})}>
                                                <h4 className="font-black text-gray-800 text-lg flex items-center gap-2">
                                                    {p.nombre}
                                                    {isExp ? <IconChevronUp className="w-4 h-4 text-gray-400"/> : <IconChevronDown className="w-4 h-4 text-gray-400"/>}
                                                </h4>
                                                <p className="text-[10px] text-gray-500 mt-1">{p.items.length} Componentes asignados</p>
                                                <div className="flex gap-4 mt-2">
                                                    <div>
                                                        <span className="block text-[9px] text-gray-400 uppercase">Volumen Pie²</span>
                                                        <span className="font-bold text-orange-600">{p.totalPie2.toFixed(2)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[9px] text-gray-400 uppercase">Costo Base</span>
                                                        <span className="font-black text-teal-700">{formatMoney(p.totalCosto)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2 ml-4">
                                                <button onClick={()=>editPalletTemplate(p)} className="p-2 bg-blue-50 text-blue-500 rounded hover:bg-blue-100" title="Editar">
                                                    <IconPencil className="w-4 h-4"/>
                                                </button>
                                                <button onClick={()=>deletePalletTemplate(p.id)} className="p-2 bg-red-50 text-red-400 rounded hover:bg-red-100 hover:text-red-600" title="Eliminar">
                                                    <IconTrash className="w-4 h-4"/>
                                                </button>
                                            </div>
                                        </div>
                                        {isExp && (
                                            <div className="bg-gray-50 border-t border-gray-100 p-3 text-xs animate-fade-in divide-y divide-gray-200">
                                                <div className="flex justify-between font-bold text-gray-500 pb-2 mb-2 px-1">
                                                    <span>Insumo</span>
                                                    <span>Cant.</span>
                                                    <span>Subtotal</span>
                                                </div>
                                                {p.items.map((i, idx) => {
                                                    const costObj = costosMadres.find(c => c.id === i.costoId);
                                                    const name = costObj ? costObj.nombre : 'Insumo eliminado';
                                                    const subtotal = costObj ? costObj.costo_unitario * i.qty : 0;
                                                    return (
                                                        <div key={idx} className="flex justify-between items-center py-1.5 px-1 hover:bg-gray-100">
                                                            <span className="flex-1 truncate pr-2 text-gray-700">{name}</span>
                                                            <span className="w-12 text-center text-gray-600 font-mono">{i.qty}</span>
                                                            <span className="w-20 text-right font-bold text-teal-700">{formatMoney(subtotal)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* TAB 3: PRESUPUESTOS */}
            {palletTab === 'presupuestos' && (
                <>
                    <button 
                        onClick={() => {
                            setNewQuote({cliente:'', items:[]}); 
                            setEditingId(null); 
                            setShowAddForm(!showAddForm);
                        }} 
                        className={`w-full ${theme.btn} hover:opacity-90 text-white p-3 rounded-xl shadow-md mb-6 flex items-center justify-center gap-2 font-bold transition-all active:scale-95`}
                    >
                        <IconPlus className="w-5 h-5"/> {showAddForm && !editingId ? 'Cancelar' : 'Armar Nuevo Presupuesto'}
                    </button>

                    {showAddForm && (
                        <div className="bg-white p-5 rounded-xl shadow-lg border border-gray-200 mb-6 animate-fade-in relative">
                            <div className="absolute top-0 left-0 w-1 h-full bg-teal-600"></div>
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-700">
                                    {editingId ? 'Editar Presupuesto' : 'Generador de Presupuesto'}
                                </h3>
                                {editingId && (
                                    <button 
                                        type="button" 
                                        onClick={() => {
                                            setShowAddForm(false); 
                                            setEditingId(null);
                                        }} 
                                        className="text-red-500 text-xs font-bold"
                                    >
                                        Cancelar Edición
                                    </button>
                                )}
                            </div>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Cliente</label>
                                    <input 
                                        className="w-full p-3 bg-gray-50 rounded-lg border outline-none font-bold" 
                                        value={newQuote.cliente} 
                                        onChange={e=>setNewQuote({...newQuote, cliente:e.target.value})} 
                                        required 
                                        placeholder="Nombre del Cliente/Empresa" 
                                    />
                                </div>
                                
                                <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                                    <h4 className="text-xs font-bold text-gray-600 mb-2 uppercase">Pallets a Cotizar</h4>
                                    {newQuote.items.map((item, idx) => (
                                        <div key={idx} className="flex gap-2 mb-2 items-center">
                                            <div className="flex-1">
                                                <select 
                                                    className="w-full p-2 bg-white rounded border text-sm outline-none font-bold text-gray-700" 
                                                    value={item.palletId} 
                                                    onChange={e=> {
                                                        const newItems = [...newQuote.items];
                                                        newItems[idx].palletId = e.target.value;
                                                        setNewQuote({...newQuote, items: newItems});
                                                    }}
                                                >
                                                    <option value="">Seleccionar Pallet...</option>
                                                    {palletsTemplates.map(p => (
                                                        <option key={p.id} value={p.id}>{p.nombre} (Costo: {formatMoney(p.totalCosto)})</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="w-24">
                                                <input 
                                                    type="number" 
                                                    className="w-full p-2 bg-white rounded border text-sm text-center outline-none font-bold" 
                                                    placeholder="Cant. Final" 
                                                    value={item.qty} 
                                                    onChange={e=> {
                                                        const newItems = [...newQuote.items];
                                                        newItems[idx].qty = e.target.value;
                                                        setNewQuote({...newQuote, items: newItems});
                                                    }} 
                                                />
                                            </div>
                                            <button 
                                                onClick={() => {
                                                    const newItems = newQuote.items.filter((_, i) => i !== idx);
                                                    setNewQuote({...newQuote, items: newItems});
                                                }} 
                                                className="p-2 text-red-500 bg-red-50 rounded hover:bg-red-100"
                                            >
                                                <IconX className="w-4 h-4"/>
                                            </button>
                                        </div>
                                    ))}
                                    <button 
                                        onClick={() => {
                                            setNewQuote({...newQuote, items: [...newQuote.items, {palletId: '', qty: 1}]});
                                        }} 
                                        className="text-xs text-teal-600 font-bold bg-teal-100 px-3 py-1.5 rounded-lg hover:bg-teal-200 mt-1 flex items-center gap-1"
                                    >
                                        <IconPlus className="w-3 h-3"/> Agregar Fila
                                    </button>
                                </div>

                                <div className="bg-blue-50 p-5 rounded-xl border border-blue-200 flex justify-between items-center shadow-inner">
                                    <div>
                                        <p className="text-[10px] font-bold text-blue-800 uppercase mb-1">Volumen Madera Presupuesto</p>
                                        <p className="text-lg font-black text-orange-600">{getQuoteTotals(newQuote.items).quoteTotalPie2.toFixed(2)} Pie²</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-blue-800 uppercase mb-1">Total Presupuestado (Costo Base)</p>
                                        <p className="text-2xl font-black text-blue-700">{formatMoney(getQuoteTotals(newQuote.items).quoteTotalCost)}</p>
                                    </div>
                                </div>

                                <button onClick={saveQuote} className="w-full bg-blue-600 text-white p-3 rounded-lg font-bold hover:bg-blue-700 shadow-md">
                                    Guardar Presupuesto
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-3 bg-gray-50 border-b font-bold text-sm text-gray-600">Historial de Presupuestos</div>
                        {presupuestos.length === 0 ? (
                            <p className="p-4 text-center text-xs text-gray-400">No hay presupuestos armados.</p>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {presupuestos.map(q => {
                                    const isExp = expandedQuotes[q.id];
                                    return (
                                    <div key={q.id} className="hover:bg-gray-50 transition-colors">
                                        <div className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                            <div className="flex-1 cursor-pointer" onClick={() => setExpandedQuotes({...expandedQuotes, [q.id]: !isExp})}>
                                                <p className="font-bold text-gray-800 text-lg flex items-center gap-2">
                                                    {q.cliente}
                                                    {isExp ? <IconChevronUp className="w-4 h-4 text-gray-400"/> : <IconChevronDown className="w-4 h-4 text-gray-400"/>}
                                                </p>
                                                <p className="text-xs text-gray-500 font-mono mt-0.5">
                                                    {new Date(q.date+'T00:00:00').toLocaleDateString('es-AR')} • {q.items.length} Tipos de Pallets • Maderas: {q.totalPie2.toFixed(2)} Pie²
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0">
                                                <p className="font-black text-blue-700 text-xl">{formatMoney(q.totalCosto)}</p>
                                                <div className="flex gap-1 border-l pl-3 ml-2">
                                                    <button onClick={()=>editQuote(q)} className="p-2 bg-gray-100 text-blue-500 rounded hover:bg-blue-100" title="Editar">
                                                        <IconPencil className="w-4 h-4"/>
                                                    </button>
                                                    <button onClick={()=>triggerQuoteReport(q, 'print')} className="p-2 bg-gray-100 text-gray-500 rounded hover:bg-blue-100 hover:text-blue-700" title="Imprimir">
                                                        <IconPrinter className="w-4 h-4"/>
                                                    </button>
                                                    <button onClick={()=>triggerQuoteReport(q, 'download')} className="p-2 bg-gray-100 text-gray-500 rounded hover:bg-blue-100 hover:text-blue-700" title="PDF">
                                                        <IconDownload className="w-4 h-4"/>
                                                    </button>
                                                    <button onClick={()=>sendQuoteWP(q)} className="p-2 bg-green-100 text-green-600 rounded hover:bg-green-200" title="Enviar WhatsApp">
                                                        <IconMessage className="w-4 h-4"/>
                                                    </button>
                                                    <button onClick={()=>deleteQuote(q.id)} className="p-2 bg-red-50 text-red-400 rounded hover:bg-red-100 hover:text-red-600 ml-1">
                                                        <IconTrash className="w-4 h-4"/>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        {isExp && (
                                            <div className="bg-gray-100 px-4 py-3 text-xs animate-fade-in border-t border-dashed border-gray-200 shadow-inner">
                                                <div className="flex justify-between font-bold text-gray-500 mb-1 px-2">
                                                    <span>Pallet</span>
                                                    <span>Cantidad</span>
                                                    <span className="text-right">Subtotal Base</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {q.items.map((i, idx) => {
                                                        const pObj = palletsTemplates.find(p => p.id === i.palletId);
                                                        const name = pObj ? pObj.nombre : 'Pallet eliminado';
                                                        const subtotal = pObj ? pObj.totalCosto * i.qty : 0;
                                                        return (
                                                            <div key={idx} className="flex justify-between items-center bg-white p-2 rounded shadow-sm">
                                                                <span className="flex-1 font-medium text-gray-700">{name}</span>
                                                                <span className="w-16 text-center font-mono text-gray-600">x {i.qty}</span>
                                                                <span className="w-24 text-right font-bold text-blue-700">{formatMoney(subtotal)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )})}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
