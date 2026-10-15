export function generateErrorMessage(error, type, message){
    return {
        message: error,
        errors: [
            {
                type, message
            }
        ]
    }
}

export function generateSuccessMessage(message, payload){
    return {
        message, payload
    }
}