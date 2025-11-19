"""
Initialization Service for Wafer Prober Agent
Handles database-driven and manual initialization with producer-side interaction
"""

from services.kafka_db_service import KafkaDBService


class WPInitializationService:
    """
    Service for initializing wafer prober with database-driven machine selection.
    Keeps initialization logic separate from Kafka communication layer.
    """

    def __init__(self, agent):
        """
        Initialize the service.

        Args:
            agent: WaferProberAgent instance for sending commands
        """
        self.agent = agent

    def initialize_from_database(self, project_name=None, force=False, db_timeout=15.0):
        """
        Initialize prober by selecting from database on the PRODUCER side.

        This method:
        1. Queries database for available machines
        2. Displays machines to user (PRODUCER SIDE)
        3. Gets user selection (PRODUCER SIDE)
        4. Sends Initialize command with selected machine parameters

        Args:
            project_name: Optional project name
            force: Force re-initialization
            db_timeout: Database query timeout

        Returns:
            dict: Initialization result with status and output
        """
        print("\n🔍 Fetching available wafer probe machines from database...")

        try:
            # Query database
            db_service = KafkaDBService.get_instance()
            machines = db_service.get_all_wafer_probe_machines(timeout=db_timeout)

            if not machines:
                return {
                    "status": "error",
                    "output": "No wafer probe machines found in database or database agent not responding"
                }

            # Display machines and get user selection (PRODUCER SIDE)
            selected_machine = self._select_machine_from_list(machines)

            if not selected_machine:
                return {
                    "status": "error",
                    "output": "No machine selected - initialization cancelled"
                }

            # Extract parameters from selected machine
            machine_type = selected_machine.get('type', '').lower()
            host_name = selected_machine.get('hostName', '')
            connection_port = selected_machine.get('connectionPort', '')
            machine_id = selected_machine.get('id', '')
            machine_name = selected_machine.get('name', '')

            if not machine_type or not host_name:
                return {
                    "status": "error",
                    "output": f"Missing required machine parameters (type: {machine_type}, host: {host_name})"
                }

            # Build address
            if connection_port:
                address = f"{host_name}:{connection_port}"
            else:
                address = host_name

            print(f"\n🔧 Initializing {machine_name} ({machine_type}) at {address}...")

            # Send Initialize command via agent (manual mode with metadata)
            result = self.agent.send(
                command="Initialize",
                params={
                    "address": address,
                    "machine_type": machine_type,
                    "project_name": project_name,
                    "force": force,
                    # Add metadata for tracking
                    "machine_id": machine_id,
                    "machine_name": machine_name,
                    "initialization_mode": "database"
                },
                timeout=30.0
            )

            # Enhance result with database metadata
            if result.get("status") == "success":
                if "data" not in result:
                    result["data"] = {}
                result["data"]["machine_id"] = machine_id
                result["data"]["machine_name"] = machine_name
                result["data"]["initialization_mode"] = "database"

            return result

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "status": "error",
                "output": f"Database initialization failed: {str(e)}"
            }

    def initialize_manual(self, address, machine_type, project_name=None, force=False):
        """
        Initialize prober with manual parameters (wrapper for convenience).

        Args:
            address: Prober network address
            machine_type: Type of prober machine
            project_name: Optional project name
            force: Force re-initialization

        Returns:
            dict: Initialization result
        """
        return self.agent.send(
            command="Initialize",
            params={
                "address": address,
                "machine_type": machine_type,
                "project_name": project_name,
                "force": force,
                "initialization_mode": "manual"
            },
            timeout=30.0
        )

    def list_available_machines(self, timeout=15.0):
        """
        List available machines from database without initializing.

        Args:
            timeout: Database query timeout

        Returns:
            list: List of machine dictionaries
        """
        try:
            db_service = KafkaDBService.get_instance()
            machines = db_service.get_all_wafer_probe_machines(timeout=timeout)

            if machines:
                print(f"\n✅ Found {len(machines)} machine(s)")
                self._display_machines(machines)
            else:
                print("❌ No machines found")

            return machines

        except Exception as e:
            print(f"❌ Error listing machines: {e}")
            return []

    def initialize_by_id(self, machine_id, project_name=None, force=False, timeout=15.0):
        """
        Initialize by machine ID (useful for automation).

        Args:
            machine_id: Database ID of the machine
            project_name: Optional project name
            force: Force re-initialization
            timeout: Database query timeout

        Returns:
            dict: Initialization result
        """
        try:
            # Get all machines
            db_service = KafkaDBService.get_instance()
            machines = db_service.get_all_wafer_probe_machines(timeout=timeout)

            # Find machine by ID
            selected = None
            for machine in machines:
                if str(machine.get('id')) == str(machine_id):
                    selected = machine
                    break

            if not selected:
                return {
                    "status": "error",
                    "output": f"Machine with ID '{machine_id}' not found in database"
                }

            # Extract parameters
            machine_type = selected.get('type', '').lower()
            host_name = selected.get('hostName', '')
            connection_port = selected.get('connectionPort', '')
            machine_name = selected.get('name', '')

            if connection_port:
                address = f"{host_name}:{connection_port}"
            else:
                address = host_name

            print(f"🔧 Initializing {machine_name} (ID: {machine_id}) at {address}...")

            # Send Initialize command
            return self.agent.send(
                command="Initialize",
                params={
                    "address": address,
                    "machine_type": machine_type,
                    "project_name": project_name,
                    "force": force,
                    "machine_id": machine_id,
                    "machine_name": machine_name,
                    "initialization_mode": "database"
                },
                timeout=30.0
            )

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "status": "error",
                "output": f"Initialization by ID failed: {str(e)}"
            }

    def initialize_by_name(self, machine_name, project_name=None, force=False, timeout=15.0):
        """
        Initialize by machine name (useful for automation).

        Args:
            machine_name: Name of the machine
            project_name: Optional project name
            force: Force re-initialization
            timeout: Database query timeout

        Returns:
            dict: Initialization result
        """
        try:
            # Get all machines
            db_service = KafkaDBService.get_instance()
            machines = db_service.get_all_wafer_probe_machines(timeout=timeout)

            # Find machine by name (case-insensitive)
            selected = None
            for machine in machines:
                if machine.get('name', '').lower() == machine_name.lower():
                    selected = machine
                    break

            if not selected:
                return {
                    "status": "error",
                    "output": f"Machine '{machine_name}' not found in database"
                }

            # Extract parameters
            machine_type = selected.get('type', '').lower()
            host_name = selected.get('hostName', '')
            connection_port = selected.get('connectionPort', '')
            machine_id = selected.get('id', '')

            if connection_port:
                address = f"{host_name}:{connection_port}"
            else:
                address = host_name

            print(f"🔧 Initializing {machine_name} at {address}...")

            # Send Initialize command
            return self.agent.send(
                command="Initialize",
                params={
                    "address": address,
                    "machine_type": machine_type,
                    "project_name": project_name,
                    "force": force,
                    "machine_id": machine_id,
                    "machine_name": machine_name,
                    "initialization_mode": "database"
                },
                timeout=30.0
            )

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "status": "error",
                "output": f"Initialization by name failed: {str(e)}"
            }

    def _select_machine_from_list(self, machines):
        """
        Display machines and prompt user for selection (PRODUCER SIDE).

        Args:
            machines: List of machine dicts from database

        Returns:
            Selected machine dict or None if cancelled
        """
        print("\n" + "="*70)
        print("  AVAILABLE WAFER PROBE MACHINES")
        print("="*70)

        self._display_machines(machines)

        print("\n" + "="*70)

        while True:
            try:
                selection = input(f"\nSelect machine (1-{len(machines)}) or 'q' to quit: ").strip()

                if selection.lower() == 'q':
                    print("❌ Initialization cancelled by user")
                    return None

                idx = int(selection)
                if 1 <= idx <= len(machines):
                    selected = machines[idx - 1]
                    print(f"\n✅ Selected: {selected.get('name')}")
                    return selected
                else:
                    print(f"⚠️  Please enter a number between 1 and {len(machines)}")

            except ValueError:
                print("⚠️  Invalid input. Please enter a number or 'q' to quit.")
            except KeyboardInterrupt:
                print("\n❌ Initialization cancelled by user")
                return None

    def _display_machines(self, machines):
        """Display list of machines in formatted output"""
        for idx, machine in enumerate(machines, 1):
            print(f"\n{idx}. {machine.get('name', 'N/A')}")
            print(f"   ID: {machine.get('id', 'N/A')}")
            print(f"   Type: {machine.get('type', 'N/A')}")
            print(f"   Host: {machine.get('hostName', 'N/A')}:{machine.get('connectionPort', 'N/A')}")
            print(f"   Location: {machine.get('generalLocation', 'N/A')}")