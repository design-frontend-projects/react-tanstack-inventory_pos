export type DomainErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'

export class DomainError extends Error {
  readonly code: DomainErrorCode
  readonly statusCode: number

  constructor(code: DomainErrorCode, message: string, statusCode: number) {
    super(message)
    this.name = 'DomainError'
    this.code = code
    this.statusCode = statusCode
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403)
  }
}

export class NotFoundError extends DomainError {
  constructor(message = 'Not found') {
    super('NOT_FOUND', message, 404)
  }
}

export class ConflictError extends DomainError {
  constructor(message = 'Conflict') {
    super('CONFLICT', message, 409)
  }
}

export class ValidationError extends DomainError {
  constructor(message = 'Validation failed') {
    super('VALIDATION', message, 422)
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}
