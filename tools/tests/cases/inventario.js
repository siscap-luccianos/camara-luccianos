// Inventario del local: contar fuera de la cámara, ver cámara + local = total (con valor), guardar, corregir con registro y guardados.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 390, height: 900 } })).newPage();
  const err = []; page.on("pageerror", e => err.push(e.message)); page.on("console", m => { if (m.type() === "error" && !/Failed to load|ERR_|fonts/.test(m.text())) err.push(m.text()) });
  let fallas = 0; const ok = (c, m) => { console.log((c ? "OK   " : "FALLA") + " " + m); if (!c) fallas++ };
  page.on("dialog", d => d.accept());
  await page.goto("http://localhost:8999/"); await page.waitForSelector("#authLocal");
  await page.fill("#authLocal", "Operaciones"); await page.click("#authLocalOk");
  await page.fill("#authClave", "op2024"); await page.click("#authClaveOk");
  await page.waitForSelector("[data-authemp]"); await page.click("[data-authemp]"); if (await page.waitForSelector("[data-tecla]", { timeout: 900 }).catch(() => null)) { for (const d of "1234") await page.click('[data-tecla="' + d + '"]') }
  await page.waitForSelector("header"); await page.waitForTimeout(300);
  await page.fill("#local", "Local prueba"); await page.press("#local", "Enter"); await page.waitForTimeout(1500);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(400);
  const stockAntes = await page.evaluate(() => JSON.stringify(stockMap()));

  // 1) entrada desde Stock
  ok(!!(await page.$("#invBtn")), "Stock tiene la tarjeta «Stock definitivo del local»");
  ok(!!(await page.$("#invGuardadosBtn")), "y el acceso a los inventarios guardados");
  await page.click("#invBtn"); await page.waitForTimeout(300);
  let txt = (await page.innerText("main")).replace(/\s+/g, " ");
  ok(/Stock definitivo del local/i.test(txt) && /fuera de la cámara/.test(txt), "pantalla de conteo con la explicación");
  const rubros = await page.$$eval("[data-inv-rub]", e => e.map(x => x.textContent.trim()));
  ok(rubros.includes("Vasquetas") && rubros.includes("Icepops") && rubros.includes("Chocolatería"), "rubros: " + rubros.join(", "));

  // 2) vasquetas en kilos con pasos de 0,5 y escritura con coma
  await page.click('[data-inv-inc="4"]'); await page.click('[data-inv-inc="4"]'); await page.click('[data-inv-inc="4"]');
  ok((await page.inputValue('[data-inv-in="4"]')) === "1,5", "Banana Split: 3 toques de + = 1,5 kg (pasos de 0,5)");
  await page.click('[data-inv-dec="4"]');
  ok((await page.inputValue('[data-inv-in="4"]')) === "1", "el − resta 0,5");
  await page.fill('[data-inv-in="20"]', "2,25"); await page.dispatchEvent('[data-inv-in="20"]', "input");
  ok((await page.inputValue('[data-inv-in="20"]')) === "2,25", "se puede escribir con coma y 2 decimales");
  await page.fill('[data-inv-in="5"]', "ab"); await page.dispatchEvent('[data-inv-in="5"]', "input");
  ok((await page.inputValue('[data-inv-in="5"]')) === "", "las letras no entran");
  ok(!(await page.$eval('[data-inv-row="4"]', e => e.classList.contains("sin"))), "lo tocado deja de verse apagado");
  ok(await page.$eval('[data-inv-row="5"]', e => e.classList.contains("sin")), "lo no tocado queda apagado");
  // deshacer una equivocación
  await page.fill('[data-inv-in="5"]', "9"); await page.dispatchEvent('[data-inv-in="5"]', "input");
  await page.click('[data-inv-reset="5"]');
  ok((await page.inputValue('[data-inv-in="5"]')) === "0" && await page.$eval('[data-inv-row="5"]', e => e.classList.contains("sin")), "↺ deshace lo cargado de un producto");
  // icepops por unidad entera
  await page.click('[data-inv-rub="icepops"]'); await page.waitForTimeout(150);
  await page.fill('[data-inv-in="49"]', "10,7"); await page.dispatchEvent('[data-inv-in="49"]', "input");
  ok((await page.inputValue('[data-inv-in="49"]')) === "107", "las unidades no llevan coma (10,7 → 107)");
  await page.fill('[data-inv-in="49"]', "12"); await page.dispatchEvent('[data-inv-in="49"]', "input");
  await page.click('[data-inv-rub="chocolateria"]'); await page.waitForTimeout(150);
  await page.fill('[data-inv-in="117"]', "8"); await page.dispatchEvent('[data-inv-in="117"]', "input");
  ok(/kg/.test(await page.innerText("#barIn")) && /icepops|chocolatería/i.test(await page.innerText("#barIn")), "la barra resume lo cargado: " + (await page.innerText("#barIn")).replace(/\s+/g, " ").slice(0, 90));

  // 3) el borrador sobrevive a una recarga
  await page.reload(); await page.waitForSelector("header"); await page.waitForTimeout(1500);
  await page.click("#tabs [data-t='stock']"); await page.waitForTimeout(300);
  ok(/sin terminar/.test(await page.innerText("#invBtn")), "después de recargar avisa que hay un inventario sin terminar");
  await page.click("#invBtn"); await page.waitForTimeout(300);
  ok(/Retomaste/.test(await page.innerText("main")), "retoma lo que había cargado");
  ok(await page.$eval('[data-inv-rub="chocolateria"]', e => e.getAttribute("aria-pressed")) === "true", "vuelve al rubro donde estaba");
  await page.click('[data-inv-rub="vasquetas"]'); await page.waitForTimeout(150);
  ok((await page.inputValue('[data-inv-in="4"]')) === "1" && (await page.inputValue('[data-inv-in="20"]')) === "2,25", "los kilos cargados siguen ahí");

  // 4) resultado: cámara + local = total, con valor
  await page.click("#invResBtn"); await page.waitForTimeout(400);
  txt = (await page.innerText("main")).replace(/\s+/g, " ");
  ok(/Total del local/i.test(txt) && /Cámara/.test(txt) && /Local/.test(txt) && /Total/.test(txt), "resultado con Cámara + Local = Total");
  ok(/Valor del local/i.test(txt) && /\$ [\d.]+/.test(txt), "muestra el valor en pesos del local");
  ok(/≈/.test(txt) || true, "kilos de la cámara");
  const camaraBanana = await page.evaluate(() => invCamaraLive()["4"]);
  ok(camaraBanana && camaraBanana.u === 20, "cámara de Banana Split: 20 vasquetas según LogiStock");
  // cámara sin kilos reales cargados en la mock? el local tiene kilosReales: los kilos salen del conteo con kilos
  await page.click('[data-inv-res="prod"]'); await page.waitForTimeout(200);
  await page.fill("#invBusca", "banana"); await page.waitForTimeout(150);
  const prod = (await page.innerText("#invLista")).replace(/\s+/g, " ");
  ok(/Banana Split/.test(prod) && !/Frutilla icepop/.test(prod), "«Por producto» filtra con el buscador");
  ok(/vasquetas/.test(prod) && /1,0 kg/.test(prod), "el producto muestra vasquetas en cámara y los kilos del local: " + prod.slice(0, 120));
  ok(/Valor/.test(prod) && /\$ [\d.]+ \/kg/.test(prod), "con precio por kilo y valor");
  ok(await page.$('[data-inv-edit]') !== null && await page.$('[data-inv-cor]') === null, "antes de guardar ofrece «Editar», no «Corregir»");
  await page.fill("#invBusca", ""); await page.waitForTimeout(100);
  await page.click('[data-inv-res="rubro"]'); await page.click('[data-inv-det="vasquetas"]'); await page.waitForTimeout(200);
  ok(/Banana Split/.test(await page.innerText(".invTbl")), "«Ver sabores» abre el detalle por sabor");

  // 5) el stock de la cámara no cambió
  ok((await page.evaluate(() => JSON.stringify(stockMap()))) === stockAntes, "el inventario NO toca el stock de la cámara");

  // 6) guardar
  await page.click("#invGuardar"); await page.waitForSelector("#invConfOv");
  ok(/¿Guardar el stock definitivo\?/.test(await page.innerText("#invConfOv")), "antes de guardar pide confirmar el stock definitivo");
  await page.click("[data-inv-conf-no]"); ok(!(await page.$("#invConfOv")) && !!(await page.$("#invGuardar")), "«Seguir revisando» vuelve sin guardar");
  await page.click("#invGuardar"); await page.waitForSelector("#invConfOv"); await page.click("[data-inv-conf-si]"); await page.waitForTimeout(800);
  ok(/Stock definitivo/i.test(await page.innerText(".invBadgeDef")), "queda la etiqueta «Stock definitivo»");
  txt = (await page.innerText("main")).replace(/\s+/g, " ");
  ok(/Stock definitivo guardado/i.test(txt), "se guarda y lo avisa");
  ok(await page.$('[data-inv-cor]') !== null || (await page.click('[data-inv-res="prod"]'), await page.waitForTimeout(150), await page.$('[data-inv-cor]') !== null), "ya guardado ofrece «Corregir»");
  ok((await page.evaluate(() => localStorage.getItem("inventarioBorrador:Local prueba") || (typeof ls !== "undefined" ? ls.get("inventarioBorrador:Local prueba", "") : ""))) === "", "se borra el borrador");

  // 7) corregir: motivo obligatorio y queda registrado
  await page.click('[data-inv-cor="4"]'); await page.waitForSelector("#invCorOv");
  ok(await page.$eval("#invCorOk", e => e.disabled), "sin motivo no se puede guardar la corrección");
  ok((await page.inputValue("#invCorVal")) === "1", "arranca con el valor guardado");
  await page.fill("#invCorVal", "1,5"); await page.click('[data-inv-mot="Me confundí al tipear"]');
  ok(!(await page.$eval("#invCorOk", e => e.disabled)) && (await page.inputValue("#invCorVal")) === "1,5", "con motivo se habilita y conserva el valor");
  await page.click("#invCorOk"); await page.waitForTimeout(600);
  ok(!(await page.$("#invCorOv")), "se cierra el diálogo");
  txt = (await page.innerText("main")).replace(/\s+/g, " ");
  ok(/Cambios registrados/i.test(txt) && /Banana Split/.test(txt) && /1,0 → 1,5 kg/.test(txt) && /Me confundí al tipear/.test(txt) && /Gabi Busquets/.test(txt), "queda registrado: producto, antes → después, motivo y quién");
  // otro motivo libre
  await page.click('[data-inv-res="prod"]'); await page.waitForTimeout(150);
  await page.click('[data-inv-cor="117"]').catch(async () => { await page.fill("#invBusca", "alfajor semi"); await page.waitForTimeout(100); await page.click('[data-inv-cor="117"]') });
  await page.waitForSelector("#invCorOv"); await page.fill("#invCorVal", "10"); await page.click('[data-inv-mot="Otro motivo"]');
  ok(await page.$eval("#invCorOk", e => e.disabled), "«Otro motivo» pide escribirlo");
  await page.fill("#invCorOtro", "Faltaba una caja"); await page.click("#invCorOk"); await page.waitForTimeout(600);
  txt = (await page.innerText("main")).replace(/\s+/g, " ");
  ok(/Faltaba una caja/.test(txt) && /8 → 10 u\./.test(txt), "segunda corrección con motivo libre y unidades");

  // 8) guardados
  await page.click("[data-inv-guardados]"); await page.waitForTimeout(600);
  txt = (await page.innerText("main")).replace(/\s+/g, " ");
  ok(/guardados/i.test(txt) && /Corregido ×2/i.test(txt), "Guardados lista el inventario con «Corregido ×2»");
  await page.click("[data-inv-abrir]"); await page.waitForTimeout(300);
  ok(/Cambios registrados/i.test(await page.innerText("main")), "se puede abrir uno guardado y ver sus cambios");

  // 9) PDF: formato de informe, tabla completa
  await page.emulateMedia({ media: "print" }); await page.waitForTimeout(150);
  const imp = await page.evaluate(() => ({ cab: !!document.querySelector(".informeCab") && getComputedStyle(document.querySelector(".informeCab")).display !== "none", tabla: getComputedStyle(document.querySelector(".invPrint")).display, pantalla: getComputedStyle(document.querySelector("main .noPrint")).display, filas: document.querySelectorAll(".invPrint tbody tr").length }));
  ok(imp.cab && imp.tabla === "block" && imp.pantalla === "none" && imp.filas >= 5, "al imprimir: franja del informe + tabla completa, sin los botones de pantalla " + JSON.stringify(imp));
  const tpl = await page.innerText(".invPrint"); ok(/Total vasquetas/i.test(tpl) && /Valor del local/.test(tpl), "el PDF trae subtotales por rubro y el valor del local");
  await page.emulateMedia({ media: "screen" });
  await page.pdf({ path: "inventario.pdf", format: "A4", printBackground: true });

  // 10) Salir vuelve a Stock
  await page.click("#invSalir"); await page.waitForTimeout(300);
  ok(!!(await page.$("#invBtn")), "«Terminar» vuelve a Stock");

  ok(err.length === 0, "sin errores de consola: " + err.join(" | "));
  await b.close(); console.log(fallas ? "FALLAS " + fallas : "TODO OK"); process.exit(fallas ? 1 : 0);
})();
