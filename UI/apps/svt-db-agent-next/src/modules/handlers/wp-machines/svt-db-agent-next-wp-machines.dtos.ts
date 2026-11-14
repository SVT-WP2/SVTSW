import { IsInt, IsNumber, IsOptional, IsString } from 'class-validator'
import { EpicWpMachineCreateRequest, EpicWpMachineUpdateRequest } from 'epic-api-types'
import { EpicWpMachineUpdateInstalledProbeCard, EpicWpMachineUpdateLoadedWafer } from 'epic-api-types/kafka'


/** `data.create` of `CreateWpMachine`. */
export class SvtDbAgentNextWpMachineCreateDto implements EpicWpMachineCreateRequest {

    @IsString()
    name!: string

    @IsString()
    serialNumber!: string

    @IsString()
    hostName!: string

    /** Enum value `wpConnectionType`. */
    @IsString()
    connectionType!: string

    @IsNumber()
    connectionPort!: number

    /** Enum value `wpGeneralLocation`. */
    @IsString()
    generalLocation!: string

    /** Enum value `wpSwType`. */
    @IsString()
    software!: string

    @IsString()
    swVersion!: string

    /** Enum value `wpVendor`. */
    @IsString()
    vendor!: string

}

/** `data.update` of `UpdateWpMachine`. */
export class SvtDbAgentNextWpMachineUpdateDto implements EpicWpMachineUpdateRequest {

    @IsString()
    hostName!: string

    /** Enum value `wpConnectionType`. */
    @IsString()
    connectionType!: string

    @IsNumber()
    connectionPort!: number

    /** Enum value `wpGeneralLocation`. */
    @IsString()
    generalLocation!: string

    /** Enum value `wpSwType`. */
    @IsString()
    software!: string

    @IsString()
    swVersion!: string

}

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
