#!/usr/bin/env python3.12
"""
DB Agent Connection Diagnostic Tool
Tests direct connection to DB Agent Kafka broker
"""

from confluent_kafka import Producer as KafkaProducer, Consumer as KafkaConsumer
from confluent_kafka.admin import AdminClient
import json
import uuid
import time
import sys

DB_KAFKA_BROKER = "localhost:9095"
DB_REQUEST_TOPIC = "svt.db-agent.request"
DB_REPLY_TOPIC = "svt.db-agent.request.reply"


def test_broker_connection():
    """Test if we can connect to Kafka broker at localhost:9095"""
    print("\n" + "=" * 70)
    print("TEST 1: Kafka Broker Connection")
    print("=" * 70)

    try:
        admin = AdminClient({'bootstrap.servers': DB_KAFKA_BROKER})
        metadata = admin.list_topics(timeout=5)

        print(f"✅ Connected to Kafka broker at {DB_KAFKA_BROKER}")
        print(f"\n📋 Available topics:")
        for topic in metadata.topics:
            print(f"   - {topic}")

        # Check if our topics exist
        if DB_REQUEST_TOPIC in metadata.topics:
            print(f"\n✅ Found request topic: {DB_REQUEST_TOPIC}")
        else:
            print(f"\n❌ Missing request topic: {DB_REQUEST_TOPIC}")

        if DB_REPLY_TOPIC in metadata.topics:
            print(f"✅ Found reply topic: {DB_REPLY_TOPIC}")
        else:
            print(f"❌ Missing reply topic: {DB_REPLY_TOPIC}")

        return True

    except Exception as e:
        print(f"❌ Failed to connect to Kafka broker at {DB_KAFKA_BROKER}")
        print(f"   Error: {e}")
        return False


def test_simple_request():
    """Send a simple test request to DB Agent"""
    print("\n" + "=" * 70)
    print("TEST 2: Send Test Request to DB Agent")
    print("=" * 70)

    try:
        # Create producer
        producer = KafkaProducer({
            'bootstrap.servers': DB_KAFKA_BROKER
        })

        # Create consumer
        consumer = KafkaConsumer({
            'bootstrap.servers': DB_KAFKA_BROKER,
            'group.id': f'test-consumer-{uuid.uuid4()}',
            'auto.offset.reset': 'latest',
            'enable.auto.commit': False
        })
        consumer.subscribe([DB_REPLY_TOPIC])

        # Test different request types
        test_requests = [
            {
                "type": "GetAllWaferProbeMachines",
                "data": {}
            },
            {
                "type": "GetAllEnums",
                "data": {
                    "filter": {}
                }
            },
            {
                "type": "Ping",  # Maybe DB Agent has a ping endpoint?
                "data": {}
            }
        ]

        for idx, request_payload in enumerate(test_requests, 1):
            req_id = str(uuid.uuid4())
            request_payload["requestId"] = req_id

            print(f"\n📤 Test {idx}: Sending {request_payload['type']}")
            print(f"   Request ID: {req_id[:8]}...")

            # Send request
            producer.produce(
                DB_REQUEST_TOPIC,
                value=json.dumps(request_payload).encode("utf-8")
            )
            producer.flush()

            print(f"   ✅ Request sent")
            print(f"   ⏳ Waiting for reply (timeout: 5s)...")

            # Wait for reply
            start = time.time()
            timeout = 5.0
            received = False

            while time.time() - start < timeout:
                msg = consumer.poll(1.0)

                if msg is None:
                    continue

                if msg.error():
                    print(f"   ⚠️ Consumer error: {msg.error()}")
                    continue

                try:
                    reply = json.loads(msg.value().decode("utf-8"))
                    print(f"\n   ✅ RECEIVED REPLY!")
                    print(f"   Reply type: {reply.get('type', 'Unknown')}")
                    print(f"   Request ID: {reply.get('requestId', 'Unknown')[:8]}...")

                    # Check if it's our reply
                    if reply.get('requestId') == req_id:
                        print(f"   ✅ Request ID matches!")
                        print(f"\n   📦 Reply data:")
                        print(json.dumps(reply, indent=2)[:500])  # First 500 chars
                        received = True
                        break
                    else:
                        print(f"   ⚠️ Request ID doesn't match (got different reply)")

                except Exception as e:
                    print(f"   ⚠️ Failed to parse reply: {e}")
                    continue

            if not received:
                print(f"   ❌ No reply received (timeout: {timeout}s)")
                print(f"   This means DB Agent is not responding to '{request_payload['type']}'")

        consumer.close()
        return True

    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def monitor_topics():
    """Monitor both request and reply topics to see what's happening"""
    print("\n" + "=" * 70)
    print("TEST 3: Monitor Topics (20 seconds)")
    print("=" * 70)
    print("This will show all messages on both topics...")
    print("Press Ctrl+C to stop early\n")

    try:
        # Consumer for both topics
        consumer = KafkaConsumer({
            'bootstrap.servers': DB_KAFKA_BROKER,
            'group.id': f'monitor-{uuid.uuid4()}',
            'auto.offset.reset': 'earliest',  # See old messages too
            'enable.auto.commit': False
        })
        consumer.subscribe([DB_REQUEST_TOPIC, DB_REPLY_TOPIC])

        print(f"👀 Watching topics...")
        print(f"   - {DB_REQUEST_TOPIC}")
        print(f"   - {DB_REPLY_TOPIC}\n")

        start = time.time()
        message_count = 0

        while time.time() - start < 20:
            msg = consumer.poll(1.0)

            if msg is None:
                continue

            if msg.error():
                print(f"⚠️ Error: {msg.error()}")
                continue

            message_count += 1
            topic = msg.topic()

            try:
                value = json.loads(msg.value().decode("utf-8"))
                msg_type = value.get('type', 'Unknown')
                req_id = value.get('requestId', 'None')[:8]

                print(f"📨 Message #{message_count}")
                print(f"   Topic: {topic}")
                print(f"   Type: {msg_type}")
                print(f"   Request ID: {req_id}...")
                print(f"   Keys: {list(value.keys())}")
                print()

            except Exception as e:
                print(f"📨 Message #{message_count} (could not parse)")
                print(f"   Topic: {topic}")
                print(f"   Raw: {msg.value()[:100]}")
                print()

        print(f"\n📊 Summary: Received {message_count} messages in 20 seconds")

        if message_count == 0:
            print("⚠️ No messages found on topics - DB Agent may not be running")

        consumer.close()

    except KeyboardInterrupt:
        print("\n⏹️  Monitoring stopped by user")
    except Exception as e:
        print(f"❌ Monitoring failed: {e}")
        import traceback
        traceback.print_exc()


def check_db_agent_process():
    """Check if DB Agent process is running"""
    print("\n" + "=" * 70)
    print("TEST 4: Check DB Agent Process")
    print("=" * 70)

    import subprocess

    try:
        # Check for processes listening on port 9095
        result = subprocess.run(
            ["netstat", "-tlnp", "2>/dev/null", "|", "grep", "9095"],
            capture_output=True,
            text=True,
            shell=True
        )

        if result.stdout:
            print("✅ Found process listening on port 9095:")
            print(result.stdout)
        else:
            print("❌ No process listening on port 9095")
            print("\nℹ️  DB Agent Kafka broker may not be running")
            print("   Start it with: cd /path/to/db-agent && <start command>")

    except Exception as e:
        print(f"⚠️ Could not check processes: {e}")


def main():
    print("\n" + "=" * 70)
    print("🔍 DB AGENT CONNECTION DIAGNOSTIC TOOL")
    print("=" * 70)
    print(f"Target broker: {DB_KAFKA_BROKER}")
    print(f"Request topic: {DB_REQUEST_TOPIC}")
    print(f"Reply topic: {DB_REPLY_TOPIC}")

    # Run all tests
    test_broker_connection()
    test_simple_request()
    monitor_topics()
    check_db_agent_process()

    print("\n" + "=" * 70)
    print("🏁 DIAGNOSTIC COMPLETE")
    print("=" * 70)
    print("\nNext steps:")
    print("1. If broker connection fails → Check if Kafka is running on port 9095")
    print("2. If topics are missing → DB Agent may need to create them")
    print("3. If no replies received → DB Agent service is not running or not responding")
    print("4. If messages seen on topics → Check DB Agent logs for errors")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n⏹️  Diagnostic stopped by user")
        sys.exit(0)