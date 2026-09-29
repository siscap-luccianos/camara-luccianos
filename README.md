# Cámara Lucciano's

App para registrar las salidas de cámara y los ingresos de vasquetas por local, controlar el stock diario y alertar cuando un sabor queda con menos de 6 vasquetas.

## Qué hace
- **Salida:** el empleado elige el local, escribe su nombre y toca la foto de cada sabor una vez por vasqueta.
- **Ingreso:** carga la compra semanal con el mismo sistema.
- **Stock:** muestra el stock por local, marca en rojo los sabores bajo 6 vasquetas y sugiere cuánto pedir (7 días de salidas + mínimo). Incluye conteo físico para corregir el stock.
- **Historial:** muestra quién sacó qué y cuándo, más una tabla semanal de salidas por sabor.

## Archivos
- `index.html`: la app completa, con las fotos de los sabores incluidas.
- `fotos/`: fotos de los sabores por número (ver lista en `index.html`, constante `SABORES`).

## Base de datos
La app guarda los datos con la base compartida de los artifacts de claude.ai (`claude.use("db")`).
Fuera de claude.ai, por ejemplo en GitHub Pages, la app se ve pero **no guarda movimientos**. Para usarla fuera de claude.ai hay que conectarla a otra base de datos (por ejemplo Firebase o Supabase).

Colecciones:
- `registros`: `{tipo: salida|ingreso|conteo, local, empleado, items: {idSabor: cantidad}, total, ts}`
- `stock/<local>`: último conteo físico `{local, base, ts, empleado}`
- `config/locales`: `{lista: [...]}`
- `fotos/<idSabor>`: foto cargada desde la app `{img}`
