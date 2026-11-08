import { IsInt, IsOptional, IsString } from 'class-validator'
import { EpicWpMachineUpdateInstalledProbeCard, EpicWpMachineUpdateLoadedWafer } from 'epic/entities'


/**
 * `UpdateWpMachineLoadedWafer` payload (`WpMachineLoadedWaferUpdateDto` of the Kafka contract): the machine,
 * the wafer to load or `null` to unload, and the orientation it is loaded with. The TypeScript contract type
 * lacks the orientation, which WPAgent sends and reads; the DTO of `epic/entities` lacks the machine id.
 */
export class SvtDbAgentNextWpMachineLoadedWaferDto implements EpicWpMachineUpdateLoadedWafer {

    @IsInt()
    wpMachineId!: number

    @IsOptional()
    @IsInt()
    loadedWaferId!: number | null

    @IsOptional()
    @IsString()
    loadedWaferOrientation?: string | null

}

/**
 * `UpdateWpMachineInstalledProbeCard` payload (`WpMachineInstalledProbeCardUpdateDto` of the Kafka contract):
 * the machine, the probe card to install or `null` to uninstall, and its orientation (optional).
 */
export class SvtDbAgentNextWpMachineInstalledProbeCardDto implements EpicWpMachineUpdateInstalledProbeCard {

    @IsInt()
    wpMachineId!: number

    @IsOptional()
    @IsInt()
    installedProbeCardId!: number | null

    @IsOptional()
    @IsString()
    installedProbeCardOrientation?: string | null

}
