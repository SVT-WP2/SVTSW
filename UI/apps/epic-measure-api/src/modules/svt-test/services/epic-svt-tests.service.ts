import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import {
    EpicPageData,
    EpicPager,
    EpicSvtTestCreateEntity,
    EpicSvtTestEntity,
    EpicSvtTestResolvedEntity,
    EpicSvtTestsGetAllParams,
    EpicSvtTestStatus,
    mapEpicKafkaMessageData,
    mapSvtDbAgentEntityReplyData,
    resolveEpicSvtTestResultStatuses,
    resolveEpicSvtTestStatus,
    SvtDbAgentKafka,
    SvtDbAgentKafkaSvtTests,
} from 'epic/entities'
import { map, Observable, of } from 'rxjs'

import { EpicSvtTestSvc } from '../models'


@Injectable()
export class EpicSvtTestsService implements OnModuleInit {

    constructor(
        @Inject(EpicSvtTestSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    getAll(
        queryFilter?: EpicSvtTestsGetAllParams,
        pager?: EpicPager): Observable<EpicPageData<EpicSvtTestResolvedEntity>> {

        // the API filters by the synthetic status, the DB agent only knows the physical result status
        const testResultStatuses = queryFilter?.statuses?.length
            ? resolveEpicSvtTestResultStatuses(queryFilter.statuses as EpicSvtTestStatus[])
            : undefined

        // a status no stored value can resolve to (Running, for now) matches nothing at all — handing the DB
        // agent an empty list instead would read as "any result status" and return the whole list
        if (testResultStatuses && !testResultStatuses.length) {
            return of({ items: [], totalCount: 0 })
        }

        const data: SvtDbAgentKafkaSvtTests.GetAllSvtTestsData = {
            filter: {
                ...(queryFilter?.ids ? { ids: queryFilter.ids } : {}),
                ...(queryFilter?.dutEntityNames ? { dutEntityNames: queryFilter.dutEntityNames } : {}),
                ...(queryFilter?.dutId ? { dutId: queryFilter.dutId } : {}),
                ...(testResultStatuses ? { testResultStatuses } : {}),
                ...(queryFilter?.testTypeConfigIds ? { testTypeConfigIds: queryFilter.testTypeConfigIds } : {}),
                ...(queryFilter?.testSetupConfigIds ? { testSetupConfigIds: queryFilter.testSetupConfigIds } : {}),
                ...(queryFilter?.createdAtFrom ? { createdAtFrom: queryFilter.createdAtFrom } : {}),
                ...(queryFilter?.createdAtTo ? { createdAtTo: queryFilter.createdAtTo } : {}),
                ...(queryFilter?.startedAtFrom ? { startedAtFrom: queryFilter.startedAtFrom } : {}),
                ...(queryFilter?.startedAtTo ? { startedAtTo: queryFilter.startedAtTo } : {}),
                ...(queryFilter?.finishedAtFrom ? { finishedAtFrom: queryFilter.finishedAtFrom } : {}),
                ...(queryFilter?.finishedAtTo ? { finishedAtTo: queryFilter.finishedAtTo } : {}),
            },
            pager: {
                limit: 20,
                offset: 0,
                ...(pager || {}),
            },
        }

        const message = new SvtDbAgentKafkaSvtTests.GetAllSvtTestsMessage(data)
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTests.GetAllSvtTestsReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                map(({ items, totalCount }) => ({
                    items: items.map(item => this.resolveEntity(item)),
                    totalCount,
                })),
            )
    }

    create(createRequest: EpicSvtTestCreateEntity): Observable<EpicSvtTestResolvedEntity> {
        const message = new SvtDbAgentKafkaSvtTests.CreateSvtTestMessage({ create: createRequest })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaSvtTests.CreateSvtTestReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                mapSvtDbAgentEntityReplyData(),
                map(entity => this.resolveEntity(entity)),
            )
    }

    onModuleInit() {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    /**
     * The DB agent only knows the physical `testResultStatus`. The synthetic `status` is resolved here, on the
     * BFF — this is the seam where, later, the live processing state of other services gets folded in.
     */
    protected resolveEntity(entity: EpicSvtTestEntity): EpicSvtTestResolvedEntity {
        return {
            ...entity,
            status: resolveEpicSvtTestStatus(entity.testResultStatus),
        }
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaSvtTests.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, JSON.stringify(message))
    }

}

