
const { createClient } = require("@supabase/supabase-js");

const url = "https://ouvsukoorcwthtfkcisr.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dnN1a29vcmN3dGh0ZmtjaXNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ4MTQyNCwiZXhwIjoyMDkzMDU3NDI0fQ.PMqf0wkHLWcH1SuXW22Awxq0PxODMnx2zP1i9Ucf8sU";

const supabase = createClient(url, key);

async function listTables() {
  // This is a hacky way to find tables if we don't have direct access
  const tables = ["lager", "kokebok", "ukesmeny", "handleliste", "messages", "chats"];
  for (const t of tables) {
      const { error } = await supabase.from(t).select("*").limit(0);
      if (!error) {
          console.log(`Table exists: ${t}`);
          // Check columns
          const { data } = await supabase.from(t).select("*").limit(1);
          if (data && data.length > 0) {
              console.log(`Columns in ${t}:`, Object.keys(data[0]));
          }
      } else {
          console.log(`Table does NOT exist: ${t}`);
      }
  }
}

listTables();
