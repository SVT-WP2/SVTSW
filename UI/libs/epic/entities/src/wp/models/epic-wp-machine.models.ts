export type EpicWpMachineEntity = {
    id: number
    name: string
    serialNumber: string
    hostName: string
    connectionType: string
    connectionPort: number
    generalLocation: string
    software: string
    swVersion: string
    vendor: string
    loadedWaferId: number | null
    installedProbeCardId: number | null
}


