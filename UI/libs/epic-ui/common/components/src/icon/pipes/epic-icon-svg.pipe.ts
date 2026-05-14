import { Pipe, PipeTransform } from '@angular/core'

import { toEpicSvgIcon } from '../models'


@Pipe({
    name: 'epicIconSvg',
})
export class EpicIconSvgPipe implements PipeTransform {

    transform(iconName: string): string {
        return toEpicSvgIcon(iconName)
    }

}
