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
  customerId: z.string({
    invalid_type_error: 'Please select a customer.',
  }),
  //amount field is specifically set to coerce (change) from a string to a number
  amount: z.coerce
    .number()
    //Let's tell Zod we always want the amount greater than 0 with the .gt() function
    .gt(0, {message: 'Please enter an amount greater than $0.'}),
  status: z.enum(['pending', 'paid'], {
    invalid_type_error: 'Please select an invoice status.',
  }),
  date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

//State for useFormState hook in create-form.tsx
export type State = {
    errors?: {
      customerId?: string[];
      amount?: string[];
      status?: string[];
    };
    message?: string | null;
};

//prevState - contains the state passed from the useFormState hook. You won't be using it in the action in this example, but it's a required prop
export async function createInvoice(prevState: State, formData: FormData) {
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
    //safeParse() will return an object containing either a success or error field. This will help handle validation more gracefully without having put this logic inside the try/catch block.
    const validatedFields  = CreateInvoice.safeParse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });

    //If validatedFields isn't successful, we return the function early with the error messages from Zod.
    if (!validatedFields.success) {
        return {
            errors: validatedFields.error.flatten().fieldErrors,
            message: 'Missing Fields. Failed to Create Invoice.',
        };
    }

    // Prepare data for insertion into the database
    const { customerId, amount, status } = validatedFields.data;

    //convert amount to cent to eliminate javascript floating point error
    const amountInCents = amount * 100;
    //create a new date with the format "YYYY-MM-DD"
    const date = new Date().toISOString().split('T')[0];

    try {
        await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
        `;
    } catch (error) {
        return {
            message: 'Database Error: Failed to Create Invoice.',
          };
    }

    //clear this cache and trigger a new request to the server
    //the /dashboard/invoices path will be revalidated, and fresh data will be fetched from the server.
    revalidatePath('/dashboard/invoices');

    //redirect the user back to the /dashboard/invoices page
    redirect('/dashboard/invoices');
}

export async function updateInvoice(id: string, prevState: State, formData: FormData) {
    //Extracting data from formData
    //pass the raw formData to CreateInvoice to validate the types with Zob FormSchema
    const validatedFields = UpdateInvoice.safeParse({
      customerId: formData.get('customerId'),
      amount: formData.get('amount'),
      status: formData.get('status'),
    });
   
    if (!validatedFields.success) {
        return {
          errors: validatedFields.error.flatten().fieldErrors,
          message: 'Missing Fields. Failed to Update Invoice.',
        };
    }
    
    const { customerId, amount, status } = validatedFields.data;
    //Converting the amount to cents.
    const amountInCents = amount * 100;
   
    //Passing the variables to SQL query.
    try {
        await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
        `;
    } catch (error) {
        return { message: 'Database Error: Failed to Update Invoice.' };
    }
    
    //clear the client cache and make a new server request
    revalidatePath('/dashboard/invoices');
    //redirect the user to the invoice's page
    redirect('/dashboard/invoices');
  }
  
  export async function deleteInvoice(id: string) {
    throw new Error('Failed to Delete Invoice');

    try {
        await sql`DELETE FROM invoices WHERE id = ${id}`;
        return { message: 'Deleted Invoice.' };
    } catch (error) {
        return { message: 'Database Error: Failed to Delete Invoice.' };
    }
    
    //trigger a new server request and re-render the table
    revalidatePath('/dashboard/invoices');
  }