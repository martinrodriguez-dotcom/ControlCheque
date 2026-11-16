# PRUEBA: Nueva pestaña PRESUPUESTOS PDF

Implementación aislada en `feature/presupuestos-pdf-sii-20261116`. No fusionar con `main` sin la confirmación del usuario.

## Alcance
- Pestaña nueva PRESUPUESTOS en ControlCheque. La pantalla Presupuestar existente dentro de PALLETS se mantiene sin cambios.
- PDF A4 con bordes, encabezado de emisor y cliente, documento ORIGINAL, número, fecha, ítems, cantidades, bultos, precios y totales.
- Logo actual basado exclusivamente en la imagen aportada por el usuario, exportado a formato optimizado para incorporación al PDF; sin redibujar ni reinterpretar.
- **Cuenta 1**: subtotal e IVA 21 %. **Cuenta 2**: subtotal únicamente.
- **Compartir PDF**: Web Share API con archivo adjunto cuando esté soportado (incluye elegir WhatsApp o correo). En otros dispositivos: descarga y adjuntar manualmente.
- Numeración editable, con correlativo auxiliar almacenado localmente por navegador (no global ni fiscal).
- Sin altas de colecciones, cambios en Firebase, reglas de seguridad o escrituras de presupuestos. No altera funciones existentes.

## Verificación manual antes de usarlo con clientes
1. Confirmar que los datos permanentes copiados del modelo físico sean exactos: razón social, dirección, CUIT y teléfono.
2. Ingresar un cliente y dos ítems con precio y cantidad. Cambiar Cuenta 1 a Cuenta 2: el IVA debe pasar a cero.
3. Descargar PDF e inspeccionar una página A4, acentos, el logo nuevo, precios y subtotal.
4. Probar varios productos que requieran una segunda página.
5. Abrir desde iPhone/Android y comprobar descargas, compartir archivo adjunto en WhatsApp y correo.
6. En navegador sin soporte de archivos compartidos, comprobar la descarga y el aviso para adjuntar manualmente.
7. Si se usará en más de un dispositivo, diseñar correlativo centralizado con control de permisos para evitar duplicados.

## Publicación de prueba
Se solicitó una Deploy Preview del PR #7 de Netlify, sin fusionar a `main`.
