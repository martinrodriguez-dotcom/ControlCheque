import React, { useState } from 'react';
import { IconCalendar, IconFileText, IconPieChart, IconChevronDown } from '../components/Icons';
import { formatMoney, getCategoryLabel, getCategoryColor } from '../utils/helpers';

export default function Balance({ balanceData, forecastData, setRangeReportModal, setShowCalendar, setSelectedDateFilter, payItems }) {
    const [expandedCategory, setExpandedCategory] = useState(null);

    return (
        <div className="animate-fade-in">
            <div className={`bg-white p-5 rounded-2xl shadow-md border-l-8 mb-6 border-violet-500`}>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Estado Financiero Global</p>
                <div className="flex justify-between text-center mb-4">
                    <div>
                        <p className="text-xs text-emerald-600 font-bold mb-1">A COBRAR</p>
                        <p className="text-xl font-bold text-gray-800">{formatMoney(balanceData.collect + balanceData.wallet)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-blue-600 font-bold mb-1">A PAGAR</p>
                        <p className="text-xl font-bold text-gray-800">{formatMoney(balanceData.pay + balanceData.expenses)}</p>
                    </div>
                </div>
                <div className="border-t pt-3 flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-600">PROYECCIÓN SALDO:</span>
                    <span className={`text-3xl font-black ${balanceData.net >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                        {balanceData.net > 0 ? '+' : ''}{formatMoney(balanceData.net)}
                    </span>
                </div>
            </div>

            <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                        <IconCalendar className="w-5 h-5 text-violet-600"/> Proyección 15 Días
                    </h3>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setRangeReportModal({isOpen: true, startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0]})} 
                            className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1"
                        >
                            <IconFileText className="w-3 h-3"/> Reporte Rango
                        </button>
                        <button 
                            onClick={() => setShowCalendar(true)} 
                            className="bg-violet-100 text-violet-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-violet-200 transition-colors flex items-center gap-1"
                        >
                            <IconCalendar className="w-3 h-3"/> Ver Mensual
                        </button>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {forecastData.map((day, idx) => (
                        <button 
                            key={idx} 
                            onClick={() => { setSelectedDateFilter(day.dateKey); }}
                            className={`p-2 rounded-xl border flex flex-col items-center justify-center shadow-sm transition-transform active:scale-95 ${day.net > 0 ? 'bg-emerald-50 border-emerald-200' : (day.net < 0 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100')}`}
                        >
                            <span className="text-[10px] font-bold text-gray-500 uppercase mb-1">
                                {day.date.toLocaleDateString('es-AR', {weekday:'short', day:'numeric'})}
                            </span>
                            <span className={`text-xs font-black ${day.net > 0 ? 'text-emerald-600' : (day.net < 0 ? 'text-red-600' : 'text-gray-300')}`}>
                                {day.net === 0 ? '-' : (day.net > 0 ? '+' : '') + formatMoney(Math.abs(day.net))}
                            </span>
                            {(day.inflow > 0 || day.outflow > 0) && (
                                <div className="flex gap-1 mt-1 justify-center w-full">
                                    {day.inflow > 0 && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>}
                                    {day.outflow > 0 && <div className="w-1.5 h-1.5 rounded-full bg-blue-400"></div>}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-2 text-center">Toca un día para ver el detalle de movimientos.</p>
            </div>

            {balanceData.sortedCategories.length > 0 && (
                <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 mb-6">
                    <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                        <IconPieChart className="w-4 h-4 text-blue-500"/> Distribución de Gastos (Pendientes)
                    </h3>
                    <div className="space-y-3">
                        {balanceData.sortedCategories.map((item, idx) => {
                            const percent = balanceData.pay > 0 ? (item.amount / balanceData.pay) * 100 : 0;
                            const isExpanded = expandedCategory === item.cat;
                            return (
                                <div key={idx} className="mb-3">
                                    <button 
                                        onClick={() => setExpandedCategory(isExpanded ? null : item.cat)} 
                                        className="w-full text-left"
                                    >
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="font-bold text-gray-600 flex items-center gap-1">
                                                {getCategoryLabel(item.cat)} 
                                                <IconChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}/>
                                            </span>
                                            <span className="font-mono text-gray-500">{formatMoney(item.amount)}</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2.5">
                                            <div className={`h-2.5 rounded-full ${getCategoryColor(item.cat)}`} style={{ width: `${percent}%` }}></div>
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="mt-2 pl-2 border-l-2 border-gray-200 space-y-2 animate-fade-in">
                                            {payItems.filter(p => p.status !== 'paid' && (p.category || 'others') === item.cat).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).map(detail => (
                                                <div key={detail.id} className="text-xs flex justify-between bg-gray-50 p-2 rounded items-center">
                                                    <span className="truncate pr-2">
                                                        {detail.payee} 
                                                        <span className="text-gray-400"> ({new Date(detail.dueDate+'T00:00:00').toLocaleDateString('es-AR', {day:'numeric', month:'short'})})</span>
                                                    </span>
                                                    <span className="font-mono font-bold whitespace-nowrap">{formatMoney(detail.amount - (detail.paidAmount||0))}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100">
                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <IconCalendar className="w-4 h-4 text-violet-500"/> Agenda Financiera
                </h3>
                <div className="space-y-4">
                    {balanceData.dailyAgenda.length === 0 ? <p className="text-xs text-gray-400 italic text-center">No hay movimientos pendientes.</p> : 
                    balanceData.dailyAgenda.slice(0, 10).map((day, i) => (
                        <div key={i} className="flex items-center text-sm border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                            <div className="w-16 font-bold text-gray-500 text-xs">
                                {new Date(day.date+'T00:00:00').toLocaleDateString('es-AR', {day:'2-digit', month:'short'})}
                            </div>
                            <div className="flex-1 px-2">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-emerald-600 font-bold">Ingresos</span>
                                    <span className="text-emerald-600">{formatMoney(day.inflow)}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-blue-600 font-bold">Egresos</span>
                                    <span className="text-blue-600">{formatMoney(day.outflow)}</span>
                                </div>
                            </div>
                            <div className={`w-20 text-right font-mono font-bold text-xs ${day.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {day.net > 0 ? '+' : ''}{formatMoney(day.net)}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
