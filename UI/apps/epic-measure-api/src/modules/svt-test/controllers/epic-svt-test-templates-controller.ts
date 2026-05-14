import {
    Body,
    ClassSerializerInterceptor,
    Controller,
    Get,
    NotFoundException,
    Param, Patch,
    Post, Query,
    SerializeOptions,
    UseInterceptors,
} from '@nestjs/common'
import { ApiBody, ApiResponse } from '@nestjs/swagger'
import {
    EpicSvtTestTemplateCreateDto,
    EpicSvtTestTemplateDto,
    EpicSvtTestTemplatesGetAllParamsDto,
    EpicSvtTestTemplateUpdateDto,
    processKafkaReplyError,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicSvtTestTemplatesService } from '../services'


@Controller('/svt-test-templates')
export class EpicSvtTestTemplatesController {

    constructor(private readonly epicSvtTestTemplatesService: EpicSvtTestTemplatesService) {
    }

    @Get()
    @ApiResponse({ type: EpicSvtTestTemplateDto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestTemplateDto })
    async getAll(@Query() params: EpicSvtTestTemplatesGetAllParamsDto): Promise<EpicSvtTestTemplateDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestTemplatesService.getAll({
                ids: params.ids ? params.ids : undefined,
                dutTypes: params.dutTypes ? params.dutTypes : undefined,
            }))
        ))
    }

    @Get('/:id')
    @ApiResponse({ type: EpicSvtTestTemplateDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestTemplateDto })
    async getOne(@Param('id') id: number): Promise<EpicSvtTestTemplateDto> {
        const result = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicSvtTestTemplatesService.getAll({ ids: [+id] }),
            )
        ))

        const entity = result?.find(item => item.id === +id)

        if (!entity) {
            throw new NotFoundException(`SvtTestTemplate does not exist: ${id}`)
        }

        return entity
    }

    @Post()
    @ApiBody({ type: EpicSvtTestTemplateCreateDto })
    @ApiResponse({ type: EpicSvtTestTemplateDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestTemplateDto })
    async create(@Body() body: EpicSvtTestTemplateCreateDto): Promise<EpicSvtTestTemplateDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestTemplatesService.create(body))
        ))
    }

    @Patch('/:id')
    @ApiBody({ type: EpicSvtTestTemplateUpdateDto })
    @ApiResponse({ type: EpicSvtTestTemplateDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestTemplateDto })
    async update(@Param('id') id: number, @Body() body: EpicSvtTestTemplateUpdateDto): Promise<EpicSvtTestTemplateDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestTemplatesService.update(+id, body))
        ))
    }

}

