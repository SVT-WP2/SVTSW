from wafer_prober_agent import WaferProberAgent


class DBRetrievalAgent(WaferProberAgent):
    """
    Wrapper for the SVT DB Agent API.
    Converts Python method calls into Kafka request messages matching the OpenAPI spec.
    """

    REQUEST_TOPIC = "svt.db-agent.request"
    REPLY_TOPIC = "svt.db-agent.request.reply"

    def _db(self, message_type: str, data: dict | None = None, timeout: float = 10.0):
        payload = {
            "type": message_type,
            "data": data or {}
        }

        reply = self.send(
            command=self.REQUEST_TOPIC,
            params=payload,
            wait_for_reply=True,
            timeout=timeout,
        )

        # expected DB Agent reply shape:
        # {
        #   "status": "Success",
        #   "type": "GetAllWafersReply",
        #   "data": { ... }
        # }

        status = reply.get("status")
        if status != "Success":
            raise RuntimeError(
                f"DBAgent returned error for {message_type}: {reply.get('error')}"
            )

        return reply.get("data")

    # ---------------------------------------------------------
    # WAFER TYPES
    # ---------------------------------------------------------

    def get_all_wafer_types(self, ids=None):
        return self._db("GetAllWaferTypes", {"filter": {"ids": ids or []}})

    def create_wafer_type(self, create: dict):
        return self._db("CreateWaferType", {"create": create})

    def get_wafer_type_map(self, wafer_type_id: int):
        return self._db("GetWaferTypeMap", {"waferTypeId": wafer_type_id})

    # ---------------------------------------------------------
    # WAFERS
    # ---------------------------------------------------------

    def get_all_wafers(self, ids=None):
        return self._db("GetAllWafers", {"filter": {"ids": ids or []}})

    def create_wafer(self, create: dict):
        return self._db("CreateWafer", {"create": create})

    def update_wafer(self, wafer_id: int, update: dict):
        return self._db("UpdateWafer", {"id": wafer_id, "update": update})

    def update_wafer_location(self, dto: dict):
        return self._db("UpdateWaferLocation", dto)

    def get_wafer_location_history(self, wafer_id: int):
        return self._db("GetWaferLocationHistory", {"waferId": wafer_id})

    # ---------------------------------------------------------
    # ASICS
    # ---------------------------------------------------------

    def get_all_asics(self, filter=None, pager=None):
        return self._db("GetAllAsics", {
            "filter": filter or {},
            "pager": pager or {}
        })

    def create_asic(self, create: dict):
        return self._db("CreateAsic", {"create": create})

    # ---------------------------------------------------------
    # CHIPS
    # ---------------------------------------------------------

    def get_all_chips(self, filter=None):
        return self._db("GetAllChips", {"filter": filter or {}})

    def create_chip(self, create: dict):
        return self._db("CreateChip", {"create": create})

    def create_many_chips(self, create: dict):
        return self._db("CreateManyChips", {"create": create})

    def update_chip_location(self, dto: dict):
        return self._db("UpdateChipLocation", dto)

    def get_chip_location_history(self, chip_id: int):
        return self._db("GetChipLocationHistory", {"chipId": chip_id})

    # ---------------------------------------------------------
    # EQUIPMENT TYPES
    # ---------------------------------------------------------

    def get_all_equipment_types(self, ids=None):
        return self._db("GetAllEquipmentTypes", {"filter": {"ids": ids or []}})

    def create_equipment_type(self, create: dict):
        return self._db("CreateEquipmentType", {"create": create})

    # ---------------------------------------------------------
    # EQUIPMENTS
    # ---------------------------------------------------------

    def get_all_equipments(self, ids=None):
        return self._db("GetAllEquipments", {"filter": {"ids": ids or []}})

    def create_equipment(self, create: dict):
        return self._db("CreateEquipment", {"create": create})

    def update_equipment_location(self, dto: dict):
        return self._db("UpdateEquipmentLocation", dto)

    def get_equipment_location_history(self, equipment_id: int):
        return self._db("GetEquipmentLocationHistory", {"equipmentId": equipment_id})

    # ---------------------------------------------------------
    # ENUMS
    # ---------------------------------------------------------

    def get_all_enums(self, enum_names=None):
        return self._db("GetAllEnums", {"enumsNames": enum_names or []})



# db = DBRetrievalAgent()

# w = db.get_all_wafers()
# print(w["items"])

# new_chip = db.create_chip({
#     "serialNumber": "CHIP42",
#     "asicId": 77,
#     "generalLocation": "Warehouse"
# })
# print(new_chip["entity"])