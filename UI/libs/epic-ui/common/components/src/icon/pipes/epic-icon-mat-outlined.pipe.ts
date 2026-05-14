import { Pipe, PipeTransform } from '@angular/core'

import { toEpicMatOutlinedIcon } from '../models'


@Pipe({
    name: 'epicIconMatOutlined',
})
export class EpicIconMatOutlinedPipe implements PipeTransform {

    transform(iconName: string): string {
        return toEpicMatOutlinedIcon(iconName)
    }

}
