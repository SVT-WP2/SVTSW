import { Pipe, PipeTransform } from '@angular/core'


@Pipe({
    name: 'userInitials',
})
export class UserInitialsPipe implements PipeTransform {

    static getInitialLetter(value: string): string {
        return value?.length ? value[0].toUpperCase() : ''
    }

    static getInitials(name: string): string {
        if (!name?.length) {
            return ''
        }

        const splits = (name || '').split(' ')

        return UserInitialsPipe.getInitialLetter(splits[0])
            + (
                splits.length > 1
                    ? UserInitialsPipe.getInitialLetter(splits[splits.length - 1])
                    : ''
            )
    }

    transform(value: string): string {
        return UserInitialsPipe.getInitials(value)
    }

}
