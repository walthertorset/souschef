import { GoogleGenAI } from "@google/genai";

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
    }
  ]
}];

async function run() {
  try {
    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: `Sjekk alltid hva som finnes på lageret først. Deretter legg til disse ingrediensene: "spisskummen, paprika, chili, oregano, salt, pepper" uten duplikater.`,
        tools: tools,
      },
      history: []
    });
    
    let response = await chat.sendMessage({ message: "Legg til ingrediensene på lageret" });
    
    let loopCount = 0;
    while (response.functionCalls && response.functionCalls.length > 0 && loopCount < 5) {
      loopCount++;
      console.log(`Loop ${loopCount}:`, JSON.stringify(response.functionCalls, null, 2));
      
      const functionResponses = [];
      for (const call of response.functionCalls) {
        if (call.name === "hent_lager") {
          functionResponses.push({
            functionResponse: { name: call.name, response: { data: [{navn: "salt"}] } }
          });
        } else if (call.name === "legg_til_ingredienser") {
          functionResponses.push({
            functionResponse: { name: call.name, response: { success: true, added: call.args.ingredienser } }
          });
        } else {
          functionResponses.push({
            functionResponse: { name: call.name, response: { error: "Unknown tool" } }
          });
        }
      }
      response = await chat.sendMessage({ message: functionResponses });
    }
    console.log("FINAL RESPONSE:", response.text);
  } catch (error) {
    console.error("ERROR CAUGHT:", error);
  }
}

run();
