import { z } from "zod";

import { passwordSchema } from "@/lib/validations/auth";

export const createAdminUserSchema = z
  .object({
    username: z
      .string()
      .min(3, "Username must be at least 3 characters")
      .max(30, "Username must be at most 30 characters"),
    email: z.string().email("Enter a valid email address"),
    password: passwordSchema,
    password2: z.string().min(1, "Please confirm the password"),
    role: z.enum(["admin", "user"], {
      required_error: "Select a role",
    }),
  })
  .refine((data) => data.password === data.password2, {
    message: "Passwords do not match",
    path: ["password2"],
  });

export const updateAdminUserEmailSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export const resetAdminUserPasswordSchema = z.object({
  password: passwordSchema,
});

export type CreateAdminUserFormValues = z.infer<typeof createAdminUserSchema>;
export type UpdateAdminUserEmailFormValues = z.infer<
  typeof updateAdminUserEmailSchema
>;
export type ResetAdminUserPasswordFormValues = z.infer<
  typeof resetAdminUserPasswordSchema
>;
