import { Pipe, PipeTransform } from '@angular/core'


@Pipe({
    name: 'startsWith',
})
export class StartsWithPipe implements PipeTransform {

    transform(value: string[], term: string | null): string[] {
        return term === null
            ? value
            : value
                .filter(
                    (item: string) =>
                        item.toLowerCase()
                            .startsWith(
                                term.toLowerCase(),
                            ),
                )
    }

}
