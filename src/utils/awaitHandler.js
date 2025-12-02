/**
 * Handles a Promise and returns a tuple of [result, error].
 * Allows you to avoid try/catch by destructuring the outcome.
 *
 * @template T
 * @param {Promise<T>} promise - The Promise to handle.
 * @returns {Promise<[T|null, Error|null]>} A tuple where the first element is the resolved value (or null),
 * and the second is the caught error (or null).
 */
export async function handleAsync(promise) {
    try {
        const result = await promise;
        return [result, null];
    } catch (error) {
        return [null, error];
    }
}
