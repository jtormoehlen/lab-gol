// Führt den Python-Code der SuS mit Pyodide aus.
// Läuft in einem Web Worker, damit eine Endlosschleife die Seite nicht einfriert.
importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");

const PYTHON_KERN = String.raw`
import sys, io, json, inspect, traceback

DATEI = "<deine Regel>"

HINWEISE = {
    "SyntaxError": "Python versteht diese Zeile nicht. Prüfe Doppelpunkte, Klammern und Schreibweise.",
    "IndentationError": "Die Einrückung stimmt nicht. Prüfe die Leerzeichen am Zeilenanfang.",
    "TabError": "Tabs und Leerzeichen sind gemischt. Benutze nur Leerzeichen zum Einrücken.",
    "NameError": "Ein Name ist unbekannt. Vielleicht ein Tippfehler?",
    "UnboundLocalError": "Eine Variable wird benutzt, bevor sie einen Wert bekommen hat.",
    "TypeError": "Ein Wert hat nicht die passende Art (z. B. Zahl und Text gemischt).",
    "ZeroDivisionError": "Es wird durch 0 geteilt.",
    "RecursionError": "Die Funktion ruft sich immer wieder selbst auf.",
}

def _fehler(e, aufruf=None):
    art = type(e).__name__
    zeile = None
    if isinstance(e, SyntaxError) and e.filename == DATEI:
        zeile = e.lineno
        meldung = e.msg
    elif isinstance(e, NameError) and getattr(e, "name", None):
        meldung = f"Der Name '{e.name}' ist nicht bekannt."
    else:
        meldung = str(e)
    if not isinstance(e, SyntaxError):
        for rahmen in traceback.extract_tb(e.__traceback__):
            if rahmen.filename == DATEI:
                zeile = rahmen.lineno
    return {"ok": False, "art": art, "meldung": meldung,
            "hinweis": HINWEISE.get(art, ""), "zeile": zeile, "aufruf": aufruf}

def lade_regel(code):
    ausgaben = []
    puffer = io.StringIO()
    alt = sys.stdout
    sys.stdout = puffer

    def sammle(wer):
        text = puffer.getvalue()
        if text:
            ausgaben.append([wer, text])
        puffer.seek(0)
        puffer.truncate(0)

    def antwort(daten):
        sammle(None)
        daten["ausgaben"] = ausgaben
        return json.dumps(daten)

    try:
        namensraum = {"__name__": "__main__"}
        try:
            exec(compile(code, DATEI, "exec"), namensraum)
        except Exception as e:
            return antwort(_fehler(e))
        sammle(None)

        regel = namensraum.get("regel")
        if regel is None:
            return antwort({"ok": False, "art": "Keine Regel",
                "meldung": "Es gibt keine Funktion mit dem Namen regel.",
                "hinweis": "Sie muss so beginnen:  def regel(lebendig, nachbarn):"})
        if not callable(regel):
            return antwort({"ok": False, "art": "Keine Regel",
                "meldung": "regel ist keine Funktion.",
                "hinweis": "Sie muss so beginnen:  def regel(lebendig, nachbarn):"})
        try:
            inspect.signature(regel).bind(True, 0)
        except TypeError:
            return antwort({"ok": False, "art": "Falsche Parameter",
                "meldung": "regel muss genau zwei Parameter haben.",
                "hinweis": "Sie muss so beginnen:  def regel(lebendig, nachbarn):"})
        except ValueError:
            pass

        tabelle = []
        for lebendig in (False, True):
            reihe = []
            for nachbarn in range(9):
                aufruf = f"regel({lebendig}, {nachbarn})"
                try:
                    wert = regel(lebendig, nachbarn)
                except Exception as e:
                    return antwort(_fehler(e, aufruf))
                finally:
                    sammle(aufruf)
                if wert is True or wert is False or (type(wert) is int and wert in (0, 1)):
                    reihe.append(bool(wert))
                else:
                    hinweis = "Die Regel muss True (Zelle lebt) oder False (Zelle ist tot) zurückgeben."
                    if wert is None:
                        hinweis += " Fehlt irgendwo ein return?"
                    return antwort({"ok": False, "art": "Falscher Rückgabewert",
                        "meldung": f"{aufruf} gibt {wert!r} zurück.",
                        "hinweis": hinweis, "aufruf": aufruf})
            tabelle.append(reihe)
        return antwort({"ok": True, "tabelle": tabelle})
    finally:
        sys.stdout = alt
`;

let pyodide = null;

const bereit = (async () => {
  try {
    pyodide = await loadPyodide();
    pyodide.runPython(PYTHON_KERN);
    postMessage({ typ: "bereit" });
  } catch (e) {
    postMessage({ typ: "ladefehler", text: String(e) });
  }
})();

onmessage = async (e) => {
  await bereit;
  const { typ, id, code } = e.data;
  if (typ !== "regel" || !pyodide) return;
  let ergebnis;
  try {
    const lade = pyodide.globals.get("lade_regel");
    ergebnis = JSON.parse(lade(code));
    lade.destroy();
  } catch (fehler) {
    ergebnis = { ok: false, art: "Interner Fehler", meldung: String(fehler), hinweis: "", ausgaben: [] };
  }
  postMessage({ typ: "ergebnis", id, ergebnis });
};
