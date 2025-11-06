# WPAgent/db_aware_wafer_prober_agent.py
from WPAgent.wafer_prober_agent import WaferProberAgent
from kafka import KafkaProducer, KafkaConsumer
import json, uuid, threading

class DBAwareWaferProberAgent(WaferProberAgent):
    """
    Extends WaferProberAgent with communication to SVT DB Agent via Kafka.
    Handles wafer-related data queries (GetAllWafers, GetWaferTypeMap, etc.).
    """

    def __init__(self, kafka_broker_url: str = "localhost:9092"):
        # Initialize everything from the base class (command handler, etc.)
        super().__init__()

        # New DB-related Kafka topics and clients
        self.kafka_broker_url = kafka_broker_url
        self.request_topic = "svt.db-agent.request"
        self.reply_topic = f"{self.request_topic}.reply"

        self.producer = KafkaProducer(
            bootstrap_servers=self.kafka_broker_url,
            value_serializer=lambda v: json.dumps(v).encode("utf-8"),
        )
        self.consumer = KafkaConsumer(
            self.reply_topic,
            bootstrap_servers=self.kafka_broker_url,
            group_id=f"wp_agent_{uuid.uuid4()}",
            auto_offset_reset="latest",
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        )

        self.pending_requests = {}
        self._start_reply_listener()


    # ------------------------------------------------------------------
    # Internal: Request/Reply flow
    # ------------------------------------------------------------------
    def _start_reply_listener(self):
        """Start a thread to continuously listen for DB replies."""
        def listen():
            for msg in self.consumer:
                reply = msg.value
                msg_id = reply.get("correlationId")
                if msg_id and msg_id in self.pending_requests:
                    cb = self.pending_requests.pop(msg_id)
                    cb(reply)
        threading.Thread(target=listen, daemon=True).start()

    def _send_request(self, msg_type: str, data: dict, callback=None):
        """Send a DB agent request."""
        corr_id = str(uuid.uuid4())
        message = {"type": msg_type, "data": data, "correlationId": corr_id}

        if callback:
            self.pending_requests[corr_id] = callback

        self.producer.send(self.request_topic, message)
        self.producer.flush()

    # ------------------------------------------------------------------
    # Public: Wafer queries
    # ------------------------------------------------------------------
    def get_all_wafers(self, callback=None):
        self._send_request("GetAllWafers", {"filter": {"ids": []}}, callback)

    def get_wafer_by_id(self, wafer_id: int, callback=None):
        self._send_request("GetAllWafers", {"filter": {"ids": [wafer_id]}}, callback)

    def get_all_wafer_types(self, callback=None):
        self._send_request("GetAllWaferTypes", {"filter": {"ids": []}}, callback)

    def get_wafer_type_by_id(self, wafer_type_id: int, callback=None):
        self._send_request("GetAllWaferTypes", {"filter": {"ids": [wafer_type_id]}}, callback)

    def get_wafer_type_map(self, wafer_type_id: int, callback=None):
        self._send_request("GetWaferTypeMap", {"waferTypeId": wafer_type_id}, callback)

    def get_wafer_location_history(self, wafer_id: int, callback=None):
        self._send_request("GetWaferLocationHistory", {"waferId": wafer_id}, callback)

    # ------------------------------------------------------------------
    # Example composite call
    # ------------------------------------------------------------------
    # def get_full_wafer_info(self, wafer_id: int):
    #     """Chain calls to get wafer + type + location history."""
    #     result = {}

    #     def on_wafer(reply):
    #         wafers = reply["data"].get("items", [])
    #         if not wafers:
    #             return
    #         wafer = wafers[0]
    #         result["wafer"] = wafer
    #         wafer_type_id = wafer["waferTypeId"]

    #         def on_type(reply2):
    #             result["wafer_type"] = reply2["data"].get("items", [])[0]
    #             def on_hist(reply3):
    #                 result["history"] = reply3["data"].get("items", [])
    #             self.get_wafer_location_history(wafer_id, callback=on_hist)

    #         self.get_wafer_type_by_id(wafer_type_id, callback=on_type)

    #     self.get_wafer_by_id(wafer_id, callback=on_wafer)

    def close(self):
        self.producer.close()
        self.consumer.close()
        
