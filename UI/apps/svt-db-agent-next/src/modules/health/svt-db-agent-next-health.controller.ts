import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckResult, HealthCheckService, MikroOrmHealthIndicator } from '@nestjs/terminus'


/**
 * `GET /health`: the endpoint the container `HEALTHCHECK` calls.
 * `database` pings PostgreSQL through MikroORM; phase 4 adds the Kafka consumer.
 */
@Controller('health')
export class SvtDbAgentNextHealthController {

    constructor(
        private readonly health: HealthCheckService,
        private readonly database: MikroOrmHealthIndicator,
    ) {
    }

    @Get()
    @HealthCheck()
    check(): Promise<HealthCheckResult> {
        return this.health.check([
            () => this.database.pingCheck('database', { timeout: 3000 }),
        ])
    }

}
