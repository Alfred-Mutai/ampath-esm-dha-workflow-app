import { z } from 'zod';

const validationSchema = z.object({
    unitPrice: z.string({ required_error: "Unit price is required" }),
    quantity: z.number({ required_error: "Quantity is required" }),
});

export { validationSchema };

export type CreateOrderBillFormSchema = z.infer<typeof validationSchema>;