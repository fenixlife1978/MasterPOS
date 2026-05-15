'use server';
/**
 * @fileOverview This file defines an AI-powered inventory forecasting tool.
 *
 * - intelligentInventoryForecast - A function that analyzes sales data to predict stockouts and suggest reorder quantities.
 * - IntelligentInventoryForecastInput - The input type for the intelligentInventoryForecast function.
 * - IntelligentInventoryForecastOutput - The return type for the intelligentInventoryForecast function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// 1. Define Zod Schemas
const IntelligentInventoryForecastInputSchema = z.object({
  productId: z.number().describe('The unique identifier of the product.'),
  productName: z.string().describe('The name of the product.'),
  currentStock: z.number().describe('The current quantity of the product in stock.'),
  salesHistory: z.array(
    z.object({
      date: z.string().describe('ISO string of the sale date.'),
      quantity: z.number().describe('Quantity of the product sold in this transaction.'),
    })
  ).describe('An array of historical sales data for this product.'),
  daysForForecast: z.number().optional().default(30).describe('The number of recent days to consider for calculating average daily sales.'),
  reorderBufferDays: z.number().optional().default(7).describe('The number of future days to cover with the reorder quantity, acting as a safety buffer.'),
});

export type IntelligentInventoryForecastInput = z.infer<typeof IntelligentInventoryForecastInputSchema>;

const IntelligentInventoryForecastOutputSchema = z.object({
  productName: z.string().describe('The name of the product.'),
  currentStock: z.number().describe('The current quantity of the product in stock.'),
  predictedStockoutDays: z.number().describe('The estimated number of days until the current stock runs out, based on average daily sales.'),
  suggestedReorderQuantity: z.number().describe('The recommended quantity to reorder to cover sales and a buffer period.'),
  reasoning: z.string().describe('A detailed explanation of the calculations and reasoning behind the prediction and suggestion.'),
});

export type IntelligentInventoryForecastOutput = z.infer<typeof IntelligentInventoryForecastOutputSchema>;

// 2. Define the Prompt
const forecastPrompt = ai.definePrompt({
  name: 'intelligentInventoryForecastPrompt',
  input: { schema: IntelligentInventoryForecastInputSchema },
  output: { schema: IntelligentInventoryForecastOutputSchema },
  prompt: `You are an expert inventory manager and data analyst. Your task is to analyze sales data for a specific product, predict its stockout date, and recommend an optimal reorder quantity to avoid stockouts.\n\nHere is the information about the product:\nProduct Name: {{{productName}}}\nCurrent Stock: {{{currentStock}}} units\n\nHere is the sales history for this product over the past {{daysForForecast}} days (date, quantity sold):\n{{#each salesHistory}}\n- Date: {{date}}, Quantity: {{quantity}} units\n{{/each}}\n\nBased on this data, perform the following calculations and provide your analysis:\n1. Calculate the average daily sales rate for this product using the provided sales history. Consider sales only from the last {{daysForForecast}} days. If there's no sales history, assume 0 average daily sales.\n2. Predict approximately when the current stock will run out. If average daily sales are 0, it means the stock will not run out unless sales start.\n3. Suggest an optimal reorder quantity. The reorder quantity should aim to cover sales for an additional {{reorderBufferDays}} days beyond the predicted stockout date, assuming the calculated average daily sales rate continues. If the stock is predicted to last indefinitely (0 average daily sales), suggest a minimal reorder quantity (e.g., 5-10 units) if current stock is low (e.g. < 10 units), otherwise suggest 0.\n\nProvide your output in JSON format according to the output schema.\n`,
});

// 3. Define the Flow
const intelligentInventoryForecastFlow = ai.defineFlow(
  {
    name: 'intelligentInventoryForecastFlow',
    inputSchema: IntelligentInventoryForecastInputSchema,
    outputSchema: IntelligentInventoryForecastOutputSchema,
  },
  async (input) => {
    const { output } = await forecastPrompt(input);
    if (!output) {
      throw new Error('Failed to get forecast output from AI model.');
    }
    return output;
  }
);

// 4. Exported Wrapper Function
export async function intelligentInventoryForecast(
  input: IntelligentInventoryForecastInput
): Promise<IntelligentInventoryForecastOutput> {
  return intelligentInventoryForecastFlow(input);
}
