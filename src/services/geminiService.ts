import { GoogleGenAI, Type } from "@google/genai";
import { Transaction, SpendingInsight, Budget, SavingsGoal, Investment, AIInvestmentPlan, BudgetRecommendation } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function categorizeTransaction(description: string, amount: number): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Categorize this transaction: "${description}" for amount ${amount}. Return ONLY the category name (e.g., Food, Transport, Rent, Salary, Entertainment, Utilities, Healthcare, Shopping, Other).`,
      config: {
        temperature: 0.1,
      },
    });
    return response.text?.trim() || "Other";
  } catch (error) {
    console.error("AI Categorization failed:", error);
    return "Other";
  }
}

export async function getSpendingInsights(
  transactions: Transaction[],
  budgets?: Budget[],
  savingsGoals?: SavingsGoal[],
  investments?: Investment[]
): Promise<SpendingInsight[]> {
  try {
    const transactionSummary = transactions.map(t => ({
      amount: t.amount,
      type: t.type,
      category: t.category,
      description: t.description,
      date: t.date
    }));

    const contextData = {
      transactions: transactionSummary,
      budgets: budgets || [],
      savingsGoals: savingsGoals || [],
      investments: investments || []
    };

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this financial data and provide 3 highly personalized, actionable financial insights or recommendations. 
      Consider spending habits, budget adherence, savings goals progress, and potential duplicate transactions or unusual spending spikes.
      Data: ${JSON.stringify(contextData)}. 
      Return the response as a JSON array of objects with 'title', 'content', and 'type' (one of: 'info', 'warning', 'success').`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              content: { type: Type.STRING },
              type: { type: Type.STRING, enum: ["info", "warning", "success"] }
            },
            required: ["title", "content", "type"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Insights failed:", error);
    return [];
  }
}

export async function forecastExpenses(transactions: Transaction[]): Promise<number> {
  try {
    const expenses = transactions.filter(t => t.type === 'expense');
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Based on these past expenses: ${JSON.stringify(expenses)}, forecast the total expenses for the next month. Return ONLY the predicted total amount as a number.`,
      config: {
        temperature: 0.5,
      },
    });
    const forecast = parseFloat(response.text?.trim() || "0");
    return isNaN(forecast) ? 0 : forecast;
  } catch (error) {
    console.error("AI Forecast failed:", error);
    return 0;
  }
}

export async function extractReceiptDetails(base64Image: string, mimeType: string): Promise<{ amount: number, description: string, date: string, category: string } | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Image,
              mimeType: mimeType,
            },
          },
          {
            text: "Extract the following details from this receipt: date (YYYY-MM-DD), description (store name or main item), amount (total number only), and category (one of: Housing, Transportation, Food, Utilities, Insurance, Healthcare, Savings, Personal, Education, Entertainment, Other). Return as JSON.",
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            amount: { type: Type.NUMBER, description: "Total amount on the receipt" },
            description: { type: Type.STRING, description: "Store name or main item" },
            date: { type: Type.STRING, description: "Date in YYYY-MM-DD format" },
            category: { type: Type.STRING, description: "One of the specified categories" }
          },
          required: ["amount", "description", "date", "category"]
        }
      }
    });

    return JSON.parse(response.text || "null");
  } catch (error) {
    console.error("Receipt extraction failed:", error);
    return null;
  }
}

export async function getInvestmentAdvice(
  transactions: Transaction[],
  savingsGoals: SavingsGoal[],
  investments: Investment[],
  riskTolerance: string,
  investmentHorizon: string
): Promise<AIInvestmentPlan | null> {
  try {
    const contextData = {
      transactions: transactions.map(t => ({ amount: t.amount, type: t.type, category: t.category })),
      savingsGoals: savingsGoals.map(g => ({ title: g.title, target: g.targetAmount, current: g.currentAmount, deadline: g.deadline })),
      investments: investments.map(i => ({ name: i.name, amount: i.amount, category: i.category, expectedReturn: i.expectedReturnRate })),
      riskTolerance,
      investmentHorizon
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `You are an expert, unbiased financial AI advisor. Analyze the user's financial data to provide a personalized investment plan.
      
      User Data: ${JSON.stringify(contextData)}
      
      Provide:
      1. A brief summary of their current financial standing.
      2. Their assessed risk profile based on their input and data.
      3. A recommended asset allocation (e.g., Stocks, Bonds, Crypto, Real Estate) with percentages totaling 100%. Explain the reasoning for each, keeping it simple and free of complex jargon.
      4. 3 actionable AI tips for investing, holding, or diversifying.
      5. A behavioral nudge to encourage better financial habits.
      6. 3 "What-if" scenario simulations showing potential future values based on different market conditions or contribution levels over their investment horizon.
      
      Ensure recommendations are ethical, unbiased, and transparent. Do not give guaranteed financial advice.
      Return the response strictly as JSON matching the schema.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            riskProfile: { type: Type.STRING },
            summary: { type: Type.STRING },
            recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  assetClass: { type: Type.STRING },
                  allocationPercentage: { type: Type.NUMBER },
                  reasoning: { type: Type.STRING },
                  riskLevel: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
                  expectedReturn: { type: Type.NUMBER }
                },
                required: ["assetClass", "allocationPercentage", "reasoning", "riskLevel", "expectedReturn"]
              }
            },
            tips: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            behavioralNudge: { type: Type.STRING },
            scenarios: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  scenarioName: { type: Type.STRING },
                  projectedValue: { type: Type.NUMBER },
                  description: { type: Type.STRING }
                },
                required: ["scenarioName", "projectedValue", "description"]
              }
            }
          },
          required: ["riskProfile", "summary", "recommendations", "tips", "behavioralNudge", "scenarios"]
        }
      }
    });

    return JSON.parse(response.text || "null");
  } catch (error) {
    console.error("AI Investment Advice failed:", error);
    return null;
  }
}

export async function generateBudgetRecommendations(
  transactions: Transaction[],
  currentIncome: number
): Promise<BudgetRecommendation[]> {
  try {
    const expenses = transactions.filter(t => t.type === 'expense');
    const income = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0) || currentIncome;
    
    const contextData = {
      recentExpenses: expenses.map(t => ({ category: t.category, amount: t.amount, date: t.date })),
      totalIncome: income
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: `You are an expert financial advisor. Analyze the user's historical transactions and income to generate balanced personalized budget limits for different spending categories.
      
      User Data: ${JSON.stringify(contextData)}
      
      Provide a list of recommended budget limits for their most common or necessary categories (e.g., Groceries, Entertainment, Utilities, Transport). Do not allocate 100% of their income to expenses; leave room for savings.
      
      Return the response strictly as a JSON array of objects. Each object must have:
      - 'category' (string)
      - 'suggestedLimit' (number)
      - 'reason' (string, explaining why this limit is optimal based on their data).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              suggestedLimit: { type: Type.NUMBER },
              reason: { type: Type.STRING }
            },
            required: ["category", "suggestedLimit", "reason"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  } catch (error) {
    console.error("AI Budget Recommendations failed:", error);
    return [];
  }
}
