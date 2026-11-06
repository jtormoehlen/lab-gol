# lab-gol – Game of Life Regel-Labor

Eine kleine Web-Umgebung für den Informatikunterricht. Die Schülerinnen und Schüler
entwickeln die Regeln für Conways *Game of Life* selbst und schreiben sie in Python.
Python läuft dabei direkt im Browser ([Pyodide](https://pyodide.org)). Es muss nichts installiert werden.

## Idee

Das Programm übernimmt alles rund um das Grid: Zeichnen, Nachbarn zählen und Generationen berechnen.
Die SuS schreiben nur die Funktion, die für **eine einzelne Zelle** entscheidet, ob sie weiterlebt:

```python
def regel(lebendig, nachbarn):
    # lebendig: True oder False
    # nachbarn: Anzahl lebender Nachbarzellen (0 bis 8)
    if lebendig and nachbarn < 2:
        return False
    ...
```

## Funktionen

- **Grid**: Zellen per Klick oder mit gedrückter Maustaste setzen. Dazu Start/Pause, Einzelschritt,
  Schritt zurück und Reset auf Generation 0.
- **Muster**: Block, Bienenstock, Blinker, Kröte, Leuchtfeuer, Pulsar, Gleiter, Segler,
  R-Pentomino und Gleiterkanone, außerdem Zufall.
- **Optionen**: drei Grid-Größen, Rand „tot“ oder „umlaufend“ (Torus), Tempo-Regler.
- **Nachbarzahlen**: zeigt in jeder Zelle die Anzahl lebender Nachbarn an.
  Beim Überfahren mit der Maus erscheint zum Beispiel „Zelle (12 | 7): tot, 3 Nachbarn → wird lebendig“.
- **Regeltabelle**: zeigt nach dem Übernehmen, was die eigene Regel für alle 18 Fälle entscheidet
  (tot/lebendig × 0–8 Nachbarn).
- **Fehlermeldungen auf Deutsch** mit markierter Zeile im Editor. Dazu Hinweise bei fehlendem `return`,
  falschen Rückgabewerten oder Tippfehlern. Eine Endlosschleife wird nach 4 Sekunden abgebrochen.
- **`print(...)`** in der Regel wird in der Ausgabe angezeigt, jeweils mit dem Aufruf, aus dem es stammt.
- Der Code wird automatisch im Browser gespeichert und lässt sich als `regel.py` herunterladen und wieder öffnen.

Aufgaben sind bewusst nicht eingebaut. Sie werden im Unterricht separat gestellt.

## Technik

Reines HTML/CSS/JavaScript ohne Build-Schritt.

| Datei        | Inhalt                                                        |
|--------------|---------------------------------------------------------------|
| `index.html` | Layout                                                        |
| `style.css`  | Gestaltung (inkl. Dark Mode)                                  |
| `app.js`     | Grid, Simulation, Editor, Bedienung                           |
| `worker.js`  | Pyodide im Web Worker: prüft die Regel und erstellt die Tabelle |
| `muster.js`  | Startmuster                                                   |

Da `regel` nur von `lebendig` und `nachbarn` abhängt, wird sie beim Übernehmen einmal für alle
18 Kombinationen aufgerufen. Die Simulation nutzt dann diese Tabelle und läuft dadurch auch bei großen Grids flüssig.

Bibliotheken (per CDN): Pyodide 0.26.4 (jsDelivr), CodeMirror 5.65.16 (cdnjs).

## Veröffentlichen mit GitHub Pages

*Settings → Pages → Source: „Deploy from a branch“ → Branch `main`, Ordner `/ (root)`.*
Die Seite ist danach unter `https://<benutzername>.github.io/lab-gol/` erreichbar.

## Lokal ausprobieren

Der Web Worker braucht einen kleinen Webserver. Ein Doppelklick auf `index.html` reicht nicht.

```bash
python3 -m http.server
```

Danach `http://localhost:8000` öffnen.
