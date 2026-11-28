import { FormControl } from '@angular/forms'

import { EpicAuthPasswordChangeForm } from './epic-auth-password-change-form.models'
import { EpicPasswordForm } from './epic-password-form.models'


describe('EpicPasswordForm', () => {

    it('needs 8 to 128 characters for a new password', () => {
        const control = new FormControl<string | null>(null, EpicPasswordForm.newPasswordValidators())

        expect(EpicPasswordForm.getErrorText(control)).toBe('Required Field')
        control.setValue('x'.repeat(7))
        expect(EpicPasswordForm.getErrorText(control)).toBe('At least 8 characters')
        control.setValue('x'.repeat(129))
        expect(EpicPasswordForm.getErrorText(control)).toBe('At most 128 characters')
        control.setValue('x'.repeat(8))
        expect(EpicPasswordForm.getErrorText(control)).toBeNull()
    })

    it('marks a repetition that differs, also when the password changes after it', () => {
        const password = new FormControl<string | null>('first-password')
        const repeat = new FormControl<string | null>(null)
        EpicPasswordForm.linkRepeatControl(password, repeat)

        repeat.setValue('first-password')
        expect(repeat.valid).toBe(true)
        password.setValue('second-password')
        expect(repeat.hasError(EpicPasswordForm.MISMATCH_ERROR)).toBe(true)
        expect(EpicPasswordForm.getErrorText(repeat)).toBe('The two passwords differ')
        repeat.setValue('second-password')
        expect(repeat.valid).toBe(true)
    })

    describe('the form of the own password', () => {

        it('needs the current password, a new one of 8 characters and the same new one twice', () => {
            const form = EpicAuthPasswordChangeForm.createFromGroup()

            form.setValue({ currentPassword: '', newPassword: 'new-password', repeatPassword: 'new-password' })
            expect(form.controls.currentPassword.hasError('required')).toBe(true)
            form.setValue({ currentPassword: 'old', newPassword: 'new-password', repeatPassword: 'new-passwort' })
            expect(form.controls.repeatPassword.hasError(EpicPasswordForm.MISMATCH_ERROR)).toBe(true)
            form.setValue({ currentPassword: 'old', newPassword: 'new-password', repeatPassword: 'new-password' })
            expect(form.valid).toBe(true)
        })

        it('sends the current and the new password, never the repetition', () => {
            const formData = { currentPassword: 'old', newPassword: 'new-password', repeatPassword: 'new-password' }

            expect(EpicAuthPasswordChangeForm.toRequest(formData)).toEqual({ currentPassword: 'old', newPassword: 'new-password' })
        })

    })

})
