import base64
import os
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def extract_receipt_data(file_path: str) -> dict:
    """
    Sends the receipt image to OpenAI Vision and returns structured data.
    """
    # Read and base64-encode the image
    with open(file_path, "rb") as f:
        img_bytes = f.read()
    b64_image = base64.b64encode(img_bytes).decode("utf-8")

    prompt = """
You are an expert AI system that extracts structured data from receipt images for financial, bookkeeping, and expense-tracking purposes.

You MUST output ONLY a single valid JSON object matching the following schema.
Use null when information is missing, unreadable, or ambiguous.

{
  "store_name": string | null,
  "store_address": string | null,
  "store_tax_id": string | null,

  "date": string | null,                     // ISO 8601 preferred
  "payment_method": string | null,           // e.g., Cash, Visa, Mastercard, GCash

  "subtotal_amount": number | null,          // before tax/fees
  "tax_amount": number | null,
  "total_amount": number | null,
  "currency": "PHP" | "USD" | "EUR" | "JPY" | "GBP",

  "category": string | null,                 // inferred expense category

  "items": [
    {
      "description": string,
      "quantity": number | null,
      "unit_price": number | null,
      "line_total": number | null
    }
  ],

  "confidence_score": number                 // range: 0.0 – 1.0
}

=========================
CATEGORIZATION GUIDELINES
=========================

Infer the overall receipt **category** using signals such as:
- Store name and type (e.g., Shell = Fuel; Starbucks = Coffee/Food)
- Purchased items (e.g., "Tylenol" = Healthcare, "Brakes" = Auto Maintenance)
- Phrases like "Tuition", "Electricity Bill", "Water Utility", etc.

Choose the **best matching category**. Examples include:

- "Groceries"
- "Restaurants / Dining"
- "Coffee Shops"
- "Fuel / Gas"
- "Transportation"
- "Ride Hailing"
- "Utilities"
- "Internet / Mobile"
- "Bills & Payments"
- "Shopping"
- "Clothing"
- "Electronics"
- "Hardware / Home Improvement"
- "Travel"
- "Lodging"
- "Healthcare"
- "Pharmacy"
- "Entertainment"
- "Subscriptions"
- "Business Supplies"
- "Office Supplies"
- "Other"

If you cannot determine a clear match, use:  
→ "Other"

=========================
EXTRACTION GUIDELINES
=========================

1. STORE DETAILS  
- Extract clearly visible store names (e.g., “7-ELEVEN”).
- Extract address as a full string.
- Extract tax ID (TIN, VAT No., GST, Reg No., etc.).

2. DATE  
- Prefer transaction date over print date.
- Convert to ISO 8601 when possible.
- If unsure, keep raw text.

3. PAYMENT METHOD  
Look for keywords:
- Cash, CREDIT, DEBIT, VISA, AMEX, GCash, PayMaya, EFTPOS, etc.

4. AMOUNTS  
- subtotal_amount → before tax/fees  
- tax_amount → VAT/GST/Sales Tax  
- total_amount → final payable  
- Accuracy preferred; if ambiguous, use null.

5. CURRENCY  
Infer from symbol or explicit code.

6. LINE ITEMS  
Extract meaningful purchase lines only:
- description
- quantity
- unit_price
- line_total

Exclude loyalty points, promotions, slogans, etc.

7. CONFIDENCE SCORE (0.0 – 1.0)  
Estimate based on:
- Completeness
- Clarity
- Extraction quality
- Certainty in category, totals, and items

General scale:
- 0.9–1.0 = high accuracy  
- 0.7–0.89 = mostly correct  
- 0.4–0.69 = partial extraction  
- <0.4 = low confidence  

=========================
IMPORTANT RULES
=========================

- ALWAYS output valid JSON.
- NEVER include explanations or text outside the JSON.
- Use null when uncertain.
- Do not hallucinate values not present in the receipt.
"""

    response = client.chat.completions.create(
        model="gpt-4o-mini",  # or gpt-4o if you prefer
        messages=[
            {
                "role": "system",
                "content": prompt,
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Here is a receipt image. Extract the data.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{b64_image}"
                        },
                    },
                ],
            },
        ],
        response_format={"type": "json_object"},
    )

    json_content = response.choices[0].message.content

    import json
    if isinstance(json_content, str):
        data = json.loads(json_content)
    else:
        data = json_content

    # -------- Currency normalizer (Option 3) -------- #

    def normalize_currency(cur):
        """
        Normalize any model output to a safe, supported currency.
        For SnapSpend Lite we default to PHP if anything looks off.
        """
        if not cur:
            return "PHP"

        cur = str(cur).upper().strip()

        # Known / allowed currencies
        allowed = {"PHP", "USD", "EUR", "JPY", "GBP"}

        # Map common mistakes / weird outputs to PHP
        if cur in {
            "PESO",
            "PH",
            "PHP.",
            "PHPH",
            "NV",
            "PHP$",
            "₱",
        }:
            return "PHP"

        # If it's not explicitly allowed, assume PHP for this deployment
        if cur not in allowed:
            return "PHP"

        return cur

    data["currency"] = normalize_currency(data.get("currency"))

    return data
