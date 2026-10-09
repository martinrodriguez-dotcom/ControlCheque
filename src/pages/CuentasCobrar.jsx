import React, { useEffect, useMemo, useRef, useState } from 'react';
import { formatMoney } from '../utils/helpers';

/*
 * Vista de ensayo aislada de producción.
 * Lee los movimientos existentes mediante las props, pero TODOS los cambios
 * de este módulo se guardan únicamente en localStorage.
 * No importar ni llamar a addDoc/updateDoc/deleteDoc desde esta pantalla.
 */
const STORE_KEY = 'controlcheque_cuentas_preview_v1';
const ACCOUNT_TYPES = ['General', 'Factura', 'Cta 2', 'Cheque', 'Transferencia', 'Efectivo', 'Otro'];
const DOC_TYPES = [
  { value: 'invoice', label: 'Factura' },
  { value: 'cta2', label: 'Cta 2' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'transfer', label: 'Transferencia' },
  { value: 'cash', label: 'Efectivo' }
];
const initialStore = { clients: {}, movements: [], edits: {}, audit: [] };
const money = n => formatMoney(Number(n) || 0);
const keyOf = n => String(n || 'SIN CLIENTE').trim().replace(/\s+/g, ' ').toLocaleUpperCase('es-AR');
const isoDay = date => String(date || '').slice(0, 10);
const dateText = date => {
  if (!date) return 'Sin fecha';
  const d = new Date(isoDay(date) + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? 'Sin fecha' : d.toLocaleDateString('es-AR');
};
const stamp = () => new Date().toISOString();
const uid = () => 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9);
const cleanStore = raw => raw && typeof raw === 'object' ? {
  clients: raw.clients && typeof raw.clients === 'object' ? raw.clients : {},
  movements: Array.isArray(raw.movements) ? raw.movements : [],
  edits: raw.edits && typeof raw.edits === 'object' ? raw.edits : {},
  audit: Array.isArray(raw.audit) ? raw.audit : []
} : initialStore;
function loadStore() {
  try { return cleanStore(JSON.parse(localStorage.getItem(STORE_KEY))); }
  catch { return initialStore; }
}
const csvCell = value => '"' + String(value == null ? '' : value).replace(/"/g, '""') + '"';
const startingForm = () => ({
  id: '', originalId: '', client: '', kind: 'debit',
  date: new Date().toLocaleDateString('en-CA'),
  dueDate: '', amount: '', description: '', reference: '', subtype: 'invoice'
});

function buildLedger(items, store) {
  const lines = [];
  for (const raw of items) {
    const saved = store.edits[raw.id] || {};
    const item = { ...raw, ...saved };
    const name = String(item.payee || 'Sin cliente').trim();
    const amount = Number(item.amount) || 0;
    const paidAmount = Math.max(0, Number(raw.paidAmount) || 0);
    const payments = Array.isArray(raw.paymentHistory) ? raw.paymentHistory : [];
    const recordedTotal = payments.reduce((sum, p) => sum + Math.max(0, Number(p.amount) || 0), 0);
    lines.push({
      id: 'original-' + raw.id, originalId: raw.id, source: 'existing',
      client: name, kind: 'debit', date: isoDay(item.issueDate || item.dueDate),
      dueDate: isoDay(item.dueDate), amount, subtype: item.subtype || 'invoice',
      description: item.description || 'Comprobante a cobrar',
      reference: String(item.number || ''), createdAt: raw.createdAt || '',
      editable: true
    });
    payments.forEach((p, i) => {
      const value = Math.max(0, Number(p.amount) || 0);
      if (!value) return;
      lines.push({
        id: 'payment-' + raw.id + '-' + i, client: name, kind: 'credit',
        date: isoDay(p.date), amount: value, editable: false, source: 'payment',
        description: 'Cobro registrado' + (p.method ? ' · ' + p.method : ''),
        reference: String(p.proof || item.number || ''), subtype: p.method || ''
      });
    });
    const assumedPaid = raw.status === 'paid' && paidAmount === 0 ? amount : paidAmount;
    const difference = Math.max(0, assumedPaid - recordedTotal);
    if (difference > 0.005) {
      lines.push({
        id: 'legacy-paid-' + raw.id, client: name, kind: 'credit', date: '',
        amount: difference, editable: false, source: 'legacy',
        description: 'Cobro histórico (fecha no registrada)',
        reference: String(item.number || ''), subtype: '',
      });
    }
  }
  for (const p of store.movements) {
    if (p.archivedAt) continue;
    lines.push({ ...p, source: 'preview', editable: true });
  }
  const clientMap = new Map();
  for (const line of lines) {
    const key = keyOf(line.client);
    if (!clientMap.has(key)) clientMap.set(key, { key, rawName: line.client, lines: [] });
    clientMap.get(key).lines.push(line);
  }
  for (const [key, record] of Object.entries(store.clients)) {
    if (!clientMap.has(key)) clientMap.set(key, { key, rawName: record.name || key, lines: [] });
  }
  const clients = [...clientMap.values()].map(client => {
    const meta = store.clients[client.key] || {};
    const sorted = [...client.lines].sort((a, b) => {
      const da = a.date || '9999-12-31', db = b.date || '9999-12-31';
      return da.localeCompare(db) || String(a.id).localeCompare(String(b.id));
    });
    let balance = 0;
    const ledger = sorted.map(line => {
      balance += line.kind === 'debit' ? Number(line.amount) : -Number(line.amount);
      return { ...line, balance };
    });
    const debit = ledger.filter(i => i.kind === 'debit').reduce((s, i) => s + Number(i.amount), 0);
    const credit = ledger.filter(i => i.kind === 'credit').reduce((s, i) => s + Number(i.amount), 0);
    return {
      ...client, name: meta.name || client.rawName, accountType: meta.accountType || 'General',
      note: meta.note || '', ledger, debit, credit, balance: debit - credit,
      documentCount: ledger.filter(i => i.kind === 'debit').length
    };
  });
  return clients.sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name));
}

export default function CuentasCobrar({ items = [] }) {
  const [store, setStore] = useState(loadStore);
  const [selection, setSelection] = useState('');
  const [view, setView] = useState('summary');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [form, setForm] = useState(null);
  const [clientForm, setClientForm] = useState(null);
  const [showAudit, setShowAudit] = useState(false);
  const [status, setStatus] = useState('');
  const reportRef = useRef(null);
  const clients = useMemo(() => buildLedger(items, store), [items, store]);
  const selected = clients.find(c => c.key === selection) || null;
  const visibleClients = clients.filter(c => (c.name + ' ' + c.accountType).toLocaleLowerCase('es-AR').includes(search.toLocaleLowerCase('es-AR')));
  const reportLines = selected ? selected.ledger.filter(line =>
    (!startDate || (line.date && line.date >= startDate)) &&
    (!endDate || (line.date && line.date <= endDate))
  ) : [];
  const opening = selected ? selected.ledger.filter(line => (startDate && line.date && line.date < startDate))
    .reduce((sum, line) => sum + (line.kind === 'debit' ? line.amount : -line.amount), 0) : 0;
  const reportClosing = reportLines.reduce((sum, line) => sum + (line.kind === 'debit' ? line.amount : -line.amount), opening);
  const totalPending = clients.reduce((sum, c) => sum + c.balance, 0);
  const totalClients = clients.length;

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch { setStatus('No se pudo guardar localmente. Verificá el espacio disponible del navegador.'); }
  }, [store]);

  function commit(action, fn) {
    const at = stamp();
    setStore(prev => {
      const next = fn(prev);
      return { ...next, audit: [{ id: uid(), at, action }, ...prev.audit].slice(0, 300) };
    });
    setStatus('Cambio de prueba guardado en este navegador. Firestore no fue modificado.');
  }

  function openNewMovement(kind = 'debit') {
    setForm({ ...startingForm(), client: selected ? selected.name : '', kind });
  }
  function openEditMovement(line) {
    if (!line.editable) return;
    setForm({
      id: line.source === 'preview' ? line.id : '',
      originalId: line.originalId || '',
      client: line.client, kind: line.kind, date: line.date || '',
      dueDate: line.dueDate || '', amount: line.amount,
      description: line.description, reference: line.reference,
      subtype: line.subtype || 'invoice'
    });
  }
  function saveMovement(event) {
    event.preventDefault();
    const client = String(form.client || '').trim();
    const amount = Number(form.amount);
    if (!client || !form.date || !Number.isFinite(amount) || amount <= 0) {
      setStatus('Indicá cliente, fecha e importe válido.'); return;
    }
    const payload = {
      client, kind: form.kind, date: form.date,
      dueDate: form.dueDate, amount, description: form.description.trim(),
      reference: String(form.reference || '').trim(), subtype: form.subtype
    };
    if (form.originalId) {
      const originalId = form.originalId;
      commit('Edición de ensayo del comprobante ' + originalId, s => ({
        ...s, edits: {
          ...s.edits, [originalId]: {
            payee: client, amount, issueDate: payload.date, dueDate: payload.dueDate,
            number: payload.reference, subtype: payload.subtype, description: payload.description
          }
        }
      }));
    } else if (form.id) {
      commit('Edición de movimiento de ensayo', s => ({
        ...s, movements: s.movements.map(m => m.id === form.id ? { ...m, ...payload, updatedAt: stamp() } : m)
      }));
    } else {
      commit('Alta de ' + (payload.kind === 'debit' ? 'debe' : 'haber') + ' para ' + client, s => ({
        ...s, movements: [...s.movements, { id: uid(), ...payload, createdAt: stamp() }]
      }));
    }
    setSelection(keyOf(client));
    setView('detail');
    setForm(null);
  }
  function archiveMovement(line) {
    if (line.source !== 'preview') return;
    if (!window.confirm('¿Anular este movimiento de prueba? Permanecerá registrado en la auditoría.')) return;
    commit('Anulación del movimiento de ensayo ' + line.id, s => ({
      ...s, movements: s.movements.map(m => m.id === line.id ? { ...m, archivedAt: stamp() } : m)
    }));
  }
  function saveClient(event) {
    event.preventDefault();
    const name = String(clientForm.name || '').trim();
    if (!name) return;
    const key = clientForm.originalKey || keyOf(name);
    if (!clientForm.originalKey && clients.some(c => c.key === key)) {
      setStatus('Ese cliente ya existe. Seleccionalo para editar sus datos.'); return;
    }
    commit('Alta/edición de ficha de cliente ' + name, s => ({
      ...s, clients: { ...s.clients, [key]: { name, accountType: clientForm.accountType, note: clientForm.note } }
    }));
    setSelection(key);
    setClientForm(null);
  }
  function downloadCSV() {
    if (!selected) return;
    const rows = [
      ['Cliente', selected.name], ['Cuenta', selected.accountType],
      ['Desde', startDate], ['Hasta', endDate],
      ['Saldo inicial', opening], [],
      ['Fecha', 'Detalle', 'Referencia', 'Tipo', 'Debe', 'Haber', 'Saldo']
    ];
    let running = opening;
    reportLines.forEach(line => {
      running += line.kind === 'debit' ? line.amount : -line.amount;
      rows.push([dateText(line.date), line.description, line.reference, line.subtype,
        line.kind === 'debit' ? line.amount : '', line.kind === 'credit' ? line.amount : '', running]);
    });
    rows.push(['', 'SALDO FINAL', '', '', '', '', reportClosing]);
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'ControlCheque_' + selected.name.replace(/[^a-z0-9áéíóúñ]+/gi, '_') + '_' + new Date().toLocaleDateString('en-CA') + '.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  }
  async function downloadPDF() {
    if (!selected || !reportRef.current) return;
    try {
      const pdf = (await import('html2pdf.js')).default;
      await pdf().set({
        margin: 9, filename: 'ControlCheque_' + selected.name.replace(/[^a-z0-9áéíóúñ]+/gi, '_') + '.pdf',
        image: { type: 'jpeg', quality: 0.95 }, html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      }).from(reportRef.current).save();
    } catch (error) {
      console.error(error);
      setStatus('No se pudo generar el PDF. Podés descargar el CSV mientras tanto.');
    }
  }
  const fieldStyle = 'w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200';

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 py-5 text-slate-800">
      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 mb-6 text-sm">
        <strong className="text-amber-900">ENTORNO DE PRUEBA · SIN CAMBIOS EN FIREBASE</strong>
        <p className="mt-1 text-amber-800">Los comprobantes existentes se muestran solo para consulta. Las altas, modificaciones y anulaciones de esta pantalla se guardan localmente en este navegador y no afectan los registros reales. El historial de pruebas no se sincroniza entre dispositivos.</p>
      </div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest">SII PALLETS · ControlCheque</p>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">Cuentas por cobrar</h2>
          <p className="text-sm text-slate-500 mt-1">Clientes, saldos y extractos con debe y haber.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button className="bg-white text-slate-700 border px-4 py-2.5 rounded-xl text-sm font-bold" onClick={() => setClientForm({ originalKey: '', name: '', accountType: 'General', note: '' })}>+ Cliente</button>
          <button className="bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm" onClick={() => openNewMovement()}>+ Movimiento</button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-xl bg-white border p-4"><p className="text-xs uppercase text-slate-500 font-bold">Clientes</p><p className="text-2xl font-black mt-1">{totalClients}</p></div>
        <div className="rounded-xl bg-white border p-4"><p className="text-xs uppercase text-slate-500 font-bold">Saldo neto a cobrar</p><p className="text-xl sm:text-2xl font-black mt-1 text-emerald-700">{money(totalPending)}</p></div>
        <div className="rounded-xl bg-white border p-4 col-span-2 sm:col-span-1"><p className="text-xs uppercase text-slate-500 font-bold">Movimientos de ensayo</p><p className="text-2xl font-black mt-1">{store.movements.filter(m => !m.archivedAt).length}</p></div>
      </div>
      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start">
        <section className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <label className="block text-xs text-slate-500 uppercase font-bold mb-2">Buscar cliente</label>
            <input className={fieldStyle} placeholder="Nombre o tipo de cuenta..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="text-xs text-slate-500 mt-3">{visibleClients.length} cliente(s) encontrados</div>
          </div>
          <div className="max-h-[550px] overflow-auto divide-y">
            {visibleClients.map(client => (
              <button key={client.key} onClick={() => { setSelection(client.key); setView('detail'); setStartDate(''); setEndDate(''); }}
                className={'w-full text-left p-4 hover:bg-emerald-50 transition ' + (selection === client.key ? 'bg-emerald-50 border-l-4 border-emerald-600' : '')}>
                <div className="flex justify-between gap-2 items-start">
                  <span className="text-sm font-bold break-words">{client.name}</span>
                  <span className="text-[10px] rounded-full bg-slate-100 px-2 py-1 text-slate-600 shrink-0">{client.accountType}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2"><span>{client.documentCount} comprobantes</span><span className={'font-black ' + (client.balance > 0 ? 'text-emerald-700' : 'text-slate-600')}>{money(client.balance)}</span></div>
              </button>
            ))}
            {!visibleClients.length && <p className="text-sm text-slate-500 p-5">No se encontraron clientes.</p>}
          </div>
        </section>
        <section className="min-w-0 bg-white rounded-2xl border shadow-sm overflow-hidden">
          {!selected ? (
            <div className="p-12 text-center">
              <p className="text-4xl mb-3">📋</p><h3 className="text-xl font-black">Seleccioná un cliente</h3>
              <p className="text-slate-500 text-sm mt-2">Vas a encontrar su extracto, movimientos y reportes.</p>
            </div>
          ) : (
            <>
              <div className="p-4 sm:p-6 border-b">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs text-emerald-600 uppercase font-bold">Cuenta del cliente</p><h3 className="text-xl sm:text-2xl font-black break-words">{selected.name}</h3><p className="text-sm text-slate-500 mt-1">Tipo: {selected.accountType}{selected.note ? ' · ' + selected.note : ''}</p></div>
                  <button className="text-xs font-bold text-slate-700 bg-slate-100 px-3 py-2 rounded-lg" onClick={() => setClientForm({ originalKey: selected.key, name: selected.name, accountType: selected.accountType, note: selected.note })}>Editar cliente</button>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-slate-50 p-2 sm:p-3"><p className="text-[10px] uppercase font-bold text-slate-500">Debe</p><p className="text-xs sm:text-base font-black">{money(selected.debit)}</p></div>
                  <div className="rounded-xl bg-slate-50 p-2 sm:p-3"><p className="text-[10px] uppercase font-bold text-slate-500">Haber</p><p className="text-xs sm:text-base font-black">{money(selected.credit)}</p></div>
                  <div className="rounded-xl bg-emerald-50 p-2 sm:p-3"><p className="text-[10px] uppercase font-bold text-emerald-700">Saldo</p><p className="text-xs sm:text-base font-black text-emerald-800">{money(selected.balance)}</p></div>
                </div>
              </div>
              <div className="p-4 sm:px-6 border-b flex flex-wrap gap-2 items-center justify-between">
                <div className="bg-slate-100 rounded-xl p-1 flex text-sm font-bold">
                  <button className={'px-3 py-2 rounded-lg ' + (view === 'summary' ? 'bg-white shadow-sm' : 'text-slate-500')} onClick={() => setView('summary')}>Resumida</button>
                  <button className={'px-3 py-2 rounded-lg ' + (view === 'detail' ? 'bg-white shadow-sm' : 'text-slate-500')} onClick={() => setView('detail')}>Detallada</button>
                </div>
                <div className="flex gap-2"><button className="px-3 py-2 text-sm rounded-lg border font-bold" onClick={() => openNewMovement('debit')}>+ Debe</button><button className="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white font-bold" onClick={() => openNewMovement('credit')}>+ Haber</button></div>
              </div>
              {view === 'summary' ? (
                <div className="p-4 sm:p-6">
                  <h4 className="font-bold mb-4">Resumen de cuenta</h4>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div className="bg-slate-50 p-4 rounded-xl"><p className="text-xs text-slate-500">Comprobantes</p><p className="text-2xl font-black">{selected.documentCount}</p></div>
                    <div className="bg-slate-50 p-4 rounded-xl"><p className="text-xs text-slate-500">Cobros registrados</p><p className="text-2xl font-black">{selected.ledger.filter(i => i.kind === 'credit').length}</p></div>
                  </div>
                  <button onClick={() => setView('detail')} className="mt-4 w-full p-3 rounded-xl bg-emerald-50 text-emerald-800 text-sm font-bold">Abrir extracto detallado →</button>
                </div>
              ) : (
                <>
                  <div className="p-4 sm:px-6 flex flex-wrap gap-3 items-end border-b bg-slate-50">
                    <label className="text-xs text-slate-500 font-bold">Desde<input type="date" className={fieldStyle + ' mt-1'} value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
                    <label className="text-xs text-slate-500 font-bold">Hasta<input type="date" className={fieldStyle + ' mt-1'} value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
                    <button className="rounded-lg border px-3 py-2.5 text-xs font-bold" onClick={() => {setStartDate('');setEndDate('');}}>Limpiar fechas</button>
                    <button className="rounded-lg bg-slate-800 text-white px-3 py-2.5 text-xs font-bold" onClick={downloadCSV}>Descargar CSV</button>
                    <button className="rounded-lg bg-emerald-600 text-white px-3 py-2.5 text-xs font-bold" onClick={downloadPDF}>Descargar PDF</button>
                  </div>
                  <div className="px-4 py-3 text-xs text-slate-500 bg-slate-50">Saldo anterior al período: <strong>{money(opening)}</strong></div>
                  <div className="overflow-x-auto">
                    <table className="min-w-[650px] w-full text-sm">
                      <thead className="bg-slate-100 text-slate-600 text-xs uppercase"><tr><th className="text-left p-3">Fecha</th><th className="text-left p-3">Detalle / Referencia</th><th className="text-right p-3">Debe</th><th className="text-right p-3">Haber</th><th className="text-right p-3">Saldo</th><th className="p-3">Acciones</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {reportLines.map(line => <tr key={line.id} className={line.source === 'preview' ? 'bg-amber-50/50' : ''}>
                          <td className="p-3 text-xs whitespace-nowrap">{dateText(line.date)}</td>
                          <td className="p-3"><p className="font-semibold">{line.description || (line.kind === 'debit' ? 'Cargo' : 'Cobro')}</p><p className="text-xs text-slate-500">{line.reference && '#' + line.reference + ' · '}{line.subtype}{line.source === 'preview' ? ' · PRUEBA' : ''}</p></td>
                          <td className="p-3 text-right font-semibold">{line.kind === 'debit' ? money(line.amount) : '—'}</td>
                          <td className="p-3 text-right text-emerald-700 font-semibold">{line.kind === 'credit' ? money(line.amount) : '—'}</td>
                          <td className="p-3 text-right font-bold">{money(line.balance)}</td>
                          <td className="p-3 text-center whitespace-nowrap">{line.editable && <button className="text-blue-700 text-xs font-bold px-2 py-1" onClick={() => openEditMovement(line)}>Editar</button>}{line.source === 'preview' && <button className="text-red-700 text-xs font-bold px-2 py-1" onClick={() => archiveMovement(line)}>Anular</button>}</td>
                        </tr>)}
                        {!reportLines.length && <tr><td colSpan="6" className="text-center p-8 text-slate-500">Sin movimientos en este período.</td></tr>}
                      </tbody>
                      <tfoot className="bg-slate-100"><tr><td colSpan="4" className="font-bold p-3 text-right">Saldo final del período</td><td className="p-3 text-right font-black">{money(reportClosing)}</td><td /></tr></tfoot>
                    </table>
                  </div>
                  {selected.ledger.some(l => !l.date) && <p className="px-4 py-3 text-xs text-amber-700 bg-amber-50">Hay cobros históricos sin fecha registrada. No se atribuyen a una fecha inventada; el filtro por período no los incluye, pero sí forman parte del saldo total de la cuenta.</p>}
                </>
              )}
            </>
          )}
        </section>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
        <span>{status || 'Esta versión no cambia datos reales.'}</span>
        <button className="underline font-semibold" onClick={() => setShowAudit(!showAudit)}>{showAudit ? 'Ocultar' : 'Ver'} auditoría de pruebas ({store.audit.length})</button>
      </div>
      {showAudit && <div className="mt-3 bg-white rounded-xl border p-4 text-xs max-h-56 overflow-auto">{store.audit.length ? store.audit.map(e => <p key={e.id} className="border-b py-2">{dateText(e.at)} · {e.action}</p>) : 'Todavía no hay modificaciones de prueba.'}</div>}

      {form && <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-start justify-center overflow-y-auto p-3 sm:p-8">
        <form onSubmit={saveMovement} className="bg-white rounded-2xl shadow-xl w-full max-w-xl p-5 sm:p-7">
          <div className="flex justify-between items-center mb-5"><h3 className="text-xl font-black">{form.id || form.originalId ? 'Editar movimiento · Prueba' : 'Nuevo movimiento · Prueba'}</h3><button type="button" className="text-2xl" onClick={() => setForm(null)}>×</button></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs font-bold">Cliente<input required className={fieldStyle + ' mt-1'} value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} list="knownClients" /><datalist id="knownClients">{clients.map(c => <option key={c.key} value={c.name} />)}</datalist></label>
            <label className="text-xs font-bold">Tipo<select className={fieldStyle + ' mt-1'} value={form.subtype} onChange={e => setForm({ ...form, subtype: e.target.value })}>{DOC_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></label>
            {!form.originalId && <label className="text-xs font-bold">Movimiento<select className={fieldStyle + ' mt-1'} value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}><option value="debit">Debe · Cargo</option><option value="credit">Haber · Cobro</option></select></label>}
            <label className="text-xs font-bold">Importe<input required min="0.01" step="0.01" type="number" className={fieldStyle + ' mt-1'} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} /></label>
            <label className="text-xs font-bold">Fecha<input required type="date" className={fieldStyle + ' mt-1'} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
            <label className="text-xs font-bold">Vencimiento (opcional)<input type="date" className={fieldStyle + ' mt-1'} value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></label>
            <label className="text-xs font-bold sm:col-span-2">Detalle / Concepto<input className={fieldStyle + ' mt-1'} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Ej.: Factura, anticipo, ajuste..." /></label>
            <label className="text-xs font-bold sm:col-span-2">Referencia / Nº documento<input className={fieldStyle + ' mt-1'} value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} /></label>
          </div>
          {form.originalId && <p className="text-xs text-amber-700 mt-4">Esta edición crea una corrección visual local; el comprobante histórico de Firestore no se modifica.</p>}
          <div className="flex gap-2 mt-6 justify-end"><button type="button" className="px-4 py-2 rounded-lg border" onClick={() => setForm(null)}>Cancelar</button><button type="submit" className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-bold">Guardar prueba</button></div>
        </form>
      </div>}
      {clientForm && <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-3">
        <form onSubmit={saveClient} className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
          <div className="flex justify-between items-center"><h3 className="text-xl font-black">Ficha de cliente · Prueba</h3><button type="button" className="text-2xl" onClick={() => setClientForm(null)}>×</button></div>
          <label className="block text-xs font-bold mt-5">Nombre<input required className={fieldStyle + ' mt-1'} value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} /></label>
          <label className="block text-xs font-bold mt-3">Tipo de cuenta<select className={fieldStyle + ' mt-1'} value={clientForm.accountType} onChange={e => setClientForm({ ...clientForm, accountType: e.target.value })}>{ACCOUNT_TYPES.map(t => <option key={t}>{t}</option>)}</select></label>
          <label className="block text-xs font-bold mt-3">Observaciones<input className={fieldStyle + ' mt-1'} value={clientForm.note} onChange={e => setClientForm({ ...clientForm, note: e.target.value })} /></label>
          <p className="text-xs text-slate-500 mt-3">La ficha solo se guarda en este navegador durante la prueba.</p>
          <div className="flex justify-end gap-2 mt-5"><button type="button" className="px-4 py-2 border rounded-lg" onClick={() => setClientForm(null)}>Cancelar</button><button type="submit" className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold">Guardar ficha</button></div>
        </form>
      </div>}
      <div ref={reportRef} style={{ position: 'fixed', left: '-10000px', top: 0, width: '780px', background: 'white', padding: '28px', color: '#1e293b', fontFamily: 'Arial', fontSize: '12px' }}>
        {selected && <>
          <h1 style={{fontSize: '23px', marginBottom: '4px'}}>SII PALLETS · Estado de cuenta</h1>
          <div style={{borderBottom: '2px solid #059669', paddingBottom: '10px', marginBottom: '12px'}}>
            <p><strong>Cliente:</strong> {selected.name} · <strong>Tipo:</strong> {selected.accountType}</p>
            <p><strong>Período:</strong> {startDate ? dateText(startDate) : 'Desde inicio'} a {endDate ? dateText(endDate) : 'Hasta hoy'} · <strong>Emitido:</strong> {new Date().toLocaleDateString('es-AR')}</p>
            <p><strong>Saldo inicial:</strong> {money(opening)}</p>
          </div>
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead><tr style={{background: '#f1f5f9'}}>{['Fecha', 'Detalle', 'Referencia', 'Debe', 'Haber', 'Saldo'].map(h => <th key={h} style={{padding: '8px', textAlign: h === 'Fecha' || h === 'Detalle' || h === 'Referencia' ? 'left' : 'right'}}>{h}</th>)}</tr></thead>
            <tbody>{(() => {let balance = opening; return reportLines.map(line => {balance += line.kind === 'debit' ? line.amount : -line.amount; return <tr key={line.id} style={{borderBottom: '1px solid #e2e8f0'}}><td style={{padding: '7px'}}>{dateText(line.date)}</td><td style={{padding: '7px'}}>{line.description}</td><td style={{padding: '7px'}}>{line.reference}</td><td style={{padding: '7px', textAlign: 'right'}}>{line.kind === 'debit' ? money(line.amount) : '-'}</td><td style={{padding: '7px', textAlign: 'right'}}>{line.kind === 'credit' ? money(line.amount) : '-'}</td><td style={{padding: '7px', textAlign: 'right'}}>{money(balance)}</td></tr>;});})()}</tbody>
          </table>
          <p style={{fontWeight: 800, marginTop: '18px', textAlign: 'right'}}>Saldo final: {money(reportClosing)}</p>
          <p style={{fontSize: '10px', marginTop: '25px'}}>Documento generado desde la versión de prueba. Los movimientos de ensayo no representan transacciones definitivas.</p>
        </>}
      </div>
    </div>
  );
}
