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
      description: "Lagre en ny oppskrift i kokeboken.",
      parameters: {
        type: "OBJECT",
        properties: {
          navn: { type: "STRING", description: "Navnet på oppskriften" },
          kategori: { type: "STRING", description: "Kategori for oppskriften ('hverdag' eller 'helg')" },
          rangering: { type: "INTEGER", description: "Rangering fra 1 til 5" },
          notater: { type: "STRING", description: "Eventuelle notater" },
          cuisine: { type: "STRING", description: "Type kjøkken (f.eks 'Italiensk', 'Asiatisk', 'Norsk')" },
          oppskrift: { type: "STRING", description: "Oppskriftsdata som JSON streng (ingredienser, instruksjoner etc)" },
          sist_laget: { type: "STRING", description: "Dato for når den sist ble laget (YYYY-MM-DD)" }
        },
        required: ["navn"]
      }
    },
    {
      name: "lagre_ukesmeny",
      description: "Lagre eller oppdater ukesmenyen for brukeren. Bruk dette når du har foreslått en meny og brukeren er fornøyd, eller hvis brukeren ber deg sette opp menyen. Returner gjerne en oppdatert handleliste i chatten etterpå.",
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
          handleliste: { type: "STRING", description: "En samlet handleliste for hele uken, gjerne i markdown-format" }
        }
      }
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
    if (name === "lagre_ukesmeny") {
      const payload = { ...args, user_id: userId, oppdatert: new Date().toISOString() };
      const { data, error } = await supabase
        .from("ukesmeny")
        .upsert(payload, { onConflict: 'user_id' })
        .select();
      if (error) throw error;
      return { success: true, added: data };
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
4. Handlelister: Handlelister skal ALLTID sorteres etter hvor varene befinner seg fysisk i en typisk norsk matbutikk (f.eks. Frukt & Grønt, Kjøtt & Fisk, Kjølevare/Mejeri, Tørrvare, Frysevare).
5. Ukesmenyer: Hvis du blir bedt om å foreslå meny for flere dager eller en hel uke, skal du alltid generere én felles, summert handleliste for hele perioden, som igjen er pent sortert etter butikkavdelinger.
6. Duplikater på lager: Sjekk alltid hva som allerede finnes på lageret før du legger til nye varer. Hvis brukeren ber deg legge til en ingrediens som allerede finnes (f.eks. Spisskummen), skal du IKKE legge den til på nytt for å unngå duplikater.`,
        tools: tools,
      },
      history: history
    });
    
    let response = await chat.sendMessage({ message: latestMessage });
    
    let loopCount = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && loopCount < 5) {
      loopCount++;
      const functionResponses = [];
      for (const call of response.functionCalls) {
        const result = await executeTool(call, supabase, user.id);
        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: result
          }
        });
      }
      response = await chat.sendMessage({ message: functionResponses });
    }
    
    return Response.json({ role: "assistant", content: response.text });
  } catch (error) {
    console.error("API Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
