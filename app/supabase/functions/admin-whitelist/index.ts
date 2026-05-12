import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { buildCorsHeaders } from "../_shared/cors.ts";

type Action = "add" | "remove";

async function findUserIdByEmail(
  // Use `any` to avoid Deno type/generic mismatches across supabase-js builds.
  adminClient: any,
  emailLower: string,
): Promise<string | null> {
  // Supabase Auth Admin API does not provide a direct get-by-email endpoint.
  // We page through users (small admin apps) and match by lowercased email.
  const perPage = 200;
  const maxPages = 20; // 4k users max scan

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = (data.users || []).find(
      (u: any) => (u.email ?? "").trim().toLowerCase() === emailLower,
    );
    if (match?.id) return match.id;

    if ((data.users || []).length < perPage) break;
  }

  return null;
}

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

    // User-context client (used only for auth + is_admin RPC)
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerEmail = (userData.user.email ?? "").trim();

    const { data: isAdmin, error: adminErr } = await userClient.rpc("is_admin");
    if (adminErr || !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "") as Action;
    const email = String(body?.email ?? "").trim().toLowerCase();
    const reason = typeof body?.reason === "string" ? body.reason.trim() : null;
    const grantCredits = Number.isFinite(body?.grantCredits)
      ? Math.max(0, Math.floor(body.grantCredits))
      : 1_000_000;

    if (!action || !["add", "remove"].includes(action)) {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service client for privileged mutations (bypasses RLS)
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    if (action === "add") {
      const { error: upsertErr } = await adminClient
        .from("whitelisted_users")
        .upsert(
          {
            email,
            reason,
            created_by: callerEmail || null,
          },
          { onConflict: "email" },
        );
      if (upsertErr) throw upsertErr;

      // Ensure profile exists, set unlimited flag, and grant credits
      const targetUserId = await findUserIdByEmail(adminClient, email);
      if (targetUserId) {
        const { data: profile, error: profileErr } = await adminClient
          .from("profiles")
          .select("credits")
          .eq("id", targetUserId)
          .maybeSingle();
        if (profileErr) throw profileErr;

        if (!profile) {
          const { error: insertErr } = await adminClient.from("profiles").insert({
            id: targetUserId,
            credits: grantCredits,
            // Per requirement: whitelisted users get a 1,000,000 credit balance (not unlimited).
            is_unlimited: false,
          });
          if (insertErr) throw insertErr;
        } else {
          const nextCredits = Math.max(profile.credits ?? 0, grantCredits);
          const { error: updateErr } = await adminClient
            .from("profiles")
            .update({
              // Ensure at least 1,000,000 credits; never reduce if user already has more.
              credits: nextCredits,
              is_unlimited: false,
            })
            .eq("id", targetUserId);
          if (updateErr) throw updateErr;
        }
      }

      return new Response(
        JSON.stringify({ success: true, email, granted: grantCredits }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // remove
    const { error: delErr } = await adminClient
      .from("whitelisted_users")
      .delete()
      .eq("email", email);
    if (delErr) throw delErr;

    const targetUserId = await findUserIdByEmail(adminClient, email);
    if (targetUserId) {
      const { error: updateErr } = await adminClient
        .from("profiles")
        .update({ is_unlimited: false })
        .eq("id", targetUserId);
      if (updateErr) throw updateErr;
    }

    return new Response(JSON.stringify({ success: true, email }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("admin-whitelist error", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
