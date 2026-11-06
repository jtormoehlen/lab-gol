"use strict";

// ------------------------------------------------------------------
// Einstellungen
// ------------------------------------------------------------------
const GROESSEN = { klein: [30, 20], mittel: [50, 30], gross: [80, 50] }; // [Breite, Höhe]
const SPEICHER_CODE = "lab-gol-code";
const ZEITLIMIT_MS = 4000;      // so lange darf das Prüfen der Regel dauern
const MAX_VERLAUF = 200;        // so viele Schritte kann man zurückgehen
const MAX_AUSGABE_ZEICHEN = 4000;

const STANDARD_CODE = `def regel(lebendig, nachbarn):
    # lebendig: True, wenn die Zelle gerade lebt, sonst False
    # nachbarn: Anzahl der lebenden Nachbarzellen (0 bis 8)
    #
    # Gib zurück, ob die Zelle in der nächsten Generation lebt:
    # True = lebt, False = tot

    return lebendig
`;

// ------------------------------------------------------------------
// Zustand
// ------------------------------------------------------------------
const z = {
  breite: 50,
  hoehe: 30,
  zellen: null,        // Uint8Array, 1 = lebendig
  startzellen: null,   // Zustand in Generation 0
  generation: 0,
  verlauf: [],
  tabelle: null,       // tabelle[lebendig][nachbarn] -> true/false
  laeuft: false,
  timer: null,
  rand: "tot",
  zeigeZahlen: false,
  hover: null,         // {x, y}
  zellGroesse: 10,
};

const $ = (id) => document.getElementById(id);
const canvas = $("grid");
const ctx = canvas.getContext("2d");

// ------------------------------------------------------------------
// Grid-Logik
// ------------------------------------------------------------------
function index(x, y) { return y * z.breite + x; }

function neuesGrid(breite, hoehe) {
  z.breite = breite;
  z.hoehe = hoehe;
  z.zellen = new Uint8Array(breite * hoehe);
  setzeGeneration0();
}

function setzeGeneration0() {
  z.generation = 0;
  z.verlauf = [];
  z.startzellen = z.zellen.slice();
}

function istLebendig(x, y) {
  if (z.rand === "torus") {
    x = (x + z.breite) % z.breite;
    y = (y + z.hoehe) % z.hoehe;
  } else if (x < 0 || y < 0 || x >= z.breite || y >= z.hoehe) {
    return 0;
  }
  return z.zellen[index(x, y)];
}

function zaehleNachbarn(x, y) {
  let anzahl = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx !== 0 || dy !== 0) anzahl += istLebendig(x + dx, y + dy);
    }
  }
  return anzahl;
}

function schritt() {
  if (!z.tabelle) return;
  const neu = new Uint8Array(z.zellen.length);
  for (let y = 0; y < z.hoehe; y++) {
    for (let x = 0; x < z.breite; x++) {
      const lebendig = z.zellen[index(x, y)];
      neu[index(x, y)] = z.tabelle[lebendig][zaehleNachbarn(x, y)] ? 1 : 0;
    }
  }
  z.verlauf.push(z.zellen);
  if (z.verlauf.length > MAX_VERLAUF) z.verlauf.shift();
  z.zellen = neu;
  z.generation++;
  zeichne();
}

function schrittZurueck() {
  if (z.verlauf.length === 0) return;
  z.zellen = z.verlauf.pop();
  z.generation--;
  zeichne();
}

// Wird aufgerufen, wenn jemand das Grid von Hand verändert.
function gridVonHandGeaendert() {
  if (z.generation === 0) {
    z.startzellen = z.zellen.slice();
  } else {
    // Ab jetzt gilt der gezeichnete Zustand als neuer Startzustand.
    setzeGeneration0();
  }
}

function setzeMuster(name) {
  const zeilen = MUSTER[name];
  if (!zeilen) return;
  const h = zeilen.length;
  const b = Math.max(...zeilen.map((s) => s.length));
  if (b > z.breite || h > z.hoehe) {
    konsoleLeeren();
    konsoleZeile(`Das Muster „${name}“ ist zu groß für dieses Grid. Wähle eine größere Größe.`, "fehler");
    return;
  }
  z.zellen = new Uint8Array(z.breite * z.hoehe);
  const ox = Math.floor((z.breite - b) / 2);
  const oy = Math.floor((z.hoehe - h) / 2);
  zeilen.forEach((zeile, y) => {
    [...zeile].forEach((c, x) => {
      if (c === "#") z.zellen[index(ox + x, oy + y)] = 1;
    });
  });
  setzeGeneration0();
  zeichne();
}

// ------------------------------------------------------------------
// Zeichnen
// ------------------------------------------------------------------
let farben = {};
function leseFarben() {
  const s = getComputedStyle(document.documentElement);
  for (const name of ["zelle-an", "zelle-aus", "gitter", "zahl", "zahl-an", "hover"]) {
    farben[name] = s.getPropertyValue("--" + name).trim();
  }
}

function passeGroesseAn() {
  const rahmen = $("grid-rahmen");
  const verfuegbarB = rahmen.clientWidth - 2;
  const verfuegbarH = rahmen.clientHeight - 2;
  z.zellGroesse = Math.max(4, Math.floor(Math.min(verfuegbarB / z.breite, verfuegbarH / z.hoehe)));
  const b = z.zellGroesse * z.breite;
  const h = z.zellGroesse * z.hoehe;
  const dpr = window.devicePixelRatio || 1;
  canvas.style.width = b + "px";
  canvas.style.height = h + "px";
  canvas.width = Math.round(b * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  zeichne();
}

function zeichne() {
  const g = z.zellGroesse;
  const b = g * z.breite;
  const h = g * z.hoehe;

  ctx.fillStyle = farben["zelle-aus"];
  ctx.fillRect(0, 0, b, h);

  ctx.fillStyle = farben["zelle-an"];
  for (let y = 0; y < z.hoehe; y++) {
    for (let x = 0; x < z.breite; x++) {
      if (z.zellen[index(x, y)]) ctx.fillRect(x * g, y * g, g, g);
    }
  }

  if (g >= 6) {
    ctx.strokeStyle = farben["gitter"];
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= z.breite; x++) { ctx.moveTo(x * g + 0.5, 0); ctx.lineTo(x * g + 0.5, h); }
    for (let y = 0; y <= z.hoehe; y++) { ctx.moveTo(0, y * g + 0.5); ctx.lineTo(b, y * g + 0.5); }
    ctx.stroke();
  }

  if (z.zeigeZahlen && g >= 12) {
    ctx.font = `${Math.floor(g * 0.6)}px system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < z.hoehe; y++) {
      for (let x = 0; x < z.breite; x++) {
        const n = zaehleNachbarn(x, y);
        const lebendig = z.zellen[index(x, y)];
        if (n === 0 && !lebendig) continue;
        ctx.fillStyle = lebendig ? farben["zahl-an"] : farben["zahl"];
        ctx.fillText(String(n), x * g + g / 2, y * g + g / 2 + 1);
      }
    }
  }

  if (z.hover) {
    ctx.strokeStyle = farben["hover"];
    ctx.lineWidth = 2;
    ctx.strokeRect(z.hover.x * g + 1, z.hover.y * g + 1, g - 2, g - 2);
  }

  $("generation").textContent = z.generation;
  $("lebend").textContent = z.zellen.reduce((a, c) => a + c, 0);
  $("zurueck").disabled = z.verlauf.length === 0;
  zeigeZellInfo();
}

function zeigeZellInfo() {
  const info = $("zell-info");
  if (!z.hover) {
    info.textContent = "Fahre mit der Maus über eine Zelle.";
    return;
  }
  const { x, y } = z.hover;
  const lebendig = z.zellen[index(x, y)];
  const n = zaehleNachbarn(x, y);
  let text = `Zelle (${x} | ${y}): ${lebendig ? "lebendig" : "tot"}, ${n} ${n === 1 ? "Nachbar" : "Nachbarn"}`;
  if (z.tabelle) {
    const danach = z.tabelle[lebendig][n];
    const folge = lebendig
      ? (danach ? "bleibt lebendig" : "stirbt")
      : (danach ? "wird lebendig" : "bleibt tot");
    text += ` → ${folge}`;
  }
  info.textContent = text;
}

// ------------------------------------------------------------------
// Maus / Touch auf dem Grid
// ------------------------------------------------------------------
let malWert = null;

function zelleAusEreignis(e) {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - r.left) / z.zellGroesse);
  const y = Math.floor((e.clientY - r.top) / z.zellGroesse);
  if (x < 0 || y < 0 || x >= z.breite || y >= z.hoehe) return null;
  return { x, y };
}

canvas.addEventListener("pointerdown", (e) => {
  const zelle = zelleAusEreignis(e);
  if (!zelle) return;
  canvas.setPointerCapture(e.pointerId);
  const i = index(zelle.x, zelle.y);
  malWert = z.zellen[i] ? 0 : 1;
  z.zellen[i] = malWert;
  z.hover = zelle;
  zeichne();
});

canvas.addEventListener("pointermove", (e) => {
  const zelle = zelleAusEreignis(e);
  const vorher = z.hover;
  z.hover = zelle;
  if (zelle && malWert !== null) z.zellen[index(zelle.x, zelle.y)] = malWert;
  if (malWert !== null || !vorher || !zelle || vorher.x !== zelle.x || vorher.y !== zelle.y) zeichne();
});

function malenBeenden() {
  if (malWert !== null) {
    malWert = null;
    gridVonHandGeaendert();
    zeichne();
  }
}
canvas.addEventListener("pointerup", malenBeenden);
canvas.addEventListener("pointercancel", malenBeenden);
canvas.addEventListener("pointerleave", () => {
  if (malWert === null) { z.hover = null; zeichne(); }
});

// ------------------------------------------------------------------
// Simulation starten / anhalten
// ------------------------------------------------------------------
function tempoMs() { return 1000 / Number($("tempo").value); }

function starte() {
  if (!z.tabelle || z.laeuft) return;
  z.laeuft = true;
  const takt = () => {
    if (!z.laeuft) return;
    schritt();
    z.timer = setTimeout(takt, tempoMs());
  };
  z.timer = setTimeout(takt, 0);
  aktualisiereKnoepfe();
}

function stoppe() {
  z.laeuft = false;
  clearTimeout(z.timer);
  aktualisiereKnoepfe();
}

function aktualisiereKnoepfe() {
  const start = $("start");
  start.textContent = z.laeuft ? "⏸ Pause" : "▶ Start";
  start.disabled = !z.tabelle;
  $("schritt").disabled = !z.tabelle || z.laeuft;
  $("zurueck").disabled = z.laeuft || z.verlauf.length === 0;
}

$("start").addEventListener("click", () => (z.laeuft ? stoppe() : starte()));
$("schritt").addEventListener("click", () => { stoppe(); schritt(); aktualisiereKnoepfe(); });
$("zurueck").addEventListener("click", () => { stoppe(); schrittZurueck(); aktualisiereKnoepfe(); });
$("reset").addEventListener("click", () => {
  stoppe();
  z.zellen = z.startzellen.slice();
  z.generation = 0;
  z.verlauf = [];
  zeichne();
  aktualisiereKnoepfe();
});
$("leeren").addEventListener("click", () => {
  stoppe();
  z.zellen = new Uint8Array(z.breite * z.hoehe);
  setzeGeneration0();
  zeichne();
  aktualisiereKnoepfe();
});
$("zufall").addEventListener("click", () => {
  stoppe();
  for (let i = 0; i < z.zellen.length; i++) z.zellen[i] = Math.random() < 0.3 ? 1 : 0;
  setzeGeneration0();
  zeichne();
  aktualisiereKnoepfe();
});

const musterAuswahl = $("muster");
for (const name of Object.keys(MUSTER)) {
  const o = document.createElement("option");
  o.value = o.textContent = name;
  musterAuswahl.appendChild(o);
}
musterAuswahl.addEventListener("change", () => {
  if (!musterAuswahl.value) return;
  stoppe();
  setzeMuster(musterAuswahl.value);
  musterAuswahl.value = "";
  aktualisiereKnoepfe();
});

$("groesse").addEventListener("change", (e) => {
  stoppe();
  const [b, h] = GROESSEN[e.target.value];
  neuesGrid(b, h);
  z.hover = null;
  passeGroesseAn();
  aktualisiereKnoepfe();
});

$("rand").addEventListener("change", (e) => { z.rand = e.target.value; zeichne(); });
$("zahlen").addEventListener("change", (e) => { z.zeigeZahlen = e.target.checked; zeichne(); });

$("tempo").addEventListener("input", () => {
  if (z.laeuft) { clearTimeout(z.timer); stoppe(); starte(); }
});

// ------------------------------------------------------------------
// Code-Editor
// ------------------------------------------------------------------
function ladeGespeichertenCode() {
  try { return localStorage.getItem(SPEICHER_CODE) || STANDARD_CODE; }
  catch { return STANDARD_CODE; }
}

const editor = CodeMirror($("editor"), {
  value: ladeGespeichertenCode(),
  mode: "python",
  lineNumbers: true,
  indentUnit: 4,
  tabSize: 4,
  indentWithTabs: false,
  matchBrackets: true,
  extraKeys: {
    "Ctrl-Enter": () => regelUebernehmen(),
    "Cmd-Enter": () => regelUebernehmen(),
    Tab: (cm) => cm.somethingSelected() ? cm.indentSelection("add") : cm.replaceSelection("    "),
    "Shift-Tab": (cm) => cm.indentSelection("subtract"),
  },
});

let fehlerZeile = null;
function markiereFehlerzeile(zeile) {
  if (fehlerZeile !== null) editor.removeLineClass(fehlerZeile, "background", "fehlerzeile");
  fehlerZeile = null;
  if (zeile) {
    fehlerZeile = editor.getLineHandle(zeile - 1);
    if (fehlerZeile) editor.addLineClass(fehlerZeile, "background", "fehlerzeile");
  }
}

let speicherTimer = null;
editor.on("change", () => {
  markiereFehlerzeile(null);
  clearTimeout(speicherTimer);
  speicherTimer = setTimeout(() => {
    try { localStorage.setItem(SPEICHER_CODE, editor.getValue()); } catch { /* egal */ }
  }, 300);
});

$("speichern").addEventListener("click", () => {
  const blob = new Blob([editor.getValue()], { type: "text/x-python" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "regel.py";
  a.click();
  URL.revokeObjectURL(a.href);
});

$("oeffnen").addEventListener("click", () => $("datei-eingabe").click());
$("datei-eingabe").addEventListener("change", async (e) => {
  const datei = e.target.files[0];
  if (!datei) return;
  editor.setValue(await datei.text());
  e.target.value = "";
  regelUebernehmen();
});

// ------------------------------------------------------------------
// Konsole
// ------------------------------------------------------------------
const konsole = $("konsole");
function konsoleLeeren() { konsole.textContent = ""; }
function konsoleZeile(text, klasse) {
  const div = document.createElement("div");
  if (klasse) div.className = klasse;
  div.textContent = text;
  konsole.appendChild(div);
  konsole.scrollTop = konsole.scrollHeight;
}

function zeigeAusgaben(ausgaben) {
  let gesamt = 0;
  for (const [wer, text] of ausgaben || []) {
    if (gesamt > MAX_AUSGABE_ZEICHEN) {
      konsoleZeile("… (weitere Ausgaben ausgeblendet)", "leise");
      return;
    }
    gesamt += text.length;
    if (wer) konsoleZeile(`Ausgabe bei ${wer}:`, "print-kopf");
    konsoleZeile(text.replace(/\n$/, ""));
  }
}

// ------------------------------------------------------------------
// Regeltabelle
// ------------------------------------------------------------------
function zeigeTabelle(tabelle) {
  for (const reihe of document.querySelectorAll("#tabelle tbody tr")) {
    const lebendig = Number(reihe.dataset.lebendig);
    reihe.querySelectorAll("td").forEach((td) => td.remove());
    for (let n = 0; n <= 8; n++) {
      const td = document.createElement("td");
      if (tabelle) {
        const an = tabelle[lebendig][n];
        td.className = an ? "an" : "aus";
        td.title = `${lebendig ? "Lebende" : "Tote"} Zelle mit ${n} Nachbarn → ${an ? "lebt" : "tot"}`;
      } else {
        td.className = "leer";
      }
      reihe.appendChild(td);
    }
  }
}

// ------------------------------------------------------------------
// Python (Pyodide im Web Worker)
// ------------------------------------------------------------------
let worker = null;
let workerBereit = false;
let wartendeAnfrage = false;
let aktuellerAuftrag = null; // {id, timeout}
let auftragZaehler = 0;
let neustart = false;

function starteWorker() {
  worker = new Worker("worker.js");
  workerBereit = false;
  worker.onmessage = (e) => {
    const d = e.data;
    if (d.typ === "bereit") {
      workerBereit = true;
      $("uebernehmen").disabled = false;
      if (neustart) {
        neustart = false;
        konsoleZeile("✓ Python ist wieder bereit. Korrigiere deine Regel und übernimm sie erneut.", "ok");
      }
      if (wartendeAnfrage) {
        wartendeAnfrage = false;
        regelUebernehmen();
      }
    } else if (d.typ === "ladefehler") {
      konsoleLeeren();
      konsoleZeile("Python konnte nicht geladen werden. Besteht eine Internetverbindung?", "fehler");
      konsoleZeile(d.text, "leise");
    } else if (d.typ === "ergebnis" && aktuellerAuftrag && d.id === aktuellerAuftrag.id) {
      clearTimeout(aktuellerAuftrag.timeout);
      aktuellerAuftrag = null;
      $("uebernehmen").disabled = false;
      verarbeiteErgebnis(d.ergebnis);
    }
  };
}

function regelUebernehmen() {
  if (!workerBereit) {
    wartendeAnfrage = true;
    konsoleLeeren();
    konsoleZeile("Python wird geladen …", "leise");
    return;
  }
  if (aktuellerAuftrag) return;
  markiereFehlerzeile(null);
  konsoleLeeren();
  konsoleZeile("Regel wird geprüft …", "leise");
  $("uebernehmen").disabled = true;

  const id = ++auftragZaehler;
  const timeout = setTimeout(() => {
    // Die Regel braucht zu lange – vermutlich eine Endlosschleife.
    worker.terminate();
    aktuellerAuftrag = null;
    setzeRegel(null);
    konsoleLeeren();
    konsoleZeile("Fehler: Deine Regel läuft zu lange.", "fehler");
    konsoleZeile("Vielleicht gibt es eine Endlosschleife (while …)?", "hinweis");
    konsoleZeile("Python wird neu gestartet …", "leise");
    $("uebernehmen").disabled = true;
    neustart = true;
    starteWorker();
  }, ZEITLIMIT_MS);
  aktuellerAuftrag = { id, timeout };
  worker.postMessage({ typ: "regel", id, code: editor.getValue() });
}

function verarbeiteErgebnis(erg) {
  konsoleLeeren();
  if (erg.ok) {
    setzeRegel(erg.tabelle);
    konsoleZeile("✓ Regel übernommen.", "ok");
    zeigeAusgaben(erg.ausgaben);
  } else {
    stoppe();
    setzeRegel(null);
    zeigeAusgaben(erg.ausgaben);
    let kopf = `Fehler: ${erg.art}`;
    if (erg.zeile) kopf += ` in Zeile ${erg.zeile}`;
    if (erg.aufruf) kopf += ` (beim Aufruf ${erg.aufruf})`;
    konsoleZeile(kopf, "fehler");
    if (erg.meldung) konsoleZeile(erg.meldung);
    if (erg.hinweis) konsoleZeile("Tipp: " + erg.hinweis, "hinweis");
    markiereFehlerzeile(erg.zeile);
  }
}

function setzeRegel(tabelle) {
  z.tabelle = tabelle;
  if (!tabelle) stoppe();
  zeigeTabelle(tabelle);
  aktualisiereKnoepfe();
  zeichne();
}

$("uebernehmen").addEventListener("click", regelUebernehmen);

// ------------------------------------------------------------------
// Hilfe
// ------------------------------------------------------------------
$("hilfe-knopf").addEventListener("click", () => $("hilfe").showModal());

// ------------------------------------------------------------------
// Start
// ------------------------------------------------------------------
leseFarben();
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { leseFarben(); zeichne(); });
neuesGrid(...GROESSEN.mittel);
setzeMuster("Gleiter");
zeigeTabelle(null);
new ResizeObserver(passeGroesseAn).observe($("grid-rahmen"));
passeGroesseAn();
starteWorker();
wartendeAnfrage = true;
konsoleZeile("Python wird geladen …", "leise");
