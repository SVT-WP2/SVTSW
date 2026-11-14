import { IsDateString, IsEnum, IsNumber, IsString } from 'class-validator'
import { EpicSvtDutEntityName, EpicSvtTestCreateRequest, EpicSvtTestResultStatus } from 'svt-ts-types'
import { EpicSvtTestFinishUpdate, EpicSvtTestStartUpdate } from 'svt-ts-types/kafka'


/** `data.create` of `CreateSvtTest`. */
export class SvtDbAgentNextSvtTestCreateDto implements EpicSvtTestCreateRequest {

    /** Enum value `dutEntityName`. */
    @IsString()
    dutEntityName!: EpicSvtDutEntityName

    @IsNumber()
    dutId!: number

    @IsNumber()
    testTypeConfigId!: number

    @IsNumber()
    testSetupConfigId!: number

}

/** `data.update` of `UpdateSvtTestStart` (`SvtTestStartUpdateDto` of the Kafka contract). */
export class SvtDbAgentNextSvtTestStartUpdateDto implements EpicSvtTestStartUpdate {

    @IsDateString()
    startedAt!: string

}

/** `data.update` of `UpdateSvtTestFinish` (`SvtTestFinishUpdateDto` of the Kafka contract). */
export class SvtDbAgentNextSvtTestFinishUpdateDto implements EpicSvtTestFinishUpdate {

    @IsDateString()
    finishedAt!: string

    @IsString()
    pathToResult!: string

    @IsEnum(EpicSvtTestResultStatus)
    testResultStatus!: EpicSvtTestResultStatus

}
