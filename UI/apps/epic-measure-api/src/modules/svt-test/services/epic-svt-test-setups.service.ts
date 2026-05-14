import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import {
    EpicSvtTestSetupCreateEntity,
    EpicSvtTestSetupEntity, EpicSvtTestSetupUpdateEntity,
    mapEpicKafkaMessageData,
    mapSvtDbAgentEntityReplyData,
    mapSvtDbAgentListReplyData,
    SvtDbAgentKafka,
    SvtDbAgentKafkaSvtTestSetups,
} from 'epic/entities'
import { Observable } from 'rxjs'

import { EpicSvtTestSvc } from '../models'


@Injectable()
export class EpicSvtTestSetupsService implements OnModuleInit {

    constructor(
        @Inject(EpicSvtTestSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: { ids?: number[] }): Observable<EpicSvtTestSetupEntity[]> {
        const message = new SvtDbAgentKafkaSvtTestSetups.GetAllSvtTestSetupsMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestSetups.GetAllSvtTestSetupsReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    create(createRequest: EpicSvtTestSetupCreateEntity): Observable<EpicSvtTestSetupEntity> {
        const message = new SvtDbAgentKafkaSvtTestSetups.CreateSvtTestSetupMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestSetups.CreateSvtTestSetupReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    update(id: number, update: EpicSvtTestSetupUpdateEntity): Observable<EpicSvtTestSetupEntity> {
        const message = new SvtDbAgentKafkaSvtTestSetups.UpdateSvtTestSetupMessage({ id, update })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTestSetups.UpdateSvtTestSetupReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaSvtTestSetups.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
