// supabase/functions/admin-reset-access/index.ts
// Edge Function para restaurar acesso de usuario com codigo temporario seguro
// Reseta senha para codigo unico, marca primeiro_acesso_pendente e resolve solicitacoes pendentes

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

// Gera codigo temporario forte que atende a todos os requisitos de senha:
// Minimo 8 chars, maiuscula, minuscula, numero, simbolo e diferente de ser@2026
function gerarCodigoTemporarioSeguro(): string {
  const charsMaiusculas = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const charsMinusculas = "abcdefghjkmnpqrstuvwxyz";
  const charsNumeros = "23456789";
  const charsSimbolos = "@#$*";
  const todosChars = charsMaiusculas + charsMinusculas + charsNumeros + charsSimbolos;

  const array = new Uint8Array(12);
  crypto.getRandomValues(array);

  // Garantir pelo menos um de cada grupo
  const parte1 = [
    charsMaiusculas[array[0] % charsMaiusculas.length],
    charsMinusculas[array[1] % charsMinusculas.length],
    charsNumeros[array[2] % charsNumeros.length],
    charsSimbolos[array[3] % charsSimbolos.length],
  ];

  const parteRestante: string[] = [];
  for (let i = 4; i < 12; i++) {
    parteRestante.push(todosChars[array[i] % todosChars.length]);
  }

  // Embaralhar
  const todos = [...parte1, ...parteRestante];
  for (let i = todos.length - 1; i > 0; i--) {
    const j = array[i] % (i + 1);
    [todos[i], todos[j]] = [todos[j], todos[i]];
  }

  return "Tmp@" + todos.join("");
}

async function sha256Hex(texto: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

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
    const isAdmin = userRoles.some((rol: string) =>
      ["admin", "administrador", "admin_super", "super_admin"].includes(rol)
    );

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado: apenas administradores podem restaurar acesso." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { profile_id, solicitacao_id } = body;

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
      return new Response(JSON.stringify({ error: "Voce nao pode restaurar seu proprio acesso" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gerar codigo temporario seguro
    const codigoTemporario = gerarCodigoTemporarioSeguro();
    const codigoHash = await sha256Hex(codigoTemporario);

    // Atualizar senha no Supabase GoTrue Auth
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
          password: codigoTemporario,
        }),
      }
    );

    if (!resetPasswordResponse.ok) {
      const errData = await resetPasswordResponse.json();
      const errorMsg = errData.msg || errData.message || "Erro ao definir codigo temporario";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: resetPasswordResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Atualizar perfil: marcar primeiro acesso pendente e armazenar codigo temporario ativo
    const { error: updateErr } = await adminClient
      .from("profiles")
      .update({
        primeiro_acesso_pendente: true,
        data_troca_senha: null,
        codigo_temporario_acesso: codigoTemporario,
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

    // Atualizar ou criar solicitacao com situacao 'aguardando_troca' e codigo ativo
    if (solicitacao_id) {
      await adminClient
        .from("recuperacao_acesso_solicitacoes")
        .update({
          situacao: "aguardando_troca",
          codigo_temporario: codigoTemporario,
          codigo_temporario_hash: codigoHash,
          resolvida_em: new Date().toISOString(),
          resolvida_por: profile.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", solicitacao_id);
    } else {
      const { data: solExistente } = await adminClient
        .from("recuperacao_acesso_solicitacoes")
        .select("id")
        .eq("profile_id", profile_id)
        .in("situacao", ["pendente", "aguardando_troca"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (solExistente) {
        await adminClient
          .from("recuperacao_acesso_solicitacoes")
          .update({
            situacao: "aguardando_troca",
            codigo_temporario: codigoTemporario,
            codigo_temporario_hash: codigoHash,
            resolvida_em: new Date().toISOString(),
            resolvida_por: profile.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", solExistente.id);
      } else {
        const { data: targetRoles } = await adminClient
          .from("user_roles")
          .select("role")
          .eq("profile_id", profile_id)
          .eq("ativo", true);
        const targetRole = targetRoles && targetRoles.length > 0 ? targetRoles[0].role : "coordenador";

        await adminClient
          .from("recuperacao_acesso_solicitacoes")
          .insert({
            user_id: targetProfile.user_id,
            profile_id: targetProfile.id,
            email: targetProfile.email,
            perfil: targetRole,
            situacao: "aguardando_troca",
            codigo_temporario: codigoTemporario,
            codigo_temporario_hash: codigoHash,
            resolvida_em: new Date().toISOString(),
            resolvida_por: profile.id,
            solicitada_em: new Date().toISOString(),
            tentativas: 1,
          });
      }
    }

    // Auditoria
    await adminClient.from("audit_logs").insert({
      tabela: "profiles",
      registro_id: profile_id,
      operacao: "RESTAURAR_ACESSO",
      dados_novos: JSON.stringify({
        primeiro_acesso_pendente: true,
        motivo: "Acesso restaurado com codigo temporario pelo administrador",
        solicitacao_id: solicitacao_id || null,
        codigo_hash: codigoHash,
      }),
      profile_id: profile.id,
    });

    return new Response(JSON.stringify({
      success: true,
      profile_id,
      email: targetProfile.email,
      nome_completo: targetProfile.nome_completo,
      codigo_temporario: codigoTemporario,
      mensagem: "Acesso restaurado com sucesso.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
