// supabase/functions/admin-delete-user/index.ts
// Edge Function segura para excluir definitivamente um usuario via GoTrue Admin API
// Remove auth.users (cascata para profiles) e registra auditoria

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
      .select("id, nome_completo, email")
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
      .select("id, user_id, email, nome_completo, ativo")
      .eq("id", profile_id)
      .single();

    if (targetErr || !targetProfile) {
      return new Response(JSON.stringify({ error: "Usuario alvo nao encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (targetProfile.user_id === user.id) {
      return new Response(JSON.stringify({ error: "Voce nao pode excluir seu proprio usuario" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: otherAdminCount } = await adminClient
      .from("user_roles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("ativo", true)
      .neq("profile_id", profile_id);

    const { data: targetRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("profile_id", profile_id)
      .eq("ativo", true);

    const targetIsAdmin = (targetRoles || []).some((r: any) => r.role === "admin");

    if (targetIsAdmin && (otherAdminCount || 0) === 0) {
      return new Response(JSON.stringify({ error: "Nao e possivel excluir o ultimo administrador ativo do sistema" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dependencies: string[] = [];

    const { count: preceptorCount } = await adminClient
      .from("preceptores")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", profile_id);
    if (preceptorCount && preceptorCount > 0) {
      dependencies.push(`${preceptorCount} preceptor(es) vinculado(s) ao perfil`);
    }

    const { count: presencaCount } = await adminClient
      .from("presencas")
      .select("id", { count: "exact", head: true })
      .eq("registrado_por", profile_id);
    if (presencaCount && presencaCount > 0) {
      dependencies.push(`${presencaCount} presenca(s) registrada(s) por este usuario`);
    }

    if (dependencies.length > 0) {
      return new Response(JSON.stringify({
        error: "Nao e possivel excluir este usuario porque existem registros dependentes",
        dependencies,
      }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const deleteResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${targetProfile.user_id}`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${serviceRoleKey}`,
          "apikey": serviceRoleKey,
          "Content-Type": "application/json",
        },
      }
    );

    if (!deleteResponse.ok) {
      const errData = await deleteResponse.json().catch(() => ({}));
      const errorMsg = errData.msg || errData.message || "Erro ao excluir usuario do auth";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: deleteResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("audit_logs").insert({
      tabela: "profiles",
      registro_id: profile_id,
      operacao: "DELETE",
      dados_anteriores: JSON.stringify({
        user_id: targetProfile.user_id,
        email: targetProfile.email,
        nome_completo: targetProfile.nome_completo,
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
