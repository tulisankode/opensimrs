/**
 *
 * @param {string} message
 * @param {Object | Array} payload
 * @param {Object} properties for pagination info
 * @returns
 */
export function generateSuccessResponse(message, payload, properties) {
  return {
    message,
    payload,
    properties,
  };
}

/**
 *
 * @param {string} error
 * @param {string} type
 * @param {string} message
 */
export function generateErrorResponse(error, type, message) {
  return {
    message: error,
    errors: [
      {
        type,
        message,
      },
    ],
  };
}


/**
 * this helper for zod validator
 * @param {string} field - field that error
 * @returns {string} - mesaage
 */
export function invalidMessage(field){
  return `${field} tidak valid`
}

/**
 * this helper for zod validator
 * @param {string} field - field that error
 * @returns {string} - message
 */
export function requiredMessage(field){
  return `${field} tidak boleh kosong`
}