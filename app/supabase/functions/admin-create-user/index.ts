import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { buildCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders();
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } =
      await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin, error: adminErr } =
      await userClient.rpc("is_admin");
    if (adminErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const fullName = typeof body?.full_name === "string" ? body.full_name.trim() : null;
    const credits = Number.isFinite(body?.credits) ? Math.max(0, Math.floor(body.credits)) : 0;
    const tier = typeof body?.tier === "string" ? body.tier : "none";

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Valid email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: "Password must be at least 6 characters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: newUser, error: createErr } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });

    if (createErr) throw createErr;
    if (!newUser?.user?.id) throw new Error("User creation returned no ID");

    const userId = newUser.user.id;

    // The DB trigger `handle_new_user` auto-creates the profile row.
    // We update it with the admin-specified values.
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (credits > 0) updates.credits = credits;
    if (fullName) updates.full_name = fullName;
    if (tier && tier !== "none") updates.subscription_tier = tier;

    if (Object.keys(updates).length > 1) {
      const { error: profileErr } = await adminClient
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      if (profileErr) {
        console.error("Profile update after create failed:", profileErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${email} created`,
        user: {
          id: userId,
          email,
          full_name: fullName,
          credits,
          subscription_tier: tier,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("admin-create-user error", error);
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
