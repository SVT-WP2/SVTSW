import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckResult, HealthCheckService } from '@nestjs/terminus'

import { SvtDbAgentNextDatabaseHealthIndicator } from './svt-db-agent-next-database.health-indicator'


/**
 * `GET /health`: the endpoint the container `HEALTHCHECK` calls.
 * `database` is a round trip to PostgreSQL through MikroORM; phase 4 adds the Kafka consumer.
 */
@Controller('health')
export class SvtDbAgentNextHealthController {

    constructor(
        private readonly health: HealthCheckService,
        private readonly database: SvtDbAgentNextDatabaseHealthIndicator,
    ) {
    }

    @Get()
    @HealthCheck()
    check(): Promise<HealthCheckResult> {
        return this.health.check([
            () => this.database.isHealthy('database'),
        ])
    }

}
