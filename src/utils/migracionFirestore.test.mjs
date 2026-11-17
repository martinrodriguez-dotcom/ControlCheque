import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp, GeoPoint, Bytes } from 'firebase/firestore';
import { codificarValor, ARCHIVO_FORMATO, COLECCIONES_INCLUIDAS } from './migracionFirestore.js';

test('codifica y distingue tipos y mapas sin perder nanosegundos ni bytes', () => {
  const data = {
    cantidad: 2,
    fecha: new Timestamp(1730000000, 123456789),
    punto: new GeoPoint(-33.0, -58.5),
    archivo: Bytes.fromUint8Array(Uint8Array.from([0, 1, 254, 255])),
    extra: { __siiTipo: 'valor real del usuario', a: [true, null, { k: 11 }] }
  };
  const encoded = codificarValor(data);
  assert.equal(encoded.__siiTipo, 'mapa');
  assert.equal(encoded.campos.fecha.nanosegundos, 123456789);
  assert.equal(encoded.campos.punto.latitud, -33.0);
  assert.equal(encoded.campos.archivo.base64, 'AAH+/w==');
  assert.equal(encoded.campos.extra.__siiTipo, 'mapa');
  assert.equal(encoded.campos.extra.campos.__siiTipo, 'valor real del usuario');
  assert.deepEqual(encoded.campos.extra.campos.a.valores[2].campos.k, 11);
});
test('el respaldo cubre las colecciones principales conocidas y finanzas', () => {
  assert.match(ARCHIVO_FORMATO, /SII-PALLETS/);
  assert.ok(COLECCIONES_INCLUIDAS.principal.includes('config_sii'));
  assert.ok(COLECCIONES_INCLUIDAS.principal.includes('presupuestos_sii/main_list/items'));
  assert.ok(COLECCIONES_INCLUIDAS.principal.includes('caja_public_shared/main_list/items'));
  assert.deepEqual(COLECCIONES_INCLUIDAS.pagos, ['finanzas']);
});
