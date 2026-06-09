import { Pipe, PipeTransform } from '@angular/core'
import { get } from 'lodash-es'

import { TypeHelpers } from '../models'


@Pipe({
    name: 'epicSearch',
})
export class EpicSearchPipe implements PipeTransform {

    transform<T extends Record<string, any>>(value: T[], searchTerm: string, fieldAlias: string): T[] {

        const decoratedSearchTerm = (searchTerm || '').trim().toLowerCase()

        if (!decoratedSearchTerm.length) {
            return value
        }

        return value
            .filter((item) => {
                const targetDataSource: string = TypeHelpers.isString(item)
                    ? item
                    : get<string>(item as any, fieldAlias, '')
                return targetDataSource?.trim().toLowerCase().includes(decoratedSearchTerm)
            })
    }

}
