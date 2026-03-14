/**
 * Thrown when an optimistic-locking version conflict is detected.
 * The caller attempted to update a row whose version has already advanced
 * past the expected value.
 */
export class ConflictError extends Error {
  constructor(message = 'Version conflict: the record was modified by another request') {
    super(message);
    this.name = 'ConflictError';
  }
}
