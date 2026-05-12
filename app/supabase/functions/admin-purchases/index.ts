import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { buildCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsHeaders = buildCorsHeaders();
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      throw new Error("Unauthorized");
    }

    const { data: isAdmin, error: adminRpcError } = await supabase.rpc("is_admin");
    if (adminRpcError || !isAdmin) {
      return new Response(JSON.stringify({ error: "Access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, {
      apiVersion: "2025-08-27.basil",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const sessions = await stripe.checkout.sessions.list({
      limit,
      status: "complete",
      expand: ["data.line_items", "data.customer"],
    });

    const purchases = sessions.data.map((session) => {
      const customer = session.customer as Stripe.Customer | null;
      const lineItems = session.line_items?.data || [];
      const firstItem = lineItems[0];

      return {
        id: session.id,
        email: session.customer_email || customer?.email || "Unknown",
        customer_name: customer?.name || null,
        amount: (session.amount_total || 0) / 100,
        currency: (session.currency || "eur").toUpperCase(),
        package: firstItem?.description || (session.mode === "subscription" ? "Full Access Subscription" : "One-time purchase"),
        mode: session.mode,
        status: session.payment_status,
        created_at: new Date(session.created * 1000).toISOString(),
      };
    });

    return new Response(JSON.stringify({ purchases }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin-purchases] Error:", message);
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
