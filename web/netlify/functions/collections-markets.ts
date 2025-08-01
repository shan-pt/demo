import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "./utils/auth";

const supabase = createClient(process.env.SUPABASE_PROJECT_URL!, process.env.SUPABASE_API_KEY!);

export default async (req: Request) => {
  try {
    const userId = verifyToken(req.headers.get("Authorization") || "");
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    // Handle GET request
    if (req.method === "GET") {
      const { data: collectionsMarkets } = await supabase.from("collections_markets").select().eq("user_id", userId);

      return new Response(JSON.stringify({ data: collectionsMarkets }), { status: 200 });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500 });
  }
};
