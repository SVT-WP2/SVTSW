import { EpicPasswordForm } from 'epic-ui/common/auth'
import { firstValueFrom } from 'rxjs'
import { EpicUserRole } from 'svt-ts-types'

import { EpicUserCreateFormFactory, EpicUserPasswordFormFactory, EpicUserUpdateFormFactory } from '../../forms'

import { EpicUserCreateForm } from './epic-user-create-form.models'
import { EpicUserFormValidators } from './epic-user-form-validators.models'
import { EpicUserPasswordForm } from './epic-user-password-form.models'
import { EpicUserUpdateForm } from './epic-user-update-form.models'


describe('the forms of the users page', () => {

    describe('New user', () => {

        const valid: EpicUserCreateForm.FormData = {
            login: 'jane.doe',
            name: 'Jane Doe',
            role: EpicUserRole.Expert,
            password: 'long-enough',
            repeatPassword: 'long-enough',
        }

        async function formWith(values: Partial<EpicUserCreateForm.FormData>) {
            const form = await firstValueFrom(new EpicUserCreateFormFactory().createFormGroup())
            form.setValue({ ...valid, ...values })
            return form
        }

        it('is valid with a login, a name, a role and the same password twice; a new user is a User by default', async () => {
            expect((await formWith({})).valid).toBe(true)
            expect(EpicUserCreateForm.createFromGroup().controls.role.value).toBe(EpicUserRole.User)
        })

        it('refuses a repeat password that differs, and checks it again when the password changes', async () => {
            const form = await formWith({ repeatPassword: 'long-enough-2' })

            expect(form.controls.repeatPassword.hasError(EpicPasswordForm.MISMATCH_ERROR)).toBe(true)
            expect(form.valid).toBe(false)
            form.controls.password.setValue('long-enough-2')
            expect(form.controls.repeatPassword.valid).toBe(true)
            expect(form.valid).toBe(true)
        })

        it('refuses a password of 7 characters and of 129, and accepts 8 and 128', async () => {
            for (const password of ['x'.repeat(7), 'x'.repeat(129)]) {
                const form = await formWith({ password, repeatPassword: password })

                expect(form.controls.password.valid, String(password.length)).toBe(false)
            }
            for (const password of ['x'.repeat(8), 'x'.repeat(128)]) {
                expect((await formWith({ password, repeatPassword: password })).valid, String(password.length)).toBe(true)
            }
        })

        it('checks the login rule on the login trimmed and in lower case', async () => {
            expect((await formWith({ login: '  Jane.DOE ' })).controls.login.valid).toBe(true)
            for (const login of ['ab', 'jane doe', 'jane@doe', 'x'.repeat(51)]) {
                const control = (await formWith({ login })).controls.login

                expect(control.hasError(EpicUserFormValidators.LOGIN_RULE_ERROR), login).toBe(true)
            }
        })

        it('needs a name that is not only spaces, of 100 characters at most', async () => {
            expect((await formWith({ name: '   ' })).controls.name.hasError(EpicUserFormValidators.BLANK_ERROR)).toBe(true)
            expect((await formWith({ name: 'x'.repeat(101) })).controls.name.valid).toBe(false)
            expect((await formWith({ name: 'x'.repeat(100) })).controls.name.valid).toBe(true)
        })

        it('sends the login, the trimmed name, the role and the password, never the repetition', () => {
            expect(EpicUserCreateForm.toRequest({ ...valid, name: ' Jane Doe ' })).toEqual({
                login: 'jane.doe',
                name: 'Jane Doe',
                role: EpicUserRole.Expert,
                password: 'long-enough',
            })
        })

    })

    describe('Edit user', () => {

        it('holds the name and the role of the user', async () => {
            const formData = { name: 'Jane Doe', role: EpicUserRole.Expert }
            const options = { login: 'jane.doe', isOwnUser: false }
            const form = await firstValueFrom(new EpicUserUpdateFormFactory().createFormGroup(formData, options))

            expect(form.getRawValue()).toEqual(formData)
            expect(form.controls.role.enabled).toBe(true)
            expect(form.valid).toBe(true)
        })

        it('disables the role of the own user', () => {
            const form = EpicUserUpdateForm.createFromGroup({ name: 'Me', role: EpicUserRole.Admin }, { isOwnUser: true })

            expect(form.controls.role.disabled).toBe(true)
            expect(form.controls.name.enabled).toBe(true)
        })

    })

    describe('Set password', () => {

        it('needs the same password twice, of 8 characters at least', async () => {
            const form = await firstValueFrom(new EpicUserPasswordFormFactory().createFormGroup())

            form.setValue({ password: 'long-enough', repeatPassword: 'long-enoug' })
            expect(EpicPasswordForm.getErrorText(form.controls.repeatPassword)).toBe('The two passwords differ')
            form.setValue({ password: 'short', repeatPassword: 'short' })
            expect(EpicPasswordForm.getErrorText(form.controls.password)).toBe('At least 8 characters')
            form.setValue({ password: 'long-enough', repeatPassword: 'long-enough' })
            expect(form.valid).toBe(true)
            expect(EpicUserPasswordForm.toRequest(form.getRawValue() as EpicUserPasswordForm.FormData)).toEqual({ password: 'long-enough' })
        })

    })

})
