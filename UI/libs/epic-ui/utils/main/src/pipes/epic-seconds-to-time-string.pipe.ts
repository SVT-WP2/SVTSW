import { Pipe, PipeTransform } from '@angular/core'

import { DateTimeHelpers } from '../models'


@Pipe({
    name: 'epicSecondsToTimeString',
})
export class EpicSecondsToTimeStringPipe implements PipeTransform {

    transform(timeInSeconds: number): string {
        return DateTimeHelpers.secondsToTimeString(timeInSeconds)
    }

}


