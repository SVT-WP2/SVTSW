from typing import List, Dict, Optional

class KafkaDBService:

    DB_REQUEST_TOPIC = "svt.db-agent.request"
    DB_REPLY_TOPIC = "svt.db-agent.request.reply"

    def __init__(self, kafka_client):
        """
        kafka_client: instance of KafkaClient
        """
        self.bus = kafka_client

    def get_all_enums(self, enum_names: Optional[List[str]] = None, timeout: float = 10.0) -> Dict[str, List[str]]:
        payload = {
            "type": "GetAllEnums",
            "data": {
                "filter": {
                    "enumNames": enum_names
                } if enum_names else {}
            }
        }

        reply = self.bus.request_reply(
            request_topic=self.DB_REQUEST_TOPIC,
            reply_topic=self.DB_REPLY_TOPIC,
            payload=payload,
            reply_type="GetAllEnumsReply",
            timeout=timeout,
            add_request_id=True
        )

        if not reply:
            return {}

        return reply.get("data", {}) or {}

    def get_chip_types(self, timeout: float = 10.0) -> List[str]:
        data = self.get_all_enums(["asicFamilyType"], timeout=timeout)
        return data.get("asicFamilyType", [])

    def get_orientations(self, timeout: float = 10.0) -> List[str]:
        data = self.get_all_enums(["waferMapOrientation"], timeout=timeout)
        return data.get("waferMapOrientation", [])
