\set SchemaName Test
--\set SchemaName Prod
--Create schema
CREATE SCHEMA IF NOT EXISTS :SchemaName;
-- SELECT SCHEMA
SET search_path TO :SchemaName;

-- WaferType refereced by:
ALTER TABLE Wafer ADD FOREIGN KEY (waferTypeId) REFERENCES WaferType (id);
ALTER TABLE WaferTypeImage ADD FOREIGN KEY (waferTypeId) REFERENCES WaferType (id);

-- Wafer referenced by:
ALTER TABLE WaferLocation ADD FOREIGN KEY (waferId) REFERENCES Wafer (id);
ALTER TABLE Asic ADD FOREIGN KEY (waferId) REFERENCES Wafer (id);

-- ALTER TABLE "Version" ADD FOREIGN KEY ("baseVersion") REFERENCES "Version" ("id");

ALTER TABLE "ProbeCardFamilyType" ADD FOREIGN KEY ("probeCardId") REFERENCES "ProbeCard" ("id");

--
-- ALTER TABLE "WaferProbeProject" ADD FOREIGN KEY ("waferTypeId") REFERENCES "WaferType" ("id");
--
-- ALTER TABLE "ProbeCardMaintenance" ADD FOREIGN KEY ("probeCardId") REFERENCES "ProbeCard" ("id");
--
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
--
-- ALTER TABLE "ProbeCardConfiguration" ADD FOREIGN KEY ("versionId") REFERENCES "Version" ("id");
