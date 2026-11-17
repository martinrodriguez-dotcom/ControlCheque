import React, { useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
  abrirRespaldo, contarRespaldo, crearRespaldo, importarRespaldo, inspeccionarDestino,
  FIREBASE_DESTINO, FIREBASE_ORIGEN, FIREBASE_PAGOS, COLECCIONES_INCLUIDAS
} from '../utils/migracionFirestore';

const badge = 'inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-bold';
const boton = 'rounded-xl px-4 py-3 text-sm font-bold transition disabled:opacity-50 disabled:cursor-not-allowed';
const n = valor => new Intl.NumberFormat('es-AR').format(valor || 0);

export default function TransferenciaFirestore({ rol, pagosDb, exportarOrigenes }) {
  const esOrigen = rol === 'origen';
  const [sesion, setSesion] = useState(Boolean(auth.currentUser));
  const [ocupado, setOcupado] = useState(false);
  const [estado, setEstado] = useState('');
  const [error, setError] = useState('');
  const [respaldo, setRespaldo] = useState(null);
  const [archivoNombre, setArchivoNombre] = useState('');
  const [comparacion, setComparacion] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [confirmacion, setConfirmacion] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [aceptoDescarga, setAceptoDescarga] = useState(false);

  // Utiliza exactamente la autenticación anónima que ya tiene la aplicación;
  // nunca solicita una contraseña adicional ni cambia la sesión actual.
  useEffect(() => onAuthStateChanged(auth, usuario => setSesion(Boolean(usuario))), []);

  const descargar = async () => {
    setError('');
    setResultado(null);
    setEstado('Leyendo las dos bases originales. No cierres esta pestaña.');
    setOcupado(true);
    try {
      if (!sesion) throw new Error('Esperá a que la app termine de iniciar su sesión anónima.');
      const conexiones = esOrigen
        ? { principalDb: db, pagosDb }
        : await exportarOrigenes();
      if (!conexiones?.principalDb || !conexiones?.pagosDb) throw new Error('No se pudieron conectar las dos bases de origen.');
      const { bytes, manifest } = await crearRespaldo(conexiones.principalDb, conexiones.pagosDb, setEstado);
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
      setEstado('ZIP generado. Guardalo en una ubicación privada y comprobá que se haya descargado.');
    } catch (err) {
      setError(err?.message || String(err));
      setEstado('La descarga no terminó. No uses un respaldo incompleto.');
    } finally {
      setOcupado(false);
    }
  };

  const seleccionarArchivo = async e => {
    setError('');
    setEstado('Abriendo ZIP y comprobando integridad...');
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
      setEstado('ZIP válido. Todavía no se escribió ningún documento en Firebase.');
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
      if (!sesion) throw new Error('Todavía no está activa la sesión anónima de la app.');
      const datos = await inspeccionarDestino(db, respaldo, setEstado);
      setComparacion(datos);
      setEstado('Comparación terminada. No se modificó ningún documento.');
    } catch (err) {
      setError(err?.message || String(err));
    } finally {
      setOcupado(false);
    }
  };

  const importar = async () => {
    if (!respaldo || !comparacion || comparacion.conflictos.length || confirmacion !== 'IMPORTAR' || !acepto || !sesion) return;
    setError('');
    setOcupado(true);
    setResultado(null);
    try {
      const datos = await importarRespaldo(db, respaldo, setEstado);
      setResultado(datos);
      setComparacion(null);
      setConfirmacion('');
      setAcepto(false);
      setEstado(datos.faltantes === 0 && datos.conflictos === 0
        ? 'Restauración verificada: todos los documentos del respaldo coinciden.'
        : 'Hay documentos pendientes. Compará de nuevo y reanudá usando el mismo ZIP.');
    } catch (err) {
      setError(err?.message || String(err));
      setEstado('Se detuvo la restauración. No se sobrescriben documentos diferentes.');
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="max-w-5xl mx-auto space-y-5 text-slate-800">
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-7 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">MIGRACIÓN DE DATOS · SII PALLETS</h2>
          <span className={badge}>{esOrigen ? 'BASE ORIGINAL · RESPALDO' : 'FIREBASE NUEVO · RESTAURACIÓN'}</span>
        </div>
        <p className="text-sm text-slate-600">
          {esOrigen
            ? 'Descargá los registros de las dos bases originales en un único archivo ZIP.'
            : 'Podés descargar las dos bases originales directamente desde esta versión, sin depender de la publicación de Netlify anterior, y restaurarlas en el Firebase nuevo.'}
        </p>
        <div className="rounded-lg p-3 bg-amber-50 text-amber-900 border border-amber-200 text-sm">
          <strong>Importante:</strong> el acceso anónimo de Firebase no identifica a un administrador.
          Si las reglas permiten acceder a cualquier usuario anónimo, otras personas también podrían leer o modificar datos financieros.
          Usá esta herramienta solamente durante la migración y restringí las reglas antes de habilitar la app definitiva.
          El ZIP contiene información privada; no lo compartas ni lo subas a GitHub.
        </div>
        <p className="text-sm font-semibold">{sesion ? '✓ Sesión Firebase activa (sin ingresar usuario y contraseña)' : 'Conectando sesión anónima de Firebase...'}</p>
      </div>

      {esOrigen || exportarOrigenes ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-7 space-y-4">
          <h3 className="font-bold text-lg">1. Descargar respaldo de ambas bases (ZIP)</h3>
          <div className="flex flex-wrap gap-2">
            <span className={badge}>{FIREBASE_ORIGEN}</span>
            <span className={badge}>{FIREBASE_PAGOS}</span>
          </div>
          <p className="text-sm text-slate-600">Contiene los registros de las colecciones conocidas de ControlCheque y los datos de Pagos Avanzados. No modifica ni borra información del origen.</p>
          <label className="flex gap-2 items-start text-sm">
            <input type="checkbox" className="mt-1" checked={aceptoDescarga} onChange={e => setAceptoDescarga(e.target.checked)}/>
            Confirmo que guardaré el respaldo ZIP de forma privada y comprobaré que estén los datos esperados.
          </label>
          <button className={boton + ' bg-blue-700 text-white w-full sm:w-auto'} disabled={ocupado || !sesion || !aceptoDescarga} onClick={descargar}>
            {ocupado ? 'Preparando respaldo...' : 'Descargar respaldo completo (ZIP)'}
          </button>
          {resultado?.descargado && <div className="bg-emerald-50 p-4 rounded-xl text-sm space-y-1">
            <p className="font-bold text-emerald-800">ZIP generado</p>
            {resultado.componentes.map(x => <p key={x.proyecto}>{x.proyecto}: <strong>{n(x.cantidad)}</strong> documentos</p>)}
          </div>}
        </div>
      ) : null}

      {!esOrigen && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5 sm:p-7 space-y-5">
          <div>
            <h3 className="font-bold text-lg">2. Restaurar respaldo en el Firebase personal</h3>
            <p className="text-sm text-slate-600">Destino: <strong>{FIREBASE_DESTINO}</strong>. El ZIP se procesa en este dispositivo, sin subirlo a Netlify.</p>
          </div>
          <label className="block text-sm font-bold">Elegir el archivo ZIP
            <input type="file" accept=".zip,application/zip" disabled={ocupado || !sesion} onChange={seleccionarArchivo}
              className="block w-full mt-2 rounded-lg border border-slate-300 p-3 text-sm"/>
          </label>
          {respaldo && <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm space-y-2">
            <p className="font-bold">{archivoNombre}</p>
            <p>Fecha de respaldo: {new Date(respaldo.manifest.creadoEn).toLocaleString('es-AR')}</p>
            {contarRespaldo(respaldo).map(x => <div key={x.proyecto} className="flex justify-between gap-3"><span>{x.proyecto}</span><strong>{n(x.cantidad)} documentos</strong></div>)}
          </div>}
          <button className={boton + ' bg-slate-800 text-white'} disabled={!respaldo || ocupado || !sesion} onClick={comprobar}>
            Comparar con la base nueva (sin escribir)
          </button>
          {comparacion && <div className="rounded-xl border border-slate-200 p-4 text-sm grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><span className="text-slate-500">Total</span><p className="font-extrabold">{n(comparacion.total)}</p></div>
            <div><span className="text-slate-500">Por crear</span><p className="font-extrabold">{n(comparacion.faltantes.length)}</p></div>
            <div><span className="text-slate-500">Ya iguales</span><p className="font-extrabold">{n(comparacion.iguales.length)}</p></div>
            <div><span className="text-slate-500">En conflicto</span><p className={'font-extrabold ' + (comparacion.conflictos.length ? 'text-red-700' : 'text-green-700')}>{n(comparacion.conflictos.length)}</p></div>
          </div>}
          {comparacion?.conflictos.length > 0 && <p className="text-red-700 font-semibold text-sm">Restauración bloqueada: hay documentos diferentes en la base nueva. No se sobrescribirá ninguno.</p>}
          {comparacion && comparacion.conflictos.length === 0 && comparacion.faltantes.length > 0 && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
              <p className="text-sm font-semibold">Para evitar movimientos faltantes, suspendé las cargas en la aplicación anterior mientras hacés el respaldo final y su importación.</p>
              <label className="flex gap-2 text-sm"><input type="checkbox" checked={acepto} onChange={e => setAcepto(e.target.checked)}/> Revisé el respaldo y confirmo que quiero escribir los documentos faltantes.</label>
              <label className="text-sm block font-medium space-y-1">Escribí IMPORTAR
                <input type="text" autoComplete="off" className="w-full border rounded-lg p-3" value={confirmacion} onChange={e => setConfirmacion(e.target.value)}/>
              </label>
              <button className={boton + ' bg-emerald-700 text-white w-full'} onClick={importar} disabled={ocupado || !sesion || !acepto || confirmacion !== 'IMPORTAR'}>
                Restaurar documentos faltantes
              </button>
              <p className="text-xs text-slate-600">Por seguridad: máximo 1.500 documentos por ejecución. Si faltan más, repetí la comparación y restauración con el mismo ZIP.</p>
            </div>
          )}
          {comparacion && comparacion.faltantes.length === 0 && comparacion.conflictos.length === 0 &&
            <p className="text-emerald-700 text-sm font-bold">Todos los documentos de este respaldo coinciden con la base nueva.</p>}
          {resultado && !resultado.descargado && <div className={'rounded-xl p-4 text-sm ' + (resultado.faltantes || resultado.conflictos ? 'bg-amber-50' : 'bg-emerald-50')}>
            <strong>Resultado:</strong> {n(resultado.escritos)} documentos creados; {n(resultado.iguales)} verificados; {n(resultado.faltantes)} pendientes; {n(resultado.conflictos)} diferentes.
          </div>}
        </div>
      )}
      {estado && <div role="status" className="rounded-xl bg-slate-100 text-slate-700 p-4 text-sm break-words">{estado}</div>}
      {error && <div role="alert" className="rounded-xl bg-red-50 text-red-800 p-4 text-sm break-words"><strong>Error de transferencia:</strong> {error}</div>}
      <details className="rounded-xl bg-white border border-slate-200 p-4 text-sm">
        <summary className="cursor-pointer font-bold">Colecciones incluidas y límites</summary>
        <p className="mt-3 mb-2">Rutas conocidas de ControlCheque:</p>
        <p className="font-mono text-xs break-words">{COLECCIONES_INCLUIDAS.principal.join(' · ')}</p>
        <p className="mt-3 mb-2">Pagos Avanzados:</p>
        <p className="font-mono text-xs">{COLECCIONES_INCLUIDAS.pagos.join(' · ')}</p>
        <p className="mt-3 text-amber-800">El navegador no permite descubrir colecciones desconocidas. Authentication, reglas, índices, Storage y localStorage deben verificarse por separado.</p>
      </details>
    </section>
  );
}
