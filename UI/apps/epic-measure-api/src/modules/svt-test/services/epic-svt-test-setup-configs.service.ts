import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { mapEpicKafkaMessageData, mapSvtDbAgentEntityReplyData, mapSvtDbAgentListReplyData } from 'epic/entities'
import { Observable } from 'rxjs'
import { EpicSvtTestSetupConfig, EpicSvtTestSetupConfigBody, EpicSvtTestSetupConfigCreateRequest } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaSvtTestSetupConfigs } from 'svt-ts-types/kafka'

import { EpicSvtTestSvc } from '../models'


@Injectable()
export class EpicSvtTestSetupConfigsService implements OnModuleInit {

    constructor(
        @Inject(EpicSvtTestSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: { ids?: number[] }): Observable<EpicSvtTestSetupConfig[]> {
        const message = new SvtDbAgentKafkaSvtTestSetupConfigs.GetAllSvtTestSetupConfigsMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestSetupConfigs.GetAllSvtTestSetupConfigsReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    create(createRequest: EpicSvtTestSetupConfigCreateRequest): Observable<EpicSvtTestSetupConfig> {
        const message = new SvtDbAgentKafkaSvtTestSetupConfigs.CreateSvtTestSetupConfigMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestSetupConfigs.CreateSvtTestSetupConfigReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    getConfigBody(testSetupConfigId: number): Observable<EpicSvtTestSetupConfigBody> {
        const message = new SvtDbAgentKafkaSvtTestSetupConfigs.GetSvtTestSetupConfigBodyMessage({ id: testSetupConfigId })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestSetupConfigs.GetSvtTestSetupConfigBodyReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaSvtTestSetupConfigs.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
