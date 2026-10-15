export class HttpException extends Error {
    constructor(message, code){
        super(code);
        this.message = message;
        this.code = code;
    }
}

export class HttpStatus {
    static NOT_FOUND = 404;
    static FOR_BIDEN = 403;
    static UNAUTHORIZED = 401;
    static CONFLIC = 409;
    static INTERNAL_SERVER_ERROR =500;
    static BAD_REQUEST = 400;
    static CREATED = 201
}
