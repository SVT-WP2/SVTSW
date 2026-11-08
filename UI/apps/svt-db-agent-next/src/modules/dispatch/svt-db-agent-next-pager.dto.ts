import { IsInt, IsOptional, Min } from 'class-validator'
import { SVT_DB_DEFAULT_PAGE_LIMIT, SvtDbPager } from 'svt-db/data'

import { validateRequestData } from './svt-db-agent-next-request-validation'


/** `data.pager` of the list messages; both keys optional, defaults as the C++ agent applied them. */
export class SvtDbAgentNextPagerDto {

    @IsOptional()
    @IsInt()
    @Min(0)
    limit?: number

    @IsOptional()
    @IsInt()
    @Min(0)
    offset?: number

}

/** Absent `pager` means every row; a present one defaults to `limit 20`, `offset 0`. */
export function optionalPager(value: unknown, path: string): SvtDbPager | undefined {
    if (value === undefined || value === null) {
        return undefined
    }
    const pager = validateRequestData(SvtDbAgentNextPagerDto, value, path)
    return { limit: pager.limit ?? SVT_DB_DEFAULT_PAGE_LIMIT, offset: pager.offset ?? 0 }
}
