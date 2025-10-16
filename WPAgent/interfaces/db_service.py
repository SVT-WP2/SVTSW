from typing import Protocol, List, Dict, Optional

class IDBService(Protocol):
    #the abstract DB client others will depend on
    def get_all_enums(self, enum_names: Optional[List[str]] = None, timeout: float = 10.0) -> Dict[str, List[str]]:
        ...

    def get_chip_types(self, timeout: float = 10.0) -> List[str]:
        ...

    def get_orientations(self, timeout: float = 10.0) -> List[str]:
        ...
