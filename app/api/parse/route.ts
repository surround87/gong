import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { NextResponse } from "next/server";
import { RisultatoParsingSchema } from "@/lib/parsedSession";

export const runtime = "nodejs";
export const maxDuration = 60;

const SISTEMA = `Sei il parser di GONG, un'app che trasforma una scheda di allenamento già scritta da un professionista in una sessione guidata a voce con timer.

GONG non genera allenamenti e non li corregge: legge quello che c'è e lo struttura. Non aggiungere esercizi, blocchi o serie che non sono nella scheda.

Regole:
- Rispondi in italiano, nel registro di uno strumento: diretto, essenziale, mai motivazionale.
- Un blocco è "tempo" se ha intervalli a tempo (tabata, EMOM, circuiti a tempo, plank a secondi), "serie" se è a ripetizioni chiuse dall'utente (es. 4x8 panca), "non-supportato" se non ha tempi da scandire (es. AMRAP o chipper a cronometro libero come "Fran").
- Per ogni valore che NON leggi esplicitamente ma deduci, aggiungi una voce in "dedotti" con: il campo, un'etichetta leggibile, la riga testuale ESATTA della scheda da cui l'hai ricavato, e una spiegazione breve in prima persona (es. «"lungo" su una 5×5 di squat, per me, è 180 secondi.»). Non inventare provenienze: la riga deve esistere nell'input.
- Non marcare come dedotto ciò che è scritto nero su bianco.
- "durataStimataMin" è un intervallo onesto [minimo, massimo], mai un numero secco.
- "schema" è la sintesi compatta (es. "8 × 20/10", "4×8"). "dettaglio" elenca gli esercizi e il recupero (es. "Panca piana · Rematore · rec 90\\"").
- Se la scheda contiene più allenamenti distinti (giorni, settimane, sedute), restituiscine uno per ciascuno in "allenamenti", con titoli che li distinguano.
- Se l'input non è una scheda (un messaggio, una ricetta, testo a caso), metti eUnAllenamento=false, riporta in "testoLetto" le prime righe di quello che hai letto, e in "diagnosi" cosa sembra invece (es. "Sembra un messaggio, non una scheda.").`;

type ImmaginePayload = { mediaType: string; data: string };

const MEDIA_IMMAGINE = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        errore:
          "Il parser non è configurato: manca la chiave ANTHROPIC_API_KEY sul server.",
      },
      { status: 503 },
    );
  }

  let body: { testo?: string; immagine?: ImmaginePayload; nomeFile?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ errore: "Richiesta non leggibile." }, { status: 400 });
  }

  const { testo, immagine, nomeFile } = body;
  if (!testo?.trim() && !immagine?.data) {
    return NextResponse.json({ errore: "Non ho ricevuto niente da leggere." }, { status: 400 });
  }

  const content: Anthropic.ContentBlockParam[] = [];

  if (immagine?.data) {
    if (immagine.mediaType === "application/pdf") {
      content.push({
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: immagine.data },
      });
    } else if (MEDIA_IMMAGINE.includes(immagine.mediaType)) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: immagine.mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
          data: immagine.data,
        },
      });
    } else {
      return NextResponse.json(
        { errore: `Non so leggere un file ${immagine.mediaType}.` },
        { status: 415 },
      );
    }
  }

  content.push({
    type: "text",
    text: testo?.trim()
      ? `Leggi questa scheda${nomeFile ? ` (dal file ${nomeFile})` : ""}:\n\n${testo}`
      : `Leggi la scheda in questo file${nomeFile ? ` (${nomeFile})` : ""}.`,
  });

  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SISTEMA,
      messages: [{ role: "user", content }],
      output_config: { format: zodOutputFormat(RisultatoParsingSchema) },
    });

    if (!response.parsed_output) {
      return NextResponse.json(
        { errore: "Ho letto la scheda ma non sono riuscito a strutturarla." },
        { status: 502 },
      );
    }

    return NextResponse.json(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return NextResponse.json({ errore: "Chiave API non valida." }, { status: 502 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { errore: "Troppe richieste in questo momento. Riprova fra poco." },
        { status: 429 },
      );
    }
    console.error("[parse]", error);
    return NextResponse.json({ errore: "La lettura è fallita." }, { status: 502 });
  }
}
