# Cámara Lucciano's

App para registrar las salidas de cámara y los ingresos de vasquetas/baldes por local, controlar el stock diario, pedir por WhatsApp cuando un sabor queda bajo mínimo, y llevar de alta/baja al equipo con login por PIN.

Publicada en GitHub Pages: https://siscap-luccianos.github.io/camara-luccianos/

## Qué hace
- **Login por PIN**: cada persona elige su nombre y entra con un PIN de 4 dígitos (lo crea ella misma la primera vez). Roles: admin, supervisor, encargado, colaborador — cada uno ve y puede hacer lo que le corresponde (ver `CLAUDE.md`).
- **Salida:** se elige el local (o viene fijo en la tablet), se toca la foto de cada sabor una vez por vasqueta/balde.
- **Ingreso:** cantidad numérica por sabor + número de remito.
- **Stock:** stock por local, sabores bajo su mínimo propio en rojo, pedido sugerido según consumo real y días hasta la próxima entrega, con vista previa del mensaje y botón para enviarlo por WhatsApp. Incluye conteo físico.
- **Historial:** quién sacó/ingresó qué y cuándo, filtro por período, y anular un movimiento propio (con ventana de tiempo según el rol).
- **Equipo:** alta/baja de encargados y colaboradores, reset de PIN, según lo que permite cada rol.
- **Cola offline**: si se pierde la conexión, los movimientos quedan guardados en el dispositivo y se mandan solos al volver.

## Archivos
- `index.html`: la app completa (HTML/CSS/JS estático, sin build).
- `fotos/<id>.jpg`: foto de cada sabor (el id es el mismo que en la hoja `Sabores`). Si falta el archivo, se muestra un círculo con las iniciales.
- `apps-script/`: el backend (Google Apps Script + Google Sheets) y las instrucciones de despliegue paso a paso.

## Backend

La app llama por `fetch` a un Web App de Google Apps Script (ver `apps-script/README.md` para desplegarlo). La URL del deploy va pegada en la constante `API_URL`, cerca del principio del `<script>` de `index.html`. Sin esa URL, la app se ve pero avisa que el backend no está conectado y no deja registrar nada.
