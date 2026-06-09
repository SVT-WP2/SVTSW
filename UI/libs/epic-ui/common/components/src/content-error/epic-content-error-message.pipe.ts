import { Pipe, PipeTransform } from '@angular/core'
import { StringHelpers, TypeHelpers } from 'epic-ui/utils'
import { isNil } from 'lodash-es'


@Pipe({
    name: 'epicContentErrorMessage',
})
export class EpicContentErrorMessagePipe implements PipeTransform {

    transform(value: Error | null | unknown): string | null {
        if (TypeHelpers.isObject(value) && value['message']) {
            return value['message'] as string
        }

        if (isNil(value)) {
            return null
        }

        return StringHelpers.toStringValue(value as any)
    }

}
