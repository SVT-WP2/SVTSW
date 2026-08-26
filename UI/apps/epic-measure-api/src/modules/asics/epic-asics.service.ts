import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import {
    EpicAsicCreateRequestDto,
    EpicAsicEntity,
    EpicGetAllAsicsQueryFilter,
    EpicPageData,
    EpicPager,
    mapEpicKafkaMessageData,
    mapSvtDbAgentEntityReplyData,
    SvtDbAgentKafka,
    SvtDbAgentKafkaAsics,
} from 'epic/entities'
import { Observable } from 'rxjs'

import { EpicAsicsSvc } from './models'

// TODO: process reply errors
@Injectable()
export class EpicAsicsService implements OnModuleInit {

    constructor(
        @Inject(EpicAsicsSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(
        queryFilter?: EpicGetAllAsicsQueryFilter,
        pager?: EpicPager): Observable<EpicPageData<EpicAsicEntity>> {
        const data: SvtDbAgentKafkaAsics.GetAllAsicsMessageData = {
            filter: {
                ...(queryFilter.waferId ? { waferId: queryFilter.waferId } : {}),
                ...(queryFilter.ids ? { ids: queryFilter.ids } : {}),
                ...(queryFilter.chipId ? { chipId: queryFilter.chipId } : {}),
                ...(queryFilter.familyTypes ? { familyTypes: queryFilter.familyTypes } : {}),
                ...(queryFilter.quality ? { quality: queryFilter.quality } : {}),
                ...(queryFilter.serialNumber ? { serialNumber: queryFilter.serialNumber } : {}),
            },
            pager: {
                limit: 20,
                offset: 0,
                ...(pager || {}),
            },
        }

        const message = new SvtDbAgentKafkaAsics.GetAllAsicsMessage(data)
        return this.sendMessageAndGetReply<SvtDbAgentKafkaAsics.GetAllAsicsReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
            )
    }

    create(createRequest: EpicAsicCreateRequestDto): Observable<EpicAsicEntity> {
        const message = new SvtDbAgentKafkaAsics.CreateAsicMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaAsics.CreateAsicReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaAsics.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
