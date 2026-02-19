"""
Initialization Service for Wafer Prober Agent
Handles database-driven and manual initialization with producer-side interaction
"""

from services.WPKafkaDbService import KafkaDBService


class WPInitializationService:
    """
    Service for initializing wafer prober with database-driven machine and project selection.
    """

    def __init__(self, agent):
        self.agent = agent


    @staticmethod
    def _format_die_position(die_pos):
        """Convert die position to string format with subsite"""
        if not die_pos:
            return None

        # If it's a string, check if it has subsite
        if isinstance(die_pos, str):
            parts = die_pos.split(",")
            if len(parts) == 2:
                # Missing subsite, add it: "2,2" → "2,2,0"
                return f"{die_pos},0"
            elif len(parts) == 3:
                # Already has subsite: "2,2,0" → "2,2,0"
                return die_pos
            else:
                return None

        # Tuple or list
        if isinstance(die_pos, (tuple, list)):
            if len(die_pos) == 2:
                return f"{die_pos[0]},{die_pos[1]},0"
            elif len(die_pos) >= 3:
                return f"{die_pos[0]},{die_pos[1]},{die_pos[2]}"

        return None

    def initialize_from_database(self, force=False, db_timeout=15.0):
        """
        Initialize prober with interactive database selection (PRODUCER SIDE).

        Interactive flow:
        1. Select probe machine from database
        2. Enter ASIC family type
        3. Enter wafer orientation
        4. Select project from filtered list
        5. Initialize with all selected parameters

        Args:
            force: Force re-initialization
            db_timeout: Database query timeout

        Returns:
            dict: Initialization result with status and output
        """
        print("\n" + "=" * 70)
        print("🔬 Interactive Database Initialization")
        print("=" * 70)

        try:
            db_service = KafkaDBService.get_instance()

            # ================================================================
            # STEP 1: Select probe machine
            # ================================================================
            print("\n📡 Step 1/4: Getting probe machines from database...")
            machines = db_service.get_all_wafer_probe_machines(timeout=db_timeout)

            if not machines:
                return {
                    "status": "error",
                    "output": "No wafer probe machines found in database or database agent not responding"
                }

            print(f"✅ Found {len(machines)} probe machine(s)")

            selected_machine = self._select_machine_from_list(machines)

            if not selected_machine:
                return {
                    "status": "error",
                    "output": "No machine selected - initialization cancelled"
                }

            print(f"\n✅ Selected: {selected_machine.get('name')} (ID: {selected_machine.get('id')})")

            # ================================================================
            # STEP 2: Get ASIC family
            # ================================================================
            print("\n" + "=" * 70)
            print("📡 Step 2/4: Specify ASIC Family")
            print("=" * 70)

            asicFamily = input("\nEnter ASIC family type (e.g., NKF7, MOSS): ").strip()

            if not asicFamily:
                return {
                    "status": "error",
                    "output": "ASIC family is required"
                }

            print(f"✅ ASIC family: {asicFamily}")

            # ================================================================
            # STEP 3: Get orientation
            # ================================================================
            print("\n" + "=" * 70)
            print("📡 Step 3/4: Specify Wafer Orientation")
            print("=" * 70)

            orientation = input("\nEnter wafer orientation (e.g., East, West, South, North): ").strip()

            if not orientation:
                return {
                    "status": "error",
                    "output": "Orientation is required"
                }

            print(f"✅ Orientation: {orientation}")

            # ================================================================
            # STEP 4: Get and filter projects
            # ================================================================
            print("\n" + "=" * 70)
            print("📡 Step 4/4: Getting projects from database...")
            print("=" * 70)

            all_projects = db_service.get_all_wafer_probe_projects(timeout=db_timeout)

            if not all_projects:
                return {
                    "status": "error",
                    "output": "No projects found in database"
                }

            print(f"\n✅ Found {len(all_projects)} total projects")

            # Filter by selected prober, ASIC family, and orientation
            filtered_projects = []
            selected_machineId = selected_machine.get('id')

            for project in all_projects:
                # Check if project matches selected prober
                if project.get("wpMachineId") != selected_machineId:
                    continue

                # Check if ASIC family matches (case-insensitive)
                if project.get("asicFamilyType", "").lower() != asicFamily.lower():
                    continue

                # Check if orientation matches
                if str(project.get("orientation", "")).lower() != str(orientation).lower():
                    continue

                filtered_projects.append(project)

            # Show filtering statistics
            machine_projects = [p for p in all_projects if p.get('wpMachineId') == selected_machineId]
            family_projects = [p for p in all_projects if p.get('asicFamilyType', '').lower() == asicFamily.lower()]

            print(f"🔽 Filtered by prober ID {selected_machineId}: {len(machine_projects)} projects")
            print(f"🔽 Filtered by ASIC family '{asicFamily}': {len(family_projects)} projects")
            print(f"🔽 Filtered by orientation '{orientation}°': {len(filtered_projects)} projects")

            if not filtered_projects:
                return {
                    "status": "error",
                    "output": f"No projects found matching:\n"
                              f"  - Prober: {selected_machine.get('name')}\n"
                              f"  - ASIC Family: {asicFamily}\n"
                              f"  - Orientation: {orientation}°"
                }

            # Select project
            selected_project = self._select_project_from_list(filtered_projects)

            if not selected_project:
                return {
                    "status": "error",
                    "output": "No project selected - initialization cancelled"
                }

            print(f"\n✅ Selected project: {selected_project.get('name')}")

            # ================================================================
            # STEP 5: Initialize with selections
            # ================================================================
            print("\n" + "=" * 70)
            print("🔌 Initializing prober connection...")
            print("=" * 70)

            # Extract machine parameters
            machineType = selected_machine.get('software', '').lower()
            host_name = selected_machine.get('hostName', '')
            connection_port = selected_machine.get('connectionPort', '')
            machineId = selected_machine.get('id', '')
            machineName = selected_machine.get('name', '')

            if not machineType or not host_name:
                return {
                    "status": "error",
                    "output": f"Missing required machine parameters (type: {machineType}, host: {host_name})"
                }

            # Build address
            if connection_port:
                address = f"{machineName}01.{host_name}:{connection_port}"
            else:
                address = host_name

            # Format die positions (around line 195)
            alignmentDie_str = self._format_die_position(selected_project.get("alignmentDie"))
            homeDie_str = self._format_die_position(selected_project.get("homeDie"))


            # Send Initialize command with all parameters
            result = self.agent.send(
                command="Initialize",
                params={
                    "address": address,
                    "machineType": machineType,
                    "projectName": selected_project.get("name"),
                    "alignmentDie": alignmentDie_str,
                    "homeDie": homeDie_str,
                    "force": force,
                    # Metadata
                    "machineId": machineId,
                    "machineName": machineName,
                    "projectId": selected_project.get("id"),
                    "asicFamily": selected_project.get("asicFamilyType"),
                    "orientation": selected_project.get("orientation"),
                    "initialization_mode": "database"
                },
                timeout=90.0
            )

            if not result:
                return {
                    "status": "error",
                    "output": "Initialization command timed out. Please check if listener is running."
                }

            # Display summary if successful
            if result.get("status") == "success":
                print("\n" + "=" * 70)
                print("✅ Initialization Complete!")
                print("=" * 70)
                print(f"Prober: {machineName}")
                print(f"Address: {address}")
                print(f"Project: {selected_project.get('name')}")
                print(f"ASIC Family: {selected_project.get('asicFamilyType')}")
                print(f"Orientation: {selected_project.get('orientation')}")

                alignmentDie = selected_project.get('alignmentDie')
                homeDie = selected_project.get('homeDie')

                if alignmentDie:
                    print(f"Alignment Die: {alignmentDie}")
                if homeDie:
                    print(f"Home Die: {homeDie}")

                print("=" * 70 + "\n")

                # Enhance result with metadata
                if "data" not in result:
                    result["data"] = {}
                result["data"].update({
                    "machineId": machineId,
                    "machineName": machineName,
                    "projectId": selected_project.get("id"),
                    "asicFamily": selected_project.get("asicFamilyType"),
                    "orientation": selected_project.get("orientation"),
                    "alignmentDie": alignmentDie_str,
                    "homeDie": homeDie_str,
                    "initialization_mode": "database"
                })
            try:
                db_service.close()
            except:
                pass
            return result

        except KeyboardInterrupt:
            print("\n❌ Initialization cancelled by user")
            return {
                "status": "error",
                "output": "Initialization cancelled by user"
            }
        except Exception as e:
            import traceback
            traceback.print_exc()
            return {
                "status": "error",
                "output": f"Database initialization failed: {str(e)}"
            }

    def initialize_manual(self, address, machineType, projectName=None,
                          alignmentDie=None, homeDie=None, force=False):
        """
        Initialize prober with manual parameters (wrapper for convenience).

        Args:
            address: Prober network address
            machineType: Type of prober machine
            projectName: Optional project name
            alignmentDie: Optional alignment die "col,row,subsite"
            homeDie: Optional home die "col,row,subsite"
            force: Force re-initialization

        Returns:
            dict: Initialization result
        """
        return self.agent.send(
            command="Initialize",
            params={
                "address": address,
                "machineType": machineType,
                "projectName": projectName,
                "alignmentDie": alignmentDie,
                "homeDie": homeDie,
                "force": force,
                "initialization_mode": "manual"
            },
            timeout=90.0
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

    def list_available_projects(self, asicFamily=None, orientation=None, timeout=15.0):
        """
        List available projects from database, optionally filtered.

        Args:
            asicFamily: Filter by ASIC family (optional)
            orientation: Filter by orientation (optional)
            timeout: Database query timeout

        Returns:
            list: List of project dictionaries
        """
        try:
            db_service = KafkaDBService.get_instance()
            all_projects = db_service.get_all_wafer_probe_projects(timeout=timeout)

            if not all_projects:
                print("❌ No projects found")
                return []

            # Apply filters if provided
            filtered_projects = all_projects

            if asicFamily:
                filtered_projects = [p for p in filtered_projects
                                     if p.get("asicFamilyType", "").lower() == asicFamily.lower()]

            if orientation:
                filtered_projects = [p for p in filtered_projects
                                     if str(p.get("orientation", "")).lower() == str(orientation).lower()]

            print(f"\n✅ Found {len(filtered_projects)} project(s)")
            if asicFamily or orientation:
                print(f"   (filtered from {len(all_projects)} total projects)")

            self._display_projects(filtered_projects)

            return filtered_projects

        except Exception as e:
            print(f"❌ Error listing projects: {e}")
            return []

    def initialize_by_id(self, machineId, projectName=None, force=False, timeout=15.0):
        """
        Initialize by machine ID (useful for automation).

        Args:
            machineId: Database ID of the machine
            projectName: Optional project name
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
                if str(machine.get('id')) == str(machineId):
                    selected = machine
                    break

            if not selected:
                return {
                    "status": "error",
                    "output": f"Machine with ID '{machineId}' not found in database"
                }

            # Extract parameters
            machineType = selected.get('software', '').lower()
            host_name = selected.get('hostName', '')
            connection_port = selected.get('connectionPort', '')
            machineName = selected.get('name', '')

            if connection_port:
                address = f"{machineName}01.{host_name}:{connection_port}"
            else:
                address = host_name

            print(f"🔧 Initializing {machineName} (ID: {machineId}) at {address}...")

            # Send Initialize command
            return self.agent.send(
                command="Initialize",
                params={
                    "address": address,
                    "machineType": machineType,
                    "projectName": projectName,
                    "force": force,
                    "machineId": machineId,
                    "machineName": machineName,
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

    def _select_machine_from_list(self, machines):
        """
        Display machines and prompt user for selection (PRODUCER SIDE).

        Args:
            machines: List of machine dicts from database

        Returns:
            Selected machine dict or None if cancelled
        """
        print("\n" + "=" * 70)
        print("📋 Available Probe Machines:")
        print("=" * 70)

        self._display_machines(machines)

        print("\n" + "=" * 70)

        while True:
            try:
                selection = input(f"\nSelect probe machine (1-{len(machines)}) or 'q' to quit: ").strip()

                if selection.lower() == 'q':
                    print("❌ Initialization cancelled by user")
                    return None

                idx = int(selection)
                if 1 <= idx <= len(machines):
                    selected = machines[idx - 1]
                    return selected
                else:
                    print(f"⚠️  Please enter a number between 1 and {len(machines)}")

            except ValueError:
                print("⚠️  Invalid input. Please enter a number or 'q' to quit.")
            except KeyboardInterrupt:
                print("\n❌ Initialization cancelled by user")
                return None

    def _select_project_from_list(self, projects):
        """
        Display projects and prompt user for selection (PRODUCER SIDE).

        Args:
            projects: List of project dicts from database

        Returns:
            Selected project dict or None if cancelled
        """
        print("\n" + "=" * 70)
        print("📋 Matching Projects:")
        print("=" * 70)

        self._display_projects(projects)

        print("\n" + "=" * 70)

        while True:
            try:
                selection = input(f"\nSelect project (1-{len(projects)}) or 'q' to quit: ").strip()

                if selection.lower() == 'q':
                    print("❌ Initialization cancelled by user")
                    return None

                idx = int(selection)
                if 1 <= idx <= len(projects):
                    selected = projects[idx - 1]
                    return selected
                else:
                    print(f"⚠️  Please enter a number between 1 and {len(projects)}")

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
            print(f"   Type: {machine.get('software', 'N/A')}")
            print(f"   Host: {machine.get('hostName', 'N/A')}")
            if machine.get('connectionPort'):
                print(f"   Port: {machine.get('connectionPort')}")
            print(f"   Location: {machine.get('generalLocation', 'N/A')}")

    def _display_projects(self, projects):
        """Display list of projects in formatted output"""
        for idx, project in enumerate(projects, 1):
            print(f"\n{idx}. {project.get('name', 'Unknown')}")
            print(f"   ID: {project.get('id', 'N/A')}")
            print(f"   ASIC Family: {project.get('asicFamilyType', 'N/A')}")
            print(f"   Orientation: {project.get('orientation', 'N/A')}")

            alignmentDie = project.get('alignmentDie')
            homeDie = project.get('homeDie')

            if alignmentDie:
                print(f"   Alignment Die: {alignmentDie}")
            if homeDie:
                print(f"   Home Die: {homeDie}")
