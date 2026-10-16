import BantuanService from "../bantuan/bantuan-service.js";
import successResponse from "../responses/success-response.js";

// Aliran jawaban (server-sent events): data: {"teks": "..."} … data: {"selesai": true}. Galat sebelum potongan pertama
// dikembalikan sebagai JSON biasa (status 400/429) lewat errorMiddleware; galat di tengah aliran dikirim sebagai
// data: {"galat": "..."}.
export default class BantuanController {
  static async status(request, response, nextFunction) {
    try {
      response.status(200).json(successResponse("Status Helpdesk", await BantuanService.status(request.author)));
    } catch (error) {
      nextFunction(error);
    }
  }

  static async chat(request, response, nextFunction) {
    const pembatal = new AbortController();
    response.on("close", () => {
      if (!response.writableEnded) pembatal.abort();
    });
    const tulis = (data) => response.write(`data: ${JSON.stringify(data)}\n\n`);
    const mulaiAliran = () => {
      if (response.headersSent) return;
      response.status(200).set({ "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache", "X-Accel-Buffering": "no" });
      response.flushHeaders();
    };
    try {
      const { disamarkan } = await BantuanService.tanya(request.author, request.body, (teks) => {
        mulaiAliran();
        tulis({ teks });
      }, pembatal.signal);
      mulaiAliran();
      tulis({ selesai: true, disamarkan });
      response.end();
    } catch (error) {
      if (!response.headersSent) return nextFunction(error);
      tulis({ galat: error.message });
      response.end();
    }
  }

  static async ringkasan(request, response, nextFunction) {
    try {
      response.status(200).json(successResponse("Ringkasan Helpdesk 30 hari", await BantuanService.ringkasan(request.author)));
    } catch (error) {
      nextFunction(error);
    }
  }
}
