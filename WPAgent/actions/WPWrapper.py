# ============================================================================
# WPWrapper.py - Complete Implementation
# ============================================================================

"""
WPWrapper - Wrapper for WP Agent status queries.

This wrapper provides methods to get machine state WITHOUT executing actions.
Actions are executed separately via CLI or TestingActions.
"""


class WPWrapper:
    """
    Wrapper for querying WP Agent machine states.

    All methods in this class ONLY return status, they do NOT execute actions.
    """

    def __init__(self, kafka_client):
        """
        Initialize wrapper with Kafka client.

        Args:
            kafka_client: KafkaClient instance for communication
        """
        self.kafka = kafka_client


    def get_load_wafer_status(self, wpMachineId=None, waferId=None, orientation=None,
                              address=None, machine_type=None):
        """
        Get LoadWafer status WITHOUT executing load.

        Called via Kafka when client requests LoadWafer status.
        Load action must be executed separately via CLI/TestingActions.

        Args:
            wpMachineId: Machine ID
            waferId: Wafer ID (for globals tracking)
            orientation: Wafer orientation (for globals tracking)
            address: Prober address
            machine_type: Prober type

        Returns:
            dict: {"status": "Success", "type": "LoadWaferReply", "data": {...}}
        """
        from actions.WPTestingActions import _ensure_initialized, _get_machine_state
        from drivers.WPFactory import get_prober
        from utilities.WPHelpers import resolve_project_parameters

        # Check initialization
        error = _ensure_initialized()
        if error:
            return {
                "status": "BadRequest",
                "type": "LoadWaferReply",
                "error": {
                    "code": 400,
                    "message": error.get("output", "Prober not initialized")
                }
            }

        try:
            # Get prober
            address, _, machine_type = resolve_project_parameters(address, None, machine_type)
            prober = get_prober(machine_type, address)


            # Get current machine state (NO load execution!)
            machine_state = _get_machine_state(prober, address, machine_type)

            return {
                "status": "Success",
                "type": "LoadWaferReply",
                "data": machine_state
            }

        except Exception as e:
            return {
                "status": "UnexpectedError",
                "type": "LoadWaferReply",
                "error": {
                    "code": 500,
                    "message": str(e)
                }
            }

    def get_unload_wafer_status(self, wpMachineId=None, address=None, machine_type=None):
        """
        Get UnloadWafer status WITHOUT executing unload.

        Returns:
            dict: {"status": "Success", "type": "UnloadWaferReply", "data": {...}}
        """
        from actions.WPTestingActions import _ensure_initialized, _get_machine_state
        from drivers.WPFactory import get_prober
        from utilities.WPHelpers import resolve_project_parameters
        from globals.WPAagentGlobalParameters import SvtWPAagentGlobalParameters

        error = _ensure_initialized()
        if error:
            return {
                "status": "BadRequest",
                "type": "UnloadWaferReply",
                "error": {
                    "code": 400,
                    "message": error.get("output", "Prober not initialized")
                }
            }

        try:
            address, _, machine_type = resolve_project_parameters(address, None, machine_type)
            prober = get_prober(machine_type, address)

            # Get current machine state
            machine_state = _get_machine_state(prober, address, machine_type)

            return {
                "status": "Success",
                "type": "UnloadWaferReply",
                "data": machine_state
            }

        except Exception as e:
            return {
                "status": "UnexpectedError",
                "type": "UnloadWaferReply",
                "error": {
                    "code": 500,
                    "message": str(e)
                }
            }

    def get_machine_state(self, wpMachineId=None, address=None, machine_type=None):
        """
        Get general machine state.

        Returns:
            dict: {"status": "Success", "type": "GetWpMachineStateReply", "data": {...}}
        """
        from actions.WPTestingActions import _ensure_initialized, _get_machine_state
        from drivers.WPFactory import get_prober
        from utilities.WPHelpers import resolve_project_parameters

        error = _ensure_initialized()
        if error:
            return {
                "status": "BadRequest",
                "type": "GetWpMachineStateReply",
                "error": {
                    "code": 400,
                    "message": error.get("output", "Prober not initialized")
                }
            }

        try:
            address, _, machine_type = resolve_project_parameters(address, None, machine_type)
            prober = get_prober(machine_type, address)

            # Get current machine state
            machine_state = _get_machine_state(prober, address, machine_type)

            return {
                "status": "Success",
                "type": "GetWpMachineStateReply",
                "data": machine_state
            }

        except Exception as e:
            return {
                "status": "UnexpectedError",
                "type": "GetWpMachineStateReply",
                "error": {
                    "code": 500,
                    "message": str(e)
                }
            }

    def get_move_chuck_die_status(self, wpMachineId=None, col=None, row=None, subsite=0,
                                  address=None, machine_type=None):
        """
        Get MoveChuckDie status WITHOUT executing move.

        Returns:
            dict: {"status": "Success", "type": "MoveChuckDieReply", "data": {...}}
        """
        from actions.WPTestingActions import _ensure_initialized, _get_machine_state
        from drivers.WPFactory import get_prober
        from utilities.WPHelpers import resolve_project_parameters

        error = _ensure_initialized()
        if error:
            return {
                "status": "BadRequest",
                "type": "MoveChuckDieReply",
                "error": {
                    "code": 400,
                    "message": error.get("output", "Prober not initialized")
                }
            }

        try:
            address, _, machine_type = resolve_project_parameters(address, None, machine_type)
            prober = get_prober(machine_type, address)

            # Get current machine state (assumes move already executed)
            machine_state = _get_machine_state(prober, address, machine_type)

            return {
                "status": "Success",
                "type": "MoveChuckDieReply",
                "data": machine_state
            }

        except Exception as e:
            return {
                "status": "UnexpectedError",
                "type": "MoveChuckDieReply",
                "error": {
                    "code": 500,
                    "message": str(e)
                }
            }

    def get_move_chuck_home_status(self, wpMachineId=None, address=None, machine_type=None):
        """
        Get MoveChuckHome status WITHOUT executing move.

        Returns:
            dict: {"status": "Success", "type": "MoveChuckHomeReply", "data": {...}}
        """
        from actions.WPTestingActions import _ensure_initialized, _get_machine_state
        from drivers.WPFactory import get_prober
        from utilities.WPHelpers import resolve_project_parameters

        error = _ensure_initialized()
        if error:
            return {
                "status": "BadRequest",
                "type": "MoveChuckHomeReply",
                "error": {
                    "code": 400,
                    "message": error.get("output", "Prober not initialized")
                }
            }

        try:
            address, _, machine_type = resolve_project_parameters(address, None, machine_type)
            prober = get_prober(machine_type, address)

            # Get current machine state
            machine_state = _get_machine_state(prober, address, machine_type)

            return {
                "status": "Success",
                "type": "MoveChuckHomeReply",
                "data": machine_state
            }

        except Exception as e:
            return {
                "status": "UnexpectedError",
                "type": "MoveChuckHomeReply",
                "error": {
                    "code": 500,
                    "message": str(e)
                }
            }

    def get_set_chuck_z_position_status(self, wpMachineId=None, chuckZPositionState=None,
                                        address=None, machine_type=None):
        """
        Get SetChuckZPosition status WITHOUT executing move.

        Returns:
            dict: {"status": "Success", "type": "SetChuckZPositionStateReply", "data": {...}}
        """
        from actions.WPTestingActions import _ensure_initialized, _get_machine_state
        from drivers.WPFactory import get_prober
        from utilities.WPHelpers import resolve_project_parameters

        error = _ensure_initialized()
        if error:
            return {
                "status": "BadRequest",
                "type": "SetChuckZPositionStateReply",
                "error": {
                    "code": 400,
                    "message": error.get("output", "Prober not initialized")
                }
            }

        try:
            address, _, machine_type = resolve_project_parameters(address, None, machine_type)
            prober = get_prober(machine_type, address)

            # Get current machine state
            machine_state = _get_machine_state(prober, address, machine_type)

            return {
                "status": "Success",
                "type": "SetChuckZPositionStateReply",
                "data": machine_state
            }

        except Exception as e:
            return {
                "status": "UnexpectedError",
                "type": "SetChuckZPositionStateReply",
                "error": {
                    "code": 500,
                    "message": str(e)
                }
            }
