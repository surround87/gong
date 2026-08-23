import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
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
type Provider = "anthropic" | "deepseek";

const MEDIA_IMMAGINE = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const DEEPSEEK_BASE_URL = "https://api.deepseek.com/anthropic";
const DEEPSEEK_TESTO = "deepseek-v4-pro";
const DEEPSEEK_VISIONE = "deepseek-v4-flash-vision-exp";
const NOME_TOOL = "restituisci_scheda";

function jsonError(errore: string, status: number, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ errore, ...extra }, { status });
}

export async function POST(request: Request) {
  // The user's own key, sent per-request from their device. A server-side
  // ANTHROPIC_API_KEY is only a fallback for a private deployment. The key is
  // used for this one call and never stored or logged.
  const chiaveUtente = request.headers.get("x-gong-key")?.trim();
  const providerHeader = request.headers.get("x-gong-provider")?.trim();
  const provider: Provider = providerHeader === "deepseek" ? "deepseek" : "anthropic";
  const apiKey = chiaveUtente || process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return jsonError("Serve la tua chiave API per leggere una scheda.", 401, {
      chiaveMancante: true,
    });
  }

  let body: { testo?: string; immagine?: ImmaginePayload; nomeFile?: string };
  try {
    body = await request.json();
  } catch {
    return jsonError("Richiesta non leggibile.", 400);
  }

  const { testo, immagine, nomeFile } = body;
  if (!testo?.trim() && !immagine?.data) {
    return jsonError("Non ho ricevuto niente da leggere.", 400);
  }

  const content: Anthropic.ContentBlockParam[] = [];

  if (immagine?.data) {
    if (immagine.mediaType === "application/pdf") {
      // DeepSeek's Anthropic-compatible endpoint rejects `document` blocks.
      if (provider === "deepseek") {
        return jsonError(
          "DeepSeek non legge i PDF. Fai una foto della scheda, oppure passa a una chiave Claude.",
          415,
        );
      }
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
      return jsonError(`Non so leggere un file ${immagine.mediaType}.`, 415);
    }
  }

  content.push({
    type: "text",
    text: testo?.trim()
      ? `Leggi questa scheda${nomeFile ? ` (dal file ${nomeFile})` : ""}:\n\n${testo}`
      : `Leggi la scheda in questo file${nomeFile ? ` (${nomeFile})` : ""}.`,
  });

  try {
    const client =
      provider === "deepseek"
        ? new Anthropic({ apiKey, baseURL: DEEPSEEK_BASE_URL })
        : new Anthropic({ apiKey });

    const parsed =
      provider === "deepseek"
        ? await leggiConDeepSeek(client, content, !!immagine?.data)
        : await leggiConClaude(client, content);

    if (!parsed) {
      return jsonError("Ho letto la scheda ma non sono riuscito a strutturarla.", 502);
    }
    return NextResponse.json(parsed);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return jsonError("La chiave API non è valida o non ha credito.", 401, {
        chiaveMancante: true,
      });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return jsonError("Troppe richieste in questo momento. Riprova fra poco.", 429);
    }
    if (error instanceof z.ZodError) {
      return jsonError("La risposta del modello non aveva la forma attesa.", 502);
    }
    console.error(
      "[parse] lettura fallita:",
      error instanceof Error ? error.message : "errore sconosciuto",
    );
    return jsonError("La lettura è fallita.", 502);
  }
}

/** Claude supports structured outputs natively — strongest guarantee available. */
async function leggiConClaude(client: Anthropic, content: Anthropic.ContentBlockParam[]) {
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    system: SISTEMA,
    messages: [{ role: "user", content }],
    output_config: { format: zodOutputFormat(RisultatoParsingSchema) },
  });
  return response.parsed_output ?? null;
}

/**
 * DeepSeek's compatible endpoint doesn't do structured outputs, but it does do
 * tool calls — so the schema is imposed as a forced tool, and the tool input is
 * validated against the same zod schema before it's trusted.
 */
async function leggiConDeepSeek(
  client: Anthropic,
  content: Anthropic.ContentBlockParam[],
  conImmagine: boolean,
) {
  const schema = z.toJSONSchema(RisultatoParsingSchema, { io: "output" });
  const response = await client.messages.create({
    model: conImmagine ? DEEPSEEK_VISIONE : DEEPSEEK_TESTO,
    max_tokens: 16000,
    system: SISTEMA,
    messages: [{ role: "user", content }],
    tools: [
      {
        name: NOME_TOOL,
        description: "Restituisce la scheda letta, strutturata.",
        input_schema: schema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: NOME_TOOL },
  });

  const blocco = response.content.find((b) => b.type === "tool_use");
  if (!blocco || blocco.type !== "tool_use") return null;
  return RisultatoParsingSchema.parse(blocco.input);
}
