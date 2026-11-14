import { IsDateString, IsEnum, IsString } from 'class-validator'
import { EpicSvtTestResultStatus } from 'epic-api-types'
import { EpicSvtTestFinishUpdate } from 'epic-api-types/kafka'


/** `data.update` of `UpdateSvtTestFinish` (`SvtTestFinishUpdateDto` of the Kafka contract). */
export class EpicSvtTestFinishUpdateDto implements EpicSvtTestFinishUpdate {

    @IsDateString()
    finishedAt: string

    @IsString()
    pathToResult: string

    @IsEnum(EpicSvtTestResultStatus)
    testResultStatus: EpicSvtTestResultStatus

}
