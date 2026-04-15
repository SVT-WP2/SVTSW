#!/usr/bin/env python3
"""
wp_kafka_send.py — Standalone WP Agent Kafka client
No dependency on WPAgent.py, WPKafkaClient.py, or any agent code.

Usage:
  python wp_kafka_send.py GetStatus
  python wp_kafka_send.py SetParameter param1=value1
  python wp_kafka_send.py RunSequencer filepath=myseq.json
  python wp_kafka_send.py GetStatus --no-reply
  python wp_kafka_send.py GetStatus --timeout 60
"""

import json
import sys
import time
import uuid
import argparse
from confluent_kafka import Producer, Consumer

# ── Config ────────────────────────────────────────────────────────────────────
BOOTSTRAP_SERVERS  = 'svmithi02:9096'
REQUEST_TOPIC      = 'svt.wp-agent.request'
REPLY_TOPIC        = 'svt.wp-agent.request.reply'

KAFKA_HEADER_CORRELATION_ID  = 'kafka_correlationId'
KAFKA_HEADER_REPLY_TOPIC     = 'kafka_replyTopic'
KAFKA_HEADER_REPLY_PARTITION = 'kafka_replyPartition'

# ── Helpers ───────────────────────────────────────────────────────────────────
def parse_params(args):
    """Convert ['key1=val1', 'key2=val2'] → {'key1': 'val1', 'key2': 'val2'}"""
    params = {}
    for arg in args:
        if '=' in arg:
            k, v = arg.split('=', 1)
            params[k.strip()] = v.strip()
    return params

def make_reply_consumer():
    consumer = Consumer({
        'bootstrap.servers': BOOTSTRAP_SERVERS,
        'group.id': f'wp-standalone-{uuid.uuid4()}',
        'auto.offset.reset': 'earliest',
        'enable.auto.commit': False,
        'session.timeout.ms': 60000,
        'max.poll.interval.ms': 120000,
    })
    consumer.subscribe([REPLY_TOPIC])
    # Wait for partition assignment before returning
    start = time.time()
    while time.time() - start < 10.0:
        consumer.poll(0.1)
        if consumer.assignment():
            print(f"  ✅ Reply consumer ready ({time.time()-start:.1f}s)")
            return consumer
    print("  ⚠️  Reply consumer partition assignment timed out — may miss fast replies")
    return consumer

def wait_for_reply(consumer, correlation_id, timeout):
    start = time.time()
    while time.time() - start < timeout:
        msg = consumer.poll(0.5)
        if msg is None or msg.error():
            continue
        headers = {k: v for k, v in (msg.headers() or [])}
        corr = headers.get(KAFKA_HEADER_CORRELATION_ID)
        if corr and corr.decode('utf-8', errors='ignore') == correlation_id:
            return json.loads(msg.value().decode('utf-8'))
    return None

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description='Standalone WP Agent Kafka sender')
    parser.add_argument('command', help='Command to send (e.g. GetStatus, RunSequencer)')
    parser.add_argument('params', nargs='*', help='Parameters as key=value pairs')
    parser.add_argument('--no-reply', action='store_true', help='Fire and forget, do not wait for reply')
    parser.add_argument('--timeout', type=float, default=30.0, help='Reply timeout in seconds (default: 30)')
    args = parser.parse_args()

    command    = args.command
    params     = parse_params(args.params)
    wait       = not args.no_reply
    timeout    = args.timeout
    corr_id    = str(uuid.uuid4())

    print(f"\n📡 WP Agent Standalone Kafka Client")
    print(f"   Broker  : {BOOTSTRAP_SERVERS}")
    print(f"   Topic   : {REQUEST_TOPIC}")
    print(f"   Command : {command}")
    print(f"   Params  : {params or '(none)'}\n")

    # Step 1: subscribe reply consumer BEFORE producing
    reply_consumer = None
    if wait:
        print("⏳ Setting up reply consumer...")
        reply_consumer = make_reply_consumer()

    # Step 2: build and send message
    producer = Producer({'bootstrap.servers': BOOTSTRAP_SERVERS})

    payload = json.dumps({"type": command, "data": params}).encode('utf-8')
    headers = [(KAFKA_HEADER_CORRELATION_ID, corr_id.encode('utf-8'))]
    if wait:
        headers.append((KAFKA_HEADER_REPLY_TOPIC,     REPLY_TOPIC.encode('utf-8')))
        headers.append((KAFKA_HEADER_REPLY_PARTITION, b'0'))

    producer.produce(REQUEST_TOPIC, value=payload, headers=headers)
    producer.flush()
    print(f"📤 Sent: {command}  (correlation: {corr_id[:8]}...)")

    # Step 3: wait for reply
    if not wait:
        print("🔇 Fire-and-forget mode — not waiting for reply.")
        return

    print(f"⏳ Waiting for reply (timeout: {timeout}s)...")
    response = wait_for_reply(reply_consumer, corr_id, timeout)
    reply_consumer.close()

    if response is None:
        print(f"\n⏱️  TIMEOUT: No response within {timeout}s")
        print("   Is the listener running?  python main.py listen CERN")
        sys.exit(1)

    # Step 4: print result
    status = response.get('status', 'unknown')
    rtype  = response.get('type', 'UnknownReply')

    display = None
    if isinstance(response.get('data'), dict):
        display = response['data'].get('message') or response['data'].get('output')
    if display is None:
        display = response.get('output')
    if display is None and isinstance(response.get('error'), dict):
        display = response['error'].get('message')

    if status == 'Success':
        print(f"\n✅ {status}: {rtype}")
    else:
        print(f"\n❌ {status}: {rtype}")
    if display:
        print(f"   {display}")

    print(f"\n📋 Full response:")
    print(json.dumps(response, indent=2))

if __name__ == '__main__':
    main()
