import { readFileSync } from 'fs'
import { join } from 'path'

import { Controller, Get } from '@nestjs/common'
import { HealthCheck, HealthCheckService, HealthIndicatorResult, HealthCheckResult } from '@nestjs/terminus'


@Controller('health')
export class HealthController {

    private readonly startTime = Date.now()
    private readonly version: string

    constructor(private health: HealthCheckService) {
        try {
            const pkg = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'))
            this.version = pkg.version ?? 'unknown'
        }
        catch {
            this.version = process.env.APP_VERSION ?? 'unknown'
        }
    }

    @Get()
    @HealthCheck()
    check(): Promise<HealthCheckResult> {
        return this.health.check([
            (): Promise<HealthIndicatorResult> => Promise.resolve({ api: { status: 'up' } }),
        ])
    }

    @Get('version')
    getVersion() {
        const uptimeMs = Date.now() - this.startTime
        return {
            service: 'epic-measure-api',
            version: this.version,
            uptime: this.formatUptime(uptimeMs),
        }
    }

    private formatUptime(ms: number): string {
        const seconds = Math.floor(ms / 1000)
        const days = Math.floor(seconds / 86400)
        const hours = Math.floor((seconds % 86400) / 3600)
        const minutes = Math.floor((seconds % 3600) / 60)

        const parts: string[] = []
        if (days > 0) {
            parts.push(`${days}d`)
        }
        if (hours > 0) {
            parts.push(`${hours}h`)
        }
        if (minutes > 0) {
            parts.push(`${minutes}m`)
        }
        if (parts.length === 0) {
            parts.push(`${seconds}s`)
        }
        return parts.join(' ')
    }

}
