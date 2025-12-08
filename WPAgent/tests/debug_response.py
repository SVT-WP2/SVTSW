"""
Debug script to inspect SENTIO Response object structure
Run this to see what attributes the Response object has
"""

from sentio_prober_control.Communication.CommunicatorTcpIp import CommunicatorTcpIp
from sentio_prober_control.Sentio.ProberSentio import SentioProber
from sentio_prober_control.Sentio.Enumerations import Module

PROBER_ADDRESS = "wpmit01.cern.ch:35555"

print("Connecting to prober...")
prober = SentioProber(CommunicatorTcpIp.create(PROBER_ADDRESS))
prober.select_module(Module.Wafermap)

print("\nSending create_project command...")
response = prober.send_cmd("create_project TestDebug123")

print("\n" + "="*70)
print("RESPONSE OBJECT INSPECTION")
print("="*70)

print(f"\nType: {type(response)}")
print(f"Class: {response.__class__.__name__}")

print("\n--- All Attributes ---")
all_attrs = dir(response)
for attr in sorted(all_attrs):
    if not attr.startswith('_'):
        print(f"  {attr}")

print("\n--- Attribute Values ---")
for attr in sorted(all_attrs):
    if not attr.startswith('_'):
        try:
            value = getattr(response, attr)
            if not callable(value):
                print(f"  {attr} = {value}")
        except Exception as e:
            print(f"  {attr} = <error: {e}>")

print("\n--- Methods ---")
for attr in sorted(all_attrs):
    if not attr.startswith('_'):
        try:
            value = getattr(response, attr)
            if callable(value):
                print(f"  {attr}()")
        except:
            pass

print("\n--- Try Common Attributes ---")
common_attrs = ['errmsg', 'message', 'resp', 'data', 'result', 'value', 'text', 'content']
for attr in common_attrs:
    if hasattr(response, attr):
        try:
            value = getattr(response, attr)
            print(f"✅ {attr}: {value}")
        except Exception as e:
            print(f"❌ {attr}: <error: {e}>")
    else:
        print(f"   {attr}: <not found>")

print("\n--- String Conversions ---")
print(f"str(response): {str(response)}")
print(f"repr(response): {repr(response)}")

print("\n--- Try Calling Methods ---")
if hasattr(response, 'get'):
    try:
        print(f"response.get(): {response.get()}")
    except Exception as e:
        print(f"response.get() failed: {e}")

if hasattr(response, 'value'):
    try:
        print(f"response.value(): {response.value()}")
    except Exception as e:
        print(f"response.value() failed: {e}")

print("\n" + "="*70)
print("Use the attribute that contains '0,0,<path>' format")
print("="*70)