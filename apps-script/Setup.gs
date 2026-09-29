/* ============================================================
   Cámara Lucciano's — Setup.gs

   Se corre UNA SOLA VEZ (o cada vez que hace falta agregar algo)
   desde el editor de Apps Script, eligiendo la función en el
   desplegable de arriba y tocando "Ejecutar". Ver apps-script/README.md
   para el orden exacto de pasos.

   1. crearHojas()            → crea las 7 hojas con los encabezados
                                 exactos que espera Code.gs (no pisa
                                 hojas que ya existan).
   2. poblarSaboresYLocales()  → carga los 47 sabores y los 122 locales
                                 (mismos datos que estaban hardcodeados
                                 en index.html). Seguro de re-correr:
                                 si ya hay filas, no duplica.
   3. crearPrimerAdmin()      → da de alta a Gabi como admin, SIN PIN
                                 todavía (lo crea él mismo la primera
                                 vez que entra a la app). Solo hace
                                 falta correrla una vez.
=============================================================== */

const HOJAS = {
  Registros: ["id", "clienteId", "tipo", "local", "empleadoId", "empleado", "items", "total", "remito", "ts", "anulado_por", "anulado_ts", "motivo"],
  Stock: ["local", "base", "ts", "empleado"],
  Sabores: ["id", "nombre", "tipo", "minimo", "activo", "orden", "categoria", "peso"],
  Locales: ["nombre", "grupo", "activo"],
  Empleados: ["id", "nombre", "rol", "local", "pin_hash", "salt", "activo", "creado_por", "creado_ts", "intentos", "bloqueado_hasta"],
  Config: ["key", "value"],
  Auditoria: ["id", "ts", "accion", "actorId", "actor", "detalle"],
};

function crearHojas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const creadas = [], yaExistian = [];
  Object.keys(HOJAS).forEach((nombre) => {
    let sheet = ss.getSheetByName(nombre);
    if (sheet) { yaExistian.push(nombre); return; }
    sheet = ss.insertSheet(nombre);
    const headers = HOJAS[nombre];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight("bold");
    sheet.setFrozenRows(1);
    creadas.push(nombre);
  });
  // La hoja default "Hoja 1" que trae toda planilla nueva, vacía, se puede borrar.
  const hojaPorDefecto = ss.getSheetByName("Hoja 1") || ss.getSheetByName("Sheet1");
  if (hojaPorDefecto && ss.getSheets().length > 1 && hojaPorDefecto.getLastRow() === 0) {
    ss.deleteSheet(hojaPorDefecto);
  }
  Logger.log("Listo — creadas: %s | ya existían: %s", creadas.join(", ") || "ninguna", yaExistian.join(", ") || "ninguna");
}

// Categoría según el catálogo oficial de Lucciano's Academy
// (js/data/productosHeladeria.js, sacado del manual institucional 2026 —
// ver ese repo si hace falta volver a chequear algo). "Chocolate vegano
// 81%" y "Mascarpone" a secas (sin "con frutos rojos") no están en ese
// catálogo — no son productos reales de la carta, así que quedan
// inactivos por defecto (5° elemento de la tupla, false) en vez de
// borrarlos — así el id no se recicla si algún día vuelven a existir.
// El resto queda con el mejor criterio a mano donde no hay match — ajustable en
// cualquier momento editando la columna "categoria" en la hoja Sabores
// (ver agregarColumnaCategoria()/corregirCategorias() más abajo).
const CATEGORIAS = ["Chocolates", "Cremas", "Frutales", "Dulces de leche"];
const SABORES_INICIALES = [
  [1, "Alfajor de nuez Lucciano's", "v", "Dulces de leche"], [2, "Alfajor Lucciano's", "v", "Dulces de leche"], [3, "Alfajor pistacchio", "v", "Cremas"], [4, "Banana Split", "v", "Cremas"],
  [5, "Cheesecake al pistacchio", "v", "Cremas"], [6, "Chocolate blanco & pistacchio crock", "v", "Cremas"], [7, "Chocolate Dubái", "v", "Chocolates"], [8, "Chocolate Lucciano's", "v", "Chocolates"],
  [9, "Chocolate Lucciano's con bombón de avellanas", "v", "Chocolates"], [10, "Chocolate Platino", "v", "Chocolates"], [11, "Chocolate vegano 81%", "v", "Chocolates", false], [12, "Chocotorta", "v", "Dulces de leche"],
  [13, "Coco rock", "v", "Cremas"], [14, "Cookies", "v", "Cremas"], [15, "Dulce de Leche & bombón de avellanas", "v", "Dulces de leche"], [16, "Dulce de Leche con Brownie", "v", "Dulces de leche"],
  [17, "Dulce de Leche con Dulce de leche", "v", "Dulces de leche"], [18, "Dulce de leche granizado", "v", "Dulces de leche"], [19, "Frambuesa + Avella bianca", "v", "Cremas"], [20, "Frutilla", "v", "Frutales"],
  [21, "Frutilla a la crema", "v", "Cremas"], [22, "Frutilla con Naranja", "v", "Frutales"], [23, "King bianco", "v", "Cremas"], [24, "King nero", "v", "Cremas"], [25, "Lemon pie", "v", "Cremas"],
  [26, "Limón", "v", "Frutales"], [27, "Mandarina", "v", "Frutales"], [28, "Mango Alphonso", "v", "Frutales"], [29, "Mascarpone", "v", "Cremas", false], [30, "Mascarpone con frutos rojos", "v", "Cremas"],
  [31, "Menta Granizada", "v", "Cremas"], [32, "Mousse de Maracuyá", "v", "Cremas"], [33, "Peanut & caramel", "v", "Cremas"], [34, "Pistacchio", "v", "Cremas"], [35, "Pistacchio vegano", "v", "Frutales"],
  [36, "Pomelo", "v", "Frutales"], [37, "Pretzel", "v", "Cremas"], [38, "Sorbete dark 72%", "v", "Chocolates"], [39, "Sorbete de frutos rojos", "v", "Frutales"], [40, "Súper gianduiotto", "v", "Cremas"],
  [41, "Súper Sabayón", "v", "Cremas"], [42, "Tiramisú", "v", "Cremas"], [43, "Tiramisú al pistacchio", "v", "Cremas"], [44, "Tramontana", "v", "Cremas"], [45, "Vasubeda", "v", "Frutales"],
  [46, "Chantilly", "b", "Cremas"], [47, "Vainilla", "b", "Cremas"],
];

const LOCALES_INICIALES = {
  Propios: ["Agüero CABA", "Aldrey Mar del Plata", "Alem Mar del Plata", "Alto NOA Salta", "Alto Rosario Santa Fe", "Calle Corrientes CABA", "Central Mar del Plata", "Cerro De Las Rosas Córdoba", "Constitucion Mar del Plata", "Distrito Arcos CABA", "Dot CABA", "Galerias Pacifico CABA", "Galerias Salta", "Gallegos Mar del Plata", "Guemes Mar del Plata", "La Imprenta Gran Hotel CABA", "Martinez GBA", "Nordelta Buenos Aires", "Nuevocentro Córdoba", "Obelisco CABA", "Olivos GBA", "Oroño Santa Fe", "Paso Mar del Plata", "Patio Bullrich CABA", "Peatonal Mar del Plata", "Plaza Oeste Buenos Aires", "Posadas Misiones", "Recoleta CABA", "Roma Italia", "San Miguel GBA", "Santa Fe y Parana CABA", "Shopping Abasto 2 CABA", "Shopping Abasto CABA", "Torreon Mar del Plata", "Varese Mar del Plata"],
  Franquicias: ["Adrogué GBA", "Adventure USA", "Alicante España", "Almagro CABA", "American Dream USA", "Arcos del Rosedal CABA", "Av Argentina Neuquén", "Bahia Blanca Buenos Aires", "Bahia Blanca Villa Mitre Buenos Aires", "Bajo Belgrano CABA", "Barcelona España", "Barcelona The Moon España", "Barrio Norte Tucuman", "Baxar Mercado Buenos Aires", "Belgrano C CABA", "Caballito CABA", "Cabildo y Juramento CABA", "Campana Buenos Aires", "Capital Corrientes", "Carilo Buenos Aires", "Carrasco Uruguay", "Caseros GBA", "Castelar Buenos Aires", "Catamarca Catamarca", "Chacras de Coria Mendoza", "Cid Campeador CABA", "Cipolletti Rio Negro", "City Bell Buenos Aires", "Coghlan CABA", "Colegiales CABA", "Devoto CABA", "Distrito T GBA", "General Pico Buenos Aires", "Gral Roca Rio Negro", "Granada España", "Honduras CABA", "Ituzaingo GBA", "La Plata Buenos Aires", "Lanus Buenos Aires", "Las Cañitas CABA", "Las Lomitas Buenos Aires", "Libertador CABA", "Madrid España", "Madryn Chubut", "Mar de las Pampas Buenos Aires", "Málaga I España", "Málaga Uncibay III España", "Nuñez CABA", "Palermo Buenos Aires", "Palermo Chico CABA", "Palmares Mendoza", "Parque Arauco Chile", "Parque Avellaneda Shopping GBA", "Parque Leloir GBA", "Parque Rivadavia CABA", "Paseo de la Costa Neuquén", "Paseo del Angel CABA", "Peatonal Sarmiento Mendoza", "Pilar Buenos Aires", "Pilar II Buenos Aires", "Plaza Houssay CABA", "Pocitos Uruguay", "Puerto Madero CABA", "Puerto Madero Dique CABA", "Punta Carrasco Uruguay", "Punta Carretas Uruguay", "Punta del Este Uruguay", "Quilmes GBA", "Ramos Mejia GBA", "Resistencia Chaco", "Ribera Shopping Santa Fe", "San Fernando Buenos Aires", "San Nicolas Buenos Aires", "San Telmo CABA", "Santa Fe Santa Fe", "Sawgrass USA", "Shopping Mendoza", "Tandil Buenos Aires", "The Florida Mall USA", "Valencia España", "Villa del Parque CABA", "Villa Luro CABA", "Villa Urquiza CABA", "Villa Urquiza II CABA", "Vista Pueblo Buenos Aires", "Weston USA", "Yerba Buena Tucuman"],
};

/** Mínimo por defecto: 6 para vasquetas, 3 para baldes (son más grandes
 *  y salen menos seguido). Gabi puede ajustar cada uno después editando
 *  la columna "minimo" directo en la hoja Sabores. */
function _minimoPorDefecto(tipo) { return tipo === "b" ? 3 : 6; }

function poblarSaboresYLocales() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const hojaSabores = ss.getSheetByName("Sabores");
  if (!hojaSabores) throw new Error("Corré primero crearHojas().");
  const idsExistentes = {};
  _filasComoObjetosLocal(hojaSabores).forEach((f) => { idsExistentes[String(f.id)] = true; });
  let nuevosSabores = 0;
  SABORES_INICIALES.forEach(([id, nombre, tipo, categoria, activo], i) => {
    if (idsExistentes[String(id)]) return;
    const fila = hojaSabores.getLastRow() + 1;
    const valores = [id, nombre, tipo, _minimoPorDefecto(tipo), activo === false ? "NO" : "SI", i + 1, categoria];
    hojaSabores.getRange(fila, 1, 1, valores.length).setValues([valores]);
    nuevosSabores++;
  });

  const hojaLocales = ss.getSheetByName("Locales");
  if (!hojaLocales) throw new Error("Corré primero crearHojas().");
  const nombresExistentes = {};
  _filasComoObjetosLocal(hojaLocales).forEach((f) => { nombresExistentes[String(f.nombre)] = true; });
  let nuevosLocales = 0;
  Object.keys(LOCALES_INICIALES).forEach((grupo) => {
    LOCALES_INICIALES[grupo].forEach((nombre) => {
      if (nombresExistentes[nombre]) return;
      const fila = hojaLocales.getLastRow() + 1;
      hojaLocales.getRange(fila, 1, 1, 3).setValues([[nombre, grupo, "SI"]]);
      nuevosLocales++;
    });
  });

  Logger.log("Listo — %s sabores nuevos, %s locales nuevos (los que ya estaban no se tocaron).", nuevosSabores, nuevosLocales);
}

/** Migración para una hoja Sabores que ya estaba en uso ANTES de que
 *  existiera la columna "categoria" (por ejemplo la de Gabi, cargada con
 *  una versión vieja de poblarSaboresYLocales). Agrega el encabezado si
 *  falta y completa la categoría de cada fila existente según el id,
 *  sin tocar nombre/tipo/mínimo/activo/orden. Segura de re-correr: si la
 *  columna ya existe y ya tiene datos, no pisa nada. */
function agregarColumnaCategoria() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Sabores");
  if (!hoja) throw new Error("No existe la hoja Sabores — corré crearHojas() primero.");

  const categoriaPorId = {};
  SABORES_INICIALES.forEach(([id, , , categoria]) => { categoriaPorId[String(id)] = categoria; });

  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  let colCategoria = headers.indexOf("categoria");
  if (colCategoria === -1) {
    colCategoria = headers.length;
    hoja.getRange(1, colCategoria + 1).setValue("categoria").setFontWeight("bold");
  }
  const colId = headers.indexOf("id");

  let completadas = 0;
  for (let i = 1; i < datos.length; i++) {
    if (!datos[i].some((c) => c !== "")) continue; // fila vacía
    const yaTiene = String(datos[i][colCategoria] || "").trim();
    if (yaTiene) continue;
    const id = String(datos[i][colId]);
    const categoria = categoriaPorId[id] || "Cremas";
    hoja.getRange(i + 1, colCategoria + 1).setValue(categoria);
    completadas++;
  }
  Logger.log("Listo — categoría completada en %s sabores (los que ya la tenían no se tocaron).", completadas);
}

/** Agrega la columna "peso" (kilos promedio por vasqueta/balde de ese
 *  sabor) a la hoja Sabores si todavía no existe, dejando en 0 (=
 *  "no cargado todavía") los sabores que no la tengan. El peso de
 *  cada sabor se carga después uno por uno desde la pestaña Sabores
 *  de la app (lápiz → Editar), no hace falta tocar la planilla a
 *  mano. Segura de re-correr: no pisa un peso ya cargado. */
function agregarColumnaPeso() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Sabores");
  if (!hoja) throw new Error("No existe la hoja Sabores — corré crearHojas() primero.");

  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  let colPeso = headers.indexOf("peso");
  if (colPeso === -1) {
    colPeso = headers.length;
    hoja.getRange(1, colPeso + 1).setValue("peso").setFontWeight("bold");
  }

  let completadas = 0;
  for (let i = 1; i < datos.length; i++) {
    if (!datos[i].some((c) => c !== "")) continue; // fila vacía
    if (datos[i][colPeso] !== "" && datos[i][colPeso] !== undefined) continue;
    hoja.getRange(i + 1, colPeso + 1).setValue(0);
    completadas++;
  }
  Logger.log("Listo — columna peso agregada/completada en %s sabores (en 0 hasta que se cargue el peso real de cada uno).", completadas);
}

/** A diferencia de agregarColumnaCategoria() (que solo completa lo
 *  vacío), esta SOBREESCRIBE la categoría de cada sabor con el valor de
 *  SABORES_INICIALES — para cuando se corrige la propuesta inicial
 *  (como pasó acá: la primera versión tenía mal varios sabores) y hace
 *  falta que la planilla ya cargada se actualice, no solo la que
 *  arranca de cero. No toca nombre/tipo/mínimo/activo/orden, y no toca
 *  ningún sabor que Gabi haya dado de alta a mano (id no está en
 *  SABORES_INICIALES) — esos quedan como estén. */
function corregirCategorias() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Sabores");
  if (!hoja) throw new Error("No existe la hoja Sabores — corré crearHojas() primero.");

  const categoriaPorId = {};
  SABORES_INICIALES.forEach(([id, , , categoria]) => { categoriaPorId[String(id)] = categoria; });

  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const colCategoria = headers.indexOf("categoria");
  if (colCategoria === -1) throw new Error("Falta la columna categoria — corré agregarColumnaCategoria() primero.");
  const colId = headers.indexOf("id");

  let corregidas = 0;
  for (let i = 1; i < datos.length; i++) {
    if (!datos[i].some((c) => c !== "")) continue;
    const id = String(datos[i][colId]);
    const categoria = categoriaPorId[id];
    if (!categoria) continue; // sabor dado de alta a mano, no está en la lista original
    if (String(datos[i][colCategoria] || "").trim() === categoria) continue; // ya está bien
    hoja.getRange(i + 1, colCategoria + 1).setValue(categoria);
    corregidas++;
  }
  Logger.log("Listo — categoría corregida en %s sabores.", corregidas);
}

/** Desactiva (activo=NO) los sabores marcados con `false` en
 *  SABORES_INICIALES — hoy "Chocolate vegano 81%" y "Mascarpone" a
 *  secas, que no son productos reales de la carta (no están en el
 *  catálogo de Lucciano's Academy). No los borra: quedan en la hoja
 *  por si hace falta reactivarlos, simplemente dejan de aparecer en
 *  la app (columna activo=NO). Segura de re-correr. */
function desactivarSaboresInexistentes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Sabores");
  if (!hoja) throw new Error("No existe la hoja Sabores — corré crearHojas() primero.");

  const idsADesactivar = SABORES_INICIALES.filter(([, , , , activo]) => activo === false).map(([id]) => String(id));

  const datos = hoja.getDataRange().getValues();
  const headers = datos[0];
  const colActivo = headers.indexOf("activo");
  const colId = headers.indexOf("id");
  const colNombre = headers.indexOf("nombre");

  let desactivados = [];
  for (let i = 1; i < datos.length; i++) {
    if (!datos[i].some((c) => c !== "")) continue;
    const id = String(datos[i][colId]);
    if (idsADesactivar.indexOf(id) === -1) continue;
    hoja.getRange(i + 1, colActivo + 1).setValue("NO");
    desactivados.push(datos[i][colNombre]);
  }
  Logger.log("Listo — desactivados: %s", desactivados.join(", ") || "ninguno (ya estaban desactivados o no existen en tu hoja)");
}

/** Da de alta a Gabi como el primer admin, sin PIN — lo crea él mismo
 *  la primera vez que entra a la app y elige su usuario. Segura de
 *  re-correr: si "Gabi" ya existe como admin activo, no crea otro. */
function crearPrimerAdmin() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("Empleados");
  if (!hoja) throw new Error("Corré primero crearHojas().");
  const existentes = _filasComoObjetosLocal(hoja);
  const yaEsta = existentes.some((e) => e.rol === "admin" && String(e.activo).toUpperCase() !== "NO");
  if (yaEsta) { Logger.log("Ya hay un admin activo — no se creó ninguno nuevo."); return; }

  let maxId = 0;
  existentes.forEach((e) => { const v = Number(e.id); if (v > maxId) maxId = v; });
  const nuevoId = maxId + 1;
  const fila = hoja.getLastRow() + 1;
  hoja.getRange(fila, 1, 1, 11).setValues([[nuevoId, "Gabi Busquets", "admin", "", "", "", "SI", "Setup.gs", Date.now(), 0, ""]]);
  PropertiesService.getScriptProperties().setProperty("proximoId_Empleados", String(nuevoId + 1));
  Logger.log("Listo — admin creado: Gabi Busquets (id %s). Va a crear su PIN la primera vez que entre a la app.", nuevoId);
}

/** Genera un valor random largo para pegar en Configuración del
 *  proyecto → Propiedades del script → SESSION_SECRET. No lo guarda
 *  solo, porque esa pantalla no es accesible por código — hay que
 *  copiarlo del log y pegarlo a mano (ver README, paso 4). */
function generarSessionSecretSugerido() {
  const bytes = Utilities.getUuid() + Utilities.getUuid() + Utilities.getUuid();
  Logger.log("Pegá esto en Propiedades del script → SESSION_SECRET:\n%s", bytes.replace(/-/g, ""));
}

function _filasComoObjetosLocal(sheet) {
  const datos = sheet.getDataRange().getValues();
  if (datos.length < 2) return [];
  const headers = datos[0];
  return datos.slice(1).filter((fila) => fila.some((c) => c !== "")).map((fila) => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = fila[i]; });
    return obj;
  });
}
