import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { collection, onSnapshot, doc, updateDoc, deleteDoc, addDoc, setDoc } from "firebase/firestore";
import { auth, db } from './firebase';
import { getDays, formatMoney, formatDate, getTheme, handleReportAction, getCategoryLabel, getCategoryColor } from './utils/helpers';
import { 
    IconDownload, IconPrinter, IconBell, IconBellRing, IconSearch, 
    IconBox, IconTag, IconWallet, IconTrendingUp, IconBriefcase, 
    IconFolder, IconLayers, IconCheck, IconEye, IconPencil, IconTrash, IconMessage, IconBank, IconChevronLeft, IconChevronRight, IconX, IconFileText, IconCalendar
} from './components/Icons';

import Pallets from './pages/Pallets';
import Caja from './pages/Caja';
import Movimientos from './pages/Movimientos';
import Balance from './pages/Balance';
import Facturacion from './pages/Facturacion';

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
        number: '', 
        issueDate: '', 
        dueDate: '', 
        amount: '', 
        payee: '', 
        paidAmount: 0, 
        subtype: 'cheque', 
        category: 'others', 
        status: 'pending', 
        monthYear: '', 
        cashType: 'income', 
        bank: '', 
        isRecurring: false, 
        installments: 2
    });
    const [newBank, setNewBank] = useState(""); 
    
    const [editingId, setEditingId] = useState(null); 
    const [expandedGroups, setExpandedGroups] = useState({});
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

    const [produccionMensual, setProduccionMensual] = useState(7000);
    const [costosMadres, setCostosMadres] = useState([]);
    const [palletsTemplates, setPalletsTemplates] = useState([]);
    const [presupuestos, setPresupuestos] = useState([]);

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

    const totalRealizados = useMemo(() => {
        return payItems.filter(i => i.status === 'paid').reduce((acc, i) => acc + (i.paidAmount || i.amount), 0);
    }, [payItems]);

    const uniqueClients = useMemo(() => {
        const clients = new Set();
        const source = mode === 'wallet' ? walletItems : collectItems;
        source.forEach(item => { if(item.payee) clients.add(item.payee.trim()); });
        return Array.from(clients).sort();
    }, [collectItems, walletItems, mode]);

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

    const cashData = useMemo(() => {
        const sorted = [...cashItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime() || (a.createdAt || '').localeCompare(b.createdAt || ''));
        let balance = 0;
        const itemsWithBalance = sorted.map(item => {
            if (item.cashType === 'open' || item.cashType === 'income') balance += item.amount;
            else if (item.cashType === 'expense') balance -= item.amount;
            return { ...item, balance };
        });
        const groups = {};
        itemsWithBalance.forEach(item => {
            const monthKey = item.date.substring(0, 7); 
            if (!groups[monthKey]) { 
                const [y, m] = monthKey.split('-'); 
                const dateObj = new Date(y, m-1); 
                const label = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }); 
                groups[monthKey] = { key: monthKey, label: label.charAt(0).toUpperCase() + label.slice(1), items: [] }; 
            }
            groups[monthKey].items.push(item);
        });
        const sortedGroups = Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
        return { balance, groups: sortedGroups };
    }, [cashItems]);

    const balanceData = useMemo(() => {
        const calcPending = (list) => list.filter(i => i.status !== 'paid').reduce((sum, i) => sum + (i.amount - (i.paidAmount || 0)), 0);
        const pendingPay = calcPending(payItems); 
        const pendingCollect = calcPending(collectItems); 
        const pendingWallet = calcPending(walletItems); 
        const pendingExpenses = calcPending(expenseItems);
        
        const expensesByCategory = {};
        payItems.filter(i => i.status !== 'paid').forEach(item => { 
            const cat = item.category || 'others'; 
            if (!expensesByCategory[cat]) expensesByCategory[cat] = 0; 
            expensesByCategory[cat] += (item.amount - (item.paidAmount || 0)); 
        });
        
        const sortedCategories = Object.entries(expensesByCategory).sort(([,a], [,b]) => b - a).map(([cat, amount]) => ({ cat, amount }));
        let dailyAgenda = [];
        
        if (mode === 'balance') {
            const dates = new Set();
            [...payItems, ...collectItems, ...walletItems, ...expenseItems]
                .filter(i => i.status !== 'paid')
                .forEach(i => { if(i.dueDate) dates.add(i.dueDate); });
                
            const sortedDates = Array.from(dates).sort((a,b) => new Date(a) - new Date(b));
            
            dailyAgenda = sortedDates.map(date => {
                const dayPays = payItems.filter(i => i.dueDate === date && i.status !== 'paid'); 
                const dayCollects = collectItems.filter(i => i.dueDate === date && i.status !== 'paid'); 
                const dayWallet = walletItems.filter(i => i.dueDate === date && i.status !== 'paid'); 
                const dayExpenses = expenseItems.filter(i => i.dueDate === date && i.status !== 'paid');
                
                const outflow = dayPays.reduce((s, i) => s + (i.amount - (i.paidAmount||0)), 0) + dayExpenses.reduce((s, i) => s + (i.amount - (i.paidAmount||0)), 0);
                const inflow = dayCollects.reduce((s, i) => s + (i.amount - (i.paidAmount||0)), 0) + dayWallet.reduce((s, i) => s + (i.amount - (i.paidAmount||0)), 0);
                
                return { date, outflow, inflow, net: inflow - outflow };
            });
        }
        return { pay: pendingPay, collect: pendingCollect, wallet: pendingWallet, expenses: pendingExpenses, net: (pendingCollect + pendingWallet) - (pendingPay + pendingExpenses), dailyAgenda, sortedCategories };
    }, [payItems, collectItems, walletItems, expenseItems, mode]);

    const dashboardData = useMemo(() => {
        const currentItems = mode === 'pay' ? payItems : (mode === 'collect' ? collectItems : (mode === 'wallet' ? walletItems : (mode === 'expenses' ? expenseItems : [])));
        const pending = currentItems.filter(i => i.status !== 'paid');
        const calcDebt = (list) => list.reduce((s, i) => s + (i.amount - (i.paidAmount || 0)), 0);
        
        return { 
            expired: { count: pending.filter(i => getDays(i.dueDate) < 0).length, total: calcDebt(pending.filter(i => getDays(i.dueDate) < 0)) }, 
            urgent: { count: pending.filter(i => getDays(i.dueDate) >= 0 && getDays(i.dueDate) <= 7).length, total: calcDebt(pending.filter(i => getDays(i.dueDate) >= 0 && getDays(i.dueDate) <= 7)) }, 
            future: { count: pending.filter(i => getDays(i.dueDate) > 7).length, total: calcDebt(pending.filter(i => getDays(i.dueDate) > 7)) } 
        };
    }, [payItems, collectItems, walletItems, expenseItems, mode]);

    const forecastData = useMemo(() => {
        const days = []; const today = new Date(); today.setHours(0,0,0,0);
        for (let i = 0; i < 15; i++) {
            const current = new Date(today); current.setDate(today.getDate() + i);
            const year = current.getFullYear(); 
            const month = String(current.getMonth() + 1).padStart(2, '0'); 
            const day = String(current.getDate()).padStart(2, '0');
            const dateKey = `${year}-${month}-${day}`;
            
            const dayPays = payItems.filter(item => item.dueDate === dateKey && item.status !== 'paid'); 
            const dayCollects = collectItems.filter(item => item.dueDate === dateKey && item.status !== 'paid'); 
            const dayWallet = walletItems.filter(item => item.dueDate === dateKey && item.status !== 'paid'); 
            const dayExpenses = expenseItems.filter(item => item.dueDate === dateKey && item.status !== 'paid');
            
            const outflow = dayPays.reduce((sum, item) => sum + (item.amount - (item.paidAmount || 0)), 0) + dayExpenses.reduce((sum, item) => sum + (item.amount - (item.paidAmount || 0)), 0);
            const inflow = dayCollects.reduce((sum, item) => sum + (item.amount - (item.paidAmount || 0)), 0) + dayWallet.reduce((sum, item) => sum + (item.amount - (item.paidAmount || 0)), 0);
            
            days.push({ date: current, dateKey, net: inflow - outflow, inflow, outflow });
        }
        return days;
    }, [payItems, collectItems, walletItems, expenseItems]);

    const generateCalendarDays = () => {
        const year = currentCalDate.getFullYear(); 
        const month = currentCalDate.getMonth(); 
        const daysInMonth = new Date(year, month + 1, 0).getDate(); 
        const firstDay = new Date(year, month, 1).getDay(); 
        const firstDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        
        let runningBalance = 0;
        [...payItems, ...collectItems, ...walletItems, ...expenseItems].forEach(item => { 
            if (item.status === 'paid') return; 
            if (item.dueDate < firstDateStr) { 
                if (item.type === 'pay' || item.type === 'expense') { 
                    runningBalance -= (item.amount - (item.paidAmount || 0)); 
                } else { 
                    runningBalance += (item.amount - (item.paidAmount || 0)); 
                } 
            } 
        });
        
        const days = [];
        for (let i = 0; i < firstDay; i++) days.push(null);
        
        for (let d = 1; d <= daysInMonth; d++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayPays = payItems.filter(i => i.dueDate === dateKey && i.status !== 'paid'); 
            const dayCollects = collectItems.filter(i => i.dueDate === dateKey && i.status !== 'paid'); 
            const dayWallet = walletItems.filter(i => i.dueDate === dateKey && i.status !== 'paid'); 
            const dayExpenses = expenseItems.filter(i => i.dueDate === dateKey && i.status !== 'paid');
            
            const outflow = dayPays.reduce((s,i)=>s+(i.amount-(i.paidAmount||0)),0) + dayExpenses.reduce((s,i)=>s+(i.amount-(i.paidAmount||0)),0);
            const inflow = dayCollects.reduce((s,i)=>s+(i.amount-(i.paidAmount||0)),0) + dayWallet.reduce((s,i)=>s+(i.amount-(i.paidAmount||0)),0);
            
            const net = inflow - outflow; 
            runningBalance += net; 
            
            const inflowItems = [...dayCollects, ...dayWallet]; 
            const outflowItems = [...dayPays, ...dayExpenses];
            
            days.push({ day: d, dateKey, inflow, outflow, net, accumulated: runningBalance, inflowItems, outflowItems });
        }
        return days;
    };

    const changeMonth = (offset) => { 
        const newDate = new Date(currentCalDate); 
        newDate.setMonth(newDate.getMonth() + offset); 
        setCurrentCalDate(newDate); 
    };

    const groupedView = useMemo(() => {
        if (mode === 'balance' && !selectedDateFilter) return null;
        if (mode === 'cashbox' || mode === 'pallets' || mode === 'billing') return null;

        let items = [];
        if (mode === 'balance' && selectedDateFilter) { 
            items = [...payItems, ...collectItems, ...walletItems, ...expenseItems]; 
        } else if (mode === 'pay') { 
            items = payTab === 'realizados' ? payItems.filter(i => i.status === 'paid') : payItems.filter(i => i.status !== 'paid'); 
        } else if (mode === 'collect') { 
            items = collectItems; 
        } else if (mode === 'wallet') { 
            items = walletItems; 
        } else if (mode === 'expenses') { 
            items = expenseItems; 
        }
        
        if (searchTerm) { 
            const lowerSearch = searchTerm.toLowerCase(); 
            items = items.filter(i => (i.payee && i.payee.toLowerCase().includes(lowerSearch)) || (i.number && i.number.toLowerCase().includes(lowerSearch))); 
        }
        
        if (selectedDateFilter) { 
            items = items.filter(i => i.dueDate === selectedDateFilter); 
        } else if (activeFilter !== 'all') { 
            items = items.filter(i => { 
                if (mode === 'pay' && payTab === 'realizados') return true;
                if (i.status === 'paid') return false; 
                const d = getDays(i.dueDate); 
                if (activeFilter === 'expired') return d < 0; 
                if (activeFilter === 'urgent') return d >= 0 && d <= 7; 
                if (activeFilter === 'future') return d > 7; 
                return true; 
            }); 
        }

        let filtered = items;
        
        if (mode === 'collect' && !selectedDateFilter) {
            const groups = {};
            filtered.forEach(item => { 
                const clientName = item.payee ? item.payee.trim().toUpperCase() : 'SIN NOMBRE'; 
                if (!groups[clientName]) {
                    groups[clientName] = { key: clientName, label: item.payee, total: 0, items: [], count: 0 }; 
                }
                const pendingAmount = item.amount - (item.paidAmount || 0); 
                if (item.status !== 'paid') groups[clientName].total += pendingAmount; 
                groups[clientName].count += 1; 
                groups[clientName].items.push(item); 
            });
            const resultData = Object.values(groups).sort((a,b) => b.total - a.total);
            resultData.forEach(group => { 
                group.items.sort((a, b) => { 
                    const numA = a.number || ''; 
                    const numB = b.number || ''; 
                    return numA.localeCompare(numB, undefined, { numeric: true }); 
                }); 
            });
            return { type: 'client-grouped', data: resultData };
            
        } else if (mode === 'expenses' && !selectedDateFilter) {
            const groups = {};
            filtered.forEach(item => { 
                const rawDate = item.dueDate || new Date().toISOString().split('T')[0];
                const monthKey = item.monthYear || rawDate.substring(0, 7); 
                if (!groups[monthKey]) { 
                    const parts = monthKey.split('-');
                    let label = monthKey;
                    if(parts.length >= 2) {
                        const dateObj = new Date(parts[0], parseInt(parts[1])-1); 
                        label = dateObj.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }); 
                        label = label.charAt(0).toUpperCase() + label.slice(1);
                    }
                    groups[monthKey] = { key: monthKey, label: label, total: 0, items: [], count: 0 }; 
                } 
                const pendingAmount = item.amount - (item.paidAmount || 0); 
                if (item.status !== 'paid') groups[monthKey].total += pendingAmount; 
                groups[monthKey].count += 1; 
                groups[monthKey].items.push(item); 
            });
            const resultData = Object.values(groups).sort((a,b) => a.key.localeCompare(b.key));
            resultData.forEach(group => { 
                group.items.sort((itemA, itemB) => new Date(itemA.dueDate || 0) - new Date(itemB.dueDate || 0)); 
            });
            return { type: 'month-grouped', data: resultData };
            
        } else {
            filtered.sort((a,b) => new Date(a.dueDate || 0) - new Date(b.dueDate || 0));
            if ((activeFilter === 'all' && !selectedDateFilter) || (mode === 'balance' && selectedDateFilter)) {
                return { type: 'flat', data: filtered };
            }
            const groups = {};
            filtered.forEach(item => { 
                const dateKey = item.dueDate || new Date().toISOString().split('T')[0]; 
                if (!groups[dateKey]) {
                    groups[dateKey] = { key: dateKey, total: 0, items: [] }; 
                }
                const valueToAdd = (mode === 'pay' && payTab === 'realizados') ? (item.paidAmount || item.amount) : (item.amount - (item.paidAmount || 0));
                groups[dateKey].total += valueToAdd;  
                groups[dateKey].items.push(item); 
            });
            return { type: 'date-grouped', data: Object.values(groups).sort((a,b) => new Date(a.key) - new Date(b.key)) };
        }
    }, [payItems, collectItems, walletItems, expenseItems, activeFilter, mode, searchTerm, selectedDateFilter, payTab]);

    // =====================================
    // FUNCIONES DE REPORTES 
    // =====================================
    const triggerMainReport = (action) => {
        if (!groupedView || !groupedView.data || groupedView.data.length === 0) {
            return alert("No hay datos para procesar.");
        }
        
        let titleMode = mode === 'pay' 
            ? (payTab === 'realizados' ? 'Pagos Realizados' : 'Pagos Pendientes') 
            : (mode === 'collect' ? 'Cobros' : (mode === 'wallet' ? 'Cartera Cheques' : (mode === 'expenses' ? 'Gastos Mensuales' : 'Balance')));
        
        let bodyHTML = `<h1>Reporte de ${titleMode}</h1><p class="meta">Generado: ${new Date().toLocaleDateString('es-AR')} • SII PALLETS APP</p>`;

        if (mode === 'balance') {
            bodyHTML += `<div class="total-box">Neto Proyectado: ${formatMoney(balanceData.net)}</div><table><thead><tr><th>Fecha</th><th style="text-align:right">Entradas</th><th style="text-align:right">Salidas</th><th style="text-align:right">Neto</th></tr></thead><tbody>`;
            
            balanceData.dailyAgenda.forEach(day => { 
                bodyHTML += `
                    <tr>
                        <td>${new Date(day.date + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                        <td class="amount green">${day.inflow > 0 ? formatMoney(day.inflow) : '-'}</td>
                        <td class="amount" style="color:blue">${day.outflow > 0 ? formatMoney(day.outflow) : '-'}</td>
                        <td class="amount">${formatMoney(day.net)}</td>
                    </tr>
                `; 
            });
            bodyHTML += `</tbody></table>`;
        } else {
            let modeTotal = 0;
            if (mode === 'pay') {
                modeTotal = payTab === 'realizados' ? payItems.filter(i=>i.status==='paid').reduce((acc,i)=>acc+(i.paidAmount || i.amount),0) : balanceData.pay; 
            } else if (mode === 'wallet') {
                modeTotal = balanceData.wallet; 
            } else if (mode === 'expenses') {
                modeTotal = balanceData.expenses; 
            } else {
                modeTotal = balanceData.collect;
            }
            
            bodyHTML += `<div class="total-box">Total ${(mode === 'pay' && payTab === 'realizados') ? 'Cancelado' : 'Pendiente'}: ${formatMoney(modeTotal)}</div>`;
            
            bodyHTML += `
                <table>
                    <thead>
                        <tr>
                            <th style="width:30%">Referencia</th>
                            <th style="width:15%">Vencimiento</th>
                            <th style="text-align:right;width:15%">Total Original</th>
                            <th style="text-align:right;width:20%">${(mode === 'pay' && payTab === 'realizados') ? 'Abonado' : 'Pendiente'}</th>
                            <th style="text-align:right;width:20%">Acumulado</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            let runningAccumulator = 0;
            
            let groupsToProcess = groupedView.type === 'flat' 
                ? [{ key: 'General', label: 'Listado General', total: modeTotal, items: groupedView.data }] 
                : groupedView.data;

            groupsToProcess.forEach(group => {
                const isRealizados = (mode === 'pay' && payTab === 'realizados');
                const sortedItems = [...group.items]
                    .filter(item => isRealizados ? item.status === 'paid' : item.status !== 'paid')
                    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
                
                if (sortedItems.length === 0) return;
                
                let groupTitle = '';
                if (groupedView.type === 'client-grouped') { 
                    groupTitle = group.label; 
                    runningAccumulator = 0; 
                } else if (groupedView.type === 'month-grouped') { 
                    groupTitle = group.label; 
                } else if (groupedView.type === 'flat') { 
                    groupTitle = 'Listado General'; 
                } else {
                    groupTitle = new Date(group.key + 'T00:00:00').toLocaleDateString('es-AR');
                }
                
                bodyHTML += `<tr class="group-row"><td colspan="2">${groupTitle}</td><td class="amount" colspan="3">Grupo: ${formatMoney(group.total)}</td></tr>`;
                
                sortedItems.forEach(item => {
                    const details = item.number ? `Ref: ${item.number}` : '';
                    const displayValue = isRealizados ? (item.paidAmount || item.amount) : (item.amount - (item.paidAmount||0));
                    runningAccumulator += displayValue;
                    
                    bodyHTML += `
                        <tr>
                            <td>${item.payee} <br/><span style="color:#666;font-size:9px">${details}</span></td>
                            <td class="date">${new Date(item.dueDate+'T00:00:00').toLocaleDateString('es-AR')}</td>
                            <td class="amount">${formatMoney(item.amount)}</td>
                            <td class="amount ${isRealizados ? 'green' : 'red'}">${formatMoney(displayValue)}</td>
                            <td class="amount" style="color:#555;font-weight:bold">${formatMoney(runningAccumulator)}</td>
                        </tr>
                    `;
                });
            });
            bodyHTML += `</tbody></table>`;
        }
        
        handleReportAction(`Reporte ${titleMode}`, bodyHTML, action, `Reporte_${titleMode.replace(/\s+/g, '_')}`);
    };

    const triggerClientReport = (group, action) => {
        const pendingItems = group.items.filter(i => i.status !== 'paid').sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        if (pendingItems.length === 0) return alert("Este cliente no tiene facturas pendientes.");
        
        const totalPending = pendingItems.reduce((acc, item) => acc + (item.amount - (item.paidAmount || 0)), 0);
        
        let bodyHTML = `
            <h1>Estado de Cuenta</h1>
            <p class="meta">Generado: ${new Date().toLocaleDateString('es-AR')} • SII PALLETS APP</p>
            <div class="client-info">
                <div class="client-name">${group.label}</div>
                <div>Total Pendiente: <strong>${formatMoney(totalPending)}</strong></div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th>Factura / Ref</th>
                        <th>Vencimiento</th>
                        <th style="text-align:center">Estado / Días</th>
                        <th style="text-align:right">Importe Original</th>
                        <th style="text-align:right">A Cuenta / Parcial</th>
                        <th style="text-align:right">Saldo Pendiente</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        pendingItems.forEach(item => {
            const original = item.amount; 
            const paid = item.paidAmount || 0; 
            const remaining = original - paid; 
            const details = item.number ? `${item.number}` : 'S/N';
            const d = getDays(item.dueDate); 
            const daysText = d < 0 ? `Vencida (${Math.abs(d)} días)` : `Faltan ${d} días`; 
            const daysClass = d < 0 ? 'red' : 'green';
            
            bodyHTML += `
                <tr>
                    <td>${details}</td>
                    <td class="date">${new Date(item.dueDate + 'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td style="text-align:center; font-size:11px;" class="${daysClass}">${daysText}</td>
                    <td class="amount">${formatMoney(original)}</td>
                    <td class="amount" style="color:#666">${paid > 0 ? formatMoney(paid) : '-'}</td>
                    <td class="amount red">${formatMoney(remaining)}</td>
                </tr>
            `;
        });
        
        bodyHTML += `
                    <tr class="total-row">
                        <td colspan="5" style="text-align:right;">TOTAL A PAGAR:</td>
                        <td class="amount red">${formatMoney(totalPending)}</td>
                    </tr>
                </tbody>
            </table>
            <div style="margin-top: 40px; font-size: 10px; color: #888; text-align: center;">Documento generado automáticamente por SII PALLETS APP</div>
        `;
        
        handleReportAction(`Estado de Cuenta - ${group.label}`, bodyHTML, action, `Estado_Cuenta_${group.label.replace(/\s+/g, '_')}`);
    };

    const triggerCalendarReport = (action) => {
        const days = generateCalendarDays();
        const monthName = currentCalDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        
        const year = currentCalDate.getFullYear(); 
        const month = currentCalDate.getMonth();
        const firstDateStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
        
        const bTotals = {};
        payItems.forEach(item => {
            if(item.dueDate >= firstDateStr && item.dueDate <= lastDateStr && item.status !== 'paid') {
                const bankName = item.bank || 'Sin Banco Especificado';
                if (!bTotals[bankName]) bTotals[bankName] = 0;
                bTotals[bankName] += (item.amount - (item.paidAmount || 0));
            }
        });

        let bodyHTML = `<h1>Proyección Mensual (Pendientes): ${monthName}</h1>`;
        
        if (Object.keys(bTotals).length > 0) {
            bodyHTML += `
                <div style="margin-bottom:20px; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px;">
                    <h3 style="margin-top:0; font-size:12px; color:#334155; border-bottom:1px solid #cbd5e1; padding-bottom:4px;">Totales de Pagos Pendientes por Banco (Este mes)</h3>
                    <ul style="margin:0; padding-left:20px; font-size:11px; font-family:monospace;">
            `;
            Object.entries(bTotals).sort((a,b)=>b[1]-a[1]).forEach(([bank, total]) => {
                bodyHTML += `<li><strong>${bank}:</strong> ${formatMoney(total)}</li>`;
            });
            bodyHTML += `</ul></div>`;
        }

        bodyHTML += `
            <table>
                <thead>
                    <tr>
                        <th class="date-col">Fecha</th>
                        <th>Ingresos (Pendientes)</th>
                        <th>Egresos (Pendientes)</th>
                        <th>Acumulado</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        days.forEach(day => {
            if(!day) return;
            
            let inflowHTML = ""; 
            if(day.inflowItems.length > 0) { 
                const pendingInflows = day.inflowItems.filter(i => i.status !== 'paid');
                if (pendingInflows.length > 0) {
                    pendingInflows.forEach(i => { 
                        const ref = i.number ? `Ref: ${i.number}` : ''; 
                        const remaining = i.amount - (i.paidAmount || 0);
                        inflowHTML += `<div style="margin-bottom:6px;"><div style="font-weight:bold; color:#16a34a;">${formatMoney(remaining)}</div><div style="font-size:9px; color:#555;">(${i.payee} ${ref ? '- '+ref : ''})</div></div>`; 
                    }); 
                } else {
                    inflowHTML = "-";
                }
            } else { 
                inflowHTML = "-"; 
            }
            
            let outflowHTML = ""; 
            if(day.outflowItems.length > 0) { 
                const pendingOutflows = day.outflowItems.filter(i => i.status !== 'paid');
                if (pendingOutflows.length > 0) {
                    pendingOutflows.forEach(i => { 
                        const ref = i.number ? `Ref: ${i.number}` : ''; 
                        const bankTag = i.bank ? ` 🏦 ${i.bank}` : '';
                        const remaining = i.amount - (i.paidAmount || 0);
                        outflowHTML += `<div style="margin-bottom:6px;"><div style="font-weight:bold; color:#dc2626;">${formatMoney(remaining)}</div><div style="font-size:9px; color:#555;">(${i.payee} ${ref ? '- '+ref : ''}${bankTag})</div></div>`; 
                    }); 
                } else {
                    outflowHTML = "-";
                }
            } else { 
                outflowHTML = "-"; 
            }
            
            if (inflowHTML !== "-" || outflowHTML !== "-") {
                const acumClass = day.accumulated >= 0 ? 'green-acum' : 'red-acum';
                bodyHTML += `
                    <tr>
                        <td class="date-col">${new Date(day.dateKey+'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}</td>
                        <td style="text-align:right;">${inflowHTML}</td>
                        <td style="text-align:right;">${outflowHTML}</td>
                        <td class="amount ${acumClass}">${formatMoney(day.accumulated)}</td>
                    </tr>
                `;
            }
        });
        
        bodyHTML += `</tbody></table>`;
        handleReportAction(`Reporte Mensual - ${monthName}`, bodyHTML, action, `Calendario_${monthName.replace(/\s+/g, '_')}`);
    };
    
    const triggerRangeReport = (action) => {
        const { startDate, endDate } = rangeReportModal;
        if (!startDate || !endDate) return alert("Selecciona ambas fechas.");
        if (startDate > endDate) return alert("La fecha de inicio debe ser menor o igual a la fecha de fin.");

        const mappedPay = payItems.map(i => ({ ...i, reportType: 'PAGO', isPositive: false }));
        const mappedExp = expenseItems.map(i => ({ ...i, reportType: 'GASTO', isPositive: false }));
        const mappedCol = collectItems.map(i => ({ ...i, reportType: 'COBRO', isPositive: true }));
        const mappedWal = walletItems.map(i => ({ ...i, reportType: 'CARTERA', isPositive: true }));

        const combined = [...mappedPay, ...mappedExp, ...mappedCol, ...mappedWal]
            .filter(i => i.status !== 'paid' && i.dueDate && i.dueDate >= startDate && i.dueDate <= endDate)
            .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

        if (combined.length === 0) return alert("No hay movimientos pendientes en este rango de fechas.");

        let totalPos = 0;
        let totalNeg = 0;
        
        const bTotals = {};
        combined.forEach(item => {
            if (item.reportType === 'PAGO' && item.status !== 'paid') {
                const bankName = item.bank || 'Sin Banco Especificado';
                if (!bTotals[bankName]) bTotals[bankName] = 0;
                bTotals[bankName] += (item.amount - (item.paidAmount || 0));
            }
        });

        let bodyHTML = `
            <h1>Reporte de Movimientos Pendientes por Fecha</h1>
            <p class="meta">Período: ${new Date(startDate+'T00:00:00').toLocaleDateString('es-AR')} al ${new Date(endDate+'T00:00:00').toLocaleDateString('es-AR')} • Generado: ${new Date().toLocaleDateString('es-AR')}</p>
        `;

        if (Object.keys(bTotals).length > 0) {
            bodyHTML += `
                <div style="margin-bottom:20px; padding:10px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:4px;">
                    <h3 style="margin-top:0; font-size:12px; color:#334155; border-bottom:1px solid #cbd5e1; padding-bottom:4px;">Totales de Pagos Pendientes por Banco (En este rango)</h3>
                    <ul style="margin:0; padding-left:20px; font-size:11px; font-family:monospace;">
            `;
            Object.entries(bTotals).sort((a,b)=>b[1]-a[1]).forEach(([bank, total]) => {
                bodyHTML += `<li><strong>${bank}:</strong> ${formatMoney(total)}</li>`;
            });
            bodyHTML += `</ul></div>`;
        }

        bodyHTML += `
            <table>
                <thead>
                    <tr>
                        <th style="width:15%">Fecha</th>
                        <th style="width:45%">Concepto / Cliente</th>
                        <th style="width:10%">Tipo</th>
                        <th style="text-align:right; width:15%">Ingreso (Pendiente)</th>
                        <th style="text-align:right; width:15%">Egreso (Pendiente)</th>
                    </tr>
                </thead>
                <tbody>
        `;

        combined.forEach(item => {
            const pendingAmount = item.amount - (item.paidAmount || 0);
            
            if (item.isPositive) totalPos += pendingAmount;
            else totalNeg += pendingAmount;

            const bankTag = (!item.isPositive && item.bank) ? `<br/><span style="color:#0284c7;font-size:9px;font-weight:bold;">🏦 ${item.bank}</span>` : '';

            bodyHTML += `
                <tr>
                    <td class="date">${new Date(item.dueDate+'T00:00:00').toLocaleDateString('es-AR')}</td>
                    <td><strong>${item.payee}</strong> ${item.number ? `<br/><span style="color:#666;font-size:9px">Ref: ${item.number}</span>` : ''}${bankTag}</td>
                    <td style="font-size:10px">${item.reportType}</td>
                    <td class="amount green">${item.isPositive ? formatMoney(pendingAmount) : '-'}</td>
                    <td class="amount red">${!item.isPositive ? formatMoney(pendingAmount) : '-'}</td>
                </tr>
            `;
        });

        const balance = totalPos - totalNeg;
        const balanceColor = balance >= 0 ? 'green' : 'red';

        bodyHTML += `
                </tbody>
            </table>
            <div style="margin-top:20px; display:flex; justify-content:space-between; gap:10px; page-break-inside: avoid;">
                <div style="flex:1; padding:15px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; text-align:center;">
                    <span style="display:block; font-size:10px; color:#166534; text-transform:uppercase; font-weight:bold; margin-bottom:5px;">Total Ingresos (Pendientes)</span>
                    <span style="font-size:16px; font-weight:900; color:#15803d;">${formatMoney(totalPos)}</span>
                </div>
                <div style="flex:1; padding:15px; background:#fef2f2; border:1px solid #fecaca; border-radius:8px; text-align:center;">
                    <span style="display:block; font-size:10px; color:#991b1b; text-transform:uppercase; font-weight:bold; margin-bottom:5px;">Total Egresos (Pendientes)</span>
                    <span style="font-size:16px; font-weight:900; color:#b91c1c;">${formatMoney(totalNeg)}</span>
                </div>
                <div style="flex:1; padding:15px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; text-align:center;">
                    <span style="display:block; font-size:10px; color:#334155; text-transform:uppercase; font-weight:bold; margin-bottom:5px;">Balance Neto Proyectado</span>
                    <span style="font-size:18px; font-weight:900;" class="${balanceColor}">${balance >= 0 ? '+' : ''}${formatMoney(balance)}</span>
                </div>
            </div>
        `;

        handleReportAction('Reporte Rango de Fechas', bodyHTML, action, `Reporte_Pendientes_${startDate}_al_${endDate}`);
    };

    // =====================================
    // MANEJADORES DE ACCIÓN
    // =====================================
    const addBankAction = async (e) => {
        e.preventDefault();
        if(!newBank.trim()) return;
        await addDoc(collection(db, 'bancos_sii', 'main_list', 'items'), { 
            name: newBank.trim(), 
            createdAt: new Date().toISOString() 
        });
        setNewBank("");
    };
    
    const deleteBankAction = async (id) => {
        if(confirm("¿Eliminar este banco?")) {
            await deleteDoc(doc(db, 'bancos_sii', 'main_list', 'items', id));
        }
    };

    const handleAddAction = async (e) => {
        e.preventDefault();
        let targetCollection = 'cheques_public_shared';
        if(mode === 'collect') targetCollection = 'cobros_public_shared'; 
        if(mode === 'wallet') targetCollection = 'cartera_public_shared'; 
        if(mode === 'expenses') targetCollection = 'gastos_public_shared';
        
        const itemData = { 
            number: newItem.number, amount: parseFloat(newItem.amount), payee: newItem.payee, paidAmount: newItem.paidAmount || 0, 
            subtype: newItem.subtype || 'cheque', category: newItem.category || 'others', status: newItem.status || 'pending', bank: newItem.bank || '' 
        };
        
        if (editingId) { 
            await updateDoc(doc(db, targetCollection, 'main_list', 'items', editingId), { ...itemData, issueDate: newItem.issueDate, dueDate: newItem.dueDate, monthYear: newItem.monthYear || '' }); 
        } else { 
            if (mode === 'expenses' && newItem.isRecurring && newItem.installments > 1) {
                let baseDate = new Date(newItem.dueDate + 'T00:00:00'); 
                if (isNaN(baseDate.getTime())) baseDate = new Date(); 
                let [baseYear, baseMonth] = newItem.monthYear ? newItem.monthYear.split('-').map(Number) : [baseDate.getFullYear(), baseDate.getMonth() + 1];
                for (let i = 0; i < newItem.installments; i++) {
                    let nextMonth = baseMonth + i; let nextYear = baseYear;
                    while (nextMonth > 12) { nextMonth -= 12; nextYear++; }
                    const currentMonthYear = `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
                    let nextDueDateStr = newItem.dueDate;
                    if (newItem.dueDate) { const d = new Date(newItem.dueDate + 'T00:00:00'); d.setMonth(d.getMonth() + i); nextDueDateStr = d.toISOString().split('T')[0]; }
                    const currentPayee = `${newItem.payee} (Cuota ${i + 1}/${newItem.installments})`;
                    await addDoc(collection(db, targetCollection, 'main_list', 'items'), { ...itemData, payee: currentPayee, monthYear: currentMonthYear, dueDate: nextDueDateStr, issueDate: newItem.issueDate, createdAt: new Date().toISOString(), paymentHistory: [] });
                }
            } else { 
                await addDoc(collection(db, targetCollection, 'main_list', 'items'), { ...itemData, issueDate: newItem.issueDate, dueDate: newItem.dueDate, monthYear: newItem.monthYear || '', createdAt: new Date().toISOString(), paymentHistory: [] }); 
            }
        }
        setNewItem({ number: '', issueDate: '', dueDate: '', amount: '', payee: '', paidAmount: 0, subtype: 'cheque', category: 'others', status: 'pending', monthYear: '', cashType: 'income', bank: '', isRecurring: false, installments: 2 });
        setEditingId(null); setShowAddForm(false);
    };

    const handleCashAddAction = async (e) => {
        e.preventDefault();
        let desc = newItem.payee; 
        if(newItem.cashType === 'close') {
            const sortedDesc = [...cashItems].sort((a, b) => new Date(b.date) - new Date(a.date));
            const lastOpen = sortedDesc.find(i => i.cashType === 'open');
            const start = lastOpen ? new Date(lastOpen.date).toLocaleDateString('es-AR') : 'Inicio';
            const end = new Date(newItem.issueDate).toLocaleDateString('es-AR');
            desc = `Cierre caja: ${start} al ${end}`;
        }
        await addDoc(collection(db, 'caja_public_shared', 'main_list', 'items'), { date: newItem.issueDate || new Date().toISOString().split('T')[0], description: desc, amount: parseFloat(newItem.amount) || 0, cashType: newItem.cashType, createdAt: new Date().toISOString() });
        setNewItem({ ...newItem, amount: '', payee: '', issueDate: '', cashType: 'income', isRecurring: false, installments: 2 });
        setShowAddForm(false);
    };

    const handleEditAction = (item) => {
        setNewItem({ 
            number: item.number || '', 
            issueDate: item.issueDate || '', 
            dueDate: item.dueDate || '', 
            amount: item.amount, 
            payee: item.payee, 
            paidAmount: item.paidAmount || 0, 
            subtype: item.subtype || (mode === 'collect' ? 'invoice' : 'cheque'), 
            category: item.category || 'others', 
            status: item.status || 'pending', 
            monthYear: item.monthYear || '', 
            bank: item.bank || '', 
            isRecurring: false, 
            installments: 2 
        });
        setEditingId(item.id); 
        setShowAddForm(true);
    };

    const confirmPaymentAction = async () => {
        if(!paymentModal.item) return; 
        const item = paymentModal.item;
        let collectionName = 'gastos_public_shared'; 
        if(item.type === 'collect') collectionName = 'cobros_public_shared'; 
        if(item.type === 'pay') collectionName = 'cheques_public_shared'; 
        if(item.type === 'wallet') collectionName = 'cartera_public_shared';
        
        let currentPaid = item.paidAmount || 0; let paidNow = 0; let newStatus = 'pending';
        if (paymentModal.type === 'total') { 
            paidNow = item.amount - currentPaid; currentPaid = item.amount; newStatus = 'paid'; 
        } else { 
            paidNow = parseFloat(paymentModal.amount); 
            if (!isNaN(paidNow)) { currentPaid += paidNow; if (currentPaid >= item.amount) { currentPaid = item.amount; newStatus = 'paid'; } else { newStatus = 'partial'; } } 
        }
        const historyRecord = { amount: paidNow, method: paymentModal.method, proof: paymentModal.proof, date: new Date().toISOString() };
        const newHistory = [...(item.paymentHistory || []), historyRecord];
        await updateDoc(doc(db, collectionName, 'main_list', 'items', item.id), { status: newStatus, paidAmount: currentPaid, paymentHistory: newHistory, paymentDetails: historyRecord });
        setPaymentModal({ isOpen: false, item: null, method: 'transfer', proof: '', type: 'total', amount: '' });
    };

    const markFullPaymentAction = async (item) => { setPaymentModal({ isOpen: true, item: item, method: 'transfer', proof: '', type: 'total', amount: '' }); };
    const markPartialPaymentAction = async (item) => { setPaymentModal({ isOpen: true, item: item, method: 'transfer', proof: '', type: 'partial', amount: '' }); };
    
    const deleteItemAction = async (item) => {
        if(!confirm('¿Eliminar?')) return;
        let collectionName = 'cheques_public_shared'; 
        if(item.type === 'collect') collectionName = 'cobros_public_shared'; 
        if(item.type === 'wallet') collectionName = 'cartera_public_shared'; 
        if(item.type === 'expense') collectionName = 'gastos_public_shared'; 
        if(item.type === 'cash') collectionName = 'caja_public_shared';
        await deleteDoc(doc(db, collectionName, 'main_list', 'items', item.id));
    };

    const changeMode = (newMode) => {
        setMode(newMode);
        setPayTab('pendientes');
        setShowAddForm(false);
        setEditingId(null);
    };

    return (
        <div className="pb-24 max-w-4xl mx-auto min-h-screen bg-gray-50 shadow-2xl relative transition-colors duration-500">
            <div className={`${theme.bg} text-white p-4 sticky top-0 z-30 shadow-lg transition-colors duration-500`}>
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold flex items-center gap-2">SII PALLETS APP</h1>
                    <div className="flex gap-1 items-center">
                        {deferredPrompt && ( 
                            <button onClick={installApp} className="bg-white/20 hover:bg-white/30 px-2 py-1 rounded text-xs font-bold flex items-center gap-1 mr-1">
                                <IconDownload className="w-4 h-4" /> Instalar
                            </button> 
                        )}
                        {mode !== 'cashbox' && mode !== 'pallets' && mode !== 'billing' && (
                            <>
                                <button onClick={() => triggerMainReport('print')} className="p-2 relative bg-white/20 rounded-full hover:bg-white/30" title="Imprimir Reporte">
                                    <IconPrinter className="w-5 h-5"/>
                                </button>
                                <button onClick={() => triggerMainReport('download')} className="p-2 relative bg-white/20 rounded-full hover:bg-white/30" title="Descargar PDF">
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
                                                    <p className={`text-xs ${d < 0 ? 'text-red-600 font-bold' : 'text-orange-500'}`}>{d < 0 ? `Vencido hace ${Math.abs(d)} días` : `Vence en ${d} días`}</p>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {mode !== 'pallets' && mode !== 'billing' && (
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

                <div className="bg-black/20 p-1 rounded-xl flex text-[10px] sm:text-xs overflow-x-auto scrollbar-hide gap-1">
                    <button onClick={() => changeMode('billing')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'billing' ? 'bg-white text-pink-800 shadow-md' : 'text-white/60'}`}><IconFileText className="w-4 h-4"/> <span>FACTURACIÓN</span></button>
                    <button onClick={() => changeMode('cashbox')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'cashbox' ? 'bg-white text-cyan-800 shadow-md' : 'text-white/60'}`}><IconBox className="w-4 h-4"/> <span>CAJA</span></button>
                    <button onClick={() => changeMode('expenses')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'expenses' ? 'bg-white text-orange-800 shadow-md' : 'text-white/60'}`}><IconTag className="w-4 h-4"/> <span>GASTOS</span></button>
                    <button onClick={() => changeMode('pay')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'pay' ? 'bg-white text-blue-800 shadow-md' : 'text-white/60'}`}><IconWallet className="w-4 h-4"/> <span>PAGOS</span></button>
                    <button onClick={() => changeMode('balance')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'balance' ? 'bg-white text-violet-800 shadow-md' : 'text-white/60'}`}><IconTrendingUp className="w-4 h-4"/> <span>BALANCE</span></button>
                    <button onClick={() => changeMode('collect')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'collect' ? 'bg-white text-emerald-800 shadow-md' : 'text-white/60'}`}><IconBriefcase className="w-4 h-4"/> <span>COBROS</span></button>
                    <button onClick={() => changeMode('wallet')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'wallet' ? 'bg-white text-indigo-800 shadow-md' : 'text-white/60'}`}><IconFolder className="w-4 h-4"/> <span>CARTERA</span></button>
                    <button onClick={() => changeMode('pallets')} className={`flex-1 py-2 px-3 rounded-lg font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-all whitespace-nowrap ${mode === 'pallets' ? 'bg-white text-teal-800 shadow-md' : 'text-white/60'}`}><IconLayers className="w-4 h-4"/> <span>PALLETS</span></button>
                </div>
            </div>

            <div className="p-4">
                {mode === 'billing' && (
                    <Facturacion 
                        collectItems={collectItems} 
                        theme={theme} 
                    />
                )}

                {mode === 'pallets' && (
                    <Pallets 
                        theme={theme}
                        produccionMensual={produccionMensual}
                        costosMadres={costosMadres}
                        palletsTemplates={palletsTemplates}
                        presupuestos={presupuestos}
                    />
                )}

                {mode === 'cashbox' && (
                    <Caja 
                        cashData={cashData}
                        showAddForm={showAddForm}
                        setShowAddForm={setShowAddForm}
                        newItem={newItem}
                        setNewItem={setNewItem}
                        handleCashAdd={handleCashAddAction}
                    />
                )}

                {mode === 'balance' && (
                    <Balance 
                        balanceData={balanceData}
                        forecastData={forecastData}
                        setRangeReportModal={setRangeReportModal}
                        setShowCalendar={setShowCalendar}
                        setSelectedDateFilter={setSelectedDateFilter}
                        payItems={payItems}
                    />
                )}

                {(mode === 'pay' || mode === 'collect' || mode === 'wallet' || mode === 'expenses') && (
                    <Movimientos 
                        mode={mode}
                        theme={theme}
                        payTab={payTab}
                        setPayTab={setPayTab}
                        totalRealizados={totalRealizados}
                        balanceData={balanceData}
                        dashboardData={dashboardData}
                        activeFilter={activeFilter}
                        setActiveFilter={setActiveFilter}
                        triggerMainReport={triggerMainReport}
                        showAddForm={showAddForm}
                        setShowAddForm={setShowAddForm}
                        setEditingId={setEditingId}
                        editingId={editingId}
                        newItem={newItem}
                        setNewItem={setNewItem}
                        handleAdd={handleAddAction}
                        banks={banks}
                        uniqueClients={uniqueClients}
                        getDays={getDays}
                        markFullPayment={markFullPaymentAction}
                        markPartialPayment={markPartialPaymentAction}
                        setHistoryModal={setHistoryModal}
                        deleteItem={deleteItemAction}
                        handleEdit={handleEditAction}
                        groupedView={groupedView}
                        expandedGroups={expandedGroups}
                        setExpandedGroups={setExpandedGroups}
                        triggerClientReport={triggerClientReport}
                        selectedDateFilter={selectedDateFilter}
                        setSelectedDateFilter={setSelectedDateFilter}
                        newBank={newBank}
                        setNewBank={setNewBank}
                        addBank={addBankAction}
                        deleteBank={deleteBankAction}
                    />
                )}
            </div>

            {/* MODALES GLOBALES */}
            {paymentModal.isOpen && (
                <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm animate-fade-in">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Confirmar {paymentModal.item.type === 'collect' ? 'Cobro' : 'Pago'}</h3>
                        <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm text-gray-600">
                            <p><strong>{paymentModal.item.payee}</strong></p>
                            <p>Nº: {paymentModal.item.number || '-'}</p>
                            <p>Vencimiento: {new Date(paymentModal.item.dueDate+'T00:00:00').toLocaleDateString('es-AR')}</p>
                            {(() => {
                                const d = getDays(paymentModal.item.dueDate);
                                if (d < 0) return <p className="text-red-500 font-bold mt-1">(Vencida hace {Math.abs(d)} días)</p>;
                                return null;
                            })()}
                            <div className="mt-2 pt-2 border-t border-gray-200">
                                Total Original: {formatMoney(paymentModal.item.amount)}<br/>
                                <span className="text-red-500 font-bold">Resta Cancelar: {formatMoney(paymentModal.item.amount - (paymentModal.item.paidAmount||0))}</span>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div className="flex gap-2">
                                <button onClick={() => setPaymentModal({...paymentModal, type: 'total'})} className={`flex-1 py-2 rounded-lg border font-bold text-xs transition-colors ${paymentModal.type === 'total' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>TOTAL</button>
                                <button onClick={() => setPaymentModal({...paymentModal, type: 'partial'})} className={`flex-1 py-2 rounded-lg border font-bold text-xs transition-colors ${paymentModal.type === 'partial' ? 'bg-blue-100 border-blue-500 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>PARCIAL</button>
                            </div>
                            {paymentModal.type === 'partial' && (
                                <div>
                                    <label className="text-xs text-gray-500 block mb-1">Monto a Ahora</label>
                                    <input type="number" step="0.01" className="w-full p-2 border rounded-lg font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none" placeholder="$ 0.00" value={paymentModal.amount} onChange={e => setPaymentModal({...paymentModal, amount: e.target.value})}/>
                                </div>
                            )}
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Medio</label>
                                <select className="w-full p-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={paymentModal.method} onChange={e => setPaymentModal({...paymentModal, method: e.target.value})}>
                                    <option value="transfer">Transferencia</option>
                                    <option value="cheque">Cheque</option>
                                    <option value="echeq">E-Cheq</option>
                                    <option value="cash">Efectivo</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1">Nº Comprobante / Nota</label>
                                <input type="text" className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Opcional" value={paymentModal.proof} onChange={e => setPaymentModal({...paymentModal, proof: e.target.value})}/>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-2">
                            <button onClick={() => setPaymentModal({isOpen:false, item:null, method:'transfer', proof:'', type: 'total', amount: ''})} className="flex-1 py-2 border rounded-lg text-gray-500 hover:bg-gray-50 font-bold transition-colors">Cancelar</button>
                            <button onClick={confirmPaymentAction} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            {historyModal.isOpen && historyModal.item && (
                <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md animate-fade-in relative">
                        <button onClick={() => setHistoryModal({isOpen: false, item: null})} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><IconX className="w-5 h-5"/></button>
                        <h3 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2"><IconEye className="text-purple-500"/> Historial de Pagos</h3>
                        <p className="text-sm font-bold text-gray-600 mb-4">{historyModal.item.payee} {historyModal.item.number && <span className="font-mono text-gray-400 ml-2">#{historyModal.item.number}</span>}</p>
                        <div className="bg-gray-50 rounded-xl p-4 mb-4 flex justify-between text-sm shadow-inner border border-gray-200">
                            <div><span className="block text-[10px] uppercase text-gray-500">Total Original</span><span className="font-bold">{formatMoney(historyModal.item.amount)}</span></div>
                            <div><span className="block text-[10px] uppercase text-gray-500">Abonado</span><span className="font-bold text-green-600">{formatMoney(historyModal.item.paidAmount || 0)}</span></div>
                            <div className="text-right"><span className="block text-[10px] uppercase text-gray-500">Saldo Pendiente</span><span className="font-bold text-red-500">{formatMoney(historyModal.item.amount - (historyModal.item.paidAmount || 0))}</span></div>
                        </div>
                        <div className="max-h-60 overflow-y-auto space-y-2">
                            {(!historyModal.item.paymentHistory || historyModal.item.paymentHistory.length === 0) ? (
                                <p className="text-center text-gray-400 text-xs py-4 italic">No hay pagos registrados para este comprobante.</p>
                            ) : (
                                historyModal.item.paymentHistory.map((h, i) => (
                                    <div key={i} className="flex justify-between items-center p-3 border border-gray-100 rounded-lg bg-white shadow-sm hover:shadow transition-shadow">
                                        <div>
                                            <p className="text-xs font-bold text-gray-800">{new Date(h.date).toLocaleDateString('es-AR')} <span className="text-gray-400 font-normal ml-1">• {h.method.toUpperCase()}</span></p>
                                            {h.proof && <p className="text-[10px] text-gray-500 mt-0.5">Ref/Comprobante: <span className="font-mono text-gray-700">{h.proof}</span></p>}
                                        </div>
                                        <div className="font-black text-green-600">{formatMoney(h.amount)}</div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="mt-6">
                            <button onClick={() => setHistoryModal({isOpen: false, item: null})} className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {rangeReportModal.isOpen && (
                <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2"><IconFileText className="text-blue-500 w-5 h-5"/> Reporte por Fechas</h3>
                            <button onClick={() => setRangeReportModal({...rangeReportModal, isOpen: false})} className="text-gray-400 hover:text-gray-600"><IconX className="w-5 h-5"/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs text-gray-500 block mb-1 font-bold">Fecha Inicio</label>
                                <input type="date" className="w-full p-3 bg-gray-50 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" value={rangeReportModal.startDate} onChange={e => setRangeReportModal({...rangeReportModal, startDate: e.target.value})} />
                            </div>
                            <div>
                                <label className="text-xs text-gray-500 block mb-1 font-bold">Fecha Fin</label>
                                <input type="date" className="w-full p-3 bg-gray-50 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-700" value={rangeReportModal.endDate} onChange={e => setRangeReportModal({...rangeReportModal, endDate: e.target.value})} />
                            </div>
                            <div className="flex gap-2 mt-4 pt-2 border-t">
                                <button onClick={() => {triggerRangeReport('download'); setRangeReportModal({...rangeReportModal, isOpen: false});}} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors"><IconDownload className="w-4 h-4"/> PDF</button>
                                <button onClick={() => {triggerRangeReport('print'); setRangeReportModal({...rangeReportModal, isOpen: false});}} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors"><IconPrinter className="w-4 h-4"/> Imprimir</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showCalendar && (
                <div className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-2">
                    <div className="bg-white w-full h-full max-w-4xl rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in">
                        <div className="bg-violet-600 text-white p-4 flex justify-between items-center shadow-md z-10">
                            <h2 className="font-bold text-lg flex items-center gap-2"><IconCalendar className="w-6 h-6"/> Calendario Financiero</h2>
                            <div className="flex gap-2">
                                <button onClick={() => triggerCalendarReport('print')} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors" title="Imprimir Calendario"><IconPrinter className="w-5 h-5"/></button>
                                <button onClick={() => triggerCalendarReport('download')} className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors" title="Descargar Calendario PDF"><IconDownload className="w-5 h-5"/></button>
                                <div className="w-px bg-white/30 mx-1"></div>
                                <button onClick={() => setShowCalendar(false)} className="p-2 bg-red-500/80 rounded-full hover:bg-red-500 transition-colors"><IconX className="w-5 h-5"/></button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center p-4 bg-gray-50 border-b">
                            <button onClick={() => changeMonth(-1)} className="p-2 rounded hover:bg-gray-200"><IconChevronLeft className="w-6 h-6 text-gray-600"/></button>
                            <span className="font-black text-xl text-gray-700 capitalize">{currentCalDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</span>
                            <button onClick={() => changeMonth(1)} className="p-2 rounded hover:bg-gray-200"><IconChevronRight className="w-6 h-6 text-gray-600"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-gray-100">
                            <div className="calendar-grid mb-2">
                                {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => ( <div key={d} className="text-center text-xs font-bold text-gray-400 uppercase py-1">{d}</div> ))}
                            </div>
                            <div className="calendar-grid">
                                {generateCalendarDays().map((day, i) => {
                                    if (!day) return <div key={i} className="bg-transparent"></div>;
                                    const isToday = new Date().toDateString() === new Date(day.dateKey+'T00:00:00').toDateString();
                                    const hasActivity = day.inflow > 0 || day.outflow > 0;
                                    return (
                                        <button key={i} onClick={() => { setSelectedDateFilter(day.dateKey); setShowCalendar(false); }} className={`calendar-day bg-white rounded-lg border border-gray-200 p-1 flex flex-col justify-between hover:border-violet-400 hover:shadow-md transition-all ${isToday ? 'ring-2 ring-violet-500 bg-violet-50' : ''}`}>
                                            <div className={`text-right font-bold ${isToday ? 'text-violet-700' : 'text-gray-400'} mb-1`}>{day.day}</div>
                                            {hasActivity ? (
                                                <>
                                                    <div className="flex justify-between items-center text-[9px] mb-0.5"><span className="text-emerald-600 font-bold">In</span><span className="text-emerald-600">{day.inflow > 0 ? formatMoney(day.inflow).replace('$','') : '-'}</span></div>
                                                    <div className="flex justify-between items-center text-[9px] mb-1"><span className="text-red-500 font-bold">Out</span><span className="text-red-500">{day.outflow > 0 ? formatMoney(day.outflow).replace('$','') : '-'}</span></div>
                                                    <div className={`text-center font-bold text-[10px] border-t pt-1 ${day.net >= 0 ? 'text-green-700' : 'text-red-700'}`}>{day.net > 0 ? '+' : ''}{formatMoney(day.net).replace('$','')}</div>
                                                </>
                                            ) : ( <div className="text-center text-gray-300 text-[10px] mb-2">-</div> )}
                                            <div className={`text-center text-[10px] font-black mt-auto pt-1 border-t border-dashed border-gray-200 ${day.accumulated >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatMoney(day.accumulated).replace('$','')}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="p-3 bg-white border-t flex justify-end">
                             <button onClick={() => setShowCalendar(false)} className="bg-gray-200 text-gray-700 px-6 py-2 rounded-xl font-bold hover:bg-gray-300 transition-colors">Volver</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
