import { inject, Pipe, PipeTransform } from '@angular/core'
import { TranslateService } from '@ngx-translate/core'
import { get } from 'lodash-es'

import { TypeHelpers } from '../models'


@Pipe({
    name: 'epicSearchI18n',
})
export class EpicSearchI18nPipe implements PipeTransform {

    protected readonly translateService = inject(TranslateService)

    transform<T = Record<string, any>[] | string[]>(value: T[], searchTerm: string, fieldAlias?: string): T[] {

        const decoratedSearchTerm = (searchTerm || '').trim().toLowerCase()

        if (!decoratedSearchTerm.length) {
            return value
        }

        return value
            .filter((item) => {
                const targetDataSource = TypeHelpers.isString(item)
                    ? item
                    : get<string>(item as any, fieldAlias || '', '')
                const targetDataSourceI18n = this.translateService.instant(targetDataSource) as string
                return targetDataSourceI18n?.trim().toLowerCase().includes(decoratedSearchTerm)
            })
    }

}
