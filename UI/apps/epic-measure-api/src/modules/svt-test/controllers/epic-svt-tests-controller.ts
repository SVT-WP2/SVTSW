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
    EpicPageDataDto,
    EpicSvtTestCreateDto,
    EpicSvtTestDto,
    EpicSvtTestsGetAllParamsDto,
    EpicSvtTestsListDto,
    processKafkaReplyError,
} from 'epic/entities'
import { firstValueFrom } from 'rxjs'

import { EpicSvtTestsService } from '../services'


@Controller('/svt-tests')
export class EpicSvtTestsController {

    constructor(private readonly epicSvtTestsService: EpicSvtTestsService) {
    }

    @Get()
    @ApiResponse({ type: EpicPageDataDto<EpicSvtTestDto> })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicPageDataDto<EpicSvtTestDto> })
    async getAll(@Query() params: EpicSvtTestsGetAllParamsDto): Promise<EpicSvtTestsListDto> {
        return processKafkaReplyError(() => (
            firstValueFrom(this.epicSvtTestsService.getAll(
                {
                    ids: params.ids?.length ? params.ids : undefined,
                    dutEntityNames: params.dutEntityNames?.length ? params.dutEntityNames : undefined,
                    dutId: params.dutId ? +params.dutId : undefined,
                    statuses: params.statuses?.length ? params.statuses : undefined,
                    testTypeConfigIds: params.testTypeConfigIds?.length ? params.testTypeConfigIds : undefined,
                    testSetupConfigIds: params.testSetupConfigIds?.length ? params.testSetupConfigIds : undefined,
                    createdAtFrom: params.createdAtFrom || undefined,
                    createdAtTo: params.createdAtTo || undefined,
                    startedAtFrom: params.startedAtFrom || undefined,
                    startedAtTo: params.startedAtTo || undefined,
                    finishedAtFrom: params.finishedAtFrom || undefined,
                    finishedAtTo: params.finishedAtTo || undefined,
                },
                {
                    limit: params.limit,
                    offset: params.offset,
                },
            ))
        ))
    }

    @Get('/:id')
    @ApiResponse({ type: EpicSvtTestDto })
    @UseInterceptors(ClassSerializerInterceptor)
    @SerializeOptions({ type: EpicSvtTestDto })
    async getOne(@Param('id') id: number): Promise<EpicSvtTestDto> {
        const list = await processKafkaReplyError(() => (
            firstValueFrom(
                this.epicSvtTestsService.getAll({ ids: [+id] }),
            )
        ))

        const entity = list.items.find(item => item.id === +id)

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

