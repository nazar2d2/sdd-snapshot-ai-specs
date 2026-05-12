import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import Stripe from "npm:stripe@14.21.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map price IDs (or metadata) to Credit amounts
// In a real app, this might be in a DB or config constant.
// For now, we'll try to deduce from metadata or use a hardcoded map if helpful,
// OR we can fetch the Product metadata from Stripe if we stored 'credits' there.
// PLAN: We will instruct the user to add 'credits' metadata to their Stripe Prices/Products.
// FALLBACK: Hardcoded mapping based on the prompt's prices.
const CREDITS_PER_PRICE: Record<string, number> = {
  // We can't know the IDs yet.
  // We will rely on Metadata passed during checkout or Product Metadata.
  // Let's implement Product Metadata lookup for robustness.
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const signature = req.headers.get("stripe-signature");

  try {
    if (!signature || !endpointSecret) {
      throw new Error("Missing signature or webhook secret");
    }

    const body = await req.text();
    let event;

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error(`⚠️  Webhook signature verification failed.`, errMessage);
      return new Response(JSON.stringify({ error: errMessage }), { status: 400 });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    console.log(`Processing event: ${event.type}`);

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object, supabase);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object, supabase);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, supabase);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    const errMessage = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: errMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Separate credit maps for subscriptions vs top-ups to avoid $10 ambiguity
const SUBSCRIPTION_CREDITS: Record<number, number> = {
  // Monthly
  1000: 75,      // Basic $10/mo
  2895: 250,     // Starter $28.95/mo
  4995: 500,     // Advanced $49.95/mo
  12495: 1000,   // Generator $124.95/mo
  // Yearly
  10000: 75,     // Basic $100/yr
  28950: 250,    // Starter $289.50/yr
  49950: 500,    // Advanced $499.50/yr
  124950: 1000,  // Generator $1249.50/yr
};

const TOPUP_CREDITS: Record<number, number> = {
  1000: 50,      // Small $10
  2500: 150,     // Medium $25
  5000: 350,     // Large $50
  9900: 750,     // Mega $99
};

async function getCreditsFromPrice(priceId: string, mode: "subscription" | "payment" = "subscription"): Promise<number> {
  try {
    const price = await stripe.prices.retrieve(priceId, { expand: ["product"] });
    const product = price.product as Stripe.Product;
    // Check metadata first
    if (product.metadata && product.metadata.credits) {
      return parseInt(product.metadata.credits, 10);
    }

    // Fallback: Map based on unit_amount in cents (USD), using mode to disambiguate
    const amount = price.unit_amount;
    const map = mode === "payment" ? TOPUP_CREDITS : SUBSCRIPTION_CREDITS;
    const credits = map[amount as number];
    
    if (credits !== undefined) return credits;

    console.warn(`[WEBHOOK] Could not determine credits for price ${priceId} (amount: ${amount} cents, mode: ${mode}). Returning 0.`);
    return 0;
  } catch (e) {
    console.error("Error fetching price details:", e);
    return 0;
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, supabase: any) {
  const userId = session.metadata?.supabase_user_id || session.client_reference_id;
  if (!userId) {
    console.error("No user ID in session metadata");
    return;
  }

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (!profile) return;

  // Retrieve line items to know what was bought
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
  const priceId = lineItems.data[0]?.price?.id;

  if (!priceId) return;
  const creditsToAdd = await getCreditsFromPrice(priceId, session.mode as "subscription" | "payment");

  if (session.mode === "payment") {
    // One-time credit top-up
    await supabase
      .from("profiles")
      .update({
        credits: (profile.credits || 0) + creditsToAdd,
        stripe_customer_id: session.customer, // Ensure customer ID is set
      })
      .eq("id", userId);
    console.log(`Added ${creditsToAdd} credits to user ${userId} (Top-up)`);
  } else if (session.mode === "subscription") {
    // New Subscription
    await supabase
      .from("profiles")
      .update({
        credits: (profile.credits || 0) + creditsToAdd, // Add initial credits
        subscription_status: "active",
        subscription_tier: "paid", // Could be more specific based on price
        stripe_customer_id: session.customer,
      })
      .eq("id", userId);
    console.log(`Activated subscription for user ${userId}, added ${creditsToAdd} credits`);
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice, supabase: any) {
  if (invoice.billing_reason === "subscription_cycle") {
    const customerId = invoice.customer as string;
    // Find user by stripe_customer_id
    const { data: profile } = await supabase.from("profiles").select("*").eq("stripe_customer_id", customerId).single();

    if (!profile) {
      console.error(`No profile found for customer ${customerId}`);
      return;
    }

    const priceId = invoice.lines.data[0]?.price?.id;
    const creditsToAdd = await getCreditsFromPrice(priceId, "subscription");

    // ROLLOVER LOGIC: Just ADD to existing balance.
    // "Credits worden elke maand automatisch vernieuwd. Ongebruikte credits worden meegenomen"
    // Interpretation: Add new monthly allowance to whatever is leftover.

    await supabase
      .from("profiles")
      .update({
        credits: (profile.credits || 0) + creditsToAdd,
        subscription_status: "active",
        current_period_end: new Date(invoice.lines.data[0]?.period.end * 1000).toISOString(),
      })
      .eq("id", profile.id);

    console.log(`Renewal for user ${profile.id}: Added ${creditsToAdd} credits (Rollover active)`);
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabase: any) {
  const customerId = subscription.customer as string;
  await supabase
    .from("profiles")
    .update({
      subscription_status: "canceled",
    })
    .eq("stripe_customer_id", customerId);
  console.log(`Subscription canceled for customer ${customerId}`);
}
