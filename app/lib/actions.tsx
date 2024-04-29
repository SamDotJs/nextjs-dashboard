'use server'

//Zod is a TypeScript-first validation library To handle type validation
import { z } from 'zod';
import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

//define a schema that matches the shape of your form object. 
//This schema will validate the formData before saving it to a database.
const FormSchema = z.object({
  id: z.string(),
  customerId: z.string(),
  //amount field is specifically set to coerce (change) from a string to a number
  amount: z.coerce.number(),
  status: z.enum(['pending', 'paid']),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });
 
export async function createInvoice(formData: FormData) {
    /*const rawFormData = {
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    };*/
    //OU const rawFormData = Object.fromEntries(formData.entries())
    // Test it out:
    //console.log(rawFormData);
    //console.log(typeof rawFormData.amount);

    //OU
    //pass the rawFormData to CreateInvoice to validate the types with Zob FormSchema
    const { customerId, amount, status } = CreateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
    //convert amount to cent to eliminate javascript floating point error
    const amountInCents = amount * 100;
    //create a new date with the format "YYYY-MM-DD"
    const date = new Date().toISOString().split('T')[0];

    await sql`
      INSERT INTO invoices (customer_id, amount, status, date)
      VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;
    //clear this cache and trigger a new request to the server
    //the /dashboard/invoices path will be revalidated, and fresh data will be fetched from the server.
    revalidatePath('/dashboard/invoices');

    //redirect the user back to the /dashboard/invoices page
    redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, formData: FormData) {
    //Extracting data from formData
    //pass the raw formData to CreateInvoice to validate the types with Zob FormSchema
    const { customerId, amount, status } = UpdateInvoice.parse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
   
    //Converting the amount to cents.
    const amountInCents = amount * 100;
   
    //Passing the variables to SQL query.
    await sql`
      UPDATE invoices
      SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
      WHERE id = ${id}
    `;
   
    //clear the client cache and make a new server request
    revalidatePath('/dashboard/invoices');
    //redirect the user to the invoice's page
    redirect('/dashboard/invoices');
  }
  
  export async function deleteInvoice(id: string) {
    await sql`DELETE FROM invoices WHERE id = ${id}`;

    //trigger a new server request and re-render the table
    revalidatePath('/dashboard/invoices');
  }