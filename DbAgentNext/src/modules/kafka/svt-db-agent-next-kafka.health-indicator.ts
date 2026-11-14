import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus'
import { Admin, Kafka, logLevel } from 'kafkajs'

import { SvtDbAgentNextConfig } from '../../config'

import { SVT_DB_AGENT_NEXT_KAFKA_CLIENT_ID } from './svt-db-agent-next-kafka.models'


const CHECK_TIMEOUT_MS = 3000

/**
 * Kafka indicator for `GET /health`: lists the broker's topics through an admin client, bounded by a
 * timeout. The client is created on the first check (the e2e harness never calls `/health`) and dropped
 * after a failure so the next check reconnects.
 */
@Injectable()
export class SvtDbAgentNextKafkaHealthIndicator implements OnApplicationShutdown {

    private readonly logger = new Logger(SvtDbAgentNextKafkaHealthIndicator.name)
    private admin?: Admin

    constructor(
        private readonly configService: ConfigService<SvtDbAgentNextConfig, true>,
        private readonly healthIndicatorService: HealthIndicatorService,
    ) {
    }

    async isHealthy(key = 'kafka'): Promise<HealthIndicatorResult> {
        const indicator = this.healthIndicatorService.check(key)
        let timer: NodeJS.Timeout | undefined
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Kafka check timed out after ${CHECK_TIMEOUT_MS} ms`)), CHECK_TIMEOUT_MS)
        })

        try {
            await Promise.race([this.listTopics(), timeout])
            return indicator.up()
        }
        catch (error) {
            await this.dropAdmin()
            return indicator.down({ message: error instanceof Error ? error.message : String(error) })
        }
        finally {
            clearTimeout(timer)
        }
    }

    async onApplicationShutdown(): Promise<void> {
        await this.dropAdmin()
    }

    private async listTopics(): Promise<string[]> {
        if (!this.admin) {
            const { brokers } = this.configService.get('kafka', { infer: true })
            const kafka = new Kafka({ clientId: `${SVT_DB_AGENT_NEXT_KAFKA_CLIENT_ID}-health`, brokers, logLevel: logLevel.NOTHING })
            this.admin = kafka.admin()
            await this.admin.connect()
        }
        return this.admin.listTopics()
    }

    private async dropAdmin(): Promise<void> {
        const admin = this.admin
        this.admin = undefined
        try {
            await admin?.disconnect()
        }
        catch (error) {
            this.logger.debug(`Kafka admin client not disconnected cleanly: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

}
