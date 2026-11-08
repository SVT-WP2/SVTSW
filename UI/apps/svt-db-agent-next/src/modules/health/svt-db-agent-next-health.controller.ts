import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckResult, HealthCheckService } from '@nestjs/terminus'


/**
 * `GET /health`: the endpoint the container `HEALTHCHECK` calls.
 * No indicators yet; phase 2 adds the database, phase 4 the Kafka consumer.
 */
@Controller('health')
export class SvtDbAgentNextHealthController {

    constructor(private readonly health: HealthCheckService) {
    }

    @Get()
    @HealthCheck()
    check(): Promise<HealthCheckResult> {
        return this.health.check([])
    }

}
