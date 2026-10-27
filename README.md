<img src="assets/anschluss.svg" width="64" height="64" alt="">

# Anschluss!

Komm pünktlich an. Irgendwie. Ein Bahn-Roguelite für den Browser: Route über ein Streckennetz planen,
in kurzen Sprints durch Bahnhöfe den Anschluss erwischen, Ausrüstung sammeln, freischalten, die Tagesreise teilen.

Konzept: [docs/SPEC.md](docs/SPEC.md)

## Spielen

ES-Module laufen nicht über `file://`, deshalb lokal einen statischen Server starten:

```sh
npm run serve   # python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen. Steuerung im Sprint: links/rechts tippen oder Pfeiltasten, `P` pausiert.

## Entwicklung

Keine Abhängigkeiten, kein Build.

```sh
npm test                                  # node --test
node scripts/simulate.js 400 de 0 0.85    # Balancing: Bot spielt Reisen (Anzahl, Region, Stufe, Können)
```

- `src/logic/` Spielregeln, rein und getestet (Netz, Reise, Sprint, Fortschritt, Teilen)
- `src/ui/` Darstellung (Bildschirme als HTML, Karte als SVG, Sprint als Canvas, Sound)
- `src/main.js` Ablauf, Eingabe, Speicher
- `src/logic/content.js` alle Inhalte und Zahlen an einer Stelle
