-- Create system_prompts table for dynamic prompt management
create table if not exists public.system_prompts (
  id uuid default gen_random_uuid() primary key,
  key text not null unique,
  prompt_text text not null,
  description text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.system_prompts enable row level security;

-- Policies
-- 1. Admins can manage (insert/update/delete) prompts
-- Using public.is_admin() function to verify admin status
create policy "Admins can manage prompts"
  on public.system_prompts
  for all
  using (
    public.is_admin() = true
  );

-- 2. Allow read access for everyone (or restrict if desired)
-- Usually needed for the server or admin dashboard to read them.
-- Server-side calls often bypass RLS, but if querying from client:
create policy "Read access"
  on public.system_prompts
  for select
  using (true); 

-- Function to get a prompt by key with fallback
create or replace function public.get_system_prompt(lookup_key text, fallback_text text)
returns text
language plpgsql
security definer
as $$
declare
  found_text text;
begin
  select prompt_text into found_text
  from public.system_prompts
  where key = lookup_key;
  
  if found_text is null then
    return fallback_text;
  else
    return found_text;
  end if;
end;
$$;

-- Seed initial prompts (Best Practice from Phase 7)
insert into public.system_prompts (key, prompt_text, description)
values 
(
  'cyclorama_background', 
  'Environment: Professional High-End Fashion Studio. Features: White Cyclorama Wall (Infinity Curve), Softbox Lighting from top-left, Ambient Occlusion on floor, Realistic cast shadows. NO flat backgrounds. Physical space depth.',
  'Standard studio background description replacing simple seamless backdrop'
),
(
  'forbidden_colors_template',
  'NEGATIVE PROMPT (FORBIDDEN COLORS): If target is {color}, DO NOT USE: {forbidden_list}. The Hex Code {hex} is the ONLY truth. Ignore color names if they conflict.',
  'Template for strict color enforcement'
)
on conflict (key) do update set prompt_text = excluded.prompt_text;
