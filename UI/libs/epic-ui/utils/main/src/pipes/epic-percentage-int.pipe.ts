import { Pipe, PipeTransform } from '@angular/core'
import { isNil } from 'lodash-es'


@Pipe({
    name: 'epicPercentageInt',
})
export class EpicPercentageIntPipe implements PipeTransform {

    transform(number: number | undefined | null): string | null | undefined {
        if (isNil(number)) {
            return number
        }
        return `${Math.round(number)}%`
    }

}


