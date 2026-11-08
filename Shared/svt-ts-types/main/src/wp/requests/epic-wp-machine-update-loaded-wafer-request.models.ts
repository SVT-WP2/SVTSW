/**
 * Body of `POST /api/wp-machines/:id/loaded-wafer` — `loadedWaferId: null` unloads the wafer.
 */
export type EpicWpMachineUpdateLoadedWaferRequest = {
    loadedWaferId: number | null
    /**
     * Enum value of `waferMapOrientation` (see the enums endpoint): required to load a wafer (the DB agent answers
     * 400 without it), ignored when unloading. Sending the loaded wafer again with another value re-orients it.
     */
    loadedWaferOrientation: string | null
}
