import { Pipe, PipeTransform } from '@angular/core'

import { NumberHelpers } from '../models'


@Pipe({
    name: 'epicFormatNumberRounded',
})
export class EpicFormatNumberRoundedPipe implements PipeTransform {

    transform(value: number): string {
        return NumberHelpers.formatNumberRounded(value)
    }

}


