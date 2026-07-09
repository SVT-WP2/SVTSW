import { AbstractControl, FormControl, FormGroup, ValidationErrors, Validators } from '@angular/forms'
import {
    EpicSvtDutEntityName,
    EpicSvtTestCreate,
    EpicSvtTestSetup,
    EpicSvtTestSetupConfig,
    EpicSvtTestTemplate,
    EpicSvtTestType,
    EpicSvtTestTypeConfig,
} from 'epic-ui/api'
import { EpicSelectFormControl } from 'epic-ui/utils'


export namespace EpicSvtTestCreateForm {

    /**
     * A DUT (Asic / Chip / ChipBlock) reduced to what the form needs: the id to submit, the serial number to
     * render and the family type used to narrow down the available test templates.
     */
    export type DutOption = {
        id: number
        serialNumber: string
        familyType: string
    }

    /**
     * A test template is identified to the user by the test type and the test type config it points at — both
     * are resolved once, when the reference lists are loaded, instead of per change detection cycle.
     */
    export type TestTemplateOption = EpicSvtTestTemplate & {
        testTypeName: string
        testTypeConfigName: string
        /** Both names joined into one haystack — `epicSearch` matches a single field, the option shows two. */
        searchLabel: string
    }

    export function toTestTemplateOptions(
        testTemplates: EpicSvtTestTemplate[],
        testTypes: EpicSvtTestType[],
        testTypeConfigs: EpicSvtTestTypeConfig[],
    ): TestTemplateOption[] {
        return testTemplates
            .filter(testTemplate => testTemplate.isEnabled)
            .map((testTemplate) => {
                const testType = testTypes.find(item => item.id === testTemplate.testTypeId)
                const testTypeConfig = testTypeConfigs.find(item => item.id === testTemplate.testTypeConfigId)

                // a dangling reference stays visible as an id rather than rendering as a blank option —
                // worded so it cannot be mistaken for a real name (test types are often named "Test Type #2")
                const testTypeName = testType?.name ?? `Unknown test type (id ${testTemplate.testTypeId})`
                const testTypeConfigName = testTypeConfig?.name ?? `Unknown config (id ${testTemplate.testTypeConfigId})`

                return {
                    ...testTemplate,
                    testTypeName,
                    testTypeConfigName,
                    searchLabel: `${testTypeName} ${testTypeConfigName}`,
                }
            })
    }

    export const FormField: Record<keyof FormGroupControls, keyof FormGroupControls> = {
        testSetupId: 'testSetupId',
        testSetupConfigId: 'testSetupConfigId',
        dutEntityName: 'dutEntityName',
        asicId: 'asicId',
        chipId: 'chipId',
        chipBlockId: 'chipBlockId',
        testTemplateId: 'testTemplateId',
        testTypeConfigId: 'testTypeConfigId',
    }

    export type FormData = {
        testSetupId: number | null
        testSetupConfigId: number | null
        dutEntityName: EpicSvtDutEntityName | null
        asicId: number | null
        chipId: number | null
        chipBlockId: number | null
        testTemplateId: number | null
        testTypeConfigId: number | null
    }

    export type FormGroupControls = {
        testSetupId: EpicSelectFormControl<number, EpicSvtTestSetup>
        testSetupConfigId: EpicSelectFormControl<number, EpicSvtTestSetupConfig>
        dutEntityName: EpicSelectFormControl<EpicSvtDutEntityName, EpicSvtDutEntityName>
        asicId: EpicSelectFormControl<number, DutOption>
        chipId: EpicSelectFormControl<number, DutOption>
        chipBlockId: EpicSelectFormControl<number, DutOption>
        testTemplateId: EpicSelectFormControl<number, TestTemplateOption>
        testTypeConfigId: FormControl<number | null>
    }

    export type DutIdFormField = Extract<keyof FormGroupControls, 'asicId' | 'chipId' | 'chipBlockId'>

    /**
     * The selected DUT entity type decides which of the three DUT controls carries `dutId`.
     * Only that one is enabled (and therefore validated), the other two stay disabled and empty.
     */
    export const DUT_ID_FORM_FIELD: Record<EpicSvtDutEntityName, DutIdFormField> = {
        [EpicSvtDutEntityName.Asic]: 'asicId',
        [EpicSvtDutEntityName.Chip]: 'chipId',
        [EpicSvtDutEntityName.ChipBlock]: 'chipBlockId',
    }

    export const DUT_ENTITY_NAME_LABEL: Record<EpicSvtDutEntityName, string> = {
        [EpicSvtDutEntityName.Asic]: 'Asic',
        [EpicSvtDutEntityName.Chip]: 'Chip',
        [EpicSvtDutEntityName.ChipBlock]: 'Chip Block',
    }

    export const NO_MATCHING_TEST_TEMPLATE_ERROR = 'noMatchingTestTemplate'

    /**
     * A DUT whose family type no test template targets is a dead end: there is nothing to pick, so the control
     * reports it as its own error rather than staying silently empty.
     */
    export function testTemplateOptionsValidator(control: AbstractControl): ValidationErrors | null {
        const { selectOptions } = control as EpicSelectFormControl<number, TestTemplateOption>
        return selectOptions?.length
            ? null
            : { [NO_MATCHING_TEST_TEMPLATE_ERROR]: true }
    }

    /**
     * Carries the full, unfiltered reference lists loaded once by the form factory. The setup configs and the
     * test templates the user may pick from are a subset of these, recalculated on every relevant selection.
     */
    export class FormGroupWithOptions extends FormGroup<FormGroupControls> {

        allTestSetupConfigs: EpicSvtTestSetupConfig[] = []
        allTestTemplates: TestTemplateOption[] = []

    }

    export function createFromGroup(formData?: Partial<FormData>): FormGroupWithOptions {
        return new FormGroupWithOptions({
            testSetupId: new EpicSelectFormControl<number, EpicSvtTestSetup>(
                formData?.testSetupId ?? null, Validators.required),
            testSetupConfigId: new EpicSelectFormControl<number, EpicSvtTestSetupConfig>(
                formData?.testSetupConfigId ?? null, Validators.required),
            dutEntityName: new EpicSelectFormControl<EpicSvtDutEntityName, EpicSvtDutEntityName>(
                formData?.dutEntityName ?? null, Validators.required),
            asicId: new EpicSelectFormControl<number, DutOption>(
                formData?.asicId ?? null, Validators.required),
            chipId: new EpicSelectFormControl<number, DutOption>(
                formData?.chipId ?? null, Validators.required),
            chipBlockId: new EpicSelectFormControl<number, DutOption>(
                formData?.chipBlockId ?? null, Validators.required),
            testTemplateId: new EpicSelectFormControl<number, TestTemplateOption>(
                formData?.testTemplateId ?? null, [Validators.required, testTemplateOptionsValidator]),
            testTypeConfigId: new FormControl<number | null>(
                formData?.testTypeConfigId ?? null, Validators.required),
        })
    }

    /**
     * `dutId` is spread over three controls in the form group — collapse it back to the single value the API expects.
     */
    export function getDutId(formData: FormData): number | null {
        return formData.dutEntityName
            ? formData[DUT_ID_FORM_FIELD[formData.dutEntityName]]
            : null
    }

    export function formDataToCreateRequest(formData: FormData): EpicSvtTestCreate {
        return {
            dutEntityName: formData.dutEntityName!,
            dutId: getDutId(formData)!,
            testTypeConfig: formData.testTypeConfigId!,
            testSetupConfigId: formData.testSetupConfigId!,
        }
    }

}
