import React from 'react';
import { IconBox, IconPlus } from '../components/Icons';
import { formatMoney } from '../utils/helpers';

export default function Caja({ cashData, showAddForm, setShowAddForm, newItem, setNewItem, handleCashAdd }) {
    return (
        <div className="animate-fade-in">
            <div className={`bg-white p-5 rounded-2xl shadow-md border-l-8 mb-6 flex items-center justify-between border-cyan-500`}>
                <div>
                    <p className={`text-xs font-bold uppercase tracking-wide mb-1 text-cyan-600`}>Saldo en Caja</p>
                    <p className="text-3xl font-black text-gray-800">{formatMoney(cashData.balance)}</p>
                </div>
                <div className={`bg-cyan-50 p-3 rounded-full`}>
                    <IconBox className={`w-8 h-8 text-cyan-600`} />
                </div>
            </div>
            
            <button 
                onClick={() => { 
                    setNewItem({
                        number:'', 
                        issueDate: new Date().toISOString().split('T')[0], 
                        dueDate:'', 
                        amount:'', 
                        payee:'', 
                        cashType: 'income'
                    }); 
                    setShowAddForm(!showAddForm); 
                }} 
                className={`w-full bg-cyan-600 hover:opacity-90 text-white p-3 rounded-xl shadow-md mb-6 flex items-center justify-center gap-2 font-bold transition-all active:scale-95`}
            >
                <IconPlus className="w-5 h-5"/> {showAddForm ? 'Cancelar' : 'Registrar Movimiento'}
            </button>
            
            {showAddForm && (
                <form onSubmit={handleCashAdd} className="bg-white p-5 rounded-xl shadow-lg border border-gray-200 mb-6 animate-fade-in relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-full bg-cyan-600"></div>
                    <h3 className="font-bold mb-4 text-gray-700">Nuevo Movimiento de Caja</h3>
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Tipo</label>
                            <select 
                                className="w-full p-3 bg-gray-50 rounded-lg border text-sm outline-none text-gray-700" 
                                value={newItem.cashType} 
                                onChange={e => setNewItem({...newItem, cashType: e.target.value})}
                            >
                                <option value="income">🟢 Ingreso</option>
                                <option value="expense">🔴 Egreso</option>
                                <option value="open">🔓 Apertura de Caja</option>
                                <option value="close">🔒 Cierre de Caja</option>
                            </select>
                        </div>
                        
                        {newItem.cashType !== 'close' && (
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Monto</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                className="w-full p-3 bg-gray-50 rounded-lg border focus:ring-2 focus:ring-cyan-500 outline-none" 
                                placeholder="$ 0.00" 
                                value={newItem.amount} 
                                onChange={e=>setNewItem({...newItem, amount:e.target.value})} 
                                required 
                            />
                        </div>
                        )}
                        
                        {newItem.cashType !== 'close' && (
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Descripción</label>
                            <input 
                                className="w-full p-3 bg-gray-50 rounded-lg border focus:ring-2 focus:ring-cyan-500 outline-none" 
                                placeholder="Detalle del movimiento" 
                                value={newItem.payee} 
                                onChange={e=>setNewItem({...newItem, payee:e.target.value})} 
                                required 
                            />
                        </div>
                        )}
                        
                        <div>
                            <label className="text-xs text-gray-500 block mb-1">Fecha</label>
                            <input 
                                type="date" 
                                className="w-full p-3 bg-gray-50 rounded-lg border outline-none" 
                                value={newItem.issueDate} 
                                onChange={e=>setNewItem({...newItem, issueDate:e.target.value})} 
                                required 
                            />
                        </div>
                        
                        <button type="submit" className="w-full bg-cyan-600 text-white p-3 rounded-lg font-bold hover:opacity-90">
                            Guardar
                        </button>
                    </div>
                </form>
            )}
            
            {cashData.groups.length === 0 ? (
                <div className="text-center py-10 text-gray-400 italic">No hay movimientos.</div>
            ) : (
                cashData.groups.map((group, idx) => (
                    <div key={idx} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
                        <div className="bg-gray-50 p-2 font-bold text-xs text-gray-600 uppercase border-b border-gray-100">
                            {group.label}
                        </div>
                        <div>
                            <div className="header-caja grid-caja">
                                <div>FECHA</div>
                                <div>DESCRIPCIÓN</div>
                                <div className="text-right text-green-700">INGRESO</div>
                                <div className="text-right text-red-700">EGRESO</div>
                                <div className="text-right">SALDO</div>
                            </div>
                            {group.items.map(item => (
                                <div key={item.id} className={`row-caja grid-caja ${item.cashType === 'close' ? 'bg-gray-200 font-bold' : (item.cashType === 'open' ? 'bg-cyan-50' : '')}`}>
                                    <div className="text-gray-500">
                                        {new Date(item.date+'T00:00:00').toLocaleDateString('es-AR', {day:'2-digit', month:'2-digit'})}
                                    </div>
                                    <div className="truncate" title={item.description}>
                                        {item.description || (item.cashType === 'close' ? 'CIERRE DE CAJA' : 'Apertura')}
                                    </div>
                                    <div className="text-right text-green-600 font-bold">
                                        {(item.cashType === 'income' || item.cashType === 'open') ? formatMoney(item.amount) : ''}
                                    </div>
                                    <div className="text-right text-red-600 font-bold">
                                        {item.cashType === 'expense' ? formatMoney(item.amount) : ''}
                                    </div>
                                    <div className="text-right font-mono text-gray-800">
                                        {formatMoney(item.balance)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
