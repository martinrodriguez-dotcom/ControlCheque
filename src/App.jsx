// Archivo: src/App.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, setDoc } from "firebase/firestore";
import { auth, db } from './firebase';
import { getDays, formatMoney, formatDate, getTheme, handleReportAction } from './utils/helpers';
import { 
    IconDownload, IconPrinter, IconBell, IconBellRing, IconSearch, 
    IconBox, IconTag, IconWallet, IconTrendingUp, IconBriefcase, 
    IconFolder, IconLayers, IconCheck, IconEye, IconPencil, IconTrash, IconMessage, IconBank, IconChevronLeft, IconChevronRight, IconX
} from './components/Icons';

// Importaremos las páginas en los próximos pasos (las comentamos temporalmente para que no den error)
// import Pallets from './pages/Pallets';
// import Caja from './pages/Caja';
// import Movimientos from './pages/Movimientos';
// import Balance from './pages/Balance';

export default function App() {
    const [mode, setMode] = useState('pay');
    const [user, setUser] = useState(null); 
    const [payItems, setPayItems] = useState([]);
    const [collectItems, setCollectItems] = useState([]);
    const [walletItems, setWalletItems] = useState([]);
    const [expenseItems, setExpenseItems] = useState([]);
    const [cashItems, setCashItems] = useState([]); 
    const [banks, setBanks] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [activeFilter, setActiveFilter] = useState('all'); 
    const [showAddForm, setShowAddForm] = useState(false);
    
    const [newItem, setNewItem] = useState({ 
        number: '', issueDate: '', dueDate: '', amount: '', payee: '', paidAmount: 0, 
        subtype: 'cheque', category: 'others', status: 'pending', monthYear: '', 
        cashType: 'income', bank: '', isRecurring: false, installments: 2
    });
    const [newBank, setNewBank] = useState(""); 
    
    const [editingId, setEditingId] = useState(null); 
    const [expandedGroups, setExpandedGroups] = useState({});
    const [expandedCategory, setExpandedCategory] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showNotifPanel, setShowNotifPanel] = useState(false);
    const [notifPermission, setNotifPermission] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'default');
    const [selectedDateFilter, setSelectedDateFilter] = useState(null);
    const [showCalendar, setShowCalendar] = useState(false);
    const [currentCalDate, setCurrentCalDate] = useState(new Date());
    
    const [paymentModal, setPaymentModal] = useState({ isOpen: false, item: null, method: 'transfer', proof: '', type: 'total', amount: '' });
    const [historyModal, setHistoryModal] = useState({ isOpen: false, item: null });
    const [rangeReportModal, setRangeReportModal] = useState({ isOpen: false, startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] });

    const [payTab, setPayTab] = useState('pendientes');

    // ESTADOS: MÓDULO PALLETS
    const [produccionMensual, setProduccionMensual] = useState(7000);
    const [palletTab, setPalletTab] = useState('costos');
    const [costosMadres, setCostosMadres] = useState([]);
    const [palletsTemplates, setPalletsTemplates] = useState([]);
    const [presupuestos, setPresupuestos] = useState([]);
    
    const [newCosto, setNewCosto] = useState({ nombre: '', tipo: 'Fijo', costoTotal: '', cantidad: 1, unidad: 'u', alto: '', ancho: '', largo: '' });
    const [newPallet, setNewPallet] = useState({ nombre: '', items: [] });
    const [newQuote, setNewQuote] = useState({ cliente: '', items: [] });
    
    const [expandedPallets, setExpandedPallets] = useState({});
    const [expandedQuotes, setExpandedQuotes] = useState({});

    const theme = getTheme(mode);

    useEffect(() => {
        window.addEventListener('beforeinstallprompt', (e) => { 
            e.preventDefault(); 
            setDeferredPrompt(e); 
        });
        
        const unsubscribe = onAuthStateChanged(auth, (u) => {
            if (u) {
                setUser(u); 
            } else {
                signInAnonymously(auth).catch(console.error);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return; 
        setLoading(true);
        
        const unsubPay = onSnapshot(collection(db, 'cheques_public_shared', 'main_list', 'items'), (snap) => {
            const data = snap.docs.map(d => { 
                const dat = d.data(); 
                return { id: d.id, ...dat, dueDate: dat.dueDate || dat.date, type: 'pay', subtype: dat.subtype || 'cheque', category: dat.category || 'others' }; 
            });
            setPayItems(data);
        });

        const unsubCollect = onSnapshot(collection(db, 'cobros_public_shared', 'main_list', 'items'), (snap) => {
            const data = snap.docs.map(d => { 
                const dat = d.data(); 
                return { id: d.id, ...dat, dueDate: dat.dueDate || dat.date, type: 'collect', subtype: dat.subtype || 'invoice' }; 
            });
            setCollectItems(data);
        });

        const unsubWallet = onSnapshot(collection(db, 'cartera_public_shared', 'main_list', 'items'), (snap) => {
            const data = snap.docs.map(d => { 
                const dat = d.data(); 
                return { id: d.id, ...dat, dueDate: dat.dueDate || dat.date, type: 'wallet', subtype: 'cheque' }; 
            });
            setWalletItems(data);
        });

        const unsubExpenses = onSnapshot(collection(db, 'gastos_public_shared', 'main_list', 'items'), (snap) => {
            const data = snap.docs.map(d => { 
                const dat = d.data(); 
                return { id: d.id, ...dat, dueDate: dat.dueDate || dat.date || new Date().toISOString().split('T')[0], type: 'expense' }; 
            });
            setExpenseItems(data);
        });

        const unsubCash = onSnapshot(collection(db, 'caja_public_shared', 'main_list', 'items'), (snap) => {
            const data = snap.docs.map(d => { 
                const dat = d.data(); 
                return { id: d.id, ...dat, type: 'cash' }; 
            });
            setCashItems(data);
        });
        
        const unsubBanks = onSnapshot(collection(db, 'bancos_sii', 'main_list', 'items'), (snap) => {
            setBanks(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => a.name.localeCompare(b.name)));
        });

        const unsubCostos = onSnapshot(collection(db, 'costos_madres_sii', 'main_list', 'items'), (snap) => {
            setCostosMadres(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
        });
        
        const unsubPallets = onSnapshot(collection(db, 'pallets_templates_sii', 'main_list', 'items'), (snap) => {
            setPalletsTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
        });
        
        const unsubQuotes = onSnapshot(collection(db, 'presupuestos_sii', 'main_list', 'items'), (snap) => {
            setPresupuestos(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.date) - new Date(a.date)));
        });
        
        const unsubConfig = onSnapshot(doc(db, 'config_sii', 'general'), (docSnap) => {
            if (docSnap.exists()) {
                setProduccionMensual(docSnap.data().produccionMensual || 7000);
            }
        });
        
        setTimeout(() => setLoading(false), 800); 
        
        return () => { 
            unsubPay(); unsubCollect(); unsubWallet(); unsubExpenses(); unsubCash(); 
            unsubBanks(); unsubCostos(); unsubPallets(); unsubQuotes(); unsubConfig(); 
        };
    }, [user]);

    const checkAlerts = (allItems) => { 
        if(typeof Notification === 'undefined' || Notification.permission !== 'granted') return; 
        const urgentCount = allItems.filter(c => c.status !== 'paid' && getDays(c.dueDate) <= 5 && getDays(c.dueDate) >= 0).length; 
    };

    useEffect(() => { 
        checkAlerts([...payItems, ...collectItems, ...walletItems, ...expenseItems]); 
    }, [payItems, collectItems, walletItems, expenseItems]);

    const requestNotify = () => { 
        if (typeof Notification === 'undefined') return; 
        Notification.requestPermission().then(perm => { 
            setNotifPermission(perm); 
            if(perm === 'granted') { 
                try { new Notification("SII PALLETS APP", { body: "¡Notificaciones activadas!" }); } catch(e) {} 
            } 
        }); 
    };

    const alerts = useMemo(() => {
        const all = [...payItems, ...collectItems, ...walletItems, ...expenseItems];
        return all.filter(item => { 
            if (item.status === 'paid') return false; 
            const d = getDays(item.dueDate); 
            return d <= 10; 
        }).sort((a,b) => getDays(a.dueDate) - getDays(b.dueDate));
    }, [payItems, collectItems, walletItems, expenseItems]);

    const installApp = () => { 
        if (deferredPrompt) { 
            deferredPrompt.prompt(); 
            deferredPrompt.userChoice.then((res) => { 
                if(res.outcome==='accepted') setDeferredPrompt(null); 
            }); 
        } 
    };

    const changeMode = (newMode) => {
        setMode(newMode);
        setPayTab('pendientes');
        setShowAddForm(false);
        setEditingId(null);
    };

    return (
        <div className="pb-24 max-w-4xl mx-auto min-h-screen bg-gray-50 shadow-2xl relative transition-colors duration-500">
            {/* HEADER Y NAVEGACIÓN */}
            <div className={`${theme.bg} text-white p-4 sticky top-0 z-30 shadow-lg transition-colors duration-500`}>
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold flex items-center gap-2">SII PALLETS APP</h1>
                    <div className="flex gap-1 items-center">
                        {deferredPrompt && ( 
                            <button onClick={installApp} className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 mr-1">
                                <IconDownload className="w-4 h-4" /> Instalar
                            </button> 
                        )}
                        {mode !== 'cashbox' && mode !== 'pallets' && (
                            <>
                                <button onClick={() => {/* triggerMainReport se pasará al componente */}} className="p-2 relative bg-white/20 rounded-full hover:bg-white/30" title="Imprimir Reporte">
                                    <IconPrinter className="w-5 h-5"/>
                                </button>
                                <button onClick={() => {/* triggerMainReport se pasará al componente */}} className="p-2 relative bg-white/20 rounded-full hover:bg-white/30" title="Descargar PDF">
                                    <IconDownload className="w-5 h-5"/>
                                </button>
                            </>
                        )}
                        <div className="relative ml-1">
                            <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="p-2 relative">
                                {alerts.length > 0 ? <IconBellRing className="w-6 h-6 animate-pulse text-yellow-300"/> : <IconBell className="w-6 h-6"/>}
                                {alerts.length > 0 && <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{alerts.length}</span>}
                            </button>
                            {showNotifPanel && (
                                <div className="absolute right-0 mt-3 w-72 bg-white text-gray-800 rounded-xl shadow-2xl border border-gray-200 z-50 overflow-hidden">
                                    <div className="p-3 bg-gray-50 border-b flex justify-between items-center">
                                        <h3 className="font-bold text-sm">Alertas (10 días)</h3>
                                        {notifPermission !== 'granted' && (
                                            <button onClick={requestNotify} className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded font-bold hover:bg-blue-200">ACTIVAR PUSH</button>
                                        )}
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {alerts.length === 0 ? <div className="p-4 text-center text-xs text-gray-400">Todo tranquilo.</div> :
                                        alerts.map(a => {
                                            const d = getDays(a.dueDate);
                                            const isPay = a.type === 'pay';
                                            return (
                                                <div key={a.id} className={`p-3 border-b text-sm ${d < 0 ? 'bg-red-50' : 'bg-white'}`}>
                                                    <div className="flex justify-between">
                                                        <span className={`text-[10px] font-bold px-1 rounded ${isPay ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                            {isPay ? 'PAGO' : (a.type === 'wallet' ? 'CARTERA' : (a.type === 'expense' ? 'GASTO' : 'COBRO'))}
                                                        </span>
                                                        <span className="font-mono text-xs">{formatMoney(a.amount - (a.paidAmount||0))}</span>
                                                    </div>
                                                    <p className="font-bold mt-1">{a.payee}</p>
                                                    <p className={`text-xs ${d < 0 ? 'text-red-600 font-bold' : 'text-orange-500'}`}>
                                                        {d < 0 ? `Vencido hace ${Math.abs(d)} días` : `Vence en ${d} días`}
                                                    </p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {mode !== 'pallets' && (
                <div className="mb-3 relative">
                    <input 
                        type="text" 
                        placeholder="Buscar por nombre, cheque o factura..." 
                        className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/70 outline-none focus:bg-white/30 text-sm" 
                        value={searchTerm} 
                        onChange={e => setSearchTerm(e.target.value)} 
                    />
                    <IconSearch className="w-4 h-4 text-white/70 absolute left-3 top-2.5"/>
                </div>
                )}

                <div className="bg-black/20 p-1 rounded-xl flex text-[10px] sm:text-xs overflow-x-auto scrollbar-hide">
                    <button onClick={() => changeMode('cashbox')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'cashbox' ? 'bg-white text-cyan-800 shadow-md' : 'text-white/60'}`}><IconBox className="w-4 h-4"/> <span>CAJA</span></button>
                    <button onClick={() => changeMode('expenses')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'expenses' ? 'bg-white text-orange-800 shadow-md' : 'text-white/60'}`}><IconTag className="w-4 h-4"/> <span>GASTOS</span></button>
                    <button onClick={() => changeMode('pay')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'pay' ? 'bg-white text-blue-800 shadow-md' : 'text-white/60'}`}><IconWallet className="w-4 h-4"/> <span>PAGOS</span></button>
                    <button onClick={() => changeMode('balance')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'balance' ? 'bg-white text-violet-800 shadow-md' : 'text-white/60'}`}><IconTrendingUp className="w-4 h-4"/> <span>BALANCE</span></button>
                    <button onClick={() => changeMode('collect')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'collect' ? 'bg-white text-emerald-800 shadow-md' : 'text-white/60'}`}><IconBriefcase className="w-4 h-4"/> <span>COBROS</span></button>
                    <button onClick={() => changeMode('wallet')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'wallet' ? 'bg-white text-indigo-800 shadow-md' : 'text-white/60'}`}><IconFolder className="w-4 h-4"/> <span>CARTERA</span></button>
                    <button onClick={() => changeMode('pallets')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'pallets' ? 'bg-white text-teal-800 shadow-md' : 'text-white/60'}`}><IconLayers className="w-4 h-4"/> <span>PALLETS</span></button>
                </div>
            </div>

            {/* CONTENIDO DE LAS PÁGINAS */}
            <div className="p-4 text-center">
                <p className="text-gray-500 mt-10">
                    Las páginas están siendo divididas en sus respectivos archivos. En el próximo paso incrustaremos el contenido aquí.
                </p>
                {/* Aquí irán los componentes de páginas:
                    {mode === 'pallets' && <Pallets ...props />}
                    {mode === 'cashbox' && <Caja ...props />}
                    {mode === 'pay' || mode === 'collect' || mode === 'wallet' || mode === 'expenses' ? <Movimientos ...props /> : null}
                    {mode === 'balance' && <Balance ...props />}
                */}
            </div>
        </div>
    );
}
