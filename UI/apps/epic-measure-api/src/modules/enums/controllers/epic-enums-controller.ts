import {
    BadRequestException,
    ClassSerializerInterceptor,
    Controller,
    Get,
    InternalServerErrorException,
    Query,
    SerializeOptions,
    UseInterceptors,
    ValidationPipe,
} from '@nestjs/common'
import { ApiResponse } from '@nestjs/swagger'
import {
    EpicEnumsCollectionQueryFilterDto,
    EpicEnumsCollectionResponseDto,
    EpicKafkaReplyMessage,
    EpicKafkaReplyStatus,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicEnumsService } from '../services'


@Controller('/enums')
export class EpicEnumsController {

    constructor(private readonly epicEnumsService: EpicEnumsService) {
    }

    @Get()
    @ApiResponse({ type: EpicEnumsCollectionResponseDto, example: { asicFamilyType: ['1', '2'] } })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicEnumsCollectionResponseDto })
    async getAll(
        @Query(new ValidationPipe({ transform: true })) filter: EpicEnumsCollectionQueryFilterDto,
    ): Promise<EpicEnumsCollectionResponseDto> {

        try {
            const collection = await firstValueFrom(this.epicEnumsService.getAll(filter?.enumNames ?? []))
            return {
                collection,
            }
        }
        catch (error) {

            if ((error as EpicKafkaReplyMessage).status === EpicKafkaReplyStatus.BadRequest) {
                const codeInfo = error.error.code ? `[${error.error.code}]: ` : ''
                throw new BadRequestException(`${codeInfo}${error.error.message}`)
            }

            throw new InternalServerErrorException(error.error.message)
        }
    }

}
