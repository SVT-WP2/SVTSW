import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Get,
    NotFoundException,
    Param,
    Post,
    Query,
    SerializeOptions,
    UseInterceptors,
} from '@nestjs/common'
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import {
    EpicSvtTestTypeConfigBodyDto,
    EpicSvtTestTypeConfigCreateDto,
    EpicSvtTestTypeConfigDto,
    EpicSvtTestTypeConfigsGetAllParamsDto,
    processKafkaReplyError,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicSvtTestTypeConfigsService } from '../services'


@Controller('/svt-test-type-configs')
export class EpicSvtTestTypeConfigsController {

    constructor(private readonly epicSvtTestTypeConfigsService: EpicSvtTestTypeConfigsService) {
    }

    @Get()
    @ApiResponse({ type: EpicSvtTestTypeConfigDto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestTypeConfigDto })
    async getAll(@Query() params: EpicSvtTestTypeConfigsGetAllParamsDto): Promise<EpicSvtTestTypeConfigDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestTypeConfigsService.getAll({
                ids: params.ids ? params.ids : undefined,
                testTypeId: params.testTypeId ? +params.testTypeId : undefined,
            }))
        ))
    }

    @Get('/:id')
    @ApiResponse({ type: EpicSvtTestTypeConfigDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestTypeConfigDto })
    async getOne(@Param('id') id: number): Promise<EpicSvtTestTypeConfigDto> {
        const result = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicSvtTestTypeConfigsService.getAll({ ids: [+id] }),
            )
        ))

        const entity = result?.find(item => item.id === +id)

        if (!entity) {
            throw new NotFoundException(`SvtTestTypeConfig does not exist: ${id}`)
        }

        return entity
    }

    @Get('/:id/config-body')
    @ApiResponse({ type: EpicSvtTestTypeConfigBodyDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestTypeConfigBodyDto })
    async getConfigBody(@Param('id') id: number): Promise<EpicSvtTestTypeConfigBodyDto> {
        const entity = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicSvtTestTypeConfigsService.getConfigBody(+id),
            )
        ))

        if (!entity) {
            throw new NotFoundException(`SvtTestTypeConfigBody does not exist: ${id}`)
        }

        return entity
    }

    @Post()
    @ApiBody({ type: EpicSvtTestTypeConfigCreateDto })
    @ApiResponse({ type: EpicSvtTestTypeConfigDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestTypeConfigDto })
    async create(@Body() body: EpicSvtTestTypeConfigCreateDto): Promise<EpicSvtTestTypeConfigDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestTypeConfigsService.create(body))
        ))
    }

}

