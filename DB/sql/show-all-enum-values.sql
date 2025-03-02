-- SHOW enum values
SELECT n.nspname AS enum_schema,  
       t.typname AS enUm_name,  
       e.enumlabel AS enum_value
FROM pg_type t 
   join pg_enum e on t.oid = e.enumtypid  
   join pg_catalog.pg_namespace n ON n.oid = t.typnamespace;

