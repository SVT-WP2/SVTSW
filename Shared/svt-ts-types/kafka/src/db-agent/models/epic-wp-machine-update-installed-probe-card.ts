import { EpicWpMachineUpdateInstalledProbeCardRequest } from 'svt-ts-types'


/** Payload of the `UpdateWpMachineInstalledProbeCard` Kafka message — the HTTP request body plus the machine it targets. */
export type EpicWpMachineUpdateInstalledProbeCard = EpicWpMachineUpdateInstalledProbeCardRequest & {
    wpMachineId: number
}
