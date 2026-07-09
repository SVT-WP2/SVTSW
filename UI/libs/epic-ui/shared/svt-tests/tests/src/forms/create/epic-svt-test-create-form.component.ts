import { Component, inject, OnInit, signal } from '@angular/core'
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MatOption } from '@angular/material/core'
import {
    MAT_FORM_FIELD_DEFAULT_OPTIONS,
    MatError,
    MatFormField,
    MatFormFieldDefaultOptions,
    MatFormFieldModule,
    MatLabel,
} from '@angular/material/form-field'
import { MatSelect } from '@angular/material/select'
import { EpicSvtDutEntityName } from 'epic-ui/api'
import { EpicContentErrorModule, EpicLoaderComponent, EpicNoResultModule, EpicSkeletonLoaderComponent } from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent, EpicSearchPipe, EpicSelectFormControl } from 'epic-ui/utils'
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search'
import { catchError, debounceTime, map, of, Subject, switchMap, takeUntil, tap } from 'rxjs'

import { EpicSvtTestCreateFormFactory } from './epic-svt-test-create-form.factory'
import { EpicSvtTestCreateForm } from './epic-svt-test-create-form.models'
import { EpicSvtTestDutSearchService } from './epic-svt-test-dut-search.service'

import Form = EpicSvtTestCreateForm


const DUT_SEARCH_DEBOUNCE_TIME = 300

@Component({
    selector: 'epic-svt-test-create-form',
    templateUrl: 'epic-svt-test-create-form.component.html',
    standalone: true,
    providers: [
        {
            provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
            useValue: {
                appearance: 'outline',
                floatLabel: 'always',
                subscriptSizing: 'dynamic',
            } as MatFormFieldDefaultOptions,
        },
    ],
    imports: [
        ReactiveFormsModule,
        FormsModule,
        MatFormField,
        MatFormFieldModule,
        MatLabel,
        MatError,
        MatSelect,
        MatOption,
        NgxMatSelectSearchModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicNoResultModule,
        EpicSkeletonLoaderComponent,
        EpicSearchPipe,
    ],
})
export class EpicSvtTestCreateFormComponent
    extends BaseFormWithFactoryComponent<Form.FormData, Form.FormGroupWithOptions>
    implements OnInit {

    override formGroup: Form.FormGroupWithOptions

    readonly FormField = Form.FormField
    readonly dutEntityNameLabel = Form.DUT_ENTITY_NAME_LABEL

    /** Not part of the form value — it only drives the DUT options lookup. */
    readonly dutSearchControl = new FormControl<string>('', { nonNullable: true })
    readonly isDutSearching = signal(false)

    /**
     * Not part of the form value. Test templates are all loaded up front by the factory, so unlike the DUT
     * search this one only filters the options already on the control — no fetching involved.
     */
    readonly testTemplateSearchTermControl = new FormControl<string>('')

    protected readonly formFactory = inject(EpicSvtTestCreateFormFactory)
    protected readonly epicSvtTestDutSearchService = inject(EpicSvtTestDutSearchService)

    protected readonly dutSearchTerm$ = new Subject<string>()

    /** The DUT the user picked, remembered because a later search may no longer return it. */
    protected selectedDutOption: Form.DutOption | null = null

    /** The term the current options were fetched for; `null` while no fetch has populated them yet. */
    protected fetchedDutSearchTerm: string | null = null

    get dutIdFormField(): Form.DutIdFormField | null {
        const dutEntityName = this.formGroup.controls.dutEntityName.value
        return dutEntityName ? Form.DUT_ID_FORM_FIELD[dutEntityName] : null
    }

    get dutIdControl(): EpicSelectFormControl<number, Form.DutOption> | null {
        const formField = this.dutIdFormField
        return formField ? this.formGroup.controls[formField] : null
    }

    /**
     * The selected DUT when the current search results do not contain it. A mat-select falls back to its
     * placeholder unless some option carries its value, so this one is rendered hidden — that keeps the trigger
     * label intact without letting the selection pose as a search hit (which would also suppress "no results").
     */
    get unlistedSelectedDutOption(): Form.DutOption | null {
        const selectedDutOption = this.selectedDutOption

        if (!selectedDutOption || this.dutIdControl?.value !== selectedDutOption.id) {
            return null
        }

        return this.dutIdControl.selectOptions.some(option => option.id === selectedDutOption.id)
            ? null
            : selectedDutOption
    }

    /**
     * The options only ever matter while the panel is open, so that is where they are fetched — and only when
     * the term they were last fetched for no longer matches.
     */
    onDutSelectOpened(): void {
        if (this.dutSearchControl.value !== this.fetchedDutSearchTerm) {
            this.dutSearchTerm$.next(this.dutSearchControl.value)
        }
    }

    /**
     * Clears the search without emitting. `clearSearchInput` is turned off so the library cannot do this for us
     * — its reset goes through the bound control and would fetch a list for a panel nobody is looking at. The
     * stale options are left alone; the next open reconciles them with the cleared term.
     */
    onDutSelectClosed(): void {
        this.dutSearchControl.setValue('', { emitEvent: false })
    }

    protected override initFormGroup(): void {

        super.initFormGroup()

        // everything below the DUT entity type stays locked until the selection above it is made
        this.formGroup.controls.testTemplateId.disable({ emitEvent: false })
        Object.values(Form.DUT_ID_FORM_FIELD)
            .forEach(formField => this.formGroup.controls[formField].disable({ emitEvent: false }))

        this.initTestSetupChanges()
        this.initDutEntityNameChanges()
        this.initDutSelectionChanges()
        this.initTestTemplateChanges()
        this.initDutSearchChanges()

        this.applyDefaultTestSetup()
    }

    protected initTestSetupChanges(): void {
        this.formGroup.controls.testSetupId.valueChanges
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe(testSetupId => this.applyTestSetup(testSetupId))
    }

    protected initDutEntityNameChanges(): void {
        this.formGroup.controls.dutEntityName.valueChanges
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe(dutEntityName => this.applyDutEntityName(dutEntityName))
    }

    protected initDutSelectionChanges(): void {
        Object.values(Form.DUT_ID_FORM_FIELD)
            .forEach((formField) => {
                this.formGroup.controls[formField].valueChanges
                    .pipe(
                        takeUntil(this.destroyed$),
                    )
                    .subscribe(dutId => this.applyDutSelection(dutId))
            })
    }

    protected initTestTemplateChanges(): void {
        this.formGroup.controls.testTemplateId.valueChanges
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe((testTemplateId) => {
                const testTemplate = this.formGroup.controls.testTemplateId.selectOptions
                    .find(item => item.id === testTemplateId)

                this.formGroup.controls.testTypeConfigId
                    .setValue(testTemplate?.testTypeConfigId ?? null)
            })
    }

    protected initDutSearchChanges(): void {

        this.dutSearchControl.valueChanges
            .pipe(
                debounceTime(DUT_SEARCH_DEBOUNCE_TIME),
                takeUntil(this.destroyed$),
            )
            .subscribe(searchTerm => this.dutSearchTerm$.next(searchTerm))

        this.dutSearchTerm$
            .pipe(
                tap(() => this.isDutSearching.set(true)),
                // switchMap: a slow response for an outdated search term must never overwrite a newer one
                switchMap((searchTerm) => {
                    const dutEntityName = this.formGroup.controls.dutEntityName.value
                    const dutOptions$ = dutEntityName
                        ? this.epicSvtTestDutSearchService.search(dutEntityName, searchTerm)
                            .pipe(
                                catchError(() => of([] as Form.DutOption[])),
                            )
                        : of([] as Form.DutOption[])

                    return dutOptions$
                        .pipe(
                            map(dutOptions => ({ searchTerm, dutOptions })),
                        )
                }),
                takeUntil(this.destroyed$),
            )
            .subscribe(({ searchTerm, dutOptions }) => {
                const dutIdControl = this.dutIdControl
                if (dutIdControl) {
                    // the search results stand on their own — the selected DUT is rendered separately
                    dutIdControl.selectOptions = dutOptions
                }
                this.fetchedDutSearchTerm = searchTerm
                this.isDutSearching.set(false)
            })
    }

    /** The first setup and its default config are preselected so the user only has to pick the DUT. */
    protected applyDefaultTestSetup(): void {
        const defaultTestSetup = this.formGroup.controls.testSetupId.selectOptions[0]
        if (defaultTestSetup) {
            this.formGroup.controls.testSetupId.setValue(defaultTestSetup.id)
        }
    }

    protected applyTestSetup(testSetupId: number | null): void {

        const testSetupConfigIdControl = this.formGroup.controls.testSetupConfigId

        testSetupConfigIdControl.selectOptions = testSetupId === null
            ? []
            : this.formGroup.allTestSetupConfigs.filter(config => config.setupId === testSetupId)

        const testSetup = this.formGroup.controls.testSetupId.selectOptions
            .find(item => item.id === testSetupId)

        const defaultTestSetupConfig = testSetupConfigIdControl.selectOptions
            .find(config => config.id === testSetup?.defaultConfigId)
            ?? testSetupConfigIdControl.selectOptions[0]

        testSetupConfigIdControl.setValue(defaultTestSetupConfig?.id ?? null)
    }

    protected applyDutEntityName(dutEntityName: EpicSvtDutEntityName | null): void {

        // a different entity type invalidates any DUT already picked, and the template that followed from it
        Object.values(Form.DUT_ID_FORM_FIELD)
            .forEach((formField) => {
                const control = this.formGroup.controls[formField]
                control.selectOptions = []
                control.reset(null, { emitEvent: false })
                control.disable({ emitEvent: false })
            })

        this.selectedDutOption = null
        this.dutSearchControl.setValue('', { emitEvent: false })
        // the options belong to the previous entity type — the next panel open fetches the right ones
        this.fetchedDutSearchTerm = null
        this.resetTestTemplate()

        if (!dutEntityName) {
            return
        }

        this.formGroup.controls[Form.DUT_ID_FORM_FIELD[dutEntityName]].enable({ emitEvent: false })
    }

    protected applyDutSelection(dutId: number | null): void {

        const dutOption = this.dutIdControl?.selectOptions.find(item => item.id === dutId)
        this.selectedDutOption = dutOption ?? null

        if (!dutOption) {
            this.resetTestTemplate()
            return
        }

        const testTemplateIdControl = this.formGroup.controls.testTemplateId

        // a template is applicable to a DUT when it targets the DUT family type
        testTemplateIdControl.selectOptions = this.formGroup.allTestTemplates
            .filter(template => template.isEnabled && template.dutType === dutOption.familyType)

        testTemplateIdControl.enable({ emitEvent: false })
        // the first applicable template is preselected — the emitted change carries it over to testTypeConfigId
        testTemplateIdControl.reset(testTemplateIdControl.selectOptions[0]?.id ?? null)

        // Material renders a mat-error only once the control is touched, and "no matching template" is not
        // something the user can trigger by interacting with the control — surface it right away
        if (testTemplateIdControl.hasError(Form.NO_MATCHING_TEST_TEMPLATE_ERROR)) {
            testTemplateIdControl.markAsTouched()
        }
    }

    protected resetTestTemplate(): void {
        const testTemplateIdControl = this.formGroup.controls.testTemplateId
        testTemplateIdControl.selectOptions = []
        testTemplateIdControl.reset(null, { emitEvent: false })
        testTemplateIdControl.disable({ emitEvent: false })
        this.formGroup.controls.testTypeConfigId.setValue(null, { emitEvent: false })
    }

}
