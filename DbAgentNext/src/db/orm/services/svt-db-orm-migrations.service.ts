import { MikroORM } from '@mikro-orm/core'
import { Injectable, Logger } from '@nestjs/common'


/**
 * Applies the migrations of the list that the application gave to `SvtDbOrmModule.forRoot`. The application calls
 * `up()` at start, before it serves a request.
 */
@Injectable()
export class SvtDbOrmMigrationsService {

    private readonly logger = new Logger(SvtDbOrmMigrationsService.name)

    constructor(private readonly orm: MikroORM) {
    }

    /**
     * Applies the pending migrations and returns their names. They run in one transaction (MikroORM's
     * `allOrNothing`): a failure rejects, and the schema stays as it was.
     *
     * A query comes first: MikroORM's migrator creates a database that does not exist, whatever `ensureDatabase`
     * says, and the query fails there. A wrong database name thus ends the start.
     */
    async up(): Promise<string[]> {
        await this.orm.em.getConnection().execute('select 1')
        const applied = await this.orm.migrator.up()
        const names = applied.map((migration) => migration.name)
        this.logger.log(names.length > 0 ? `Applied ${names.length} migration(s): ${names.join(', ')}` : 'No pending migration')

        return names
    }

}
