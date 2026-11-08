import { Inject, Injectable } from '@nestjs/common'

import { SVT_DB_ORM_CONFIG, SvtDbOrmConfig } from '../models'


/** Read access to the database configuration for the modules that need it (health, migrations, diagnostics). */
@Injectable()
export class SvtDbOrmConfigService {

    constructor(@Inject(SVT_DB_ORM_CONFIG) private readonly config: SvtDbOrmConfig) {
    }

    getConfig(): SvtDbOrmConfig {
        return { ...this.config }
    }

}
