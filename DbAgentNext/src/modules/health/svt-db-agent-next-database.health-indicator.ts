import { MikroORM } from '@mikro-orm/core'
import { Injectable } from '@nestjs/common'
import { HealthIndicatorResult, HealthIndicatorService } from '@nestjs/terminus'


const CHECK_TIMEOUT_MS = 3000

/**
 * Database indicator for `GET /health`: a real `select 1` through MikroORM's connection, bounded by a
 * timeout. Terminus's `MikroOrmHealthIndicator` and MikroORM 7's own `checkConnection()` only report the
 * connection state flag, which stays "not established" with lazy connections until something has queried.
 */
@Injectable()
export class SvtDbAgentNextDatabaseHealthIndicator {

    constructor(
        private readonly orm: MikroORM,
        private readonly healthIndicatorService: HealthIndicatorService,
    ) {
    }

    async isHealthy(key = 'database'): Promise<HealthIndicatorResult> {
        const indicator = this.healthIndicatorService.check(key)
        let timer: NodeJS.Timeout | undefined
        const timeout = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Database check timed out after ${CHECK_TIMEOUT_MS} ms`)), CHECK_TIMEOUT_MS)
        })

        try {
            await Promise.race([this.orm.em.getConnection().execute('select 1'), timeout])
            return indicator.up()
        }
        catch (error) {
            return indicator.down({ message: error instanceof Error ? error.message : String(error) })
        }
        finally {
            clearTimeout(timer)
        }
    }

}
