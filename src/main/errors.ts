/** An error the user can fix; routes turn it into a 4xx with `{ error, message }`. */
export class UserError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message)
  }
}
