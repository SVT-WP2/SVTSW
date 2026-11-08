/**
 * Body of `POST /api/wp-machines/:id/installed-probe-card` — `installedProbeCardId: null` uninstalls the probe card.
 */
export type EpicWpMachineUpdateInstalledProbeCardRequest = {
    installedProbeCardId: number | null
    /** Enum value of `waferMapOrientation` (see the enums endpoint); optional, ignored when uninstalling. */
    installedProbeCardOrientation?: string | null
}
