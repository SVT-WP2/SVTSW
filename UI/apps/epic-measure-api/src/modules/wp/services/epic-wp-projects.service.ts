import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { mapEpicKafkaMessageData, mapSvtDbAgentEntityReplyData, mapSvtDbAgentListReplyData } from 'epic/entities'
import { Observable } from 'rxjs'
import { EpicWpProject, EpicWpProjectCreateRequest } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaWpProjects } from 'svt-ts-types/kafka'

import { EpicWpSvc } from '../models'


@Injectable()
export class EpicWpProjectsService implements OnModuleInit {

    constructor(
        @Inject(EpicWpSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(filter?: { ids?: number[] }): Observable<EpicWpProject[]> {
        const message = new SvtDbAgentKafkaWpProjects.GetAllWpProjectsMessage({ filter })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWpProjects.GetAllWpProjectsReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentListReplyData(),
            )
    }

    create(createRequest: EpicWpProjectCreateRequest): Observable<EpicWpProject> {
        const message = new SvtDbAgentKafkaWpProjects.CreateWpProjectMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaWpProjects.CreateWpProjectReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaWpProjects.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}
