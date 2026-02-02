import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# i need to be sure that everything like in swagger))))

def test_updated_code():

    print("\n" + "=" * 80)
    print("  TESTING YOUR UPDATED CODE")
    print("  (Should return full Swagger-compliant response)")
    print("=" * 80)


    print("\n Setting up mock prober...")

    from drivers.WPFactory import ProberFactory
    from tests.mock_prober import MockProber

    factory = ProberFactory.get_instance()
    mock_prober = MockProber("MOCK-PROBER:35555")

    # Inject mock into factory
    factory._prober = mock_prober
    factory._initialized = True

    print("✅ Mock prober ready")

    # initialize prober
    print("\n📦 Initializing...")

    from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

    globals_ = SvtWPAagentGlobalParameters.getInstance()
    globals_.set_address("MOCK-PROBER:35555")
    globals_.set_machine_type("sentio")
    globals_.set_machine_id(1)
    globals_.set_probe_card(101, "vertical")
    globals_.set_project_id(25)

    print(f"✅ Initialized")
    print(f"   Factory ready: {factory.is_initialized()}")
    print(f"   Globals ready: {globals_.is_initialized()}")

    # Load wafer

    print("\n" + "=" * 80)
    print("  TEST: Load Wafer")
    print("=" * 80)

    from actions.WPTestingActions import load_wafer


    response = load_wafer(wafer_id=456, orientation="North")


    print("\n FULL RESPONSE:")
    print("=" * 80)
    print(json.dumps(response, indent=2))
    print("=" * 80)


    print("-" * 80)

    all_checks = []

    # Check 1: Status field
    if response.get('status') == 'Success':
        print("✅ status: 'Success'")
        all_checks.append(True)
    else:
        print(f"❌ status: '{response.get('status')}' (expected 'Success')")
        all_checks.append(False)
        if 'error' in response:
            print(f"   Error: {response['error']}")

    # Check 2: Type field
    if response.get('type') == 'LoadWaferReply':
        print("✅ type: 'LoadWaferReply'")
        all_checks.append(True)
    else:
        print(f"❌ type: '{response.get('type')}' (expected 'LoadWaferReply')")
        all_checks.append(False)

    # Check 3: Data field exists
    if 'data' in response:
        print("✅ data: present")
        all_checks.append(True)

        data = response['data']

        # Check 3a: wpMachineId
        if 'wpMachineId' in data:
            print(f"✅ data.wpMachineId: {data['wpMachineId']}")
            all_checks.append(True)
        else:
            print("❌ data.wpMachineId: missing")
            all_checks.append(False)

        # Check 3b: wpMachineStatus
        if 'wpMachineStatus' in data:
            print(f"✅ data.wpMachineStatus: '{data['wpMachineStatus']}'")
            all_checks.append(True)
        else:
            print("❌ data.wpMachineStatus: missing")
            all_checks.append(False)

        # Check 3c: loadedWafer
        if 'loadedWafer' in data:
            wafer = data['loadedWafer']
            if wafer and wafer.get('waferId') == 456:
                print(f"✅ data.loadedWafer.waferId: {wafer['waferId']}")
                print(f"✅ data.loadedWafer.orientation: '{wafer['orientation']}'")
                all_checks.append(True)
            elif wafer is None:
                print("⚠️  data.loadedWafer: null (wafer_id not tracked)")
                all_checks.append(False)
            else:
                print(f"❌ data.loadedWafer.waferId: {wafer.get('waferId')} (expected 456)")
                all_checks.append(False)
        else:
            print("❌ data.loadedWafer: missing")
            all_checks.append(False)

        # Check 3d: installedProbeCard
        if 'installedProbeCard' in data:
            card = data['installedProbeCard']
            if card:
                print(f"✅ data.installedProbeCard.probeCardId: {card.get('probeCardId')}")
                print(f"✅ data.installedProbeCard.orientation: '{card.get('orientation')}'")
            else:
                print("   data.installedProbeCard: null")
            all_checks.append(True)
        else:
            print("❌ data.installedProbeCard: missing")
            all_checks.append(False)

        # Check 3e: openedProjectId
        if 'openedProjectId' in data:
            print(f"✅ data.openedProjectId: {data['openedProjectId']}")
            all_checks.append(True)
        else:
            print("❌ data.openedProjectId: missing")
            all_checks.append(False)

        # Check 3f: waferMapDiePosition
        if 'waferMapDiePosition' in data:
            pos = data['waferMapDiePosition']
            print(
                f"✅ data.waferMapDiePosition: col={pos.get('colIndex')}, row={pos.get('rowIndex')}, subsite={pos.get('subsiteIndex')}")
            all_checks.append(True)
        else:
            print("❌ data.waferMapDiePosition: missing")
            all_checks.append(False)

        # Check 3g: chuckAbsolutePosition
        if 'chuckAbsolutePosition' in data:
            pos = data['chuckAbsolutePosition']
            print(f"✅ data.chuckAbsolutePosition: X={pos.get('x')}, Y={pos.get('y')}, Z={pos.get('z')}")
            all_checks.append(True)
        else:
            print("❌ data.chuckAbsolutePosition: missing")
            all_checks.append(False)

        # Check 3h: chuckZPositionState
        if 'chuckZPositionState' in data:
            print(f"✅ data.chuckZPositionState: '{data['chuckZPositionState']}'")
            all_checks.append(True)
        else:
            print("❌ data.chuckZPositionState: missing")
            all_checks.append(False)

    else:
        print("❌ data: missing")
        all_checks.append(False)

    print("-" * 80)


    passed = sum(all_checks)
    total = len(all_checks)

    print(f"\n VALIDATION RESULT: {passed}/{total} checks passed")

    if all(all_checks):
        print("\n" + "=" * 80)
        print("   SUCCESS! YOUR CODE RETURNS CORRECT SWAGGER FORMAT!")
        print("=" * 80)
        return True
    else:
        print("\n" + "=" * 80)
        print(f"  ️  {total - passed} issues found - see details above")
        print("=" * 80)
        return False


    factory._initialized = False
    factory._prober = None


if __name__ == "__main__":
    print("""    Running TESTS    """)

    try:
        success = test_updated_code()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ TEST CRASHED:")
        print(f"   {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)