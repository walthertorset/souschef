
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectTable() {
  const { data, error } = await supabase.from("ukesmeny").select("*").limit(1);
  if (error) {
    console.error("Error fetching ukesmeny:", error);
    return;
  }
  if (data && data.length > 0) {
    console.log("Columns in ukesmeny:", Object.keys(data[0]));
  } else {
    // Try to get columns from another way if table is empty
    console.log("Table is empty. Trying to find columns via dummy insert.");
    const { error: insertError } = await supabase.from("ukesmeny").insert({}).select();
    console.log("Insert error (might reveal columns):", insertError);
  }
}

inspectTable();
