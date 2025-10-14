import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from kafka_minimal import KafkaTestClient
from services.kafka_db_service import KafkaDBService


def test_db():
    kafka = KafkaTestClient()
    db = KafkaDBService(kafka)

    chip_types = db.get_chip_types()
    print("✅ Chip Types:", chip_types)

    orientations = db.get_orientations()
    print("✅ Orientations:", orientations)


if __name__ == "__main__":
    test_db()
