# Anschluss! – Spezifikation v1

Ergebnis der Konzept-Runde vom 27.10.2026. Ziel: ein Spiel, das süchtig macht, echte Entscheidungen hat,
sich über Freischaltungen weiterentwickelt und bei dem man sich mit anderen vergleicht. Kein Ballast.

## Kern
- **Ein Durchgang = eine Reise** von A nach B zu einem Termin (~6 Min Spielzeit, 4–6 Umstiege).
- **Netz-Karte** wie in Slay the Spire: Ebenen mit 2–3 Bahnhöfen, ganzes Netz von Anfang an sichtbar.
  Bahnhofsarten: Bahnhof, Kiosk (Ausrüstung kaufen), Lounge (Zeit gegen Geld), Ereignis (Wahl mit Folgen).
- **Anschlüsse** pro Bahnhof: ICB (schnell, teuer, wackelig, Takt 60) oder RE (langsam, billig, meist pünktlich, Takt 30).
  Zuverlässigkeit ist unscharf, die genaue Abfahrts-Verspätung sieht man erst am Bahnhof, die Ankunfts-Verspätung erst nach der Fahrt.
  Ausfall → Schienenersatzverkehr (Bus, langsam). Notlösung: Taxi (teuer). Pleite: ohne Ticket fahren (Kontroll-Risiko).
- **Sprint** (~15–25 s) vor jeder Abfahrt: drei Spuren, 4 Hindernisse (Säule, Reisegruppe, Koffer, Tauben),
  Pfandflaschen als Geldquelle, genau eine Gleis-Entscheidung. Tafel, App und Durchsage widersprechen sich;
  jede Quelle zeigt, ob man ihr trauen kann (Tafel gestört, App veraltet, Durchsage rauscht). Mindestens eine ist
  vertrauenswürdig. Zeitlimit = Umsteigezeit. Verpasst → nächster Zug im Takt.
- **Termin** = Ankunft einer fehlerfreien Referenz-Reise (kennt die festgelegten Verspätungen) + kleiner Puffer.
  Wer gut plant und sauber läuft, ist pünktlich; ein verpasster Anschluss kostet meist die Pünktlichkeit.
- **Geld** nur innerhalb des Durchgangs: Pfand + Bonus für saubere Sprints; ausgeben für Fahrkarten, Kiosk, Taxi.
- **Wertung**: Minuten vor/nach dem Termin. Gleichstand: Restgeld. Sterne: pünktlich ⭐⭐⭐, bis 15 Min zu spät ⭐⭐, sonst ⭐.

## Ausrüstung (alle 10 ab Start im Kiosk)
Laufschuhe, Thermobecher, Ellenbogen, Taubenfutter, Powerbank, Noise-Cancelling, BahnCard, Rollkoffer,
Fahrgastrechte-Formular, Deutschlandticket. Jede mit Haken oder Preis.

## Fortschritt
- **Reisekilometer** aus jedem Durchgang (auch gescheiterten) füllen eine feste Leiter:
  Figuren (Studentin, Rentner), Region ganz Deutschland, dauerhafte Vielfahrer-Vorteile.
- **Figuren**: Pendler (Start), Studentin, Rentner mit Rollator – je eine Eigenschaft.
- **Regionen**: Norden (Start), ganz Deutschland.
- **Störungsstufen 1–5**: pünktliche Ankunft auf Stufe k schaltet Stufe k+1 frei. Jede Stufe eine neue Gemeinheit.

## Vergleichen
- **Tagesreise**: gleicher Seed für alle, Pendler, Stufe 0, keine Vorteile. Nur der erste Versuch zählt.
- **Teilen** als Text (Emoji pro Etappe, 🏃 = Anschluss verpasst) + **Herausforderungs-Link** mit Spitzname und Ergebnis.
  Wer den Link öffnet, spielt dieselbe Tagesreise und sieht den Vergleich.

## Marke
Erfundene „Deutsche Bummelbahn“ (Züge ICB, RE). Keine echten DB-Marken. Texte zentral, später übersetzbar.

## Technik
Statische Seite, ES-Module ohne Build und ohne Fremdpakete. Logik (`src/logic/`) getrennt von Darstellung
(`src/ui/`), Tests mit `node --test`. Menüs und Karte als DOM/SVG, der Sprint als Canvas.

## Nicht in v1
Server, globale Bestenliste, Wiederkehr-Messung, Werbung, Käufe, Österreich/Schweiz, Störungsstufen 6–10.
