from confluent_kafka import Consumer, Producer
import json

REQUEST_TOPIC = "svt.db-agent.request"
REPLY_TOPIC = "svt.db-agent.request.reply"

consumer = Consumer({
    "bootstrap.servers": "localhost:9092",
    "group.id": "mock-db-agent",
    "auto.offset.reset": "earliest"
})
consumer.subscribe([REQUEST_TOPIC])

producer = Producer({"bootstrap.servers": "localhost:9092"})
print("DB Agent is listening...")

try:
    while True:
        msg = consumer.poll(1.0)
        if msg is None:
            continue
        if msg.error():
            print("Error:", msg.error())
            continue

        req = json.loads(msg.value().decode("utf-8"))
        print("📥 Received:", req)

        reply = {
            "type": "GetAllEnumsReply",
            "requestId": req.get("requestId"),
            "data": {
                "asicFamilyType": ["FakeChipA", "FakeChipB"],
                "waferMapOrientation": ["Top", "Bottom"]
            }
        }

        producer.produce(REPLY_TOPIC, json.dumps(reply).encode("utf-8"))
        producer.flush()
        print("Replied.")
except KeyboardInterrupt:
    print("⛔️ Stopped.")
finally:
    consumer.close()
