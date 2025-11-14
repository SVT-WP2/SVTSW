"""
Updated KafkaDBService using singleton DBKafkaClient
Fixes circular imports and ensures consistent DB communication
"""
from typing import List, Dict, Optional, Any
from services.db_kafka_client import DBKafkaClient


class KafkaDBService:
    """Service for communicating with DB Agent via Kafka on localhost:9095"""

    def __init__(self, kafka_client=None):
        """
        Initialize with optional KafkaClient (not used for DB operations)
        DB operations use dedicated DBKafkaClient singleton

        Args:
            kafka_client: Optional, not used for DB operations (for backward compatibility)
        """
        # Use singleton DB Kafka client
        self.db_client = DBKafkaClient.get_instance()

    def get_all_enums(
        self, 
        enum_names: Optional[List[str]] = None, 
        timeout: float = 10.0
    ) -> Dict[str, List[str]]:
        """
        Get enumeration values from database

        Args:
            enum_names: Optional list of specific enum names to retrieve
            timeout: Request timeout in seconds

        Returns:
            Dictionary mapping enum names to their values
        """
        # Build request data according to Swagger spec
        data = {}
        if enum_names:
            data["enumsNames"] = enum_names

        reply = self.db_client.request_reply(
            message_type="GetAllEnums",
            data=data,
            reply_type="GetAllEnumsReply",
            timeout=timeout
        )

        if not reply:
            return {}

        return reply.get("data", {}) or {}

    def get_chip_types(self, timeout: float = 10.0) -> List[str]:
        """
        Get available chip types (asicFamilyType enum)

        Args:
            timeout: Request timeout in seconds

        Returns:
            List of chip type names
        """
        data = self.get_all_enums(["asicFamilyType"], timeout=timeout)
        # Note: Swagger shows "asicFamilType" (typo?) so try both
        return data.get("asicFamilyType", []) or data.get("asicFamilType", [])

    def get_orientations(self, timeout: float = 10.0) -> List[str]:
        """
        Get available wafer map orientations

        Args:
            timeout: Request timeout in seconds

        Returns:
            List of orientation values
        """
        data = self.get_all_enums(["waferMapOrientation"], timeout=timeout)
        return data.get("waferMapOrientation", [])

    def get_all_wafer_probe_machines(
        self, 
        timeout: float = 10.0
    ) -> List[Dict[str, Any]]:
        """
        Get all wafer probe machines from database

        According to Swagger:
        - Request type: "GetAllWaferProbeMachines"
        - Reply type: "GetAllWaferProbeMachinesReply"
        - Data structure: { "filter": { "ids": [optional array] } }

        Args:
            timeout: Request timeout in seconds

        Returns:
            List of wafer probe machine dictionaries with their details
        """
        # Build request data according to Swagger spec
        data = {
            "filter": {
                # Empty filter = get all machines
            }
        }

        reply = self.db_client.request_reply(
            message_type="GetAllWaferProbeMachines",
            data=data,
            reply_type="GetAllWaferProbeMachinesReply",
            timeout=timeout
        )

        if not reply:
            print(f"⚠️ No reply received from DB agent (timeout: {timeout}s)")
            return []

        # Extract the machines from the reply
        # According to Swagger: GetAllWaferProbeMachinesReplyMessage.data.items
        reply_data = reply.get("data", {})
        machines = reply_data.get("items", [])

        if machines:
            print(f"✅ Retrieved {len(machines)} wafer probe machine(s)")
        else:
            print(f"⚠️ No machines found in response")

        return machines

    def test_connection(self, timeout: float = 5.0) -> bool:
        """
        Test if DB Agent is reachable

        Args:
            timeout: Test timeout in seconds

        Returns:
            True if DB Agent responds, False otherwise
        """
        return self.db_client.test_connection(timeout=timeout)

    def close(self):
        """Clean up resources (singleton handles its own cleanup)"""
        # Singleton persists, but we can call close if needed
        pass