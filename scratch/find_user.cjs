
const { createClient } = require("@supabase/supabase-js");

const url = "https://ouvsukoorcwthtfkcisr.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dnN1a29vcmN3dGh0ZmtjaXNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ4MTQyNCwiZXhwIjoyMDkzMDU3NDI0fQ.PMqf0wkHLWcH1SuXW22Awxq0PxODMnx2zP1i9Ucf8sU";

const supabase = createClient(url, key);

async function findUserId() {
  const { data, error } = await supabase.from("lager").select("user_id").limit(1);
  if (data && data.length > 0) {
    console.log("Found user_id:", data[0].user_id);
    const uid = data[0].user_id;
    const { data: cols, error: colError } = await supabase.from("ukesmeny").select("*").eq("user_id", uid).limit(1);
    if (cols && cols.length > 0) {
        console.log("Columns:", Object.keys(cols[0]));
    } else {
        // Try a safe upsert test
        const { error: upsertError } = await supabase.from("ukesmeny").upsert({ user_id: uid, mandag: "test" }).select();
        console.log("Upsert error:", upsertError);
    }
  } else {
    console.log("No users found in lager.");
  }
}

findUserId();
