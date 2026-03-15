export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

export class UnauthorizedError extends AppError {
  constructor(message?: string) {
    super(401, 'UNAUTHORIZED', message || 'Authentication required');
    this.name = 'UnauthorizedError';
  }
}

export class ForbiddenError extends AppError {
  constructor(message?: string) {
    super(403, 'FORBIDDEN', message || 'Insufficient permissions');
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class BridgeLimitError extends AppError {
  constructor(current: number, limit: number) {
    super(
      422,
      'BRIDGE_LIMIT_EXCEEDED',
      `Bridge mitigation limit reached (${current}/${limit}).`,
      { current, limit },
    );
    this.name = 'BridgeLimitError';
  }
}
