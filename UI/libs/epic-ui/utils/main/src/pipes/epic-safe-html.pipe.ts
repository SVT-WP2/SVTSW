import { inject, Pipe, PipeTransform } from '@angular/core'
import { DomSanitizer, SafeHtml } from '@angular/platform-browser'


@Pipe({
    name: 'epicSafeHtml',
})
export class EpicSafeHtmlPipe implements PipeTransform {

    private readonly domSanitizer = inject(DomSanitizer)

    transform(html: string | null): SafeHtml {
        return html ? this.domSanitizer.bypassSecurityTrustHtml(html) : ''
    }

}
