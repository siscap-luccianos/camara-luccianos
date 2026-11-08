# Conteo físico en LogiStock — guía completa

> Escrita el 08/11/2026 a pedido de Gabi, a partir del código (`stockViewConteo()`, `guardarConteo()`, `conteo()` en `Code.gs`) y de los conteos reales de la planilla de producción. La usa el agente `conteo-fisico`.

## 1. Qué es (y qué NO es)

Un conteo físico es **una foto absoluta del stock**: lo que se guarda **reemplaza** el stock completo del local, no se suma ni se resta.

- Stock en pantalla = **base del último conteo** + ingresos (y cambios recibidos) − salidas **posteriores a ese conteo**.
- Cada vez que se toca «Guardar conteo» nace un nuevo punto cero. Todo lo anterior deja de importar.
- Anular o eliminar un conteo **no revierte el stock** (solo deja constancia). La única forma de corregir es hacer otro conteo.
- Colaborador y gestión sin local no lo hacen: lo cargan Responsable de local, de turno, supervisor y admin.
- Cada sabor que el local no tiene (apagado, otro país, rubro apagado) se guarda en 0.

## 2. Cómo se comporta la pantalla hoy (importante para entender los errores)

1. **Arranca precargada con el stock actual del sistema**, no vacía. Un sabor que nadie toca queda con el número del sistema, o sea que **«se cuenta» sin haberse contado**.
2. «Aplicar a todos» con 0 pone todo en cero antes de empezar (obliga a contar cada sabor).
3. **No hay borrador.** Cada «Guardar» es un conteo completo y definitivo.
4. **No muestra diferencias** antes de guardar: no dice «debía haber 33, contaste 0».
5. La confirmación es solo «¿Guardar el conteo? Reemplaza el stock actual», sin resumen de qué cambia.
6. No hay alerta por saltos grandes (de 33 a 0, de 27 a 251).
7. Vasquetas con `kilos_reales=SI` piden además los kilos totales; chocolatería acepta vencimiento (opcional) por producto.
8. Sin señal el conteo queda en cola y se envía solo; mientras tanto la pantalla ya muestra lo contado.
9. Se pueden usar Enter y flechas ↑↓ para pasar de campo; el botón «+1 caja» suma la caja maestra.

## 3. Errores que se ven en los datos (planilla de producción)

- **Conteos en ráfaga como si fueran un borrador.** Recoleta, 4/11/2026: 12 conteos seguidos de la misma persona en unas 3 horas. Entre uno y otro cambian 1 a 4 sabores (145: 13→37; 121: 170→410; 74: 710→1230…). Se está usando «Guardar» para guardar avance, y cada vez se reemplaza el stock entero. Lo mismo se ve en Unicenter (4 seguidos), Santa Rosa (4 seguidos al final), Obelisco y Patio Bullrich (3 seguidos).
- **El último guardado puede romper lo que estaba bien.** El último conteo de Recoleta (id 1341) dejó los Icepops 49, 50 y 51 en 0 (venían en 33, 38 y 33 en los 11 anteriores) y la Multifruta (48) pasó de 27 a 251: típico de un número tipeado en la fila equivocada. Como no hay diferencias a la vista, nadie lo notó hasta que el stock «no cuadró».
- **Arrastre del número viejo.** Un sabor sin tocar conserva el número del sistema y parece contado.
- **Conteo con la cámara en movimiento.** Si alguien hace salidas mientras otro cuenta, el conteo se guarda con un número que ya cambió y esas salidas se descuentan de nuevo (o no): queda un faltante o un sobrante fantasma.
- **Conteo para «corregir» un movimiento.** Se hace un conteo parcial pensando que arregla un sabor y se pisa todo el local.
- **Anular un conteo creyendo que revierte.** No revierte.
- **Mezclar unidades.** Caja master vs unidades sueltas (chocolatería, Icepops), Geladot por caja, Mini Icepops por caja x4, kilos de vasquetas vs cantidad de vasquetas.

## 4. Protocolo recomendado (lo que hay que enseñar)

**Antes**
1. Elegir el momento: sin ventas ni movimientos en cámara (apertura o cierre). Si hay que contar con el local abierto, que nadie más saque helado mientras tanto.
2. Cargar antes todo lo pendiente (ingresos del día, devoluciones, desperdicios) para que el sistema esté al día.
3. Una sola persona carga; otra puede cantar los números. Una sola vez, de punta a punta.

**Durante**
4. Si se recuenta todo: «Aplicar a todos» = 0 primero, así ningún sabor queda sin contar.
5. Ir **por rubro y en el orden físico de la cámara**: vasquetas → baldes → Icepops → Gluten Free → chocolatería… Usar las pestañas de la app.
6. Contar con las manos y escribir el número, no «más o menos». Cajas cerradas con «+1 caja» y sueltas a mano.
7. Un sabor que realmente no hay se deja en 0 a propósito, no por olvido.
8. Vasquetas con kilos reales: pesar o ingresar los kilos totales del sabor.

**Antes de guardar**
9. Repasar de arriba abajo lo cargado. Mirar especialmente los ceros y los números fuera de lo normal.
10. **Guardar una sola vez**, no a mitad de camino.

**Después**
11. Revisar Stock: que lo que se ve coincida con lo que hay. Si algo no cierra, **recontar solo ese sabor y hacer otro conteo**, no anular.
12. El Responsable de local (o el supervisor) confirma que se hizo el conteo.

**Frecuencia sugerida:** conteo completo de helado al menos 1 vez por semana; chocolatería, una vez por mes si no usa Venta del día.

## 5. Cómo diagnosticar un conteo dudoso (método)

1. Leer la fila del local en `Stock` y los conteos del local en `Registros` (`tipo=conteo`, columna `items`, `ts`, `empleado`).
2. Comparar cada conteo con el anterior: qué sabores cambian y cuánto.
3. Marcar señales: (a) sabor con stock previo >0 que pasa a 0; (b) salto >3× o <⅓; (c) varios conteos del mismo empleado en <24 h; (d) conteo con salidas del local en los 10 minutos anteriores o posteriores; (e) rubros enteros en 0; (f) conteo de un sabor «inexistente» (apagado o fuera de país).
4. Calcular el stock esperado = base anterior + ingresos − salidas hasta el conteo, y compararlo con lo contado: diferencia por sabor.
5. Informar causa probable con evidencia (ids de registros, valores antes/después). **No corregir la planilla sin confirmación y sin números confiables.** Corrección permitida: editar `Stock.base` + fila en `Auditoria` (`ajuste_stock_planilla`). Lo ideal sigue siendo un nuevo conteo hecho por el local.

## 6. Mejoras propuestas para la app (todas necesitan mock antes de construir)

> **Estado 08/11/2026:** las mejoras 1 a 4 de esta lista (resumen antes de guardar, alerta de saltos con confirmación, borrador automático y marca de «sin contar») ya están construidas en `/pruebas/` (front 1.132.0). El conteo parcial por rubro (5) queda pendiente.

Ordenadas por impacto y esfuerzo:

1. **Resumen de cambios antes de guardar** (solo front): «Cambia 18 sabores · 6 quedan en 0 · 2 suben más del triple», con la lista y color rojo en los saltos raros. Evita el error de Recoleta.
2. **Alerta de saltos**: pedir un toque de confirmación explícito cuando un sabor con stock pasa a 0 o cambia más de 3×.
3. **Borrador automático**: el conteo en curso se guarda en el equipo (no en el servidor) y se retoma; un único «Guardar» final. Elimina las ráfagas.
4. **Marcar lo no contado**: sabores sin tocar en gris/«sin contar»; el botón final avisa «Faltan N sin contar». Elimina el arrastre del número viejo.
5. **Conteo parcial por rubro**: elegir «Solo Icepops» y que reemplace solo ese rubro, sin tocar el resto (requiere cambio en `conteo()` y registro del alcance).
6. **Diferencia «debería haber / contaste»** por sabor (ya está en la lista «míos si los pide»), con total de unidades y kilos de diferencia.
7. **Modo guiado**: de a un rubro, de a una subcategoría, con la foto grande y teclado numérico (más rápido y con menos errores en tablet).
8. **Bloqueo por actividad**: avisar si hay movimientos de otros dispositivos en los últimos minutos, o bloquear salidas mientras se cuenta.
9. **Historial de bases** para poder deshacer un conteo (hoy solo se guarda la última base en `Stock`).
10. **Informe mensual de conteos** por local: quién, cuándo, cuántos guardados, diferencias.
