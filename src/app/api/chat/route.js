import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const tools = [{
  functionDeclarations: [
    {
      name: "hent_lager",
      description: "Hent alle ingredienser som for øyeblikket finnes på lageret.",
    },
    {
      name: "legg_til_ingredienser",
      description: "Legg til en eller flere nye ingredienser på lageret i én enkelt operasjon. Bruk alltid denne hvis det er flere varer.",
      parameters: {
        type: "OBJECT",
        properties: {
          ingredienser: {
            type: "ARRAY",
            description: "En liste over ingredienser som skal legges til",
            items: {
              type: "OBJECT",
              properties: {
                navn: { type: "STRING", description: "Navnet på ingrediensen" },
                kategori: { type: "STRING", description: "Kategori for ingrediensen" },
                mengde: { type: "STRING", description: "Mengden av ingrediensen (f.eks. '2 stk', '500g')" },
                notat: { type: "STRING", description: "Eventuelle notater" }
              },
              required: ["navn"]
            }
          }
        },
        required: ["ingredienser"]
      }
    },
    {
      name: "hent_kokebok",
      description: "Hent alle lagrede oppskrifter fra kokeboken.",
    },
    {
      name: "lagre_oppskrift",
      description: "Lagre en ny oppskrift i kokeboken. Du må ALLTID klassifisere oppskriften med riktig 'cuisine' (f.eks 'Italiensk', 'Asiatisk', 'Norsk', 'Mexikansk') og 'kategori' ('hverdag' eller 'helg').",
      parameters: {
        type: "OBJECT",
        properties: {
          navn: { type: "STRING", description: "Navnet på oppskriften" },
          kategori: { type: "STRING", description: "Kategori for oppskriften ('hverdag' eller 'helg')" },
          rangering: { type: "INTEGER", description: "Rangering fra 1 til 5" },
          notater: { type: "STRING", description: "Eventuelle notater" },
          cuisine: { type: "STRING", description: "Type kjøkken (f.eks 'Italiensk', 'Asiatisk', 'Norsk', 'Fransk', 'Indisk', 'Mexikansk')" },
          oppskrift: { type: "STRING", description: "Oppskriftsdata som JSON streng (ingredienser, instruksjoner etc)" },
          sist_laget: { type: "STRING", description: "Dato for når den sist ble laget (YYYY-MM-DD)" }
        },
        required: ["navn", "cuisine", "kategori"]
      }
    },
    {
      name: "lagre_ukesmeny",
      description: "Lagre eller oppdater ukesmenyen for brukeren. Bruk dette når du har foreslått en meny og brukeren er fornøyd, eller hvis brukeren ber deg sette opp menyen. VIKTIG: Hvis det allerede finnes en handleliste (hent den først!), må du MERGE de nye varene inn i den eksisterende listen, med mindre brukeren ber om en helt ny meny.",
      parameters: {
        type: "OBJECT",
        properties: {
          mandag: { type: "STRING" },
          tirsdag: { type: "STRING" },
          onsdag: { type: "STRING" },
          torsdag: { type: "STRING" },
          fredag: { type: "STRING" },
          lordag: { type: "STRING" },
          sondag: { type: "STRING" },
          handleliste: { type: "STRING", description: "En samlet handleliste for uken i markdown. VIKTIG: Handlelisten MÅ grupperes etter varekategori (f.eks 'Frukt & Grønt', 'Meieri') og inneholde kontekst for hvilken rett varen tilhører (f.eks '- 500g Kjøttdeig (til Taco)')." }
        }
      }
    },
    {
      name: "lagre_handleliste",
      description: "Lagre eller oppdater KUN handlelisten. Bruk denne når brukeren ber deg om å legge til noe eller oppdatere listen. VIKTIG: Du MÅ hente eksisterende handleliste først og MERGE inn de nye varene slik at ingenting blir slettet.",
      parameters: {
        type: "OBJECT",
        properties: {
          handleliste: { type: "STRING", description: "Selve handlelisten i markdown-format. VIKTIG: Den MÅ grupperes etter varekategori og inneholde kontekst for hvilken rett varen tilhører." }
        },
        required: ["handleliste"]
      }
    },
    {
      name: "hent_ukesmeny",
      description: "Hent den nåværende ukesmenyen og handlelisten for brukeren. Bruk denne ALLTID før du oppdaterer handlelisten for å sikre at du ikke sletter eksisterende varer."
    },
    {
      name: "slett_fra_lager",
      description: "Slett en vare fra lageret basert på dens ID. Du må hente lageret først for å vite ID-en.",
      parameters: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", description: "ID-en til varen som skal slettes" }
        },
        required: ["id"]
      }
    },
    {
      name: "oppdater_lager_vare",
      description: "Oppdater informasjon om en eksisterende vare på lageret.",
      parameters: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", description: "ID-en til varen som skal oppdateres" },
          data: {
            type: "OBJECT",
            properties: {
              navn: { type: "STRING" },
              kategori: { type: "STRING" },
              mengde: { type: "STRING" },
              notat: { type: "STRING" }
            }
          }
        },
        required: ["id", "data"]
      }
    },
    {
      name: "slett_oppskrift",
      description: "Slett en oppskrift fra kokeboken basert på dens ID.",
      parameters: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", description: "ID-en til oppskriften som skal slettes" }
        },
        required: ["id"]
      }
    },
    {
      name: "oppdater_oppskrift",
      description: "Oppdater en eksisterende oppskrift i kokeboken.",
      parameters: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING", description: "ID-en til oppskriften som skal oppdateres" },
          data: {
            type: "OBJECT",
            properties: {
              navn: { type: "STRING" },
              kategori: { type: "STRING" },
              cuisine: { type: "STRING" },
              oppskrift: { type: "STRING", description: "Oppskriftsdata som JSON streng" }
            }
          }
        },
        required: ["id", "data"]
      }
    },
    {
      name: "nullstill_ukesmeny",
      description: "Slett ukesmenyen (mandag-søndag), men behold handlelisten. Bruk denne hvis brukeren vil planlegge uken på nytt."
    },
    {
      name: "nullstill_handleliste",
      description: "Slett kun handlelisten, men behold ukesmenyen. Bruk denne hvis brukeren vil tømme listen."
    },
    {
      name: "nullstill_alt",
      description: "Slett både ukesmeny og handleliste helt. Bruk denne hvis brukeren vil starte helt på nytt."
    }
  ]
}];

async function executeTool(call, supabase, userId) {
  const { name, args } = call;
  try {
    if (name === "hent_lager") {
      const { data, error } = await supabase.from("lager").select("*");
      if (error) throw error;
      return { data };
    }
    if (name === "legg_til_ingredienser") {
      const payload = (args.ingredienser || []).map(item => ({ ...item, user_id: userId }));
      const { data, error } = await supabase.from("lager").insert(payload).select();
      if (error) throw error;
      return { success: true, added: data };
    }
    if (name === "hent_kokebok") {
      const { data, error } = await supabase.from("kokebok").select("*");
      if (error) throw error;
      return { data };
    }
    if (name === "lagre_oppskrift") {
      let parsedOppskrift = args.oppskrift;
      try { parsedOppskrift = JSON.parse(args.oppskrift); } catch(e) {}
      
      const payload = { ...args, oppskrift: parsedOppskrift, user_id: userId };
      const { data, error } = await supabase.from("kokebok").insert(payload).select();
      if (error) throw error;
      return { success: true, added: data };
    }
    if (name === "lagre_ukesmeny" || name === "lagre_handleliste") {
      const { data: existing } = await supabase.from("ukesmeny").select("*").eq("user_id", userId).single();
      const defaults = { mandag: "", tirsdag: "", onsdag: "", torsdag: "", fredag: "", lordag: "", sondag: "", handleliste: "" };
      
      const payload = { 
        ...(existing || defaults),
        ...args, 
        user_id: userId, 
        oppdatert: new Date().toISOString() 
      };

      const { data, error } = await supabase.from("ukesmeny").upsert(payload, { onConflict: 'user_id' }).select();
      if (error) throw error;
      return { success: true, added: data };
    }
    if (name === "slett_fra_lager") {
      const { error } = await supabase.from("lager").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true };
    }
    if (name === "oppdater_lager_vare") {
      const { data, error } = await supabase.from("lager").update(args.data).eq("id", args.id).eq("user_id", userId).select();
      if (error) throw error;
      return { success: true, updated: data };
    }
    if (name === "slett_oppskrift") {
      const { error } = await supabase.from("kokebok").delete().eq("id", args.id).eq("user_id", userId);
      if (error) throw error;
      return { success: true };
    }
    if (name === "oppdater_oppskrift") {
      let updateData = { ...args.data };
      if (updateData.oppskrift && typeof updateData.oppskrift === "string") {
        try { updateData.oppskrift = JSON.parse(updateData.oppskrift); } catch(e) {}
      }
      const { data, error } = await supabase.from("kokebok").update(updateData).eq("id", args.id).eq("user_id", userId).select();
      if (error) throw error;
      return { success: true, updated: data };
    }
    if (name === "nullstill_ukesmeny") {
      const updates = { mandag: "", tirsdag: "", onsdag: "", torsdag: "", fredag: "", lordag: "", sondag: "", oppdatert: new Date().toISOString() };
      const { error } = await supabase.from("ukesmeny").update(updates).eq("user_id", userId);
      if (error) throw error;
      return { success: true };
    }
    if (name === "nullstill_handleliste") {
      const { error } = await supabase.from("ukesmeny").update({ handleliste: "", oppdatert: new Date().toISOString() }).eq("user_id", userId);
      if (error) throw error;
      return { success: true };
    }
    if (name === "nullstill_alt") {
      const { error } = await supabase.from("ukesmeny").delete().eq("user_id", userId);
      if (error) throw error;
      return { success: true };
    }
    if (name === "hent_ukesmeny") {
      const { data, error } = await supabase.from("ukesmeny").select("*").eq("user_id", userId).single();
      if (error && error.code !== "PGRST116") throw error; // Ignorer "ikke funnet" feil
      return { data: data || null };
    }
    return { error: `Unknown tool ${name}` };
  } catch (error) {
    return { error: error.message };
  }
}

export async function POST(req) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { messages } = body;
    
    const history = messages.slice(0, -1).map(m => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }]
    }));
    
    const latestMessage = messages[messages.length - 1].content;
    
    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: `Du er Souschef, en AI-kokk. Du hjelper brukeren med matlaging, holder oversikt over spesialvarer/krydder på lageret og lagrer oppskrifter i kokeboken. Svar alltid på Norsk, vær vennlig og formater lister pent. 

Følgende forutsetninger gjelder ALLTID:
1. Utstyr og Basisvarer: Anta at brukeren har et svært godt utstyrt kjøkken hva angår alle vanlige redskaper og basisvarer (som salt, pepper, vann, stekesmør/olje, sukker, mel, og lignende), selv om dette ikke står spesifikt på lageret.
2. Varelager og innkjøp: Varelageret inneholder kun krydder, oljer, eddiker og spesialvarer. Når du foreslår oppskrifter, ta utgangspunkt i å bruke disse spesialvarene for å skape smak. Alt annet av ingredienser du foreslår for å fullføre retten MÅ være vanlige varer man får tak i på en standard norsk dagligvarebutikk (som Kiwi eller Rema 1000).
3. Oppskrifter & Preferanser: Dere foretrekker autentiske måltider, og gjerne sunne varianter i hverdagene. Sorter og merk alltid oppskrifter som 'hverdag' (raskere, mindre effort) eller 'helg' (mer tid/effort). Angi estimert tidsbruk.
4. Handlelister & Merging: 
   - Før du legger til noe i handlelisten, må du ALLTID bruke 'hent_ukesmeny' for å se hva som allerede står der.
   - Du skal ALDRI slette eksisterende varer i handlelisten med mindre brukeren ber om det. 
   - Nye varer skal MERGES inn i den eksisterende listen.
   - Hver vare i handlelisten skal bruke sjekkliste-formatet '- [ ] ', f.eks: '- [ ] 500g Kjøttdeig (til Taco)'.
   - Handlelister skal ALLTID sorteres etter hvor varene befinner seg fysisk i en typisk norsk matbutikk (f.eks. Frukt & Grønt, Kjøtt & Fisk, Kjølevare/Mejeri, Tørrvare, Frysevare).
5. Ukesmenyer: Hvis du blir bedt om å foreslå meny for flere dager eller en hel uke, skal du alltid generere én felles, summert handleliste for hele perioden, som igjen er pent sortert etter butikkavdelinger. Bruk alltid '- [ ] ' for alle varer.
6. Duplikater på lager: Sjekk alltid hva som allerede finnes på lageret før du legger til nye varer. Hvis brukeren ber deg legge til en ingrediens som allerede finnes (f.eks. Spisskummen), skal du IKKE legge den til på nytt for å unngå duplikater.
7. Oppskriftsforespørsler: Hvis brukeren ber om en oppskrift i JSON-format (f.eks. når de klikker på en rett i ukesmenyen), skal du svare KUN med et JSON-objekt som inneholder 'navn', 'cuisine', 'kategori' ('hverdag'/'helg'), 'ingredienser' (liste med 'navn' og 'mengde') og 'instruksjoner' (liste med tekststregner). Ikke inkluder markdown-formatering rundt JSON-koden med mindre du blir bedt om det.
8. Klassifisering: Du skal ALLTID tildele en 'cuisine' til alle oppskrifter du lagrer eller foreslår. Bruk kjente kategorier som 'Norsk', 'Italiensk', 'Asiatisk', 'Indisk', 'Mexikansk', 'Amerikansk', osv. Dette er kritisk for at sorteringen i kokeboken skal fungere.`,
        tools: tools,
      },
      history: history
    });
    
    let currentMessage = { message: latestMessage };
    let loopCount = 0;

    while (loopCount < 5) {
      loopCount++;
      const result = await chat.sendMessageStream(currentMessage);
      
      // Consume the first chunk to check if it's a tool call
      const firstResult = await result.next();
      if (firstResult.done) break;
      const firstChunk = firstResult.value;

      if (firstChunk.functionCalls && firstChunk.functionCalls.length > 0) {
        // Collect all chunks to get ALL function calls
        const functionCalls = [...firstChunk.functionCalls];
        for await (const chunk of result) {
          if (chunk.functionCalls) {
            functionCalls.push(...chunk.functionCalls);
          }
        }
        
        const functionResponses = [];
        for (const call of functionCalls) {
          const toolResult = await executeTool(call, supabase, user.id);
          functionResponses.push({
            functionResponse: {
              name: call.name,
              response: toolResult
            }
          });
        }
        currentMessage = { message: functionResponses };
        continue;
      } else {
        // It's a text response! Stream it.
        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            
            // Send the first chunk we already read
            const firstText = firstChunk.text;
            if (firstText) {
              controller.enqueue(encoder.encode(firstText));
            }

            // Stream the rest
            for await (const chunk of result) {
              const text = chunk.text;
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            }
            controller.close();
          }
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Transfer-Encoding": "chunked",
          },
        });
      }
    }
    
    return Response.json({ error: "No response from AI" }, { status: 500 });
  } catch (error) {
    console.error("API Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
