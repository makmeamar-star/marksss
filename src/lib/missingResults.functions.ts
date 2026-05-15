import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MissingResult = {
  market_id: string;
  display_name: string;
  session: "OPEN" | "CLOSE";
  scheduled_time: string;
  minutes_overdue: number;
};

export const getMissingResults = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase.rpc("find_missing_results");
    if (error) {
      console.error("getMissingResults", error);
      return { rows: [] as MissingResult[], error: error.message };
    }
    return { rows: (data ?? []) as MissingResult[], error: null };
  });
