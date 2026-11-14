import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckResult, HealthCheckService } from '@nestjs/terminus'

import { SvtDbAgentNextKafkaHealthIndicator } from '../kafka'

import { SvtDbAgentNextDatabaseHealthIndicator } from './svt-db-agent-next-database.health-indicator'


/**
 * `GET /health`: the endpoint the container `HEALTHCHECK` calls. `database` is a round trip to PostgreSQL
 * through MikroORM, `kafka` an admin call to the broker; the C++ heartbeat proved only the latter.
 */
@Controller('health')
export class SvtDbAgentNextHealthController {

    constructor(
        private readonly health: HealthCheckService,
        private readonly database: SvtDbAgentNextDatabaseHealthIndicator,
        private readonly kafka: SvtDbAgentNextKafkaHealthIndicator,
    ) {
    }

    @Get()
    @HealthCheck()
    check(): Promise<HealthCheckResult> {
        return this.health.check([
            () => this.database.isHealthy('database'),
            () => this.kafka.isHealthy('kafka'),
        ])
    }

}
