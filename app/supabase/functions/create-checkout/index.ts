import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import Stripe from "npm:stripe@14.21.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            throw new Error("Not authenticated");
        }
        const token = authHeader.replace("Bearer ", "");

        const supabaseClient = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            {
                global: {
                    headers: { Authorization: authHeader },
                },
            }
        );

        const {
            data: { user },
            error: userError,
        } = await supabaseClient.auth.getUser(token);

        if (userError || !user) {
            console.error("[create-checkout] auth error:", userError?.message);
            throw new Error("Not authenticated");
        }

        console.log("[create-checkout] user:", user.email);

        const { priceId, mode, successUrl, cancelUrl, isOneTime } = await req.json();

        const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
            apiVersion: "2023-10-16",
        });

        // Get customer ID from profiles
        const { data: profile } = await supabaseClient
            .from("profiles")
            .select("stripe_customer_id")
            .eq("id", user.id)
            .single();

        let customerId = profile?.stripe_customer_id;

        // If no customer ID, create one
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                metadata: {
                    supabase_user_id: user.id,
                },
            });
            customerId = customer.id;

            await supabaseClient
                .from("profiles")
                .update({ stripe_customer_id: customerId })
                .eq("id", user.id);
        }

        const buildSessionParams = () => ({
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            mode: mode,
            success_url: successUrl,
            cancel_url: cancelUrl,
            allow_promotion_codes: true,
            client_reference_id: user.id,
            metadata: {
                supabase_user_id: user.id,
                type: isOneTime ? "credit_topup" : "subscription_start",
            },
            ...(isOneTime && {
                invoice_creation: { enabled: true },
            }),
        });

        let session;
        try {
            session = await stripe.checkout.sessions.create(buildSessionParams());
        } catch (err: any) {
            if (err?.code === "resource_missing" && err?.param === "customer") {
                const freshCustomer = await stripe.customers.create({
                    email: user.email,
                    metadata: { supabase_user_id: user.id },
                });
                customerId = freshCustomer.id;

                await supabaseClient
                    .from("profiles")
                    .update({ stripe_customer_id: customerId })
                    .eq("id", user.id);

                session = await stripe.checkout.sessions.create(buildSessionParams());
            } else {
                throw err;
            }
        }

        return new Response(JSON.stringify({ url: session.url }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    } catch (error) {
        console.error("[create-checkout] error:", error);
        const errorMessage = error instanceof Error ? error.message : String(error);
        return new Response(JSON.stringify({ error: errorMessage }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
