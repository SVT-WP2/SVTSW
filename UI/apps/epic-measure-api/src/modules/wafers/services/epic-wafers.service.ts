import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import {
    EpicWaferCreateEntity,
    EpicWaferEntity,
    EpicWaferLocationHistoryRecordEntity,
    EpicWaferLocationUpdate,
    EpicWaferUpdateEntity,
    mapEpicKafkaMessageData,
    mapSvtDbAgentEntityReplyData,
    mapSvtDbAgentListReplyData,
    SvtDbAgentKafka,
    SvtDbAgentKafkaWafers,
} from 'epic/entities'
import { Observable } from 'rxjs'

import { EpicWafersSvc } from '../models'


@Injectable()
export class EpicWafersService implements OnModuleInit {

    constructor(
        @Inject(EpicWafersSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: { ids?: number[] }): Observable<EpicWaferEntity[]> {
        const message = new SvtDbAgentKafkaWafers.GetAllWafersMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWafers.GetAllWafersReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    create(createRequest: EpicWaferCreateEntity): Observable<EpicWaferEntity> {
        const message = new SvtDbAgentKafkaWafers.CreateWaferMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWafers.CreateWaferReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    update(waferId: number, updateRequest: EpicWaferUpdateEntity): Observable<EpicWaferEntity> {
        const message = new SvtDbAgentKafkaWafers.UpdateWaferMessage({ id: waferId, update: updateRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWafers.UpdateWaferReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    getWaferLocationHistory(waferId: number): Observable<EpicWaferLocationHistoryRecordEntity[]> {
        const message = new SvtDbAgentKafkaWafers.GetWaferLocationHistoryMessage({ waferId })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWafers.GetWaferLocationHistoryReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    updateWaferLocation(waferId: number, update: EpicWaferLocationUpdate): Observable<EpicWaferEntity> {
        const message = new SvtDbAgentKafkaWafers.UpdateWaferLocationMessage({
            waferId,
            ...update,
        })

        return this.sendMessageAndGetReply<SvtDbAgentKafkaWafers.UpdateWaferLocationReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }


    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaWafers.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
