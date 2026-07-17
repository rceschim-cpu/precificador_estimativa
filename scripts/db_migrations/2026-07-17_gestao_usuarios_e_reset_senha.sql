-- Aplicado direto no Supabase em 2026-07-17. Registrado aqui só como
-- documentação/histórico — não é rodado automaticamente por nada.
--
-- CONTEXTO: uma trava de segurança anterior ("revoke anon read on
-- usuarios.senha") saiu mais ampla que o previsto — revogou TODO o SELECT
-- da tabela usuarios pro anon key (não só a coluna senha), e isso quebrou
-- a Gestão de Usuários de duas formas:
--   1) UPDATE/DELETE com WHERE id=... precisam de SELECT na coluna do
--      filtro mesmo sem devolver nada — sem isso, "permission denied".
--   2) o app pedia "Prefer: return=representation" (padrão do sbFetch),
--      que também precisa de SELECT pra devolver a linha atualizada.

-- 1) Restaura SELECT em todas as colunas MENOS senha (mantém a proteção
--    original — só a senha continua ilegível pelo anon key).
grant select (id, nome, email, perfil, status, criado_em, aprovado_em, aprovado_por, reset_solicitado_em)
on usuarios to anon, authenticated;

-- 2) Coluna nova pra sinalizar solicitação de reset de senha (tela de login).
alter table usuarios add column if not exists reset_solicitado_em timestamptz;

-- 3) RPC de listagem (fonte única usada por db.getUsers) — redundante com o
--    grant acima, mas mantido como API explícita.
create or replace function public.listar_usuarios()
returns table(id uuid, nome text, email text, perfil text, status text,
               criado_em timestamptz, aprovado_em timestamptz, aprovado_por text,
               reset_solicitado_em timestamptz)
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  return query select u.id,u.nome,u.email,u.perfil,u.status,u.criado_em,u.aprovado_em,u.aprovado_por,u.reset_solicitado_em
  from usuarios u order by u.criado_em desc;
end;
$$;

-- 4) Usuário (tela de login) sinaliza que quer redefinir a senha. Só marca
--    contas com status='ativo' — mesma mensagem de sucesso é mostrada
--    exista ou não a conta, pra não confirmar/negar e-mail cadastrado.
create or replace function public.solicitar_reset_senha(p_email text)
returns boolean
language plpgsql security definer set search_path to 'public','extensions' as $$
declare v_count int;
begin
  update usuarios set reset_solicitado_em = now()
  where email = lower(trim(p_email)) and status = 'ativo';
  get diagnostics v_count = row_count;
  return v_count > 0;
end;
$$;

-- 5) Admin define a nova senha (via Gestão de Usuários > Redefinições de
--    senha). É a ÚNICA forma de escrever na coluna senha agora — o UPDATE
--    direto nessa coluna foi revogado do anon/authenticated (item 6).
create or replace function public.admin_resetar_senha(p_user_id uuid, p_nova_senha text)
returns boolean
language plpgsql security definer set search_path to 'public','extensions' as $$
begin
  update usuarios set senha = crypt(p_nova_senha, gen_salt('bf')), reset_solicitado_em = null
  where id = p_user_id;
  return found;
end;
$$;

grant execute on function public.listar_usuarios() to anon, authenticated;
grant execute on function public.solicitar_reset_senha(text) to anon, authenticated;
grant execute on function public.admin_resetar_senha(uuid, text) to anon, authenticated;

-- 6) Sem isso, qualquer um com o anon key (público, embutido no bundle JS)
--    conseguia fazer UPDATE direto na coluna senha de QUALQUER usuário sem
--    nenhuma verificação — pior que a exposição original de leitura.
revoke update (senha) on usuarios from anon, authenticated;
