\set SchemaName %SCHEMA_NAME%
--Create schema
CREATE SCHEMA IF NOT EXISTS :SchemaName;
-- SELECT SCHEMA
SET search_path TO :SchemaName;

-- ALTER TABLE "AsicProbing" ADD FOREIGN KEY ("asicId") REFERENCES "Asic" ("id");
--
-- ALTER TABLE "WaferLoadedInMachine" ADD FOREIGN KEY ("machineId") REFERENCES "WaferProbeMachine" ("id");
--
-- ALTER TABLE "WaferLoadedInMachine" ADD FOREIGN KEY ("waferId") REFERENCES "Wafer" ("id");
--
-- ALTER TABLE "ProbeCardInstalledInMachine" ADD FOREIGN KEY ("machineId") REFERENCES "WaferProbeMachine" ("id");
--
-- ALTER TABLE "ProbeCardInstalledInMachine" ADD FOREIGN KEY ("probeCardId") REFERENCES "ProbeCard" ("id");
--
-- ALTER TABLE "AsicConfiguration" ADD FOREIGN KEY ("probeStationId") REFERENCES "WaferProbeMachine" ("id");
--
-- ALTER TABLE "AsicConfiguration" ADD FOREIGN KEY ("versionId") REFERENCES "Version" ("id");
--
-- ALTER TABLE "WpConfiguration" ADD FOREIGN KEY ("wpMachineId") REFERENCES "WaferProbeMachine" ("id");
--
-- ALTER TABLE "WpConfiguration" ADD FOREIGN KEY ("versionId") REFERENCES "Version" ("id");
--
-- ALTER TABLE "ProbeCardConfiguration" ADD FOREIGN KEY ("probeCardId") REFERENCES "ProbeCard" ("id");

-- ALTER TABLE "ProbeCardConfiguration" ADD FOREIGN KEY ("versionId") REFERENCES "Version" ("id");
-- DROP TABLE WaferType CASCADE;
-- DROP TABLE Wafer CASCADE;
-- DROP TABLE WaferLocation CASCADE;
-- DROP TABLE WaferTypeImage CASCADE;
-- DROP TABLE Asic CASCADE;

-- DELETE FROM waferlocation;
-- DELETE FROM asic;
-- DELETE FROM wafer;
-- DELETE FROM waferprobeproject;
-- DELETE FROM wafertype;
--
-- ALTER SEQUENCE asic_id_seq RESTART;
-- ALTER SEQUENCE wafer_id_seq RESTART;
-- ALTER SEQUENCE waferprobeproject_id_seq RESTART;
-- ALTER SEQUENCE wafertype_id_seq RESTART;

-- ALTER TYPE "asicFamilyType" RENAME VALUE 'AOIO' TO 'AO10';
-- ALTER TYPE "asicFamilyType" RENAME VALUE 'AOIO_P' TO 'AO10P';
-- ALTER TYPE "asicFamilyType" RENAME VALUE 'AOIO_B' TO 'AO10B';
-- ALTER TYPE "asicFamilyType" RENAME VALUE 'AFIS' TO 'AF15';
-- ALTER TYPE "asicFamilyType" RENAME VALUE 'AFISP' TO 'AF15P';
-- ALTER TYPE "asicFamilyType" RENAME VALUE 'AFISB' TO 'AF15B';
