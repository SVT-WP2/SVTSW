\set SchemaName %SCHEMA_NAME%
--Create schema
CREATE SCHEMA IF NOT EXISTS :SchemaName;
-- SELECT SCHEMA
SET search_path TO :SchemaName;

--Taking from
INSERT INTO probecard VALUES (
  1,
  'MVP251669H',
  'MPI',
  'NKF7_MPI',
  'NKF7-TS3500-CABLEOUT-MLO(EVS-P)',
  2,
  '6/6/2025',
  'CERN',
  'Vertical',
  200
);

INSERT INTO probecardfamilytype VALUES (
  1,
  'NKF7'
);

