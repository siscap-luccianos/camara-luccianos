// Panel de locales (solo admin): lista, filtros, hoja con interruptores y «Qué hace», alta, baja con confirmación, cambio en varios, grupos
// y legibilidad: el contraste de cada texto se mide en el tema crema y en el dorado.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1100, height: 900 } })).newPage();
  const err = [], posts = [];
  page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts|404/.test(m.text())) err.push(m.text()) });
  page.on("request", q => { if (q.method() === "POST") { try { const j = JSON.parse(q.postData() || "{}"); if (/LocalAdmin|localesAdmin/.test(j.accion || "")) posts.push(j) } catch (e) {} } });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  const abrirTodo = () => page.evaluate(() => { document.querySelectorAll(".laBox details").forEach(d => { d.open = true }) });
  await page.addInitScript(() => localStorage.setItem("idioma", "es"));
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]");
  if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(400);
  const txt = () => page.innerText("#main");

  // --- contraste: cada texto contra el fondo real que tiene detrás ---
  const contraste = async (nombre) => {
    const r = await page.evaluate(() => {
      const num = s => (s.match(/[\d.]+/g) || []).map(Number);
      const mez = (f, b) => { const a = f[3] === undefined ? 1 : f[3]; return [f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a), 1] };
      const lum = c => { const v = c.slice(0, 3).map(x => { x /= 255; return x <= .03928 ? x / 12.92 : Math.pow((x + .055) / 1.055, 2.4) }); return .2126 * v[0] + .7152 * v[1] + .0722 * v[2] };
      const hex = h => { h = h.trim().replace("#", ""); return h.length === 6 ? [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1] : [255, 255, 255, 1] };
      const raizBg = hex(getComputedStyle(document.documentElement).getPropertyValue("--bg"));
      // Posibles fondos de un elemento: con degradé se consideran todos sus colores (se toma el peor caso).
      const fondos = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e), c = num(cs.backgroundColor), gi = cs.backgroundImage;
        if (/gradient/.test(gi)) { const cols = (gi.match(/rgba?\([^)]*\)/g) || []).map(num).filter(x => x.length >= 3 && (x[3] === undefined || x[3] > 0)); if (cols.length) { const base = e.parentElement ? fondos(e.parentElement)[0] : raizBg; return cols.map(x => mez(x, base)) } }
        if (c.length >= 3 && (c[3] === undefined || c[3] > 0)) { if (c[3] === undefined || c[3] >= 1) return [[c[0], c[1], c[2], 1]]; const base = fondos(e.parentElement || document.documentElement)[0]; return [mez(c, base)] } }
        return [raizBg] };
      const raiz = [...document.querySelectorAll(".la, .laBox")];
      const malos = []; let n = 0;
      raiz.forEach(rz => rz.querySelectorAll("*").forEach(el => {
        if (el.hidden || el.closest("[hidden]")) return;
        const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none") return;
        const tieneTexto = [...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim()) || (/INPUT|SELECT/.test(el.tagName) && el.type !== "checkbox" && (el.value || "").trim());
        if (!tieneTexto) return;
        const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
        let ratio = 99; fondos(el).forEach(bg => { const fg = mez(num(cs.color), bg), a = lum(fg), c = lum(bg); ratio = Math.min(ratio, (Math.max(a, c) + .05) / (Math.min(a, c) + .05)) });
        const px = parseFloat(cs.fontSize), grande = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
        n++; if (ratio < (grande ? 3 : 4.5)) malos.push({ t: ((el.textContent || el.value || "").trim()).slice(0, 40), ratio: Math.round(ratio * 100) / 100, cls: el.className })
      }));
      return { n, malos };
    });
    ok(r.n > 10 && r.malos.length === 0, "contraste (" + nombre + "): " + r.n + " textos medidos, " + r.malos.length + " con poco contraste " + JSON.stringify(r.malos.slice(0, 5)));
  };

  // 1) la pestaña existe solo para admin y carga la lista
  ok(await page.$("#tabs [data-t='locales']") !== null, "admin ve la pestaña «Locales» en Operaciones");
  await page.click("#tabs [data-t='locales']"); await page.waitForSelector("[data-la-l]");
  ok((await page.$$("[data-la-l]")).length === 4, "lista los 4 locales activos");
  ok(/4\s*Activos/.test(await txt()) && /1\s*De baja/.test(await txt()), "los contadores dicen Activos 4 y De baja 1");
  ok(await page.$eval("[data-la-l='Torreon Mar del Plata']", e => /Kilos reales/.test(e.innerText) && /Escáner/.test(e.innerText)), "Torreón muestra sus etiquetas (Kilos reales, Escáner)");
  ok(await page.$eval("[data-la-l='Obelisco CABA']", e => /Sin baldes/.test(e.innerText)), "Obelisco muestra «Sin baldes»");
  await contraste("lista, crema");
  ok(await page.$eval("[data-la-l='Obelisco CABA']", e => /3 dispositivos/.test(e.innerText)), "un local con el cupo por defecto (celda vacía) muestra «3 dispositivos» en la lista");
  ok(await page.$eval("[data-la-l='Unicenter']", e => /3 dispositivos/.test(e.innerText)) && await page.$eval("[data-la-l='Torreon Mar del Plata']", e => /3 dispositivos/.test(e.innerText)), "todos los que tienen control de dispositivos muestran su cupo");
  ok(await page.$("main select, #main select") === null || (await page.$$eval("#main .la select", e => e.length)) === 0, "la pantalla no tiene menús desplegables recuadrados (<select>)");
  const ch = await page.evaluate(() => [...document.querySelectorAll(".laChips")].map(c => ({ cortado: c.scrollWidth > c.clientWidth + 1, fuera: [...c.children].some(b => b.getBoundingClientRect().right > window.innerWidth + 1) })));
  ok(ch.length >= 2 && ch.every(c => !c.cortado && !c.fuera), "los filtros se ven completos: ninguno queda cortado ni fuera de la pantalla (" + ch.length + " filas)");
  ok(await page.$("[data-la-pais='Argentina']") !== null && await page.$("[data-la-pais='Marruecos']") !== null, "el país se filtra con botones, uno por país");

  // 2) filtros
  await page.click("[data-la-f='baja']"); await page.waitForTimeout(150);
  ok((await page.$$("[data-la-l]")).length === 1 && /Bllis/.test(await txt()), "«De baja» muestra solo Bllis");
  await page.click("[data-la-f='act']");
  await page.fill("#laQ", "uni"); await page.waitForTimeout(200);
  ok((await page.$$("[data-la-l]")).length === 1 && /Unicenter/.test(await txt()), "el buscador filtra («uni» → Unicenter)");
  await page.fill("#laQ", ""); await page.waitForTimeout(150);
  await page.click("[data-la-of='kilos_reales']"); await page.waitForTimeout(150);
  ok((await page.$$("[data-la-l]")).length === 1, "«Con kilos reales» deja solo a Torreón");
  await page.click("[data-la-of='kilos_reales']"); await page.click("[data-la-f='act']");

  // 2b) mosaicos como los de Control
  const tl = await page.$$eval(".laTile", t => t.map(x => x.innerText.replace(/\s+/g, " ").trim()));
  ok(tl.length === 9 && /^\d+ Todos/.test(tl[0]) && /Activos/.test(tl[1]) && /De baja/.test(tl[2]) && /Propios/.test(tl[3]) && /Franquicias/.test(tl[4]), "los mosaicos van en este orden: Todos, Activos y De baja, Propios y Franquicias: " + tl.slice(0, 5).join(" | "));
  ok(!tl.some(x => /venta del día/i.test(x)) && tl.some(x => /Con escáner/.test(x)) && tl.some(x => /Producen helado/.test(x)), "no hay mosaico de «Venta del día» (está en todos) y sí «Con escáner» y «Producen helado»");
  const par = await page.$$eval(".laTile", t => t.slice(1, 5).map(x => Math.round(x.getBoundingClientRect().top)));
  ok(par[0] === par[1] && par[2] === par[3] && par[2] > par[0], "Activos / De baja y Propios / Franquicias quedan de a dos por fila");
  await page.click("[data-la-f='all']"); await page.waitForTimeout(100);
  ok((await page.$$("[data-la-l]")).length >= 5, "«Todos» incluye también los locales de baja");
  await page.click("[data-la-of='escaner']"); await page.waitForTimeout(120);
  ok((await page.$$("[data-la-l]")).length >= 1 && await page.$eval("[data-la-of='escaner']", e => e.getAttribute("aria-pressed") === "true"), "el mosaico «Con escáner» filtra la lista");
  await page.click("[data-la-of='escaner']"); await page.click("[data-la-f='act']");

  // 3) hoja: interruptores, «Qué hace», cambios y guardado
  await page.click("[data-la-l='Torreon Mar del Plata']"); await page.waitForSelector(".laBox");
  ok((await page.$$eval(".laBox details", d => d.length)) === 4 && (await page.$$eval(".laBox details[open]", d => d.map(x => x.dataset.sec).join())) === "Operación", "la hoja trae 4 secciones y solo Operación abierta (rubros, escáner y producción cerrados)");
  ok(/de 7/.test(await page.$eval("[data-sec='Rubros que lleva'] [data-res]", e => e.textContent)) && /Activo/.test(await page.$eval("[data-sec='Operación'] [data-res]", e => e.textContent)), "cada sección cerrada muestra su resumen sin abrirla");
  await abrirTodo();
  ok(await page.$eval("[data-la-k='kilos_reales']", e => e.checked) && await page.$eval("[data-la-k='escaner']", e => e.checked), "la hoja muestra los interruptores prendidos de Torreón");
  ok(await page.$eval("#ladt-kilos_reales", e => e.hidden), "el «Qué hace» arranca contraído");
  ok((await page.$$eval(".laBox select", e => e.length)) === 0, "la hoja tampoco tiene menús recuadrados: Tipo y País son botones");
  ok(await page.$eval("[data-la-tipo='Propios']", e => e.getAttribute("aria-pressed") === "true"), "el tipo del local aparece marcado");
  ok(await page.$eval("#laCupo", e => !e.hasAttribute("data-off")) && (await page.innerText("#laCupoN")) === "3", "con control de dispositivos prendido se ve «Dispositivos permitidos» (3)");
  await page.click("[data-la-k='control_equipos']"); ok(await page.$eval("#laCupo", e => e.hasAttribute("data-off") && e.offsetHeight > 0) && /solo rige/.test(await page.innerText("#laCupoSub")), "si se apaga el control, el cupo sigue visible (atenuado) y se puede cambiar, con la aclaración de que solo rige prendido");
  await page.click("[data-la-k='control_equipos']");
  await page.click("[data-la-mas='kilos_reales']");
  ok(!(await page.$eval("#ladt-kilos_reales", e => e.hidden)) && /Conteo con kilos/.test(await page.innerText("#ladt-kilos_reales")), "«Qué hace» se despliega y explica la recomendación");
  await page.click("[data-la-todo]");
  ok((await page.$$eval(".laDt", e => e.filter(x => !x.hidden).length)) >= 16, "«Desplegar todos los detalles» abre todas las explicaciones");
  await contraste("hoja con todo desplegado, crema");
  await page.click("[data-la-todo]");
  await page.click("[data-la-k='escaner']");
  ok(/Vas a cambiar: Escáner: NO/.test(await page.innerText("#laCam")), "antes de guardar avisa qué va a cambiar");
  posts.length = 0; await page.click("[data-la-guardar]"); await page.waitForTimeout(700);
  const pg = posts.find(p => p.accion === "guardarLocalAdmin");
  ok(pg && pg.local === "Torreon Mar del Plata" && pg.opciones.escaner_salida === false && pg.opciones.escaner_conteo === false && pg.opciones.sin_escaner === true && !("escaner" in pg.opciones) && Object.keys(pg.opciones).length === 3, "manda solo lo que cambió: " + JSON.stringify(pg && pg.opciones));
  ok(await page.$(".laBox") === null && posts.some(p => p.accion === "localesAdmin") && (await page.$("[data-la-l='Torreon Mar del Plata']")) !== null, "se cierra y la lista se vuelve a pedir al servidor");

  // 3b) cupo de dispositivos (de 1 a 20)
  await page.click("[data-la-l='Torreon Mar del Plata']"); await page.waitForSelector("#laCupoN");
  await page.click("[data-la-cupo='1']"); await page.click("[data-la-cupo='1']");
  ok((await page.innerText("#laCupoN")) === "5" && /Dispositivos permitidos: 5/.test(await page.innerText("#laCam")), "el cupo sube de a 1 y el resumen lo muestra");
  for (let i = 0; i < 20; i++) await page.click("[data-la-cupo='1']");
  ok((await page.innerText("#laCupoN")) === "20", "el cupo se frena en 20");
  for (let i = 0; i < 25; i++) await page.click("[data-la-cupo='-1']");
  ok((await page.innerText("#laCupoN")) === "1", "y en 1 hacia abajo");
  for (let i = 0; i < 4; i++) await page.click("[data-la-cupo='1']");
  posts.length = 0; await page.click("[data-la-guardar]"); await page.waitForTimeout(700);
  const pc = posts.find(p => p.accion === "guardarLocalAdmin");
  ok(pc && pc.maxEquipos === 5, "guarda el cupo (5): " + JSON.stringify(pc && pc.maxEquipos));
  ok(/5 dispositivos/.test(await page.innerText("[data-la-l='Torreon Mar del Plata']")), "la lista muestra la etiqueta «5 dispositivos»");

  // 3c) rubros que produce el local
  ok(await page.$eval("[data-la-l='Unicenter']", e => /Produce vasquetas/.test(e.innerText)) && await page.$eval("[data-la-l='Marruecos']", e => /Produce vasquetas, icepops/.test(e.innerText)), "la lista dice qué rubros produce cada local (Unicenter: vasquetas; Marruecos: vasquetas, icepops)");
  await page.click("[data-la-l='Unicenter']"); await page.waitForSelector(".laBox"); await abrirTodo();
  ok((await page.$eval("[data-sec='Producción'] [data-res]", e => e.textContent)) === "Produce vasquetas", "la sección Producción cerrada resume qué produce");
  ok(await page.$eval("[data-la-k='produce_vasquetas']", e => e.checked) && !(await page.$eval("[data-la-k='produce_icepops']", e => e.checked)), "la hoja muestra un interruptor por rubro que produce");
  await page.click("[data-la-k='produce_icepops']");
  ok(/Produce icepops: SÍ/.test(await page.innerText("#laCam")) && /Produce vasquetas, icepops/.test(await page.$eval("[data-sec='Producción'] [data-res]", e => e.textContent)), "prender un rubro lo muestra en el resumen de cambios y de la sección");
  posts.length = 0; await page.click("[data-la-guardar]"); await page.waitForTimeout(700);
  const pp = posts.find(p => p.accion === "guardarLocalAdmin");
  ok(pp && pp.local === "Unicenter" && pp.opciones.produce_icepops === true && Object.keys(pp.opciones).length === 1, "manda solo el rubro que cambió: " + JSON.stringify(pp && pp.opciones));

  // 4) alta de un local nuevo
  await page.click("[data-la-nuevo]"); await page.waitForSelector("#laN");
  await page.fill("#laN", "Palermo CABA"); await page.fill("#laR", "CABA");
  posts.length = 0; await page.click("[data-la-guardar]"); await page.waitForTimeout(800);
  ok(posts.some(p => p.accion === "crearLocalAdmin" && p.nombre === "Palermo CABA") && (await page.$("[data-la-l='Palermo CABA']")) !== null, "el local nuevo se crea y aparece en la lista");
  await page.click("[data-la-nuevo]"); await page.waitForSelector("#laN"); await page.fill("#laN", "palermo caba");
  await page.click("[data-la-guardar]"); await page.waitForTimeout(500);
  ok(/Ya existe/.test(await page.innerText("#laErr")) && await page.$(".laBox") !== null, "un nombre repetido avisa y no cierra la hoja");
  await page.click("[data-la-cerrar]");

  // 5) baja con confirmación escribiendo el nombre
  await page.click("[data-la-l='Obelisco CABA']"); await page.waitForSelector(".laBox");
  await page.click("[data-la-baja]");
  ok(!(await page.$eval("#laConf", e => e.hidden)) && await page.$eval("[data-la-baja-ok]", e => e.disabled), "dar de baja pide escribir el nombre y el botón arranca apagado");
  await contraste("hoja con la confirmación de baja, crema");
  await page.fill("#laConfN", "Obelisco"); ok(await page.$eval("[data-la-baja-ok]", e => e.disabled), "con el nombre incompleto sigue apagado");
  await page.fill("#laConfN", "obelisco caba");
  ok(!(await page.$eval("[data-la-baja-ok]", e => e.disabled)), "con el nombre completo se habilita");
  posts.length = 0; await page.click("[data-la-baja-ok]"); await page.waitForTimeout(700);
  ok(posts.some(p => p.accion === "guardarLocalAdmin" && p.local === "Obelisco CABA" && p.opciones.activo === false), "manda activo=false (baja)");
  await page.click("[data-la-f='baja']"); await page.waitForTimeout(150);
  ok(await page.$("[data-la-l='Obelisco CABA']") !== null, "el local dado de baja aparece en «De baja»");
  await page.click("[data-la-f='act']");

  // 6) cambiar una opción en varios
  await page.check("[data-la-ck='Unicenter']"); await page.check("[data-la-ck='Marruecos']"); await page.waitForTimeout(150);
  ok(/2 marcados/.test(await page.innerText(".laBarra")), "la barra dice «2 marcados»");
  await page.click("[data-la-masivo]"); await page.waitForSelector("[data-la-m]");
  ok((await page.$$eval(".laBox details[open]", d => d.map(x => x.dataset.sec).join())) === "Operación" && (await page.$$eval(".laChs span", x => x.length)) === 2, "el cambio masivo arranca con solo Operación abierta y lista los 2 locales marcados");
  await abrirTodo();
  ok(await page.$eval("[data-la-ok]", e => e.disabled), "sin elegir ningún cambio, «Aplicar» está apagado");
  await page.click("[data-la-m='kilos_reales'][data-v='1']"); await page.click("[data-la-m='escaner'][data-v='1']"); await page.click("[data-la-m='lleva_baldes'][data-v='0']");
  ok(/Cambia 3 opciones en 2 de 2 locales/.test(await page.innerText("#laMres")), "se pueden elegir varias opciones juntas y avisa cuántas cambian: " + (await page.innerText("#laMres")));
  await contraste("cambio en varios, crema");
  await page.click("[data-la-mc='+']");
  ok(/Cambia 4 opciones/.test(await page.innerText("#laMres")), "elegir un cupo de dispositivos suma una opción al resumen: " + (await page.innerText("#laMres")));
  await page.click("[data-la-mc='x']");
  ok(/Cambia 3 opciones/.test(await page.innerText("#laMres")), "«No cambiar» en el cupo la saca del resumen");
  await page.click("[data-la-mc='+']"); await page.click("[data-la-mc='+']");
  await page.click("[data-la-m='activo'][data-v='0']");
  ok(await page.$eval("[data-la-ok]", e => e.disabled) && await page.$("#laMconf") !== null, "elegir «baja» pide confirmar y apaga «Aplicar» hasta marcarlo");
  await contraste("cambio en varios con baja, crema");
  await page.click("[data-la-m='activo'][data-v='']");
  ok(await page.$("#laMconf") === null && !(await page.$eval("[data-la-ok]", e => e.disabled)), "al volver a «No cambiar» la confirmación desaparece");
  posts.length = 0; await page.click("[data-la-ok]"); await page.waitForTimeout(800);
  const pm = posts.find(p => p.accion === "localesAdminMasivo");
  ok(pm && pm.locales.length === 2 && pm.opciones.kilos_reales === true && pm.opciones.escaner_salida === true && pm.opciones.escaner_conteo === true && pm.opciones.sin_escaner === false && pm.opciones.lleva_baldes === false && !("activo" in pm.opciones) && pm.cupo === 4, "manda las 3 opciones, el cupo (4) y solo a los 2 locales: " + JSON.stringify(pm && pm.opciones));
  ok(await page.$(".laBarra") === null, "la selección se limpia");
  ok(await page.$("#laDeshacer") !== null, "después de aplicar aparece el aviso con «Deshacer»");
  posts.length = 0; await page.click("#laDeshacer"); await page.waitForTimeout(1500);
  const undo = posts.filter(p => p.accion === "localesAdminMasivo");
  ok(undo.length >= 3 && undo.some(p => p.opciones.kilos_reales === false), "«Deshacer» vuelve cada opción a lo que tenía cada local (" + undo.length + " pedidos)");

  // 6b) baja y alta de varios de una vez
  await page.click("[data-la-f='fran']"); await page.waitForTimeout(150);
  await page.check("[data-la-ck='Marruecos']"); await page.click("[data-la-masivo]"); await page.waitForSelector("[data-la-m]");
  await abrirTodo();
  await page.click("[data-la-m='activo'][data-v='0']"); await page.check("#laMconf");
  posts.length = 0; await page.click("[data-la-ok]"); await page.waitForTimeout(800);
  ok(posts.some(p => p.accion === "localesAdminMasivo" && p.opciones.activo === false), "la baja de varios manda activo=false");
  await page.click("[data-la-f='act']"); await page.waitForTimeout(100);

  // 7) grupos (los mismos de Control)
  await page.check("[data-la-ck='Unicenter']");
  await page.click("[data-la-agrupar]"); await page.waitForSelector(".cgHoja");
  ok(/Mover a/.test(await page.innerText(".cgHoja")), "«Agrupar» abre la hoja para elegir o crear un grupo");
  await page.click("[data-no]"); await page.click("[data-la-nada]");
  ok(await page.$("[data-la-gnuevo]") !== null, "hay un botón «+ Grupo» para crear un grupo vacío");

  // 8) tema dorado
  await page.evaluate(() => document.documentElement.setAttribute("data-tema", "dorado")); await page.waitForTimeout(200);
  await contraste("lista, dorado");
  await page.click("[data-la-l='Torreon Mar del Plata']"); await page.waitForSelector(".laBox"); await abrirTodo(); await page.click("[data-la-todo]");
  await contraste("hoja con todo desplegado, dorado");
  await page.click("[data-la-cerrar]");
  await page.evaluate(() => document.documentElement.removeAttribute("data-tema"));

  // 9) un supervisor no ve la pestaña
  await page.evaluate(() => { S.empleado.rol = "supervisor"; renderApp() }); await page.waitForTimeout(200);
  ok(await page.$("#tabs [data-t='locales']") === null, "el supervisor no ve la pestaña «Locales»");

  console.log("errores:", err.length ? err : "ninguno"); await b.close();
  console.log(fallas || err.length ? "FALLAS " + (fallas + err.length) : "FALLAS 0"); process.exit(fallas || err.length ? 1 : 0);
})();
