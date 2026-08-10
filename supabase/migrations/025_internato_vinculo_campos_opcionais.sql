-- Cadastro de Preceptor do Internato: somente Nome completo é obrigatório.
-- O vínculo exclusivo de Internato pode ser criado sem semestre/internato/data de início
-- e ser completado depois ("Completar cadastro").
alter table public.vinculos_internato
  alter column semestre_id drop not null,
  alter column internato_id drop not null,
  alter column data_inicio drop not null;
