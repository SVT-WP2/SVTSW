from drivers.sentio_prober import SentioProberImpl

#Add any other machine used for WP testing
prober_classes = {
    "sentio": SentioProberImpl
}

def get_prober(machine_type: str, address: str):
    try:
        return prober_classes[machine_type.lower()](address)
    except KeyError:
        raise ValueError(f"Unsupported machine type: {machine_type}")
