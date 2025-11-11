from wafer_prober_agent import WaferProberAgent


TABLE_DEFINITIONS = {
    "WaferType": [
        "id", "name", "engineeringRun", "foundry", "technology"
    ],
    "WaferTypeMap": [
        "waferTypeId", "waferMap"
    ],
    "WaferTypeImage": [
        "waferTypeId", "imageBase64String"
    ],
    "Wafer": [
        "id", "waferTypeId", "serialNumber", "batchNumber",
        "thinningDate", "dicingDate", "productionDate", "generalLocation"
    ],
    "WaferLocation": [
        "waferId", "generalLocation", "date", "username", "note"
    ],
    "Version": [
        "id", "name", "baseVersion", "creationTime", "note"
    ],
    "Asic": [
        "id", "waferId", "chipId", "serialNumber",
        "familyType", "waferMapPosition", "quality"
    ],
    "ProbeCard": [
        "id", "serialNumber", "vendor", "name", "model",
        "version", "arrivalDate", "location", "type", "vendorCleaningInterval"
    ],
    "ProbeCardFamilyType": [
        "probeCardId", "asicFamilyType"
    ],
    "WaferProbeMachine": [
        "id", "serialNumber", "name", "hostName", "connectionType",
        "connectionPort", "generalLocation", "software", "swVersion",
        "vendor", "loadedWaferId", "installedProbeCardId"
    ],
    "WaferLoadedInMachine": [
        "machineId", "waferId", "date", "username", "status"
    ],
    "ProbeCardInstalledInMachine": [
        "machineId", "probeCardId", "date", "username"
    ],
    "WaferProbeProject": [
        "id", "wpMachineId", "waferTypeId", "asicFamilyType",
        "orientation", "name", "alignmentDie", "homeDie", "local2GlobalMap"
    ],
    "ProbeCardMaintenance": [
        "id", "probeCardId", "cleaningDate", "totNumContacts",
        "numContactsSinceLastCleaning", "numContactsDuringCleaning",
        "cleaningOverdrive"
    ],
    "AsicProbing": [
        "id", "asicId", "numContacts", "mechanicalQuality", "arrivalDate"
    ],
    "AsicConfiguration": [
        "id", "probeStationId", "versionId", "isTestingAllowed"
    ],
    "WpConfiguration": [
        "id", "wpMachineId", "versionId", "orientation"
    ],
    "ProbeCardConfiguration": [
        "id", "probeCardId", "versionId", "cleaningInterval"
    ],
    "Chip": [
        "id", "serialNumber", "generalLocation"
    ],
    "ChipLocation": [
        "chipId", "generalLocation", "date", "username", "note"
    ],
    "EquipmentType": [
        "id", "name"
    ],
    "Equipment": [
        "id", "name", "equipmentTypeId", "generalLocation", "specification"
    ],
    "EquipmentLocation": [
        "equipmentId", "generalLocation", "date", "username", "note"
    ],
    "SLDO": [
        "id", "chipId", "serialNumber"
    ],
    "TestSetup": [
        "id", "name", "generalLocation"
    ],
    "SLDOTestConfiguration": [
        "id", "name", "mode", "loadCapacitance",
        "loadCurrent", "temperature"
    ],
    "SLDOTestList": [
        "name", "config", "input", "version"
    ],
    "SLDOTest": [
        "id", "name", "timestamp", "SLDOid", "testSetupId",
        "configId", "testValues"
    ]
}




class DBRetrivalAgent(WaferProberAgent):
    """
    Retrive information from the wafer-probe database and communicate
    results over Kafka.
    """

    def get_table_all(self, table: str, timeout: float = 10.0):
        # Fetch all rows for the given table name via Kafka request/reply.
        if table not in TABLE_DEFINITIONS:
            raise ValueError(f"Unknown table: {table}")

        payload = {"type": "GetDBTable", "params": {"table": table}} #command type of DB agent? 
        reply = self.kafka.request_reply( 
            request_topic="svt.db-agent",   #the Kafka topic of DBagent
            reply_topic="svt.wp-agent.reply", ##??
            payload=payload,
            reply_type="GetDBTableResult",
            timeout=timeout,
        )

        if not reply or reply.get("status") != "success":
            raise RuntimeError(f"DB request failed for table '{table}': {reply}")

        rows = reply.get("rows") or reply.get("output") or []  # How DB retunrs the fileds?
        # Attach table structure metadata so you know available fields
        return {
            "table": table,
            "fields": TABLE_DEFINITIONS[table],
            "rows": rows,
        }


    def get_field_values(self, table: str, field: str, timeout: float = 10.0):
            """Get only one specific column from a table."""
            result = self.get_table_all(table, timeout)
            if field not in result["fields"]:
                raise ValueError(f"Field '{field}' not found in table '{table}'")
            return [row.get(field) for row in result["rows"] if field in row]

