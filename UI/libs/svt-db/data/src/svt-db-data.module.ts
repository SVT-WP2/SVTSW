import { Module } from '@nestjs/common'

import { SvtDbEnumsService } from './enums'
import { SvtDbWaferTypesRepository } from './wafer-types'


/**
 * The repositories and services of the data layer, for the application's handler modules. Needs
 * `SvtDbOrmModule.forRoot` (global) for the `EntityManager`. Phase 3 appends one repository per aggregate.
 */
@Module({
    providers: [
        SvtDbEnumsService,
        SvtDbWaferTypesRepository,
    ],
    exports: [
        SvtDbEnumsService,
        SvtDbWaferTypesRepository,
    ],
})
export class SvtDbDataModule {
}
