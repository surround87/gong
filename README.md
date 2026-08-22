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

## La chiave API

La lettura usa Claude, quindi serve una chiave Anthropic. In questa versione
**la chiave è dell'utente**: la inserisce in `/chiave`, resta nel `localStorage`
del suo browser, e viaggia in un header verso `/api/parse` solo nel momento
della lettura. Il server la usa per quella chiamata e basta — non la salva, non
la scrive nei log, non la mette mai in un URL.

Conseguenza pratica: il deploy pubblico non espone la tua carta, perché ognuno
paga il proprio consumo, e **su Vercel non serve impostare nessuna variabile
d'ambiente**.

Resta un fallback: se `ANTHROPIC_API_KEY` è presente lato server, viene usata
quando l'utente non ne ha una propria — comodo per un deploy privato tuo o per
lo sviluppo in locale (`.env.local`, già coperto da `.gitignore`).

> Nota di prodotto: chiedere una chiave API va bene per il prototipo, non per
> gli utenti veri del brief (gente in palestra, PT). Quando il prodotto esce,
> serve una chiave tua dietro un account e un limite di consumo.

## In locale

Questo Mac non ha Node di sistema: ne trovi una copia utente in `~/.local/nodejs`
(installata una volta sola, niente di sistemwide).

```bash
export PATH="$HOME/.local/nodejs/bin:$PATH"
npm install
npm run dev     # http://localhost:4321
```

`npm run build && npm run start` per provare la build di produzione.
