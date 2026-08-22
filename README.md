# GONG

Prende la scheda di allenamento che hai già — incollata, fotografata, caricata
come file — e la trasforma in una sessione guidata a voce con timer.
Non genera allenamenti: è il lettore, non il compositore.

Next.js (App Router) + TypeScript, PWA mobile-first.

## Il flusso

`/` Home → `/input` incolla/foto/file → lettura → `/scelta` (solo se la scheda
contiene più allenamenti) → `/conferma` correzione dei dedotti → `/preflight`
voce + countdown → `/player` → Fine.

- `components/InputScreen.tsx` — i cinque stati dell'input: primo accesso,
  libreria, drag-over, file ricevuto, errore di lettura; più la schermata di
  parsing che mostra la scheda smontarsi riga per riga.
- `components/ConfirmScreen.tsx` — la sessione strutturata. Ogni valore che il
  parser ha *dedotto* invece che letto sta su un tratteggio ambra; toccandolo si
  apre il pannello che cita la riga della tua scheda da cui l'ha ricavato.
- `components/PlayerScreen.tsx` + `lib/useWorkoutSession.ts` — il player:
  countdown, tap per chiudere una serie, pressione lunga per la pausa, voce e
  beep ai cambi di stato, wake lock per tenere lo schermo acceso.
- `lib/parsedSession.ts` — schema della scheda letta e appiattimento in step.
- `app/api/parse/route.ts` — il lettore: manda testo o immagine a Claude e
  riceve la sessione strutturata. Gira **solo lato server**, così la chiave API
  non arriva mai al browser.

`public/design/` conserva i documenti di design originali (Player e flusso a
sedici schermate) come riferimento.

## Configurazione

Il parser richiede una chiave API Anthropic. In locale, crea `.env.local`:

```
ANTHROPIC_API_KEY=...
```

(`.env*.local` è già in `.gitignore` — la chiave non finisce nel repo.)
Su Vercel va impostata come Environment Variable del progetto.

Senza chiave l'app funziona, ma la lettura di una scheda si ferma con un
messaggio esplicito invece di fallire in silenzio.

## In locale

Questo Mac non ha Node di sistema: ne trovi una copia utente in `~/.local/nodejs`
(installata una volta sola, niente di sistemwide).

```bash
export PATH="$HOME/.local/nodejs/bin:$PATH"
npm install
npm run dev     # http://localhost:4321
```

`npm run build && npm run start` per provare la build di produzione.
