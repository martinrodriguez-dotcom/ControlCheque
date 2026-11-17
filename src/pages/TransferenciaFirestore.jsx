import React, { useEffect, useMemo, useState } from 'react';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, inMemoryPersistence, onAuthStateChanged, setPersistence, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from '../firebase';
import {
  abrirRespaldo, contarRespaldo, crearRespaldo, importarRespaldo, inspeccionarDestino,
  FIREBASE_DESTINO, FIREBASE_ORIGEN, FIREBASE_PAGOS, COLECCIONES_INCLUIDAS
} from '../utils/migracionFirestore';

const AUTH_APP = 'sii-migracion-operador-administrativo';
const ADMIN_UID = (import.meta.env.VITE_SII_MIGRATION_ADMIN_UID || '').trim();
const badge = 'inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-bold';
const boton = 'rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed';
const n = valor => new Intl.NumberFormat('es-AR').format(valor || 0);

export default function TransferenciaFirestore({ rol, pagosDb }) {
  const esOrigen = rol === 'origen';
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [autorizado, setAutorizado] = useState(false);
  const [correoActual, setCorreoActual] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [respaldo, setRespaldo] = useState(null);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [comparacion, setComparacion] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [confirmacion, setConfirmacion] = useState('');
  const [acepto, setAcepto] = useState(false);
  const operador = useMemo(() => {
    const app = getApps().some(a => a.name === AUTH_APP) ? getApp(AUTH_APP) : initializeApp(firebaseConfig, AUTH_APP);
    return { auth: getAuth(app), db: getFirestore(app) };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(operador.auth, usuario => {
      const ok = Boolean(ADMIN_UID && usuario && usuario.uid === ADMIN_UID);
      setAutorizado(ok);
      setCorreoActual(ok ? (usuario.email || '') : '');
    });
    return () => { unsub(); signOut(operador.auth).catch(() => {}); };
  }, [operador.auth]);

  const autenticar = async e => {
    e.preventDefault();
    if (!ADMIN_UID) {
      setError('Primero configurá VITE_SII_MIGRATION_ADMIN_UID en el Netlify de esta aplicación.');
      return;
    }
    setError('');
    setOcupado(true);
    try {
      await setPersistence(operador.auth, inMemoryPersistence);
      const credenciales = await signInWithEmailAndPassword(operador.auth, correo.trim(), clave);
      if (credenciales.user.uid !== ADMIN_UID) {
        await signOut(operador.auth);
        throw new Error('Este usuario no tiene autorización para la migración.');
      }
      setClave('');
      setEstado('Acceso administrativo verificado.');
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setOcupado(false);
    }
  };
  const descargar = async () => {
    setError('');
    setEstado('Leyendo las dos bases. No cierres esta pestaña.');
    setOcupado(true);
    try {
      if (!pagosDb) throw new Error('No está disponible la conexión a la base original de Pagos.');
      const { bytes, manifest } = await crearRespaldo(operador.db, pagosDb, setEstado);
      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SII_PALLETS_RESPALDO_' + new Date().toISOString().slice(0, 10) + '.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setResultado({ descargado: true, componentes: manifest.componentes });
      setEstado('Respaldo ZIP generado. Conservá el archivo en un lugar privado.');
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setOcupado(false);
    }
  };
  const seleccionarArchivo = async e => {
    setError('');
    setEstado('Abriendo y verificando integridad del ZIP...');
    setComparacion(null);
    setResultado(null);
    setConfirmacion('');
    setAcepto(false);
    setRespaldo(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setOcupado(true);
    try {
      const datos = await abrirRespaldo(file);
      setRespaldo(datos);
      setArchivoNombre(file.name);
      setEstado('Respaldo ZIP válido; todavía no se escribió ningún documento.');
    } catch (err) {
      setError(err?.message || String(err));
      setArchivoNombre('');
    } finally {
      setOcupado(false);
    }
  };
  const comprobar = async () => {
    setError('');
    setOcupado(true);
    setComparacion(null);
    try {
      if (!respaldo) throw new Error('Seleccioná el ZIP del respaldo.');
      const datos = await inspeccionarDestino(operador.db, respaldo, setEstado);
      setComparacion(datos);
      setEstado('Comparación finalizada. No se modificó ningún registro.');
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setOcupado(false);
    }
  };
  const importar = async () => {
    if (!respaldo || !comparacion || comparacion.conflictos.length || confirmacion !== 'IMPORTAR' || !acepto) return;
    setError('');
    setOcupado(true);
    setResultado(null);
    try {
      const datos = await importarRespaldo(operador.db, respaldo, setEstado);
      setResultado(datos);
      setComparacion(null);
      setConfirmacion('');
      setAcepto(false);
      setEstado(datos.faltantes === 0 && datos.conflictos === 0
        ? 'Restauración y cotejo de documentos correctos.'
        : 'Hay documentos pendientes. Volvé a comparar y reanudá con el mismo ZIP.');
    } catch (err) {
      setError(err?.message || String(err));
      setEstado('La importación se detuvo. No se sobrescriben documentos con diferencias.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="max-w-5xl mx-auto space-y-5 text-slate-800">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-7 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">MIGRACIÓN DE DATOS · SII PALLETS</h2>
          <span className={badge}>{esOrigen ? 'BASE ORIGINAL · DESCARGA' : 'BASE NUEVA · RESTAURACIÓN'}</span>
        </div>
        <p className="text-sm text-slate-600">
          {esOrigen
            ? 'Descargá en un solo archivo ZIP los registros de ControlCheque y Pagos Avanzados. No se borra ni modifica ningún movimiento.'
            : 'Seleccioná el ZIP generado en la aplicación original. Primero se comprueban los documentos y luego se restauran sin reemplazar datos diferentes.'}
        </p>
        <p className="text-xs rounded-lg p-3 bg-amber-50 text-amber-900 border border-amber-200">
          Los respaldos contienen datos financieros privados. Guardalos fuera de GitHub y WhatsApp.
          El módulo cubre las rutas que usa esta aplicación, no puede descubrir colecciones desconocidas o cuentas de Authentication.
        </p>
      </div>

      {!autorizado ? (
        <form onSubmit={autenticar} className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-7 space-y-4">
          <h3 className="font-bold text-lg">Acceso administrativo</h3>
          <p className="text-sm text-slate-600">Ingresá con el usuario de correo y contraseña creado en Firebase Authentication de este proyecto. El UID debe coincidir con el configurado en Netlify.</p>
          {!ADMIN_UID && <p className="rounded-lg bg-red-50 text-red-700 p-3 text-sm font-semibold">Falta configurar VITE_SII_MIGRATION_ADMIN_UID en Netlify. Por seguridad, la transferencia está bloqueada.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm font-medium space-y-1">Correo administrador
              <input type="email" required autoComplete="username" className="w-full border rounded-lg p-3" value={correo} onChange={e => setCorreo(e.target.value)} placeholder="correo autorizado"/>
            </label>
            <label className="text-sm font-medium space-y-1">Contraseña
              <input type="password" required autoComplete="current-password" className="w-full border rounded-lg p-3" value={clave} onChange={e => setClave(e.target.value)}/>
            </label>
          </div>
          <button type="submit" disabled={ocupado || !ADMIN_UID} className={boton + ' bg-blue-700 text-white'}>Ingresar al módulo de migración</button>
        </form>
      ) : (
        <>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 p-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>Operador autorizado: <strong>{correoActual}</strong></span>
            <button onClick={() => signOut(operador.auth)} disabled={ocupado} className="underline font-semibold">Cerrar acceso</button>
          </div>
          {esOrigen ? (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-7 space-y-4">
              <h3 className="font-bold text-lg">Descargar respaldo completo (ZIP)</h3>
              <div className="flex flex-wrap gap-2">
                <span className={badge}>{FIREBASE_ORIGEN}</span>
                <span className={badge}>{FIREBASE_PAGOS}</span>
              </div>
              <p className="text-sm text-slate-600">Incluye pagos, cobros, Caja, Cartera, gastos, bancos, Pallets, presupuestos y configuración de Facturación, además de los documentos de Pagos Avanzados.</p>
              <button className={boton + ' bg-blue-700 text-white w-full sm:w-auto'} disabled={ocupado} onClick={descargar}>
                {ocupado ? 'Preparando ZIP...' : 'Descargar respaldo completo (ZIP)'}
              </button>
              {resultado?.descargado && <div className="bg-emerald-50 p-4 rounded-xl text-sm space-y-1">
                <p className="font-bold text-emerald-800">Respaldo generado</p>
                {resultado.componentes.map(x => <p key={x.proyecto}>{x.proyecto}: <strong>{n(x.cantidad)}</strong> documentos</p>)}
              </div>}
            </div>
          ) : (
            <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-7 space-y-5">
              <div>
                <h3 className="font-bold text-lg">Recuperación de datos</h3>
                <p className="text-sm text-slate-600">Destino único: <strong>{FIREBASE_DESTINO}</strong>. El archivo ZIP nunca se sube a Netlify: se procesa en este dispositivo y se escribe en Firestore.</p>
              </div>
              <label className="block text-sm font-bold">Archivo de respaldo ZIP
                <input type="file" accept=".zip,application/zip" disabled={ocupado} onChange={seleccionarArchivo}
                  className="block w-full mt-2 rounded-lg border border-slate-300 p-3 text-sm"/>
              </label>
              {respaldo && <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-2">
                <p className="font-bold">{archivoNombre}</p>
                <p>Respaldo del: {new Date(respaldo.manifest.creadoEn).toLocaleString('es-AR')}</p>
                {contarRespaldo(respaldo).map(x => <div key={x.proyecto} className="flex justify-between gap-3"><span>{x.proyecto}</span><strong>{n(x.cantidad)} documentos</strong></div>)}
              </div>}
              <button className={boton + ' bg-slate-800 text-white'} disabled={!respaldo || ocupado} onClick={comprobar}>1. Comparar con la base nueva (sin escribir)</button>
              {comparacion && <div className="rounded-xl border border-slate-200 p-4 text-sm grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div><span className="text-slate-500">Total</span><p className="font-extrabold">{n(comparacion.total)}</p></div>
                <div><span className="text-slate-500">Por crear</span><p className="font-extrabold">{n(comparacion.faltantes.length)}</p></div>
                <div><span className="text-slate-500">Ya iguales</span><p className="font-extrabold">{n(comparacion.iguales.length)}</p></div>
                <div><span className="text-slate-500">En conflicto</span><p className={'font-extrabold ' + (comparacion.conflictos.length ? 'text-red-700' : 'text-green-700')}>{n(comparacion.conflictos.length)}</p></div>
              </div>}
              {comparacion?.conflictos.length > 0 && <p className="text-red-700 font-semibold text-sm">Se bloqueó la restauración: hay documentos distintos en la base nueva. No se sobrescribirá ninguno.</p>}
              {comparacion && comparacion.conflictos.length === 0 && comparacion.faltantes.length > 0 && (
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
                  <p className="text-sm font-semibold">Antes de importar, suspendé temporalmente las cargas en las otras apps para evitar que cambien los datos mientras migramos.</p>
                  <label className="flex gap-2 text-sm"><input type="checkbox" checked={acepto} onChange={e => setAcepto(e.target.checked)}/> Confirmo que el respaldo es el correcto y que revisé las cantidades.</label>
                  <label className="text-sm block font-medium space-y-1">Escribí IMPORTAR para confirmar
                    <input type="text" autoComplete="off" className="w-full border rounded-lg p-3" value={confirmacion} onChange={e => setConfirmacion(e.target.value)}/>
                  </label>
                  <button className={boton + ' bg-emerald-700 text-white w-full'} onClick={importar} disabled={ocupado || !acepto || confirmacion !== 'IMPORTAR'}>2. Restaurar documentos faltantes</button>
                  <p className="text-xs text-slate-600">Por seguridad se importan como máximo 1.500 documentos por ejecución. Si faltan más, repetí la comparación y la importación con el mismo ZIP.</p>
                </div>
              )}
              {comparacion && comparacion.faltantes.length === 0 && comparacion.conflictos.length === 0 &&
                <p className="text-emerald-700 text-sm font-bold">Todos los documentos de este respaldo ya coinciden con la base nueva.</p>}
              {resultado && !resultado.descargado && <div className={'rounded-xl p-4 text-sm ' + (resultado.faltantes || resultado.conflictos ? 'bg-amber-50' : 'bg-emerald-50')}>
                <strong>Resultado:</strong> {n(resultado.escritos)} documentos creados; {n(resultado.iguales)} verificados; {n(resultado.faltantes)} pendientes; {n(resultado.conflictos)} diferentes.
              </div>}
            </div>
          )}
        </>
      )}
      {estado && <div role="status" className="rounded-xl bg-slate-100 text-slate-700 p-4 text-sm break-words">{estado}</div>}
      {error && <div role="alert" className="rounded-xl bg-red-50 text-red-800 p-4 text-sm break-words"><strong>Error de transferencia:</strong> {error}</div>}
      <details className="rounded-xl bg-white border border-slate-200 p-4 text-sm">
        <summary className="cursor-pointer font-bold">Ver las rutas contempladas en el respaldo</summary>
        <p className="mt-3 mb-2">Colecciones principales y subcolecciones de la app:</p>
        <p className="font-mono text-xs break-words">{COLECCIONES_INCLUIDAS.principal.join(' · ')}</p>
        <p className="mt-3 mb-2">Proyecto Pagos:</p>
        <p className="font-mono text-xs">{COLECCIONES_INCLUIDAS.pagos.join(' · ')}</p>
        <p className="mt-3 text-amber-800">No incluye usuarios Authentication, reglas, índices, archivos Storage, claves ni datos guardados en el navegador. Verificá la consola de ambas bases por otras colecciones antes del corte definitivo.</p>
      </details>
    </section>
  );
}
