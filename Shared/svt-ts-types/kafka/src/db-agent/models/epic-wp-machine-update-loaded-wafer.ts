import { EpicWpMachineUpdateLoadedWaferRequest } from 'svt-ts-types'


/** Payload of the `UpdateWpMachineLoadedWafer` Kafka message — the HTTP request body plus the machine it targets. */
export type EpicWpMachineUpdateLoadedWafer = EpicWpMachineUpdateLoadedWaferRequest & {
    wpMachineId: number
}
