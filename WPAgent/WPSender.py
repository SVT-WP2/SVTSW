#!/usr/bin/env python3
"""
WPSender.py — Standalone WP Agent Kafka client

Usage:
  python WPSender.py MoveChuckCenter --data='{"user":"user1","waferAgentName":"CERN_DEV"}'
  python WPSender.py GetStatus       --data='{"waferAgentName":"CERN"}'
  python WPSender.py RunSequencer    --data='{"filepath":"myseq.json","waferAgentName":"CERN_DEV"}'
  python WPSender.py GetStatus       --data='{"waferAgentName":"CERN_DEV"}' --no-reply
  python WPSender.py GetStatus       --data='{"waferAgentName":"CERN_DEV"}' --timeout 60

Port selection (auto-detected from waferAgentName in --data, or override with --port):
  CERN_DEV  → 9096
  CERN      → 9093
"""

import json
import sys
import time
import uuid
import argparse
from confluent_kafka import Producer, Consumer

# ── Config ─────────────────────────────────────────────────────────────────────
BROKER_HOST   = 'svmithi02'

# Port mapping: keys are matched as substrings of waferAgentName (most specific first)
AGENT_PORT_MAP = {
    'CERN_DEV': 9096,
    'CERN':     9093,
}

REQUEST_TOPIC = 'svt.wp-agent.request'
REPLY_TOPIC   = 'svt.wp-agent.request.reply'

KAFKA_HEADER_CORRELATION_ID  = 'kafka_correlationId'
KAFKA_HEADER_REPLY_TOPIC     = 'kafka_replyTopic'
KAFKA_HEADER_REPLY_PARTITION = 'kafka_replyPartition'

# ── Port resolution ─────────────────────────────────────────────────────────────
def resolve_port(data: dict, port_override: int | None) -> int:
    """Pick broker port from --port override, or from waferAgentName in data."""
    if port_override:
        return port_override

    agent_name = data.get('waferAgentName', '')
    # Match most-specific key first (CERN_DEV before CERN)
    for key in sorted(AGENT_PORT_MAP, key=len, reverse=True):
        if key in agent_name:
            return AGENT_PORT_MAP[key]

    print(
        f"⚠️  Could not determine port from waferAgentName={agent_name!r}.\n"
        f"   Known agents: {list(AGENT_PORT_MAP.keys())}\n"
        f"   Use --port to set it explicitly.",
        file=sys.stderr,
    )
    sys.exit(1)

# ── Kafka helpers ───────────────────────────────────────────────────────────────
def make_reply_consumer(bootstrap: str) -> Consumer:
    consumer = Consumer({
        'bootstrap.servers':    bootstrap,
        'group.id':             f'wp-standalone-{uuid.uuid4()}',
        'auto.offset.reset':    'earliest',
        'enable.auto.commit':   False,
        'session.timeout.ms':   60_000,
        'max.poll.interval.ms': 120_000,
    })
    consumer.subscribe([REPLY_TOPIC])

    start = time.time()
    while time.time() - start < 10.0:
        consumer.poll(0.1)
        if consumer.assignment():
            print(f"  ✅ Reply consumer ready ({time.time() - start:.1f}s)")
            return consumer

    print("  ⚠️  Partition assignment timed out — may miss fast replies")
    return consumer


def wait_for_reply(consumer: Consumer, correlation_id: str, timeout: float) -> dict | None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        msg = consumer.poll(0.5)
        if msg is None or msg.error():
            continue
        headers = {k: v for k, v in (msg.headers() or [])}
        corr = headers.get(KAFKA_HEADER_CORRELATION_ID, b'')
        if corr.decode('utf-8', errors='ignore') == correlation_id:
            return json.loads(msg.value().decode('utf-8'))
    return None

# ── Main ────────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description='Standalone WP Agent Kafka sender',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument('command',
        help='Command to send, e.g. MoveChuckCenter, GetStatus, RunSequencer')
    parser.add_argument('--data', default='{}',
        help='JSON payload string, e.g. \'{"user":"user1","waferAgentName":"CERN_DEV"}\'')
    parser.add_argument('--port', type=int, default=None,
        help='Override broker port (default: auto-detected from waferAgentName)')
    parser.add_argument('--no-reply', action='store_true',
        help='Fire-and-forget — do not wait for a reply')
    parser.add_argument('--timeout', type=float, default=30.0,
        help='Reply wait timeout in seconds (default: 30)')
    args = parser.parse_args()

    # Parse --data JSON
    try:
        data = json.loads(args.data)
    except json.JSONDecodeError as exc:
        print(f"❌ Invalid JSON in --data: {exc}", file=sys.stderr)
        sys.exit(1)

    command   = args.command
    wait      = not args.no_reply
    timeout   = args.timeout
    corr_id   = str(uuid.uuid4())

    port      = resolve_port(data, args.port)
    bootstrap = f'{BROKER_HOST}:{port}'

    print(f"\n📡 WP Agent Kafka Client")
    print(f"   Broker  : {bootstrap}")
    print(f"   Topic   : {REQUEST_TOPIC}")
    print(f"   Command : {command}")
    print(f"   Data    : {json.dumps(data)}\n")

    # Step 1: set up reply consumer BEFORE producing (avoid missing fast replies)
    reply_consumer = None
    if wait:
        print("⏳ Setting up reply consumer...")
        reply_consumer = make_reply_consumer(bootstrap)

    # Step 2: build and send the request message
    producer = Producer({'bootstrap.servers': bootstrap})

    payload = json.dumps({"type": command, "data": data}).encode('utf-8')
    headers = [(KAFKA_HEADER_CORRELATION_ID, corr_id.encode('utf-8'))]
    if wait:
        headers += [
            (KAFKA_HEADER_REPLY_TOPIC,     REPLY_TOPIC.encode('utf-8')),
            (KAFKA_HEADER_REPLY_PARTITION, b'0'),
        ]

    producer.produce(REQUEST_TOPIC, value=payload, headers=headers)
    producer.flush()
    print(f"📤 Sent: {command}  (correlation: {corr_id[:8]}...)")

    # Step 3: optionally wait for the reply
    if not wait:
        print("🔇 Fire-and-forget mode — not waiting for reply.")
        return

    print(f"⏳ Waiting for reply (timeout: {timeout}s)...")
    response = wait_for_reply(reply_consumer, corr_id, timeout)
    reply_consumer.close()

    if response is None:
        print(f"\n⏱️  TIMEOUT: No response within {timeout}s")
        print("   Is the agent listener running?  python main.py listen CERN")
        sys.exit(1)

    # Step 4: display result
    status = response.get('status', 'unknown')
    rtype  = response.get('type',   'UnknownReply')

    # Try to surface a human-readable message from various response shapes
    display = None
    if isinstance(response.get('data'), dict):
        display = response['data'].get('message') or response['data'].get('output')
    if display is None:
        display = response.get('output')
    if display is None and isinstance(response.get('error'), dict):
        display = response['error'].get('message')

    icon = '✅' if status == 'Success' else '❌'
    print(f"\n{icon} {status}: {rtype}")
    if display:
        print(f"   {display}")

    print(f"\n📋 Full response:")
    print(json.dumps(response, indent=2))


if __name__ == '__main__':
    main()