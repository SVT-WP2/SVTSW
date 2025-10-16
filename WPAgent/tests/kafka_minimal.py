from confluent_kafka import Producer, Consumer, KafkaError
import json
import uuid
import time
from typing import List, Dict, Any, Optional, Callable

class KafkaTestClient:
    def __init__(self, bootstrap_servers="localhost:9092", group_id="test-db-client"):
        self.bootstrap_servers = bootstrap_servers
        self.producer = Producer({"bootstrap.servers": bootstrap_servers})
        self.consumer = Consumer({
            "bootstrap.servers": bootstrap_servers,
            "group.id": group_id,
            "auto.offset.reset": "latest",
        })
        self.consumer.subscribe(["svt.db-agent.request.reply"])

    def request_reply(
        self,
        request_topic: str,
        reply_topic: str,
        payload: Dict[str, Any],
        reply_type: str,
        timeout: float = 10.0,
        match_fn: Optional[Callable[[Dict[str, Any]], bool]] = None,
        add_request_id: bool = True,
    ) -> Optional[Dict[str, Any]]:
        req_id = str(uuid.uuid4()) if add_request_id else None
        if add_request_id:
            payload = dict(payload)
            payload["requestId"] = req_id

        self.producer.produce(request_topic, json.dumps(payload).encode("utf-8"))
        self.producer.flush()

        start = time.time()
        while time.time() - start < timeout:
            msg = self.consumer.poll(1.0)
            if msg is None:
                continue
            if msg.error() and msg.error().code() != KafkaError._PARTITION_EOF:
                print("Kafka error:", msg.error())
                continue

            try:
                value = json.loads(msg.value().decode("utf-8"))
            except Exception as e:
                print("JSON parse error:", e)
                continue

            if value.get("type") != reply_type:
                continue
            if req_id and value.get("requestId") != req_id:
                continue
            if match_fn and not match_fn(value):
                continue

            return value

        print("Timeout: no reply")
        return None
