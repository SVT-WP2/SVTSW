import { AfterContentInit, Directive, forwardRef, Inject, Input, OnDestroy, TemplateRef } from '@angular/core'

import { EpicMatDialogContentComponent } from '../components'
import { EpicMatDialog } from '../models'


@Directive({
    selector: '[epicMatDialogSection]ng-template',
    standalone: false,
})
export class EpicMatDialogSectionDirective implements OnDestroy, AfterContentInit {

    @Input({ required: true}) epicMatDialogSection!: EpicMatDialog.SectionName

    constructor(
        readonly template: TemplateRef<any>,
        @Inject(forwardRef(() => EpicMatDialogContentComponent))
        private readonly dialogContentComponent: EpicMatDialogContentComponent,
    ) {

    }

    ngAfterContentInit(): void {
        if (!this.epicMatDialogSection) {
            throw new Error('epicMatDialogSection is required Input parameter')
        }

        if (this.epicMatDialogSection === EpicMatDialog.SectionName.contentFooter) {
            this.dialogContentComponent.footerTemplatesRef = this.template
        }
        else if (this.epicMatDialogSection === EpicMatDialog.SectionName.contentFooterActions) {
            this.dialogContentComponent.footerActionsTemplatesRef = this.template
        }

    }

    ngOnDestroy(): void {
        if (this.epicMatDialogSection === EpicMatDialog.SectionName.contentFooter) {
            this.dialogContentComponent.footerTemplatesRef = null
        }
        else if (this.epicMatDialogSection === EpicMatDialog.SectionName.contentFooterActions) {
            this.dialogContentComponent.footerActionsTemplatesRef = null
        }
    }

}
