#!/usr/bin/env python3
"""
Diagnostic tool to see what's actually on the DB Agent Kafka topics
Run this to see if DB Agent is replying but we're not catching it
"""

from confluent_kafka import Consumer as KafkaConsumer, Producer as KafkaProducer
import json
import uuid
import time

DB_KAFKA_BROKER = "localhost:9095"
DB_REQUEST_TOPIC = "svt.db-agent.request"
DB_REPLY_TOPIC = "svt.db-agent.request.reply"


def send_test_request():
    """Send a test request to DB Agent"""
    producer = KafkaProducer({'bootstrap.servers': DB_KAFKA_BROKER})

    req_id = str(uuid.uuid4())

    # Try multiple formats to see which works
    test_messages = [
        {
            "name": "Format 1: With filter",
            "payload": {
                "type": "GetAllWaferProbeMachines",

                "data": {
                    "filter": {}
                }
            }
        },
        {
            "name": "Format 2: Empty data",
            "payload": {
                "type": "GetAllWaferProbeMachines",

                "data": {}
            }
        },
        {
            "name": "Format 3: No requestId",
            "payload": {
                "type": "GetAllWaferProbeMachines",
                "data": {
                    "filter": {}
                }
            }
        }
    ]

    print(f"🔧 Sending {len(test_messages)} test messages to DB Agent...")
    print(f"   Broker: {DB_KAFKA_BROKER}")
    print(f"   Topic: {DB_REQUEST_TOPIC}\n")

    for test in test_messages:
        print(f"📤 Sending: {test['name']}")
        print(f"   Payload: {json.dumps(test['payload'], indent=2)}")

        producer.produce(
            DB_REQUEST_TOPIC,
            value=json.dumps(test['payload']).encode("utf-8")
        )
        producer.flush()
        print(f"   ✅ Sent\n")
        time.sleep(0.5)

    producer.flush()


def listen_for_any_replies(duration=15):
    """Listen to reply topic and print EVERYTHING we receive"""
    consumer = KafkaConsumer({
        'bootstrap.servers': DB_KAFKA_BROKER,
        'group.id': f'diagnostic-{uuid.uuid4()}',
        'auto.offset.reset': 'earliest',  # Read from beginning
        'enable.auto.commit': False
    })

    consumer.subscribe([DB_REPLY_TOPIC])

    print(f"👂 Listening for ANY messages on reply topic...")
    print(f"   Broker: {DB_KAFKA_BROKER}")
    print(f"   Topic: {DB_REPLY_TOPIC}")
    print(f"   Duration: {duration}s")
    print(f"   Reading from: earliest (all messages)\n")
    print("=" * 80)

    start_time = time.time()
    message_count = 0

    while time.time() - start_time < duration:
        msg = consumer.poll(1.0)

        if msg is None:
            continue

        if msg.error():
            print(f"❌ Consumer Error: {msg.error()}")
            continue

        message_count += 1
        print(f"\n📨 Message #{message_count} received:")
        print(f"   Partition: {msg.partition()}")
        print(f"   Offset: {msg.offset()}")
        print(f"   Timestamp: {msg.timestamp()}")

        # Try to parse as JSON
        try:
            value = json.loads(msg.value().decode("utf-8"))
            print(f"   Raw JSON:")
            print(json.dumps(value, indent=6))

            # Check what fields it has
            print(f"\n   📋 Message Structure:")
            print(f"      Keys: {list(value.keys())}")
            if "type" in value:
                print(f"      Type: {value['type']}")
            if "status" in value:
                print(f"      Status: {value['status']}")
            if "requestId" in value:
                print(f"      Request ID: {value.get('requestId', 'N/A')[:8]}...")
            if "data" in value:
                data = value.get("data", {})
                print(f"      Data keys: {list(data.keys()) if isinstance(data, dict) else 'Not a dict'}")
                if isinstance(data, dict):
                    for key in data.keys():
                        data_value = data[key]
                        if isinstance(data_value, list):
                            print(f"         - {key}: [{len(data_value)} items]")
                        else:
                            print(f"         - {key}: {type(data_value).__name__}")

        except Exception as e:
            print(f"   ⚠️ Could not parse as JSON: {e}")
            print(f"   Raw bytes: {msg.value()[:200]}...")

        print("=" * 80)

    consumer.close()

    print(f"\n📊 Summary:")
    print(f"   Total messages received: {message_count}")

    if message_count == 0:
        print(f"\n⚠️  No messages found!")
        print(f"   Possible reasons:")
        print(f"   1. DB Agent is not running")
        print(f"   2. DB Agent is on a different broker")
        print(f"   3. DB Agent is not responding to requests")
        print(f"   4. Topic name is different")

    return message_count


def check_topics_exist():
    """Check if topics exist"""
    from confluent_kafka.admin import AdminClient

    print("🔍 Checking topics on DB Agent broker...")
    print(f"   Broker: {DB_KAFKA_BROKER}\n")

    try:
        admin = AdminClient({'bootstrap.servers': DB_KAFKA_BROKER})
        metadata = admin.list_topics(timeout=5)

        all_topics = metadata.topics.keys()

        print(f"📋 All topics found: {len(all_topics)}")
        for topic in sorted(all_topics):
            if 'db-agent' in topic:
                print(f"   ✅ {topic}")
            else:
                print(f"      {topic}")

        print()

        if DB_REQUEST_TOPIC in all_topics:
            print(f"✅ Request topic exists: {DB_REQUEST_TOPIC}")
        else:
            print(f"❌ Request topic NOT found: {DB_REQUEST_TOPIC}")

        if DB_REPLY_TOPIC in all_topics:
            print(f"✅ Reply topic exists: {DB_REPLY_TOPIC}")
        else:
            print(f"❌ Reply topic NOT found: {DB_REPLY_TOPIC}")

        print()
        return True

    except Exception as e:
        print(f"❌ Error connecting to broker: {e}")
        print(f"\n💡 Make sure DB Agent Kafka broker is running on {DB_KAFKA_BROKER}")
        return False


def main():
    """Run full diagnostic"""
    print("\n" + "=" * 80)
    print("🔧 DB Agent Connection Diagnostic Tool")
    print("=" * 80 + "\n")

    # Step 1: Check topics
    print("STEP 1: Check if topics exist")
    print("-" * 80)
    if not check_topics_exist():
        print("\n❌ Cannot proceed - broker not accessible")
        return

    print("\n" + "=" * 80)

    # Step 2: Listen for existing messages
    print("\nSTEP 2: Check for existing messages on reply topic")
    print("-" * 80)
    print("(This will show any messages already in the topic)\n")

    existing_count = listen_for_any_replies(duration=5)

    print("\n" + "=" * 80)

    # Step 3: Send test requests
    print("\nSTEP 3: Send test requests to DB Agent")
    print("-" * 80)
    send_test_request()

    print("=" * 80)

    # Step 4: Listen for replies to our requests
    print("\nSTEP 4: Listen for replies (15 seconds)")
    print("-" * 80)
    new_count = listen_for_any_replies(duration=15)

    print("\n" + "=" * 80)
    print("🏁 Diagnostic Complete")
    print("=" * 80)

    if new_count > existing_count:
        print(f"\n✅ SUCCESS! DB Agent replied to our requests!")
        print(f"   New messages received: {new_count - existing_count}")
        print(f"\n💡 Check the message structure above to see what format DB Agent uses")
    elif new_count == 0:
        print(f"\n❌ No replies received from DB Agent")
        print(f"\n🔍 Next steps:")
        print(f"   1. Check DB Agent service is running")
        print(f"   2. Check DB Agent logs for errors")
        print(f"   3. Verify DB Agent is listening to: {DB_REQUEST_TOPIC}")
        print(f"   4. Verify DB Agent is replying to: {DB_REPLY_TOPIC}")
    else:
        print(f"\n⚠️  Found {existing_count} old messages, but no new replies")
        print(f"\n🔍 Next steps:")
        print(f"   1. Check if DB Agent is still running")
        print(f"   2. Check DB Agent logs for errors")


if __name__ == "__main__":
    main()