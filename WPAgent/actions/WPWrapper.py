
class WPWrapper:
    """Wrapper for WP Agent commands using existing Kafka client."""

    def __init__(self, kafka_client):
        """
        Initialize with YOUR existing Kafka client.

        Args:
            kafka_client: Your KafkaClient instance from kafka_client.py
        """
        self.kafka = kafka_client

   #=========== COMMON Comands =====#

    def LoadWafer(self, wpMachineId=None, waferId=None, orientation=None):
        """Load wafer - matches load_wafer()"""
        params = {}
        if wpMachineId:
            params["wpMachineId"] = wpMachineId
        if waferId:
            params["waferId"] = waferId
        if orientation:
                params["orientation"] = orientation
        return self.kafka.send("Load", params=params)

    def UnloadWafer(self, wpMachineId=None ):
        """Unload wafer - matches unload_wafer()"""
        params = {}
        if wpMachineId:
            params["wpMachineId"] = wpMachineId

        return self.kafka.send("Unload", params=params)

    # =========== Chuck =====#

    def MoveChuckHome(self, wpMachineId=None):
        """Move chuck home - matches move_chuck_home()"""
        params = {}
        if wpMachineId:
            params["wpMachineId"] = wpMachineId
        return self.kafka.send("MoveChuckHome", params=params)




