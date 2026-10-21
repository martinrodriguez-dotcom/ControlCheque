# SII PALLETS 3.0 — piloto en rama aislada

## Regla de compatibilidad

Esta rama agrega `src/pages/Direccion.jsx` y `src/utils/gestion30.js` sin cambiar las estructuras de Firestore, sin migraciones, sin renombrar campos y sin sustituir las pantallas históricas:

- PAGOS (iframe externo `listapagos.netlify.app`)
- FACTURACIÓN
- CAJA
- GASTOS
- BALANCE
- COBROS
- CARTERA
- PALLETS

La rama agrega solamente una pestaña **DIRECCIÓN 3.0**. Navegar, consultar, exportar o simular desde la pestaña nueva no actualiza registros. Las pestañas antiguas **sí escriben en la misma base de producción incluso desde la preview**: hay que probarlas con cuidado.

## Funciones que ya incluye

1. **Dirección**: facturas emitidas por mes (brutas), facturas pendientes históricas, pagos pendientes de la colección histórica, cartera y movimientos registrados en caja; tendencia de seis meses y enlaces al editor existente en Cobros.
2. **Flujo**: horizonte 7, 15, 30, 60 o 90 días, saldo inicial editable localmente, proyección por vencimiento, alertas de vencidos, desgloses y CSV. La cartera se excluye por defecto para prevenir doble conteo con Cobros y se incluye con una opción explícita.
3. **Cuentas corrientes**: agrupación de facturas por cliente, cobros parciales, saldo y edición en Cobros (sin duplicar documentos).
4. **Rentabilidad**: costos vivos por modelo de pallet, simulación local de precio sin IVA, cantidades, margen unitario y porcentual; CSV.
5. **Auditoría**: alertas de números duplicados por cliente, importes incoherentes, vencimientos o datos obligatorios faltantes; edición en Cobros y exportación CSV.
6. **Respaldos**: exportación JSON bajo demanda de diez rutas conocidas, incluidas configuraciones `config_sii`; no descarga una copia silenciosamente incompleta: verifica lecturas exitosas de todas las rutas.

## Lo que NO está listo para uso contable o productivo

- Estado de resultados contable, rentabilidad real por cliente o venta: hoy no existe un vínculo entre el renglón facturado y modelo/cantidad de pallet vendido. No se inventan cantidades ni utilidades.
- Conciliación de facturas/cobros con cheques en cartera: actualmente no tienen un identificador común.
- IVA exacto por alícuotas, facturación electrónica o integración con ARCA: las facturas registran un total bruto y el cálculo fiscal histórico estima IVA 21%.
- Histórico de quién hizo cada modificación, roles administrativos o acceso restringido: requiere rediseño de autenticación/reglas y bitácora.
- Restauración automática: bloqueada intencionalmente; requiere copia aislada de Firebase, proceso validado de importación, simulación previa y autenticación de administrador.
- Respaldos del sistema externo de Pagos avanzado o colecciones no conocidas.

**No considerar las cifras de Dirección una liquidación fiscal, bancaría o estado de resultados definitivo.**

## Pruebas antes de aprobar

```bash
npm install
npm test
npm run build
```

1. Abrir la URL `deploy-preview` de Netlify (PR, no producción).
2. Navegar por las pestañas originales y confirmar que su vista y flujo habitual se conservan.
3. Comparar facturación de un mes contra la pestaña FACTURACIÓN actual y contra comprobantes.
4. Probar facturas pagadas, parciales, duplicadas y sin número usando **datos de prueba** o entorno aislado.
5. Simular liquidez sin cartera y luego incluyéndola; confirmar que las alertas de vencimientos tienen sentido.
6. Evaluar costos de cada modelo frente a los ya configurados en PALLETS.
7. Exportar CSV e inspeccionar planilla y sumatorias.
8. Exportar respaldo JSON y verificar cantidad de documentos y lectura de `config_sii`. NO intentar restaurar en producción.
9. Evaluar integración con Pagos avanzado antes de denominar al flujo "completo".
10. Solicitar una base de Firebase de pruebas y definir roles antes de trabajar en escritura automática, conciliación o restauración.

## Criterio de publicación

**No fusionar con `main` hasta aprobar manualmente la vista previa y las pruebas.**
