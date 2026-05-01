
const { createClient } = require("@supabase/supabase-js");

const url = "https://ouvsukoorcwthtfkcisr.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dnN1a29vcmN3dGh0ZmtjaXNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ4MTQyNCwiZXhwIjoyMDkzMDU3NDI0fQ.PMqf0wkHLWcH1SuXW22Awxq0PxODMnx2zP1i9Ucf8sU";

const supabase = createClient(url, key);

async function check() {
  const { data, error } = await supabase.from("ukesmeny").select("*");
  console.log("Data length:", data ? data.length : "null");
  if (error) console.error("Error:", error);
  if (data && data.length > 0) {
    console.log("Columns:", Object.keys(data[0]));
  } else {
      // Try to insert with just user_id and see what happens
      const uid = '752bcce1-0195-482d-aebc-73d9d2ce7580';
      const { data: ins, error: insErr } = await supabase.from("ukesmeny").upsert({ user_id: uid }).select();
      console.log("Upsert result:", ins);
      console.log("Upsert error:", insErr);
      if (ins && ins.length > 0) {
          console.log("Columns from upsert:", Object.keys(ins[0]));
      }
  }
}

check();
