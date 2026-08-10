// supabase/functions/admin-create-user/index.ts
// Edge Function segura para criar usuarios via GoTrue Admin API
// service_role armazenado como secret, nunca exposto ao cliente

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 1. Autenticar e validar sessao
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

    // Create client with user's JWT to verify session
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Verificar se e admin
    const { data: profile } = await userClient
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .eq("ativo", true)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Perfil não encontrado ou inativo" }), {
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

    // 3. Parsear body
    const body = await req.json();
    const { email, password, nome_completo, telefone, roles: newRoles } = body;

    if (!email || !password || !nome_completo) {
      return new Response(JSON.stringify({ error: "Email, senha e nome completo são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 8) {
      return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 8 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!newRoles || !Array.isArray(newRoles) || newRoles.length === 0) {
      return new Response(JSON.stringify({ error: "Pelo menos um perfil é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Only admin and coordenacao roles allowed
    const allowedRoles = ["admin", "coordenacao"];
    const invalidRoles = newRoles.filter((r: string) => !allowedRoles.includes(r));
    if (invalidRoles.length > 0) {
      return new Response(JSON.stringify({ error: `Perfis inválidos: ${invalidRoles.join(", ")}. Permitidos: ${allowedRoles.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Criar usuario via GoTrue Admin API
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const createResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceRoleKey}`,
        "apikey": serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { nome_completo },
      }),
    });

    if (!createResponse.ok) {
      const errData = await createResponse.json();
      const errorMsg = errData.msg || errData.message || "Erro ao criar usuário";
      return new Response(JSON.stringify({ error: errorMsg }), {
        status: createResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const newUser = await createResponse.json();

    // 5. Profile ja e criado pelo trigger handle_new_auth_user
    // Aguardar um momento e buscar o profile
    await new Promise((resolve) => setTimeout(resolve, 800));

    const { data: newProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("user_id", newUser.id)
      .single();

    if (profileError || !newProfile) {
      // Trigger might not have fired; create profile manually
      const { data: createdProfile, error: createProfErr } = await adminClient
        .from("profiles")
        .insert({
          user_id: newUser.id,
          nome_completo,
          email,
          telefone: telefone || null,
          ativo: true,
        })
        .select("id")
        .single();

      if (createProfErr) {
        return new Response(JSON.stringify({ error: "Erro ao criar perfil: " + createProfErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Update profile with new fields
      await adminClient
        .from("profiles")
        .update({
          papel: newRoles[0] || "coordenacao",
          status: "ativo",
          primeiro_acesso_pendente: true,
          responsavel_ultima_alteracao: user.email,
        })
        .eq("id", createdProfile.id);

      // Assign roles
      for (const role of newRoles) {
        await adminClient.from("user_roles").insert({
          profile_id: createdProfile.id,
          role,
          ativo: true,
        });
      }

      // Audit
      await adminClient.from("audit_logs").insert({
        tabela: "profiles",
        registro_id: createdProfile.id,
        operacao: "INSERT",
        dados_novos: JSON.stringify({ user_id: newUser.id, email, nome_completo, roles: newRoles }),
        profile_id: profile.id,
      });

      return new Response(JSON.stringify({
        success: true,
        user_id: newUser.id,
        profile_id: createdProfile.id,
        email,
        nome_completo,
        roles: newRoles,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Profile exists (trigger created it); update if needed
    await adminClient
      .from("profiles")
      .update({
        telefone: telefone || null,
        papel: newRoles[0] || "coordenacao",
        status: "ativo",
        primeiro_acesso_pendente: true,
        responsavel_ultima_alteracao: user.email,
      })
      .eq("id", newProfile.id);

    // Assign roles
    for (const role of newRoles) {
      await adminClient.from("user_roles").insert({
        profile_id: newProfile.id,
        role,
        ativo: true,
      }).select();
    }

    // Audit
    await adminClient.from("audit_logs").insert({
      tabela: "profiles",
      registro_id: newProfile.id,
      operacao: "INSERT",
      dados_novos: JSON.stringify({ user_id: newUser.id, email, nome_completo, roles: newRoles }),
      profile_id: profile.id,
    });

    return new Response(JSON.stringify({
      success: true,
      user_id: newUser.id,
      profile_id: newProfile.id,
      email,
      nome_completo,
      roles: newRoles,
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
