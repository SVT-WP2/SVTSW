import { Pipe, PipeTransform } from '@angular/core'

import { NumberHelpers } from '../models'


@Pipe({
    name: 'epicFormatNumber',
    standalone: true,
})
export class EpicFormatNumberPipe implements PipeTransform {

    transform(value: number): string {
        return NumberHelpers.formatNumber(value)
    }

}


