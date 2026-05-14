import { Pipe, PipeTransform } from '@angular/core'

import { NumberHelpers } from '../models'


@Pipe({
    name: 'epicReadableNumber',
})
export class EpicReadableNumberPipe implements PipeTransform {

    transform(value: number, digits = 2): string {
        return NumberHelpers.toReadableFormat(value, digits)
    }

}
