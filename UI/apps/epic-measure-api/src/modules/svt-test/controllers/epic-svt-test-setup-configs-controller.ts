import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Get,
    NotFoundException,
    Param,
    Post,
    SerializeOptions,
    UseInterceptors,
} from '@nestjs/common'
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import {
    EpicSvtTestSetupConfigBodyDto,
    EpicSvtTestSetupConfigCreateDto,
    EpicSvtTestSetupConfigDto,
    processKafkaReplyError,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicSvtTestSetupConfigsService } from '../services'


@Controller('/svt-test-setup-configs')
export class EpicSvtTestSetupConfigsController {

    constructor(private readonly epicSvtTestSetupConfigsService: EpicSvtTestSetupConfigsService) {
    }

    @Get()
    @ApiResponse({ type: EpicSvtTestSetupConfigDto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestSetupConfigDto })
    async getAll(): Promise<EpicSvtTestSetupConfigDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestSetupConfigsService.getAll())
        ))
    }

    @Get('/:id')
    @ApiResponse({ type: EpicSvtTestSetupConfigDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestSetupConfigDto })
    async getOne(@Param('id') id: number): Promise<EpicSvtTestSetupConfigDto> {
        const result = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicSvtTestSetupConfigsService.getAll({ ids: [+id] }),
            )
        ))

        const entity = result?.find(item => item.id === +id)

        if (!entity) {
            throw new NotFoundException(`SvtTestSetup does not exist: ${id}`)
        }

        return entity
    }

    @Get('/:id/config-body')
    @ApiResponse({ type: EpicSvtTestSetupConfigBodyDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestSetupConfigBodyDto })
    async getConfigBody(@Param('id') id: number): Promise<EpicSvtTestSetupConfigBodyDto> {
        const entity = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicSvtTestSetupConfigsService.getConfigBody(+id),
            )
        ))


        if (!entity) {
            throw new NotFoundException(`SvtTestSetupConfigBody does not exist: ${id}`)
        }

        return entity
    }

    @Post()
    @ApiBody({ type: EpicSvtTestSetupConfigCreateDto })
    @ApiResponse({ type: EpicSvtTestSetupConfigDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestSetupConfigDto })
    async create(@Body() body: EpicSvtTestSetupConfigCreateDto): Promise<EpicSvtTestSetupConfigDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestSetupConfigsService.create(body))
        ))
    }

}
