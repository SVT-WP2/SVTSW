import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { mapEpicKafkaMessageData } from 'epic/entities'
import { Observable } from 'rxjs'
import { EpicApiPager, EpicApiPageResponse, EpicChipBlock } from 'svt-ts-types'
import { EpicGetAllChipBlocksQueryFilter, SvtDbAgentKafka, SvtDbAgentKafkaChipBlocks } from 'svt-ts-types/kafka'

import { EpicChipBlocksSvc } from '../models'


@Injectable()
export class EpicChipBlocksService implements OnModuleInit {

    constructor(
        @Inject(EpicChipBlocksSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(
        queryFilter?: EpicGetAllChipBlocksQueryFilter,
        pager?: EpicApiPager): Observable<EpicApiPageResponse<EpicChipBlock>> {
        const data: SvtDbAgentKafkaChipBlocks.GetAllChipBlocksMessageData = {
            filter: {
                ...(queryFilter?.ids ? { ids: queryFilter.ids } : {}),
                ...(queryFilter?.chipId ? { chipId: queryFilter.chipId } : {}),
                ...(queryFilter?.chipBlockTypes ? { chipBlockTypes: queryFilter.chipBlockTypes } : {}),
                ...(queryFilter?.serialNumber ? { serialNumber: queryFilter.serialNumber } : {}),
            },
            pager: {
                limit: 20,
                offset: 0,
                ...(pager || {}),
            },
        }

        const message = new SvtDbAgentKafkaChipBlocks.GetAllChipBlocksMessage(data)
        return this.sendMessageAndGetReply<SvtDbAgentKafkaChipBlocks.GetAllChipBlocksReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaChipBlocks.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
