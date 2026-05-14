import { BadRequestException, InternalServerErrorException, NotFoundException } from '@nestjs/common'
import { EpicKafkaReplyMessage, EpicKafkaReplyStatus } from 'epic/entities'


export async function processKafkaReplyError<T>(getReplyFn: () => Promise<T>): Promise<T> {
    try {
        return await getReplyFn()
    }
    catch (error) {
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
