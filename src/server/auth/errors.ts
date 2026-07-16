export type DomainErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'VALIDATION'
  | 'SERVICE_UNAVAILABLE'

export class DomainError extends Error {
  readonly code: DomainErrorCode
  readonly statusCode: number

  constructor(
    code: DomainErrorCode,
    message: string,
    statusCode: number,
    options?: ErrorOptions
  ) {
    super(message, options)
    this.name = 'DomainError'
    this.code = code
    this.statusCode = statusCode
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized', options?: ErrorOptions) {
    super('UNAUTHORIZED', message, 401, options)
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

/**
 * Raised when a dependency the request relies on (e.g. the Supabase Auth
 * service or its JWKS endpoint) is unreachable or failing. Kept distinct from
 * {@link UnauthorizedError} so a transient outage is never reported to the
 * client as an authentication failure.
 */
export class ServiceUnavailableError extends DomainError {
  constructor(message = 'Service unavailable', options?: ErrorOptions) {
    super('SERVICE_UNAVAILABLE', message, 503, options)
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}
