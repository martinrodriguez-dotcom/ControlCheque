import {
  Bytes, DocumentReference, GeoPoint, Timestamp, collection, doc, documentId,
  getDoc, getDocs, limit, orderBy, query, startAfter, writeBatch
} from 'firebase/firestore';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

export const ARCHIVO_FORMATO = 'SII-PALLETS-RESPALDO-2026-v1';
export const FIREBASE_ORIGEN = 'controlcheque-19226';
export const FIREBASE_PAGOS = 'listapagos';
export const FIREBASE_DESTINO = 'sii-pallets-app';

const COLECCIONES_ITEMS = [
  'cheques_public_shared', 'cobros_public_shared', 'cartera_public_shared',
  'gastos_public_shared', 'caja_public_shared', 'bancos_sii',
  'costos_madres_sii', 'pallets_templates_sii', 'presupuestos_sii'
];
const RUTAS_PRINCIPAL = [
  ...COLECCIONES_ITEMS,
  ...COLECCIONES_ITEMS.map(nombre => nombre + '/main_list/items'),
  'config_sii'
];
const RUTAS_PAGOS = ['finanzas'];
export const COLECCIONES_INCLUIDAS = Object.freeze({
  principal: RUTAS_PRINCIPAL,
  pagos: RUTAS_PAGOS
});

export function codificarValor(valor) {
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return valor;
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (valor instanceof Timestamp) return { __siiTipo: 'fecha', segundos: valor.seconds, nanosegundos: valor.nanoseconds };
  if (valor instanceof GeoPoint) return { __siiTipo: 'coordenadas', latitud: valor.latitude, longitud: valor.longitude };
  if (valor instanceof DocumentReference) return { __siiTipo: 'referencia', ruta: valor.path };
  if (valor instanceof Bytes) return { __siiTipo: 'bytes', base64: valor.toBase64() };
  if (Array.isArray(valor)) return { __siiTipo: 'lista', valores: valor.map(codificarValor) };
  if (valor && typeof valor === 'object' && Object.getPrototypeOf(valor) === Object.prototype) {
    return {
      __siiTipo: 'mapa',
      campos: Object.fromEntries(Object.keys(valor).sort().map(k => [k, codificarValor(valor[k])]))
    };
  }
  throw new Error('Tipo Firestore no reconocido: ' + Object.prototype.toString.call(valor) + '. Se detuvo el respaldo.');
}

export function decodificarValor(valor, db) {
  if (valor === null || typeof valor !== 'object') return valor;
  switch (valor.__siiTipo) {
    case 'fecha': return new Timestamp(valor.segundos, valor.nanosegundos);
    case 'coordenadas': return new GeoPoint(valor.latitud, valor.longitud);
    case 'referencia': return doc(db, valor.ruta);
    case 'bytes': return Bytes.fromBase64String(valor.base64);
    case 'lista': return valor.valores.map(v => decodificarValor(v, db));
    case 'mapa': return Object.fromEntries(Object.entries(valor.campos).map(([k, v]) => [k, decodificarValor(v, db)]));
    default: throw new Error('Archivo incompatible: tipo de dato desconocido.');
  }
}

const resumen = documentos => {
  const cantidades = {};
  for (const registro of documentos) {
    const clave = registro.ruta.split('/')[0];
    cantidades[clave] = (cantidades[clave] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(cantidades).sort(([a], [b]) => a.localeCompare(b)));
};
const firmaSHA256 = async texto => {
  const digest = await crypto.subtle.digest('SHA-256', strToU8(texto));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
};

async function documentosDeRutas(db, rutas, informar, etiqueta) {
  const documentos = [], vistos = new Set();
  for (const ruta of rutas) {
    let ultimo = null;
    while (true) {
      const argumentos = [orderBy(documentId()), limit(200)];
      if (ultimo) argumentos.push(startAfter(ultimo));
      const pagina = await getDocs(query(collection(db, ruta), ...argumentos));
      for (const item of pagina.docs) {
        if (vistos.has(item.ref.path)) throw new Error('Documento repetido en la exportación: ' + item.ref.path);
        vistos.add(item.ref.path);
        documentos.push({ ruta: item.ref.path, datos: codificarValor(item.data()) });
      }
      informar(etiqueta + ': ' + ruta + ' — ' + documentos.length + ' documentos encontrados');
      if (pagina.size < 200) break;
      ultimo = pagina.docs[pagina.docs.length - 1];
    }
  }
  documentos.sort((a, b) => a.ruta.localeCompare(b.ruta));
  return documentos;
}

export async function crearRespaldo(mainDb, pagosDb, informar = () => {}) {
  if (mainDb?.app?.options?.projectId !== FIREBASE_ORIGEN) throw new Error('La base principal no es la original. Descarga cancelada.');
  if (pagosDb?.app?.options?.projectId !== FIREBASE_PAGOS) throw new Error('La base de Pagos no es la original. Descarga cancelada.');
  const principal = await documentosDeRutas(mainDb, RUTAS_PRINCIPAL, informar, 'ControlCheque');
  const pagos = await documentosDeRutas(pagosDb, RUTAS_PAGOS, informar, 'Pagos Avanzados');
  const archivos = [
    { proyecto: FIREBASE_ORIGEN, nombre: 'datos-controlcheque.json', documentos: principal },
    { proyecto: FIREBASE_PAGOS, nombre: 'datos-pagos.json', documentos: pagos }
  ];
  const entradas = {}, componentes = [];
  for (const archivo of archivos) {
    const datos = JSON.stringify({ proyecto: archivo.proyecto, documentos: archivo.documentos });
    entradas[archivo.nombre] = strToU8(datos);
    componentes.push({
      nombre: archivo.nombre, proyecto: archivo.proyecto,
      cantidad: archivo.documentos.length, colecciones: resumen(archivo.documentos),
      sha256: await firmaSHA256(datos)
    });
  }
  const manifest = {
    formato: ARCHIVO_FORMATO,
    creadoEn: new Date().toISOString(),
    destino: FIREBASE_DESTINO,
    completosParaRutasDeclaradas: true,
    nota: 'Incluye las colecciones y subcolecciones conocidas del código. Firestore Web no permite descubrir colecciones desconocidas.',
    componentes
  };
  entradas['manifiesto.json'] = strToU8(JSON.stringify(manifest, null, 2));
  informar('Generando archivo ZIP con las dos bases...');
  return { bytes: zipSync(entradas, { level: 6 }), manifest };
}

function rutaValida(proyecto, ruta) {
  if (typeof ruta !== 'string' || ruta.includes('//')) return false;
  const partes = ruta.split('/');
  if (partes.some(p => !p || p === '.' || p === '..') || partes.length % 2 !== 0) return false;
  if (proyecto === FIREBASE_ORIGEN) {
    if (partes.length === 2) return [...COLECCIONES_ITEMS, 'config_sii'].includes(partes[0]);
    if (partes.length === 4) return COLECCIONES_ITEMS.includes(partes[0]) && partes[1] === 'main_list' && partes[2] === 'items';
    return false;
  }
  return proyecto === FIREBASE_PAGOS && partes.length === 2 && partes[0] === 'finanzas';
}

function verificarDataset(datos, archivo) {
  if (!datos || datos.proyecto !== archivo.proyecto || !Array.isArray(datos.documentos)) {
    throw new Error('El archivo ' + archivo.nombre + ' tiene un origen o estructura incorrectos.');
  }
  if (datos.documentos.length !== archivo.cantidad) throw new Error('Cantidad de documentos incorrecta en ' + archivo.nombre);
  const ids = new Set();
  for (const registro of datos.documentos) {
    if (!rutaValida(datos.proyecto, registro.ruta) || ids.has(registro.ruta)) {
      throw new Error('Ruta inválida/repetida: ' + registro.ruta);
    }
    ids.add(registro.ruta);
    if (registro.datos?.__siiTipo !== 'mapa') throw new Error('Datos del documento inválidos: ' + registro.ruta);
  }
  const colecciones = resumen(datos.documentos);
  if (JSON.stringify(colecciones) !== JSON.stringify(archivo.colecciones)) throw new Error('Las colecciones del respaldo no coinciden.');
}

export async function abrirRespaldo(file) {
  if (!file || !/\.zip$/i.test(file.name)) throw new Error('Seleccioná un archivo ZIP generado por SII PALLETS.');
  if (file.size > 150 * 1024 * 1024) throw new Error('Respaldo superior a 150 MB; se requiere migración por lotes.');
  const zip = unzipSync(new Uint8Array(await file.arrayBuffer()));
  if (!zip['manifiesto.json']) throw new Error('No se encontró el manifiesto del respaldo.');
  const manifest = JSON.parse(strFromU8(zip['manifiesto.json']));
  if (manifest.formato !== ARCHIVO_FORMATO || manifest.destino !== FIREBASE_DESTINO ||
      !Array.isArray(manifest.componentes) || manifest.componentes.length !== 2 ||
      manifest.componentes[0]?.proyecto !== FIREBASE_ORIGEN || manifest.componentes[1]?.proyecto !== FIREBASE_PAGOS) {
    throw new Error('El ZIP no es un respaldo completo compatible con esta migración.');
  }
  const todos = [], claves = new Set();
  for (const componente of manifest.componentes) {
    const contenido = zip[componente.nombre];
    if (!contenido) throw new Error('Falta el archivo: ' + componente.nombre);
    const texto = strFromU8(contenido);
    if (await firmaSHA256(texto) !== componente.sha256) throw new Error('El respaldo fue modificado o está dañado: ' + componente.nombre);
    const datos = JSON.parse(texto);
    verificarDataset(datos, componente);
    for (const registro of datos.documentos) {
      if (claves.has(registro.ruta)) throw new Error('Colisión de documento entre proyectos: ' + registro.ruta);
      claves.add(registro.ruta);
      todos.push(registro);
    }
  }
  if (todos.length < 1) throw new Error('El respaldo no contiene documentos. No se puede restaurar.');
  return { manifest, documentos: todos };
}
export function contarRespaldo(bundle) {
  return bundle.manifest.componentes.map(c => ({ proyecto: c.proyecto, cantidad: c.cantidad, colecciones: c.colecciones }));
}
const identicos = (actual, esperado) => JSON.stringify(codificarValor(actual)) === JSON.stringify(esperado);
const grupos = (valores, tamano) => {
  const salida = [];
  for (let i = 0; i < valores.length; i += tamano) salida.push(valores.slice(i, i + tamano));
  return salida;
};
export async function inspeccionarDestino(db, bundle, informar = () => {}) {
  if (db?.app?.options?.projectId !== FIREBASE_DESTINO) throw new Error('El destino no es sii-pallets-app. Operación cancelada.');
  const faltantes = [], iguales = [], conflictos = [];
  let revisados = 0;
  for (const grupo of grupos(bundle.documentos, 20)) {
    const snapshots = await Promise.all(grupo.map(registro => getDoc(doc(db, registro.ruta))));
    for (let i = 0; i < grupo.length; i++) {
      const registro = grupo[i], snap = snapshots[i];
      if (!snap.exists()) faltantes.push(registro);
      else if (identicos(snap.data(), registro.datos)) iguales.push(registro.ruta);
      else conflictos.push(registro.ruta);
      revisados++;
    }
    informar('Comprobando destino: ' + revisados + ' de ' + bundle.documentos.length);
  }
  return { faltantes, iguales, conflictos, total: bundle.documentos.length };
}
export async function importarRespaldo(db, bundle, informar = () => {}) {
  const verificacion = await inspeccionarDestino(db, bundle, informar);
  if (verificacion.conflictos.length) {
    throw new Error(verificacion.conflictos.length + ' documentos existentes difieren del respaldo. NO se sobrescribió nada. Primero revisá la conciliación.');
  }
  const LIMITE_POR_EJECUCION = 1500;
  const pendientes = verificacion.faltantes.slice(0, LIMITE_POR_EJECUCION);
  let hechos = 0;
  for (const grupo of grupos(pendientes, 12)) {
    const batch = writeBatch(db);
    for (const registro of grupo) batch.set(doc(db, registro.ruta), decodificarValor(registro.datos, db));
    await batch.commit();
    hechos += grupo.length;
    informar('Restaurados: ' + hechos + ' de ' + pendientes.length + '. Coincidentes anteriores: ' + verificacion.iguales.length);
  }
  const final = await inspeccionarDestino(db, bundle, informar);
  return { escritos: hechos, iguales: final.iguales.length, faltantes: final.faltantes.length, conflictos: final.conflictos.length, total: bundle.documentos.length };
}
