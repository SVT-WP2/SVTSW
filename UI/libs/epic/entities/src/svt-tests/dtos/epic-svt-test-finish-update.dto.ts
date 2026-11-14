import { IsDateString, IsEnum, IsString } from 'class-validator'
import { EpicSvtTestResultStatus } from 'svt-ts-types'
import { EpicSvtTestFinishUpdate } from 'svt-ts-types/kafka'


/** `data.update` of `UpdateSvtTestFinish` (`SvtTestFinishUpdateDto` of the Kafka contract). */
export class EpicSvtTestFinishUpdateDto implements EpicSvtTestFinishUpdate {

    @IsDateString()
    finishedAt: string

    @IsString()
    pathToResult: string

    @IsEnum(EpicSvtTestResultStatus)
    testResultStatus: EpicSvtTestResultStatus

}
