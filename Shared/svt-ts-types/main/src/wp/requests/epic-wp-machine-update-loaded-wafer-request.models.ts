/**
 * Body of `POST /api/wp-machines/:id/loaded-wafer` — `null` unloads the wafer.
 */
export type EpicWpMachineUpdateLoadedWaferRequest = {
    loadedWaferId: number | null
}
