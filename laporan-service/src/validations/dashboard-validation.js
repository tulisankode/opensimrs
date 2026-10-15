import { z } from "zod";

export default class DashboardValidator {
  static DASHBOARD = z.object({
    startDate: z.string().date().nullable().optional(),
    endDate: z.string().date().nullable().optional(),
  }).refine(data => {
    if (data.startDate && data.endDate) {
      return new Date(data.endDate) >= new Date(data.startDate)
    }
    return true
  }, {
    message: 'endDate must be greater than startDate',
    path: ['endDate']
  })

}
