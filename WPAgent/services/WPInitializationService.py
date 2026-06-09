"""
Initialization Service for Wafer Prober Agent
Handles database-driven and manual initialization with producer-side interaction
"""

from services.WPDbKafkaClient import DBKafkaClient


class WPInitializationService:
    """
    Service for initializing wafer prober with database-driven machine and project selection.
    """

    def __init__(self, agent):
        self.agent = agent

    # =========================================================================
    # Public entry points
    # =========================================================================

    def initialize_from_database(self, force=False, db_timeout=15.0):
        """
        Initialize prober with interactive database selection (PRODUCER SIDE).
        Orchestrates: collect selections → filter → build params → send command.
        """
        sep = "=" * 70
        print(f"\n{sep}\n🔬 Interactive Database Initialization\n{sep}")

        try:
            db_service = DBKafkaClient.get_instance()

            machines = self._fetch_machines(db_service, db_timeout)
            if machines is None:
                return {"status": "error", "output": "No wafer probe machines found in database or database agent not responding"}

            all_projects = self._fetch_projects(db_service, db_timeout)
            if all_projects is None:
                return {"status": "error", "output": "No projects found in database"}

            selections = self._collect_user_selections(machines, all_projects)
            if "error" in selections:
                return {"status": "error", "output": selections["error"]}

            params = self._build_init_params(selections, force)
            if "error" in params:
                return {"status": "error", "output": params["error"]}

            result = self._send_and_report(params, selections)

            try:
                db_service.close()
            except Exception:
                pass

            return result

        except KeyboardInterrupt:
            print("\n❌ Initialization cancelled by user")
            return {"status": "error", "output": "Initialization cancelled by user"}
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"status": "error", "output": f"Database initialization failed: {str(e)}"}

    def initialize_manual(self, address, machineType, projectName=None,
                          alignmentDie=None, homeDie=None, force=False):
        """Initialize prober with manual parameters."""
        return self.agent.send(
            command="Initialize",
            params={
                "address": address,
                "machineType": machineType,
                "projectName": projectName,
                "alignmentDie": alignmentDie,
                "homeDie": homeDie,
                "force": force,
                "initialization_mode": "manual",
            },
            timeout=90.0,
        )

    def initialize_by_id(self, machineId, projectName=None, force=False, timeout=15.0):
        """Initialize by machine ID — useful for automation."""
        try:
            db_service = DBKafkaClient.get_instance()
            machines = db_service.get_all_wafer_probe_machines(timeout=timeout)
            machine = next((m for m in machines if str(m.get("id")) == str(machineId)), None)

            if not machine:
                return {"status": "error", "output": f"Machine with ID '{machineId}' not found in database"}

            address = self._build_address(machine)
            machineName = machine.get("name", "")
            print(f"🔧 Initializing {machineName} (ID: {machineId}) at {address}...")

            return self.agent.send(
                command="Initialize",
                params={
                    "address": address,
                    "machineType": machine.get("software", "").lower(),
                    "projectName": projectName,
                    "force": force,
                    "machineId": machineId,
                    "machineName": machineName,
                    "initialization_mode": "database",
                },
                timeout=30.0,
            )

        except Exception as e:
            import traceback
            traceback.print_exc()
            return {"status": "error", "output": f"Initialization by ID failed: {str(e)}"}

    def list_available_machines(self, timeout=15.0):
        """List available machines from database."""
        try:
            machines = DBKafkaClient.get_instance().get_all_wafer_probe_machines(timeout=timeout)
            if machines:
                print(f"\n✅ Found {len(machines)} machine(s)")
                self._display_machines(machines)
            else:
                print("❌ No machines found")
            return machines
        except Exception as e:
            print(f"❌ Error listing machines: {e}")
            return []

    def list_available_projects(self, asicFamily=None, orientation=None, timeout=15.0):
        """List available projects from database, optionally filtered."""
        try:
            all_projects = DBKafkaClient.get_instance().get_all_wafer_probe_projects(timeout=timeout)
            if not all_projects:
                print("❌ No projects found")
                return []

            filtered = self._filter_projects(all_projects, None, asicFamily, orientation)
            print(f"\n✅ Found {len(filtered)} project(s)")
            if asicFamily or orientation:
                print(f"   (filtered from {len(all_projects)} total projects)")
            self._display_projects(filtered)
            return filtered
        except Exception as e:
            print(f"❌ Error listing projects: {e}")
            return []

    # =========================================================================
    # Private — data fetching
    # =========================================================================

    def _fetch_machines(self, db_service, timeout):
        """Fetch machines from DB. Returns list or None on failure."""
        print("\n📡 Step 1/4: Getting probe machines from database...")
        machines = db_service.get_all_wafer_probe_machines(timeout=timeout)
        if not machines:
            return None
        print(f"✅ Found {len(machines)} probe machine(s)")
        return machines

    def _fetch_projects(self, db_service, timeout):
        """Fetch all projects from DB. Returns list or None on failure."""
        print("\n📡 Step 4/4: Getting projects from database...")
        projects = db_service.get_all_wafer_probe_projects(timeout=timeout)
        if not projects:
            return None
        print(f"✅ Found {len(projects)} total projects")
        return projects

    # =========================================================================
    # Private — user interaction (all input() calls isolated here)
    # =========================================================================

    def _collect_user_selections(self, machines, all_projects):
        """
        Collect all user input: machine, ASIC family, orientation, project.
        Returns dict with selections, or dict with 'error' key on cancellation.
        """
        sep = "=" * 70

        # Machine
        machine = self._select_machine_from_list(machines)
        if not machine:
            return {"error": "No machine selected - initialization cancelled"}
        print(f"\n✅ Selected: {machine.get('name')} (ID: {machine.get('id')})")

        # ASIC family
        print(f"\n{sep}\n📡 Step 2/4: Specify ASIC Family\n{sep}")
        asic_family = input("\nEnter ASIC family type (e.g., NKF7, MOSS): ").strip()
        if not asic_family:
            return {"error": "ASIC family is required"}
        print(f"✅ ASIC family: {asic_family}")

        # Orientation
        print(f"\n{sep}\n📡 Step 3/4: Specify Wafer Orientation\n{sep}")
        orientation = input("\nEnter wafer orientation (e.g., East, West, South, North): ").strip()
        if not orientation:
            return {"error": "Orientation is required"}
        print(f"✅ Orientation: {orientation}")

        # Filter and select project
        filtered = self._filter_projects(all_projects, machine.get("id"), asic_family, orientation)
        self._print_filter_stats(all_projects, filtered, machine, asic_family, orientation)

        if not filtered:
            return {
                "error": (
                    f"No projects found matching:\n"
                    f"  - Prober: {machine.get('name')}\n"
                    f"  - ASIC Family: {asic_family}\n"
                    f"  - Orientation: {orientation}"
                )
            }

        project = self._select_project_from_list(filtered)
        if not project:
            return {"error": "No project selected - initialization cancelled"}
        print(f"\n✅ Selected project: {project.get('name')}")

        return {
            "machine": machine,
            "asic_family": asic_family,
            "orientation": orientation,
            "project": project,
        }

    # =========================================================================
    # Private — pure logic
    # =========================================================================

    def _filter_projects(self, all_projects, machine_id, asic_family, orientation):
        """Filter projects by machine, ASIC family, and orientation. Pure logic, no I/O."""
        result = all_projects

        if machine_id is not None:
            result = [p for p in result if p.get("wpMachineId") == machine_id]

        if asic_family:
            result = [p for p in result if p.get("asicFamilyType", "").lower() == asic_family.lower()]

        if orientation:
            result = [p for p in result if str(p.get("orientation", "")).lower() == orientation.lower()]

        return result

    def _build_init_params(self, selections, force):
        """
        Build the Initialize command params dict from collected selections.
        Returns params dict, or dict with 'error' key if machine data is incomplete.
        """
        machine = selections["machine"]
        project = selections["project"]

        machine_type = machine.get("software", "").lower()
        host_name = machine.get("hostName", "")

        if not machine_type or not host_name:
            return {"error": f"Missing required machine parameters (type: {machine_type}, host: {host_name})"}

        address = self._build_address(machine)

        return {
            "address": address,
            "machineType": machine_type,
            "projectName": project.get("name"),
            "alignmentDie": self._format_die_position(project.get("alignmentDie")),
            "homeDie": self._format_die_position(project.get("homeDie")),
            "force": force,
            "machineId": machine.get("id"),
            "machineName": machine.get("name"),
            "projectId": project.get("id"),
            "asicFamily": project.get("asicFamilyType"),
            "orientation": project.get("orientation"),
            "initialization_mode": "database",
        }

    def _build_address(self, machine):
        """Build full address string from machine dict."""
        machine_name = machine.get("name", "")
        host_name = machine.get("hostName", "")
        port = machine.get("connectionPort", "")
        base = f"{machine_name}01.{host_name}" if machine_name and host_name else host_name
        return f"{base}:{port}" if port else base

    def _send_and_report(self, params, selections):
        """Send Initialize command and print summary on success."""
        print(f"\n{'=' * 70}\n🔌 Initializing prober connection...\n{'=' * 70}")

        result = self.agent.send(command="Initialize", params=params, timeout=90.0)

        if not result:
            return {"status": "error", "output": "Initialization command timed out. Check if listener is running."}

        if result.get("status") == "Success":
            self._print_init_summary(params, selections)
            result.setdefault("data", {}).update({
                "machineId": params["machineId"],
                "machineName": params["machineName"],
                "projectId": params["projectId"],
                "asicFamily": params["asicFamily"],
                "orientation": params["orientation"],
                "alignmentDie": params["alignmentDie"],
                "homeDie": params["homeDie"],
                "initialization_mode": "database",
            })

        return result

    # =========================================================================
    # Private — display helpers
    # =========================================================================

    def _print_filter_stats(self, all_projects, filtered, machine, asic_family, orientation):
        machine_id = machine.get("id")
        machine_count = len([p for p in all_projects if p.get("wpMachineId") == machine_id])
        family_count = len([p for p in all_projects if p.get("asicFamilyType", "").lower() == asic_family.lower()])
        print(f"🔽 Filtered by prober ID {machine_id}: {machine_count} projects")
        print(f"🔽 Filtered by ASIC family '{asic_family}': {family_count} projects")
        print(f"🔽 Filtered by orientation '{orientation}': {len(filtered)} projects")

    def _print_init_summary(self, params, selections):
        sep = "=" * 70
        project = selections["project"]
        print(f"\n{sep}\n✅ Initialization Complete!\n{sep}")
        print(f"Prober: {params['machineName']}")
        print(f"Address: {params['address']}")
        print(f"Project: {params['projectName']}")
        print(f"ASIC Family: {params['asicFamily']}")
        print(f"Orientation: {params['orientation']}")
        if project.get("alignmentDie"):
            print(f"Alignment Die: {project.get('alignmentDie')}")
        if project.get("homeDie"):
            print(f"Home Die: {project.get('homeDie')}")
        print(sep + "\n")

    def _select_machine_from_list(self, machines):
        """Prompt user to select a machine. Returns selected dict or None."""
        print(f"\n{'=' * 70}\n📋 Available Probe Machines:\n{'=' * 70}")
        self._display_machines(machines)
        return self._prompt_selection(machines, "probe machine")

    def _select_project_from_list(self, projects):
        """Prompt user to select a project. Returns selected dict or None."""
        print(f"\n{'=' * 70}\n📋 Matching Projects:\n{'=' * 70}")
        self._display_projects(projects)
        return self._prompt_selection(projects, "project")

    def _prompt_selection(self, items, label):
        """Generic numbered selection prompt. Returns selected item or None."""
        print(f"\n{'=' * 70}")
        while True:
            try:
                selection = input(f"\nSelect {label} (1-{len(items)}) or 'q' to quit: ").strip()
                if selection.lower() == "q":
                    print(f"❌ Cancelled by user")
                    return None
                idx = int(selection)
                if 1 <= idx <= len(items):
                    return items[idx - 1]
                print(f"⚠️  Please enter a number between 1 and {len(items)}")
            except ValueError:
                print("⚠️  Invalid input. Please enter a number or 'q' to quit.")
            except KeyboardInterrupt:
                print("\n❌ Cancelled by user")
                return None

    def _display_machines(self, machines):
        for idx, m in enumerate(machines, 1):
            print(f"\n{idx}. {m.get('name', 'N/A')}")
            print(f"   ID: {m.get('id', 'N/A')}")
            print(f"   Type: {m.get('software', 'N/A')}")
            print(f"   Host: {m.get('hostName', 'N/A')}")
            if m.get("connectionPort"):
                print(f"   Port: {m.get('connectionPort')}")
            print(f"   Location: {m.get('generalLocation', 'N/A')}")

    def _display_projects(self, projects):
        for idx, p in enumerate(projects, 1):
            print(f"\n{idx}. {p.get('name', 'Unknown')}")
            print(f"   ID: {p.get('id', 'N/A')}")
            print(f"   ASIC Family: {p.get('asicFamilyType', 'N/A')}")
            print(f"   Orientation: {p.get('orientation', 'N/A')}")
            if p.get("alignmentDie"):
                print(f"   Alignment Die: {p.get('alignmentDie')}")
            if p.get("homeDie"):
                print(f"   Home Die: {p.get('homeDie')}")

    @staticmethod
    def _format_die_position(die_pos):
        """Normalize die position to 'col,row,subsite' string format."""
        if not die_pos:
            return None
        if isinstance(die_pos, str):
            parts = die_pos.split(",")
            if len(parts) == 2:
                return f"{die_pos},0"
            if len(parts) == 3:
                return die_pos
            return None
        if isinstance(die_pos, (tuple, list)):
            if len(die_pos) == 2:
                return f"{die_pos[0]},{die_pos[1]},0"
            if len(die_pos) >= 3:
                return f"{die_pos[0]},{die_pos[1]},{die_pos[2]}"
        return None
