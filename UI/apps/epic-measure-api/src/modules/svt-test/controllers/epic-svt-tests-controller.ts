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
    EpicSvtTestCreateDto,
    EpicSvtTestDto,
    EpicSvtTestsGetAllParamsDto,
    processKafkaReplyError,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicSvtTestsService } from '../services'


@Controller('/svt-tests')
export class EpicSvtTestsController {

    constructor(private readonly epicSvtTestsService: EpicSvtTestsService) {
    }

    @Get()
    @ApiResponse({ type: EpicSvtTestDto, isArray: true })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestDto })
    async getAll(@Query() params: EpicSvtTestsGetAllParamsDto): Promise<EpicSvtTestDto[]> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestsService.getAll({
                ids: params.ids ? params.ids : undefined,
                dutEntityNames: params.dutEntityNames ? params.dutEntityNames : undefined,
            }))
        ))
    }

    @Get('/:id')
    @ApiResponse({ type: EpicSvtTestDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestDto })
    async getOne(@Param('id') id: number): Promise<EpicSvtTestDto> {
        const result = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicSvtTestsService.getAll({ ids: [+id] }),
            )
        ))

        const entity = result?.find(item => item.id === +id)

        if (!entity) {
            throw new NotFoundException(`SvtTest does not exist: ${id}`)
        }

        return entity
    }

    @Post()
    @ApiBody({ type: EpicSvtTestCreateDto })
    @ApiResponse({ type: EpicSvtTestDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestDto })
    async create(@Body() body: EpicSvtTestCreateDto): Promise<EpicSvtTestDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestsService.create(body))
        ))
    }

}

