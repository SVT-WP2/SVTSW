import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'


type EnumRow = {
    typname: string
    enumlabel: string
}

/**
 * Live enum values of schema `main` from the catalog (`pg_type` ⋈ `pg_enum`), in declaration order.
 * Read per request, so a value added with `ALTER TYPE … ADD VALUE` is visible without a restart
 * (`docs/01-behaviour-decisions.md` §4). `SVT_DB_ENUM_VALUES` is the compile-time snapshot
 * the entities declare; this is the runtime truth the agent answers with.
 */
@Injectable()
export class SvtDbEnumsService {

    constructor(private readonly em: EntityManager) {
    }

    /** All enum types, or only the named ones (unknown names are left out, not rejected). */
    async getAll(names?: readonly string[]): Promise<Record<string, string[]>> {
        const schema = this.em.config.get('schema') ?? 'main'
        const rows = await this.em.getConnection().execute<EnumRow[]>(
            `select t.typname, en.enumlabel
             from pg_type t
             join pg_namespace n on n.oid = t.typnamespace
             join pg_enum en on en.enumtypid = t.oid
             where n.nspname = ? and t.typtype = 'e'
             order by t.typname, en.enumsortorder`,
            [schema],
        )

        const all: Record<string, string[]> = {}
        for (const row of rows) {
            (all[row.typname] ??= []).push(row.enumlabel)
        }
        if (!names) {
            return all
        }
        return Object.fromEntries(names.filter((name) => name in all).map((name) => [name, all[name]]))
    }

    /** The values of one enum type; empty when the type does not exist. */
    async getValues(name: string): Promise<string[]> {
        const all = await this.getAll([name])
        return all[name] ?? []
    }

}
