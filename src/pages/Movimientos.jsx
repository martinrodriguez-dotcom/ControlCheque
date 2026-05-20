import React from 'react';
import { 
    IconWallet, IconPrinter, IconDownload, IconPlus, IconCheck, IconEye, 
    IconMessage, IconPencil, IconTrash, IconChevronDown, IconUserGroup, IconChevronLeft, IconBank, IconFileText 
} from '../components/Icons';
import { formatMoney, formatDate, getCategoryLabel, getCategoryColor } from '../utils/helpers';

export default function Movimientos({
    mode, theme, payTab, setPayTab, totalRealizados, balanceData, dashboardData, activeFilter, setActiveFilter,
    triggerMainReport, showAddForm, setShowAddForm, setEditingId, editingId, newItem, setNewItem, handleAdd, banks,
    uniqueClients, getDays, markFullPayment, markPartialPayment, setHistoryModal, deleteItem, handleEdit,
    groupedView, expandedGroups, setExpandedGroups, triggerClientReport, selectedDateFilter, setSelectedDateFilter,
    newBank, setNewBank, addBank, deleteBank
}) {

    const getTypeIcon = (subtype) => {
        switch(subtype) { 
            case 'transfer': return <IconBank className="w-4 h-4 text-blue-500"/>; 
            case 'cash': return <IconWallet className="w-4 h-4 text-emerald-500"/>; 
            case 'invoice': return <IconFileText className="w-4 h-4 text-indigo-500"/>;
            case 'fixed': 
            case 'salary': return <IconWallet className="w-4 h-4 text-orange-500"/>; 
            default: return <span className="font-mono text-[10px] border px-1 rounded bg-white text-gray-500">CHQ</span>; 
        }
    };

    return (
        <div className="animate-fade-in">
            {/* Sub-Tabs Módulo Pagos */}
            {mode === 'pay' && (
                <div className="flex bg-blue-100 p-1 rounded-xl mb-6 shadow-inner text-sm font-bold">
                    <button 
                        onClick={() => {
                            setPayTab('pendientes'); 
                            setShowAddForm(false); 
                            setEditingId(null);
                        }} 
                        className={`flex-1 py-2 rounded-lg transition-all ${payTab === 'pendientes' ? 'bg-white text-blue-800 shadow-sm' : 'text-blue-600 hover:bg-blue-50'}`}
                    >
                        Pendientes
                    </button>
                    <button 
                        onClick={() => {
                            setPayTab('realizados'); 
                            setShowAddForm(false); 
                            setEditingId(null);
                        }} 
                        className={`flex-1 py-2 rounded-lg transition-all ${payTab === 'realizados' ? 'bg-white text-blue-800 shadow-sm' : 'text-blue-600 hover:bg-blue-50'}`}
                    >
                        Realizados
                    </button>
                    <button 
                        onClick={() => {
                            setPayTab('bancos'); 
                            setShowAddForm(false); 
                            setEditingId(null);
                        }} 
                        className={`flex-1 py-2 rounded-lg transition-all ${payTab === 'bancos' ? 'bg-white text-blue-800 shadow-sm' : 'text-blue-600 hover:bg-blue-50'}`}
                    >
                        Bancos
                    </button>
                </div>
            )}

            {/* Total Card */}
            {payTab !== 'bancos' && (
                <div className={`bg-white p-5 rounded-2xl shadow-md border-l-8 mb-6 flex items-center justify-between ${theme.border}`}>
                    <div>
                        <p className={`text-xs font-bold uppercase tracking-wide mb-1 ${theme.text}`}>
                            {mode === 'pay' 
                                ? (payTab === 'realizados' ? 'Total Pagado' : 'Deuda Total Pendiente') 
                                : (mode === 'wallet' ? 'Total en Cartera' : (mode === 'expenses' ? 'Total Gastos Mes' : 'Cobros Totales Pendientes'))}
                        </p>
                        <p className="text-3xl font-black text-gray-800">
                            {mode === 'pay' 
                                ? (payTab === 'realizados' ? formatMoney(totalRealizados) : formatMoney(balanceData.pay)) 
                                : (mode === 'wallet' ? formatMoney(balanceData.wallet) : (mode === 'expenses' ? formatMoney(balanceData.expenses) : formatMoney(balanceData.collect)))}
                        </p>
                    </div>
                    <div className={`${theme.light} p-3 rounded-full`}>
                        <IconWallet className={`w-8 h-8 ${theme.text}`}/>
                    </div>
                </div>
            )}

            {!(mode === 'pay' && payTab === 'realizados') && payTab !== 'bancos' && (
                <div className="grid grid-cols-3 gap-2 mb-6">
                    {[
                        { id: 'expired', label: 'Vencidos', color: 'red', data: dashboardData.expired }, 
                        { id: 'urgent', label: 'Esta Semana', color: 'orange', data: dashboardData.urgent }, 
                        { id: 'future', label: 'A Futuro', color: 'green', data: dashboardData.future }
                    ].map(filter => (
                        <button 
                            key={filter.id} 
                            onClick={() => setActiveFilter(activeFilter === filter.id ? 'all' : filter.id)} 
                            className={`p-2 rounded-xl border-2 transition-all text-center flex flex-col items-center justify-center shadow-sm relative ${activeFilter === filter.id ? `bg-${filter.color}-50 border-${filter.color}-500 ring-2 ring-${filter.color}-200` : 'bg-white border-transparent hover:bg-gray-50'}`}
                        >
                            <span className={`text-[10px] font-bold text-${filter.color}-600 uppercase`}>{filter.label}</span>
                            <span className="text-lg font-black text-gray-800 leading-tight">{filter.data.count}</span>
                            <span className="text-[9px] text-gray-500 truncate w-full">{formatMoney(filter.data.total)}</span>
                            {activeFilter === filter.id && (
                                <div className={`absolute -bottom-2 w-3 h-3 bg-${filter.color}-500 rotate-45 border-r border-b border-white`}></div>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {mode === 'pay' && payTab === 'realizados' && (
                <div className="flex justify-end mb-4 gap-2">
                    <button 
                        onClick={() => triggerMainReport('print')} 
                        className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors flex items-center gap-2"
                    >
                        <IconPrinter className="w-4 h-4"/> Imprimir {payTab === 'realizados' ? 'Realizados' : 'Pendientes'}
                    </button>
                    <button 
                        onClick={() => triggerMainReport('download')} 
                        className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-200 transition-colors flex items-center gap-2"
                    >
                        <IconDownload className="w-4 h-4"/> Descargar PDF
                    </button>
                </div>
            )}

            {!(mode === 'pay' && payTab === 'realizados') && payTab !== 'bancos' && (
                <button 
                    onClick={() => { 
                        setEditingId(null); 
                        setNewItem({ 
                            number: '', 
                            issueDate: new Date().toISOString().split('T')[0], 
                            dueDate: '', 
                            amount: '', 
                            payee: '', 
                            paidAmount: 0, 
                            subtype: mode === 'collect' ? 'invoice' : 'cheque', 
                            category: 'others', 
                            status: 'pending', 
                            isRecurring: false, 
                            installments: 2, 
                            bank: '' 
                        }); 
                        setShowAddForm(!showAddForm); 
                    }} 
                    className={`w-full ${theme.btn} hover:opacity-90 text-white p-3 rounded-xl shadow-md mb-6 flex items-center justify-center gap-2 font-bold transition-all active:scale-95`}
                >
                    <IconPlus className="w-5 h-5"/> {showAddForm ? 'Cancelar' : 'Nuevo Registro'}
                </button>
            )}
            
            {showAddForm && !(mode === 'pay' && payTab === 'realizados') && payTab !== 'bancos' && (
                <form onSubmit={handleAdd} className="bg-white p-5 rounded-xl shadow-lg border border-gray-200 mb-6 animate-fade-in relative overflow-hidden">
                    <div className={`absolute top-0 left-0 w-1 h-full ${theme.bg}`}></div>
                    <h3 className="font-bold mb-4 text-gray-700">{editingId ? 'Editar Movimiento' : 'Nuevo Registro'}</h3>
                    <div className="space-y-3">
                        {(mode === 'pay' || mode === 'collect') && (
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                                    <select 
                                        className="w-full p-3 bg-gray-50 rounded-lg border text-sm outline-none text-gray-700" 
                                        value={newItem.subtype} 
                                        onChange={e => setNewItem({...newItem, subtype: e.target.value})}
                                    >
                                        {mode === 'collect' && <option value="invoice">📄 Factura</option>}
                                        <option value="cheque">🎫 Cheque</option>
                                        <option value="transfer">🏦 Transf</option>
                                        <option value="cash">💵 Efvo</option>
                                        {mode === 'pay' && <option value="fixed">🏢 Gasto Fijo</option>}
                                        {mode === 'pay' && <option value="salary">👥 Sueldo</option>}
                                    </select>
                                </div>
                                {mode === 'pay' && (
                                    <div>
                                        <label className="text-xs text-gray-500 block mb-1">Categoría</label>
                                        <select 
                                            className="w-full p-3 bg-gray-50 rounded-lg border text-sm outline-none text-gray-700" 
                                            value={newItem.category} 
                                            onChange={e => setNewItem({...newItem, category: e.target.value})}
                                        >
                                            <option value="others">Otros</option>
                                            <option value="raw">Mat Prima</option>
                                            <option value="logistics">Logística</option>
                                            <option value="salaries">RRHH</option>
                                            <option value="taxes">Impuestos</option>
                                            <option value="services">Servicios</option>
                                            <option value="maintenance">Mantenimiento</option>
                                        </select>
                                    </div>
                                )}
                            </div>
                        )}

                        {mode === 'pay' && (
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Banco / Origen de los fondos</label>
                                <select 
                                    className="w-full p-3 bg-gray-50 rounded-lg border text-sm outline-none text-gray-700" 
                                    value={newItem.bank} 
                                    onChange={e => setNewItem({...newItem, bank: e.target.value})}
                                >
                                    <option value="">Seleccionar Banco (Opcional)</option>
                                    {banks.map(b => (
                                        <option key={b.id} value={b.name}>{b.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {mode === 'expenses' ? (
                            <>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Concepto</label>
                                    <input 
                                        className="w-full p-3 bg-gray-50 rounded-lg border outline-none" 
                                        placeholder="Ej: Alquiler" 
                                        value={newItem.payee} 
                                        onChange={e=>setNewItem({...newItem, payee:e.target.value})} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Mes</label>
                                    <input 
                                        type="month" 
                                        className="w-full p-3 bg-gray-50 rounded-lg border outline-none" 
                                        value={newItem.monthYear} 
                                        onChange={e=>setNewItem({...newItem, monthYear:e.target.value})} 
                                        required 
                                    />
                                </div>
                            </>
                        ) : (
                            <div>
                                <input 
                                    list={mode === 'collect' ? "clientsSuggestions" : ""} 
                                    className="w-full p-3 bg-gray-50 rounded-lg border focus:ring-2 focus:ring-blue-500 outline-none" 
                                    placeholder={mode === 'pay' ? "Beneficiario" : "Cliente"} 
                                    value={newItem.payee} 
                                    onChange={e=>setNewItem({...newItem, payee:e.target.value})} 
                                    required 
                                />
                                {mode === 'collect' && (
                                    <datalist id="clientsSuggestions">
                                        {uniqueClients.map(client => (
                                            <option key={client} value={client} />
                                        ))}
                                    </datalist>
                                )}
                            </div>
                        )}
                        <div className="flex gap-3">
                            {mode !== 'expenses' && (
                                <input 
                                    className="w-1/2 p-3 bg-gray-50 rounded-lg border outline-none" 
                                    placeholder="Nº Doc" 
                                    value={newItem.number} 
                                    onChange={e=>setNewItem({...newItem, number:e.target.value})} 
                                    required={mode === 'collect' || newItem.subtype === 'cheque' || mode === 'wallet'} 
                                />
                            )}
                            <input 
                                type="number" 
                                step="0.01" 
                                className={`${mode === 'expenses' ? 'w-full' : 'w-1/2'} p-3 bg-gray-50 rounded-lg border outline-none`} 
                                placeholder="$ Importe" 
                                value={newItem.amount} 
                                onChange={e=>setNewItem({...newItem, amount:e.target.value})} 
                                required 
                            />
                        </div>
                        <div className="flex gap-3">
                            {mode !== 'expenses' && (
                                <div className="w-1/2">
                                    <label className="text-xs text-gray-500 block mb-1">Emisión</label>
                                    <input 
                                        type="date" 
                                        className="w-full p-3 bg-gray-50 rounded-lg border outline-none" 
                                        value={newItem.issueDate} 
                                        onChange={e=>setNewItem({...newItem, issueDate:e.target.value})} 
                                        required={mode === 'collect'}
                                    />
                                </div>
                            )}
                            <div className={mode === 'expenses' ? 'w-full' : 'w-1/2'}>
                                <label className="text-xs text-gray-500 block mb-1">Vencimiento</label>
                                <input 
                                    type="date" 
                                    className="w-full p-3 bg-gray-50 rounded-lg border outline-none font-bold text-gray-700" 
                                    value={newItem.dueDate} 
                                    onChange={e=>setNewItem({...newItem, dueDate:e.target.value})} 
                                    required 
                                />
                            </div>
                        </div>
                        {mode === 'expenses' && !editingId && (
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border mt-2">
                                <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer">
                                    <input 
                                        type="checkbox" 
                                        checked={newItem.isRecurring} 
                                        onChange={e => setNewItem({...newItem, isRecurring: e.target.checked})} 
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500" 
                                    />
                                    Gasto Recurrente / Cuotas
                                </label>
                                {newItem.isRecurring && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Cantidad:</span>
                                        <input 
                                            type="number" 
                                            min="2" 
                                            max="120" 
                                            value={newItem.installments} 
                                            onChange={e => setNewItem({...newItem, installments: parseInt(e.target.value) || 2})} 
                                            className="w-16 p-1 border rounded-lg outline-none text-sm text-center" 
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                        <button 
                            type="submit" 
                            className={`w-full ${theme.btn} text-white p-3 rounded-lg font-bold mt-2`}
                        >
                            Guardar
                        </button>
                    </div>
                </form>
            )}

            {/* LIST (COBROS, PAGOS, CARTERA, GASTOS) */}
            {payTab !== 'bancos' && (
            <div className="space-y-3">
                {selectedDateFilter && (
                    <div className="mb-4 flex justify-between items-center bg-violet-50 p-3 rounded-lg border border-violet-100 mt-4">
                        <span className="text-sm text-violet-800 font-bold flex items-center gap-2">
                            <IconCalendar className="w-4 h-4"/> Filtrado: {new Date(selectedDateFilter+'T00:00:00').toLocaleDateString('es-AR')}
                        </span>
                        <button 
                            onClick={() => setSelectedDateFilter(null)} 
                            className="text-xs bg-white text-red-500 border border-red-200 px-2 py-1 rounded font-bold hover:bg-red-50"
                        >
                            Borrar
                        </button>
                    </div>
                )}

                {groupedView && (groupedView.type === 'flat' ? groupedView.data.map(item => {
                    const days = getDays(item.dueDate);
                    const isPaid = item.status === 'paid';
                    const isPartial = item.status === 'partial';
                    let borderClass = 'border-l-4 ';
                    
                    if (isPaid) borderClass += 'border-emerald-500 bg-emerald-50'; 
                    else if (isPartial) borderClass += 'border-yellow-400 bg-yellow-50';
                    else if (days < 0) borderClass += 'border-red-500 bg-red-50';
                    else if (days <= 7) borderClass += 'border-orange-400 bg-orange-50';
                    else borderClass += 'border-green-400 bg-white';

                    return (
                        <div key={item.id} className={`p-4 rounded-lg shadow-sm flex flex-col gap-2 ${borderClass} mb-2 bg-white`}>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <div className="text-gray-400">{getTypeIcon(item.subtype)}</div>
                                        <h3 className={`font-bold truncate text-gray-800`}>{item.payee}</h3>
                                        {isPaid && <span className="bg-emerald-200 text-emerald-800 text-[9px] px-1 rounded font-bold">PAGADO</span>}
                                        {isPartial && <span className="bg-yellow-200 text-yellow-800 text-[9px] px-1 rounded font-bold">PARCIAL</span>}
                                        {item.type === 'pay' && item.category !== 'others' && (
                                            <span className={`text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ml-1 ${getCategoryColor(item.category)}`}>
                                                {getCategoryLabel(item.category)}
                                            </span>
                                        )}
                                        {item.type === 'pay' && item.bank && !isPaid && (
                                            <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded font-bold ml-1 flex items-center gap-1">
                                                <IconBank className="w-3 h-3"/> {item.bank}
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
                                        {item.number && <span className="font-mono bg-white px-1 rounded border">#{item.number}</span>}
                                        <span>•</span>
                                        <span className={days < 0 && !isPaid ? 'text-red-600 font-bold' : ''}>
                                            {formatDate(item.dueDate)} 
                                            {days < 0 && !isPaid && <span className="ml-1 bg-red-100 text-red-600 px-1 rounded">-{Math.abs(days)}d</span>}
                                        </span>
                                    </div>
                                </div>
                                <div className="w-full sm:w-auto flex justify-between sm:justify-end items-center gap-4 pl-0 sm:pl-3 border-t sm:border-t-0 pt-2 sm:pt-0 mt-2 sm:mt-0">
                                    <div className="text-right">
                                        <div className="font-bold text-gray-800">{formatMoney(item.amount)}</div>
                                        {(isPartial || (isPaid && item.paidAmount < item.amount)) && (
                                            <div className="text-[10px] text-red-500 font-bold">Resta: {formatMoney(item.amount - (item.paidAmount || 0))}</div>
                                        )}
                                    </div>
                                    <div className="flex gap-1">
                                        {!isPaid && (
                                            <button onClick={() => markFullPayment(item)} className="text-gray-400 hover:text-green-600">
                                                <IconCheck className="w-4 h-4"/>
                                            </button>
                                        )}
                                        {!isPaid && item.status !== 'paid' && mode !== 'expenses' && (
                                            <button onClick={() => markPartialPayment(item)} className="text-gray-400 hover:text-yellow-600">
                                                $
                                            </button>
                                        )}
                                        <button onClick={() => setHistoryModal({isOpen: true, item: item})} className="text-gray-400 hover:text-purple-600" title="Ver Historial de Pagos">
                                            <IconEye className="w-4 h-4"/>
                                        </button>
                                        <button 
                                            onClick={() => { 
                                                const action = item.type === 'pay' ? 'PAGO' : 'COBRO';
                                                const text = `Hola *${item.payee}*, aviso sobre ${action} (Ref: ${item.number || 'S/N'}) por *${formatMoney(item.amount)}* con fecha: ${new Date(item.dueDate+'T00:00:00').toLocaleDateString('es-AR')}. Saludos, SII PALLETS.`;
                                                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                            }} 
                                            className="text-gray-400 hover:text-green-500"
                                        >
                                            <IconMessage className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-blue-600">
                                            <IconPencil className="w-4 h-4"/>
                                        </button>
                                        <button onClick={() => deleteItem(item)} className="text-gray-400 hover:text-red-600">
                                            <IconTrash className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {/* Detalle Integrado Cancelaciones Parciales */}
                            {(item.status === 'partial' && item.paymentHistory && item.paymentHistory.length > 0) && (
                                <div className="mt-2 pt-2 border-t border-dashed border-gray-200 bg-gray-50/50 rounded-lg p-2">
                                    <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Detalle de Cancelaciones Parciales:</p>
                                    {item.paymentHistory.map((h, i) => (
                                        <div key={i} className="flex justify-between items-center text-[10px] text-gray-600 py-0.5 px-1 hover:bg-gray-100 rounded">
                                            <span>{new Date(h.date).toLocaleDateString('es-AR')} • Medio: {h.method.toUpperCase()} {h.proof ? `(Ref: ${h.proof})` : ''}</span>
                                            <span className="font-bold text-green-600">{formatMoney(h.amount)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                }) : groupedView.data.map((group, idx) => {
                    const isClientGroup = groupedView.type === 'client-grouped';
                    return (
                    <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-2">
                        <button 
                            onClick={() => setExpandedGroups(p => ({...p, [group.key]: !p[group.key]}))} 
                            className="w-full p-3 flex justify-between items-center bg-gray-50 hover:bg-gray-100 transition"
                        >
                            <div className="flex items-center gap-3">
                                {isClientGroup ? (
                                    <div className={`bg-emerald-100 text-emerald-700 font-bold rounded-full p-2 w-10 h-10 flex items-center justify-center shrink-0`}>
                                        <IconUserGroup className="w-5 h-5"/>
                                    </div>
                                ) : (
                                    <div className={`${theme.light} ${theme.text} font-bold rounded-lg p-2 text-center min-w-[50px]`}>
                                        <span className="block text-xs uppercase">
                                            {group.label && group.label.includes(' ') ? group.label.split(' ')[0] : new Date(group.key + 'T00:00:00').toLocaleDateString('es-AR', {month:'short'})}
                                        </span>
                                        <span className="block text-xl leading-none">
                                            {group.key.includes('-') && group.key.length === 7 ? '' : new Date(group.key + 'T00:00:00').getDate()}
                                        </span>
                                    </div>
                                )}
                                <div className="text-left overflow-hidden">
                                    <p className="text-sm font-bold text-gray-700 truncate">
                                        {groupedView.type === 'client-grouped' || mode === 'expenses' ? group.label : `${group.items.length} Items`}
                                    </p>
                                    {(groupedView.type === 'client-grouped' || mode === 'expenses') && (
                                        <p className="text-xs text-gray-500">
                                            {group.count} {mode === 'pay' && payTab === 'realizados' ? 'Pagados' : 'Pendientes'}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="text-right flex items-center gap-2">
                                <p className="text-lg font-black text-gray-800">{formatMoney(group.total)}</p>
                                {isClientGroup && (
                                    <div className="flex gap-1 ml-2 border-l pl-2">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); triggerClientReport(group, 'print'); }} 
                                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-emerald-100 text-gray-400 hover:text-emerald-700 transition-colors" 
                                            title="Imprimir Estado"
                                        >
                                            <IconPrinter className="w-4 h-4" />
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); triggerClientReport(group, 'download'); }} 
                                            className="p-1.5 rounded-lg bg-gray-100 hover:bg-emerald-100 text-gray-400 hover:text-emerald-700 transition-colors" 
                                            title="Descargar PDF"
                                        >
                                            <IconDownload className="w-4 h-4" />
                                        </button>
                                    </div>
                                )}
                                <IconChevronDown className={`w-5 h-5 text-gray-400 transition-transform ml-1 ${expandedGroups[group.key] ? 'rotate-180' : ''}`} />
                            </div>
                        </button>
                        {expandedGroups[group.key] && (
                            <div className="border-t border-gray-100 animate-fade-in bg-gray-50 p-2 space-y-2">
                                {group.items.map(item => {
                                    const days = getDays(item.dueDate);
                                    const isPaid = item.status === 'paid';
                                    const isPartial = item.status === 'partial';
                                    let borderClass = 'border-l-4 ';
                                    
                                    if (isPaid) borderClass += 'border-emerald-500 bg-emerald-50'; 
                                    else if (isPartial) borderClass += 'border-yellow-400 bg-yellow-50';
                                    else if (days < 0) borderClass += 'border-red-500 bg-red-50';
                                    else if (days <= 7) borderClass += 'border-orange-400 bg-orange-50';
                                    else borderClass += 'border-green-400 bg-white';

                                    return (
                                        <div key={item.id} className={`p-4 rounded-lg shadow-sm flex flex-col gap-2 ${borderClass} mb-2 bg-white`}>
                                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-gray-400">{getTypeIcon(item.subtype)}</div>
                                                        <h3 className={`font-bold truncate text-gray-800`}>{item.payee}</h3>
                                                        {isPaid && <span className="bg-emerald-200 text-emerald-800 text-[9px] px-1 rounded font-bold">PAGADO</span>}
                                                        {isPartial && <span className="bg-yellow-200 text-yellow-800 text-[9px] px-1 rounded font-bold">PARCIAL</span>}
                                                        {item.type === 'pay' && item.category !== 'others' && (
                                                            <span className={`text-white text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ml-1 ${getCategoryColor(item.category)}`}>
                                                                {getCategoryLabel(item.category)}
                                                            </span>
                                                        )}
                                                        {item.type === 'pay' && item.bank && !isPaid && (
                                                            <span className="bg-blue-100 text-blue-700 text-[9px] px-1.5 py-0.5 rounded font-bold ml-1 flex items-center gap-1">
                                                                <IconBank className="w-3 h-3"/> {item.bank}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-gray-500 flex flex-wrap gap-2 mt-1">
                                                        {item.number && <span className="font-mono bg-white px-1 rounded border">#{item.number}</span>}
                                                        <span>•</span>
                                                        <span className={days < 0 && !isPaid ? 'text-red-600 font-bold' : ''}>
                                                            {formatDate(item.dueDate)} 
                                                            {days < 0 && !isPaid && <span className="ml-1 bg-red-100 text-red-600 px-1 rounded">-{Math.abs(days)}d</span>}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="w-full sm:w-auto flex justify-between sm:justify-end items-center gap-4 pl-0 sm:pl-3 border-t sm:border-t-0 pt-2 sm:pt-0 mt-2 sm:mt-0">
                                                    <div className="text-right">
                                                        <div className="font-bold text-gray-800">{formatMoney(item.amount)}</div>
                                                        {(isPartial || (isPaid && item.paidAmount < item.amount)) && (
                                                            <div className="text-[10px] text-red-500 font-bold">Resta: {formatMoney(item.amount - (item.paidAmount || 0))}</div>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        {!isPaid && (
                                                            <button onClick={() => markFullPayment(item)} className="text-gray-400 hover:text-green-600">
                                                                <IconCheck className="w-4 h-4"/>
                                                            </button>
                                                        )}
                                                        {!isPaid && item.status !== 'paid' && mode !== 'expenses' && (
                                                            <button onClick={() => markPartialPayment(item)} className="text-gray-400 hover:text-yellow-600">
                                                                $
                                                            </button>
                                                        )}
                                                        <button onClick={() => setHistoryModal({isOpen: true, item: item})} className="text-gray-400 hover:text-purple-600" title="Ver Historial de Pagos">
                                                            <IconEye className="w-4 h-4"/>
                                                        </button>
                                                        <button 
                                                            onClick={() => { 
                                                                const action = item.type === 'pay' ? 'PAGO' : 'COBRO';
                                                                const text = `Hola *${item.payee}*, aviso sobre ${action} (Ref: ${item.number || 'S/N'}) por *${formatMoney(item.amount)}* con fecha: ${new Date(item.dueDate+'T00:00:00').toLocaleDateString('es-AR')}. Saludos, SII PALLETS.`;
                                                                window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                                            }} 
                                                            className="text-gray-400 hover:text-green-500"
                                                        >
                                                            <IconMessage className="w-4 h-4" />
                                                        </button>
                                                        <button onClick={() => handleEdit(item)} className="text-gray-400 hover:text-blue-600">
                                                            <IconPencil className="w-4 h-4"/>
                                                        </button>
                                                        <button onClick={() => deleteItem(item)} className="text-gray-400 hover:text-red-600">
                                                            <IconTrash className="w-4 h-4"/>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                            {/* Detalle Integrado Cancelaciones Parciales */}
                                            {(item.status === 'partial' && item.paymentHistory && item.paymentHistory.length > 0) && (
                                                <div className="mt-2 pt-2 border-t border-dashed border-gray-200 bg-gray-50/50 rounded-lg p-2">
                                                    <p className="text-[9px] font-bold text-gray-500 uppercase mb-1">Detalle de Cancelaciones Parciales:</p>
                                                    {item.paymentHistory.map((h, i) => (
                                                        <div key={i} className="flex justify-between items-center text-[10px] text-gray-600 py-0.5 px-1 hover:bg-gray-100 rounded">
                                                            <span>{new Date(h.date).toLocaleDateString('es-AR')} • Medio: {h.method.toUpperCase()} {h.proof ? `(Ref: ${h.proof})` : ''}</span>
                                                            <span className="font-bold text-green-600">{formatMoney(h.amount)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
                })
                )}
                {(!groupedView || groupedView.data.length === 0) && (
                    <div className="text-center py-10 text-gray-400 italic">No hay registros.</div>
                )}
                {selectedDateFilter && (
                    <button 
                        onClick={() => setSelectedDateFilter(null)} 
                        className="w-full mt-4 py-4 bg-gray-200 text-gray-600 font-bold rounded-xl text-sm hover:bg-gray-300 shadow-inner flex items-center justify-center gap-2"
                    >
                        <IconChevronLeft className="w-4 h-4" /> Volver a ver todo
                    </button>
                )}
            </div>
            )}

            {/* MODO PAGOS: BANCOS (Gestión de Bancos) */}
            {mode === 'pay' && payTab === 'bancos' && (
                <div className="p-4 pt-0 animate-fade-in">
                    <div className="bg-white p-5 rounded-2xl shadow-md border border-gray-100 flex flex-col gap-4 mb-6">
                        <div>
                            <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                <IconBank className="text-blue-500"/> Gestión de Bancos
                            </h3>
                            <p className="text-xs text-gray-500 mt-1">Carga las cuentas bancarias o billeteras virtuales para asociarlas a los pagos y obtener reportes agrupados.</p>
                        </div>
                        <form onSubmit={addBank} className="flex gap-2">
                            <input 
                                type="text" 
                                className="flex-1 p-3 bg-gray-50 rounded-lg border outline-none focus:ring-2 focus:ring-blue-500" 
                                placeholder="Ej. Galicia, MercadoPago..." 
                                value={newBank} 
                                onChange={e => setNewBank(e.target.value)} 
                                required 
                            />
                            <button 
                                type="submit" 
                                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm whitespace-nowrap"
                            >
                                Añadir Banco
                            </button>
                        </form>
                    </div>
                    
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-3 bg-gray-50 border-b font-bold text-sm text-gray-600">
                            Bancos Registrados ({banks.length})
                        </div>
                        <div className="divide-y divide-gray-100">
                            {banks.length === 0 ? (
                                <p className="p-4 text-center text-xs text-gray-400">No hay bancos registrados.</p>
                            ) : banks.map(b => (
                                <div key={b.id} className="p-3 flex justify-between items-center hover:bg-gray-50">
                                    <span className="font-bold text-gray-700 flex items-center gap-2">
                                        <IconBank className="w-4 h-4 text-gray-400"/> {b.name}
                                    </span>
                                    <button onClick={() => deleteBank(b.id)} className="text-red-400 hover:text-red-600 p-2">
                                        <IconTrash className="w-4 h-4"/>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
