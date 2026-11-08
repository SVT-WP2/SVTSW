import { InjectRepository } from '@mikro-orm/nestjs'
import { EntityRepository } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbWaferTypeEntity } from './svt-db-wafer-type.entity'


/**
 * Pilot repository: list and get wafer types with their map. Phase 3 defines the common repository
 * shape (pagination, filters) and extends this one; keep it minimal until then.
 * Register with `SvtDbOrmModule.forFeature([SvtDbWaferTypeEntity])` in the module that provides it.
 */
@Injectable()
export class SvtDbWaferTypesRepository {

    constructor(
        @InjectRepository(SvtDbWaferTypeEntity) private readonly waferTypes: EntityRepository<SvtDbWaferTypeEntity>,
    ) {
    }

    findAll(): Promise<SvtDbWaferTypeEntity[]> {
        return this.waferTypes.findAll({ populate: ['map'], orderBy: { id: 'asc' } })
    }

    findById(id: number): Promise<SvtDbWaferTypeEntity | null> {
        return this.waferTypes.findOne({ id }, { populate: ['map'] })
    }

}
