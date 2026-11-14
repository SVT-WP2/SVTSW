import { IsDateString } from 'class-validator'
import { EpicSvtTestStartUpdate } from 'epic-api-types/kafka'


/** `data.update` of `UpdateSvtTestStart` (`SvtTestStartUpdateDto` of the Kafka contract). */
export class EpicSvtTestStartUpdateDto implements EpicSvtTestStartUpdate {

    @IsDateString()
    startedAt: string

}
