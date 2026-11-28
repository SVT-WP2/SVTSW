import { BadRequestException, HttpException, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { EpicKafkaReplyMessage, EpicKafkaReplyStatus } from 'svt-ts-types/kafka'


/**
 * Turns a failed reply of the DB agent into an HTTP error: `BadRequest` → `400`, `NotFound` → `404`, anything else
 * `500`. An `HttpException` that the code itself threw (a `503` of a timeout, a `400` of a check) passes unchanged.
 */
export async function processKafkaReplyError<T>(getReplyFn: () => Promise<T>): Promise<T> {
    try {
        return await getReplyFn()
    }
    catch (error) {
        if (error instanceof HttpException) {
            throw error
        }
        const codeInfo = error.error?.code ? `[${error.error.code}]: ` : ''
        const errorMessage = `${codeInfo}${error.error.message}`
        if ((error as EpicKafkaReplyMessage).status === EpicKafkaReplyStatus.BadRequest) {
            throw new BadRequestException(errorMessage)
        }

        if ((error as EpicKafkaReplyMessage).status === EpicKafkaReplyStatus.NotFound) {
            throw new NotFoundException(errorMessage)
        }

        throw new InternalServerErrorException(error.error.message)
    }
}
