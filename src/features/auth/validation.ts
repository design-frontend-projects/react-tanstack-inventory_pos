import { z } from 'zod'

export const ACTIVITY_OPTIONS = ['restaurant', 'retail', 'hybrid'] as const

export const PASSWORD_POLICY_MESSAGE =
  'Use at least 8 characters with uppercase, lowercase, number, and special character.'

const PHONE_PATTERN = /^[+\d().\-\s/]{7,32}$/
const OTP_CODE_PATTERN = /^\d{8}$/
const passwordValueSchema = z
  .string()
  .min(8, PASSWORD_POLICY_MESSAGE)
  .regex(/[A-Z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/[a-z]/, PASSWORD_POLICY_MESSAGE)
  .regex(/\d/, PASSWORD_POLICY_MESSAGE)
  .regex(/[^A-Za-z0-9]/, PASSWORD_POLICY_MESSAGE)

export const firstNameSchema = z
  .string()
  .trim()
  .min(2, 'First name must be at least 2 characters.')
  .max(100, 'First name must be 100 characters or fewer.')

export const lastNameSchema = z
  .string()
  .trim()
  .min(2, 'Last name must be at least 2 characters.')
  .max(100, 'Last name must be 100 characters or fewer.')

export const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address.')
  .transform((value) => value.toLowerCase())

export const signInOtpCodeSchema = z
  .string()
  .trim()
  .regex(OTP_CODE_PATTERN, 'Enter the 6-digit code.')

export const requiredPhoneSchema = z
  .string()
  .trim()
  .min(7, 'Phone number is required.')
  .max(32, 'Phone number must be 32 characters or fewer.')
  .regex(PHONE_PATTERN, 'Use digits and phone punctuation only.')

export const optionalPhoneSchema = z
  .string()
  .trim()
  .max(32, 'Phone number must be 32 characters or fewer.')
  .refine(
    (value) => value.length === 0 || PHONE_PATTERN.test(value),
    'Use digits and phone punctuation only.'
  )

export const avatarUrlSchema = z
  .string()
  .trim()
  .max(2048, 'Avatar URL is too long.')
  .refine((value) => value.length === 0 || URL.canParse(value), 'Enter a valid URL.')

export const timezoneSchema = z
  .string()
  .trim()
  .min(1, 'Timezone is required.')
  .max(100, 'Timezone must be 100 characters or fewer.')

export const tenantNameSchema = z
  .string()
  .trim()
  .min(2, 'Tenant name must be at least 2 characters.')
  .max(120, 'Tenant name must be 120 characters or fewer.')

export const activitySchema = z.enum(ACTIVITY_OPTIONS, {
  error: 'Select a valid activity type.',
})

export const signUpSchema = z.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  email: emailSchema,
  phone: requiredPhoneSchema,
  activity: activitySchema,
  origin: z.string().url('Origin must be a valid URL.'),
})

export const signInOtpRequestSchema = z.object({
  email: emailSchema,
})

export const signInOtpVerifySchema = z.object({
  email: emailSchema,
  token: signInOtpCodeSchema,
})

const profileFieldsSchema = z.object({
  firstName: firstNameSchema,
  lastName: lastNameSchema,
  phone: optionalPhoneSchema,
  avatarUrl: avatarUrlSchema,
})

export const ownerOnboardingSchema = profileFieldsSchema
  .extend({
    registrationId: z.string().uuid('Registration reference is invalid.'),
    tenantName: tenantNameSchema,
    timezone: timezoneSchema,
    password: passwordValueSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: 'custom',
        message: 'Passwords do not match.',
        path: ['confirmPassword'],
      })
    }
  })

export const invitationAcceptanceSchema = profileFieldsSchema
  .extend({
    invitationId: z.string().uuid('Invitation reference is invalid.'),
    password: z.string().optional().default(''),
    confirmPassword: z.string().optional().default(''),
  })
  .superRefine((value, context) => {
    const password = value.password.trim()
    const confirmPassword = value.confirmPassword.trim()

    if (!password && !confirmPassword) {
      return
    }

    const passwordResult = passwordValueSchema.safeParse(password)
    if (!passwordResult.success) {
      for (const issue of passwordResult.error.issues) {
        context.addIssue({
          ...issue,
          path: ['password'],
        })
      }
    }

    if (password !== confirmPassword) {
      context.addIssue({
        code: 'custom',
        message: 'Passwords do not match.',
        path: ['confirmPassword'],
      })
    }
  })

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  origin: z.string().url('Origin must be a valid URL.'),
})

export const resetPasswordSchema = z
  .object({
    password: passwordValueSchema,
    confirmPassword: z.string().min(1, 'Confirm your password.'),
  })
  .superRefine((value, context) => {
    if (value.password !== value.confirmPassword) {
      context.addIssue({
        code: 'custom',
        message: 'Passwords do not match.',
        path: ['confirmPassword'],
      })
    }
  })

export const profileUpdateSchema = profileFieldsSchema

export function getPasswordPolicyDescription() {
  return PASSWORD_POLICY_MESSAGE
}
