import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import {
    EpicSvtTestTypeConfigBodyEntity,
    EpicSvtTestTypeConfigCreateEntity,
    EpicSvtTestTypeConfigEntity,
    EpicSvtTestTypeConfigsGetAllParams,
    mapEpicKafkaMessageData,
    mapSvtDbAgentEntityReplyData,
    mapSvtDbAgentListReplyData,
    SvtDbAgentKafka,
    SvtDbAgentKafkaSvtTestTypeConfigs,
} from 'epic/entities'
import { Observable } from 'rxjs'

import { EpicSvtTestSvc } from '../models'


@Injectable()
export class EpicSvtTestTypeConfigsService implements OnModuleInit {

    constructor(
        @Inject(EpicSvtTestSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: EpicSvtTestTypeConfigsGetAllParams): Observable<EpicSvtTestTypeConfigEntity[]> {
        const message = new SvtDbAgentKafkaSvtTestTypeConfigs.GetAllSvtTestTypeConfigsMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestTypeConfigs.GetAllSvtTestTypeConfigsReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    create(createRequest: EpicSvtTestTypeConfigCreateEntity): Observable<EpicSvtTestTypeConfigEntity> {
        const message = new SvtDbAgentKafkaSvtTestTypeConfigs.CreateSvtTestTypeConfigMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestTypeConfigs.CreateSvtTestTypeConfigReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    getConfigBody(testTypeConfigId: number): Observable<EpicSvtTestTypeConfigBodyEntity> {
        const message = new SvtDbAgentKafkaSvtTestTypeConfigs.GetSvtTestTypeConfigBodyMessage({ id: testTypeConfigId })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestTypeConfigs.GetSvtTestTypeConfigBodyReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaSvtTestTypeConfigs.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}

