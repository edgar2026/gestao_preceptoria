// supabase/functions/admin-reset-access/index.ts
// Edge Function para redefinir acesso de usuario
// Reseta senha para ser@2026 e marca primeiro_acesso_pendente

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY");

    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Service role key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessao invalida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await userClient
      .from("profiles")
      .select("id, nome_completo")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Perfil nao encontrado ou inativo" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("profile_id", profile.id)
      .eq("ativo", true);

    const userRoles = (roles || []).map((r: any) => r.role);
    if (!userRoles.includes("admin")) {
      return new Response(JSON.stringify({ error: "Acesso negado: apenas administradores" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { profile_id } = body;

    if (!profile_id) {
      return new Response(JSON.stringify({ error: "profile_id e obrigatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: targetProfile, error: targetErr } = await adminClient
      .from("profiles")
      .select("id, user_id, email, nome_completo")
      .eq("id", profile_id)
      .single();

    if (targetErr || !targetProfile) {
      return new Response(JSON.stringify({ error: "Usuario alvo nao encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetProfile.user_id === user.id) {
      return new Response(JSON.stringify({ error: "Voce nao pode redefinir seu proprio acesso" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetPasswordResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${targetProfile.user_id}`,
      {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: "ser@2026",
        }),
      }
    );

    if (!resetPasswordResponse.ok) {
      const errData = await resetPasswordResponse.json();
      const errorMsg = errData.msg || errData.message || "Erro ao redefinir senha";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: resetPasswordResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updateErr } = await adminClient
      .from("profiles")
      .update({
        primeiro_acesso_pendente: true,
        data_troca_senha: null,
        responsavel_ultima_alteracao: user.email,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile_id);

    if (updateErr) {
      return new Response(JSON.stringify({ error: "Erro ao atualizar perfil: " + updateErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("audit_logs").insert({
      tabela: "profiles",
      registro_id: profile_id,
      operacao: "REDEFINIR_ACESSO",
      dados_novos: JSON.stringify({
        primeiro_acesso_pendente: true,
        motivo: "Redefinicao forcada pelo administrador",
      }),
      profile_id: profile.id,
    });

    return new Response(JSON.stringify({
      success: true,
      profile_id,
      email: targetProfile.email,
      nome_completo: targetProfile.nome_completo,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
