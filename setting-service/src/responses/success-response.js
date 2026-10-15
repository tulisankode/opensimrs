// Fungsi khusus untuk respons sukses
export default function successResponse(message, data, property) {
  if (!data && !property) {
    return {
      status: "success",
      message: message,
    };
  }
  
  if (!property) {
    return {
      status: "success",
      message: message,
      payload: data,
    };
  }

  if (property) {
    return {
      status: "success",
      message: message,
      properties: property,
      payload: data,
    };
  }
}
