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
    EpicSvtTestTypeCreateDto,
    EpicSvtTestTypeDto,
    EpicSvtTestTypesGetAllParamsDto,
    EpicSvtTestTypeUpdateDto,
    processKafkaReplyError,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicSvtTestTypesService } from '../services'


@Controller('/svt-test-types')
export class EpicSvtTestTypesController {

    constructor(private readonly epicSvtTestTypesService: EpicSvtTestTypesService) {
    }

    @Get()
    @ApiResponse({ type: EpicSvtTestTypeDto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestTypeDto })
    async getAll(@Query() params: EpicSvtTestTypesGetAllParamsDto): Promise<EpicSvtTestTypeDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestTypesService.getAll({
                ids: params.ids ? params.ids : undefined,
                dutTypes: params.dutTypes ? params.dutTypes : undefined,
            }))
        ))
    }

    @Get('/:id')
    @ApiResponse({ type: EpicSvtTestTypeDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestTypeDto })
    async getOne(@Param('id') id: number): Promise<EpicSvtTestTypeDto> {
        const result = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicSvtTestTypesService.getAll({ ids: [+id] }),
            )
        ))

        const entity = result?.find(item => item.id === +id)

        if (!entity) {
            throw new NotFoundException(`SvtTestType does not exist: ${id}`)
        }

        return entity
    }

    @Post()
    @ApiBody({ type: EpicSvtTestTypeCreateDto })
    @ApiResponse({ type: EpicSvtTestTypeDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestTypeDto })
    async create(@Body() body: EpicSvtTestTypeCreateDto): Promise<EpicSvtTestTypeDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestTypesService.create(body))
        ))
    }

    @Patch('/:id')
    @ApiBody({ type: EpicSvtTestTypeUpdateDto })
    @ApiResponse({ type: EpicSvtTestTypeDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestTypeDto })
    async update(@Param('id') id: number, @Body() body: EpicSvtTestTypeUpdateDto): Promise<EpicSvtTestTypeDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestTypesService.update(+id, body))
        ))
    }

}

