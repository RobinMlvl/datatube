// One error for every model call. `code` says what to do: a final code stops the job, the rest retry.
export class LlmError extends Error {
  constructor(message, code) {
    super(message);
    this.name = "LlmError";
    this.code = code;
  }
}
