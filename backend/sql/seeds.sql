truncate table notes cascade;

insert into notes (title, content) values
  ('Template ready', 'Supabase + Lambda template is ready to accept data.'),
  ('Projects seeded', 'This note proves seeding works with the schema script.');
