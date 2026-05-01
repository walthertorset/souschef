
const { createClient } = require("@supabase/supabase-js");

const url = "https://ouvsukoorcwthtfkcisr.supabase.co";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91dnN1a29vcmN3dGh0ZmtjaXNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ4MTQyNCwiZXhwIjoyMDkzMDU3NDI0fQ.PMqf0wkHLWcH1SuXW22Awxq0PxODMnx2zP1i9Ucf8sU";

const supabase = createClient(url, key);

async function inspectTable() {
  const { data, error } = await supabase.from("ukesmeny").select("*").limit(1);
  if (error) {
    console.error("Error fetching ukesmeny:", error);
    return;
  }
  if (data && data.length > 0) {
    console.log("Columns in ukesmeny:", Object.keys(data[0]));
  } else {
    console.log("Table is empty.");
  }
}

inspectTable();
