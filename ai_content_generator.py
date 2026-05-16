#!/usr/bin/env python3
"""
AI Money Agent - Real Content Generator
Generates blog posts, product descriptions & social captions using Claude API
Save output and sell on Fiverr / to Indian businesses via UPI
"""

import anthropic
import json
import os
from datetime import datetime

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

OUTPUT_DIR = "generated_content"
os.makedirs(OUTPUT_DIR, exist_ok=True)

SERVICES = {
    "1": {
        "name": "Blog Post (500 words)",
        "price_inr": 500,
        "price_usd": 6,
        "prompt": lambda topic: f"""Write a professional, SEO-optimized blog post about: {topic}

Requirements:
- Exactly 500 words
- Catchy headline (H1)
- 3 subheadings (H2)
- Natural keyword use
- Engaging intro and strong conclusion
- Ready to publish, no fluff

Write the full blog post now:"""
    },
    "2": {
        "name": "Product Description (5 products)",
        "price_inr": 400,
        "price_usd": 5,
        "prompt": lambda topic: f"""Write 5 compelling product descriptions for: {topic}

Each description must:
- Be 80-100 words
- Highlight key benefits
- Include a call to action
- Be ready for Amazon/Flipkart/Shopify

Write all 5 product descriptions now:"""
    },
    "3": {
        "name": "Social Media Pack (30 captions)",
        "price_inr": 600,
        "price_usd": 7,
        "prompt": lambda topic: f"""Create 30 social media captions for: {topic}

Requirements:
- 10 for Instagram (with hashtags)
- 10 for Facebook (conversational)
- 10 for Twitter/X (under 280 chars)
- Mix of promotional, educational, and engaging
- Ready to post immediately

Write all 30 captions now:"""
    },
    "4": {
        "name": "Business Email Pack (5 emails)",
        "price_inr": 500,
        "price_usd": 6,
        "prompt": lambda topic: f"""Write 5 professional business emails for: {topic}

Include:
1. Introduction/cold outreach email
2. Follow-up email
3. Thank you email
4. Proposal email
5. Invoice/payment request email

Each email should be professional, concise, and ready to send:"""
    },
    "5": {
        "name": "Market Research Report",
        "price_inr": 1200,
        "price_usd": 15,
        "prompt": lambda topic: f"""Write a detailed market research report for: {topic}

Structure:
1. Executive Summary
2. Market Overview & Size
3. Target Audience Analysis
4. Top 5 Competitors Analysis
5. Opportunities & Gaps
6. Recommended Strategy
7. Action Steps (30/60/90 days)

Make it data-driven, professional, and actionable. Minimum 800 words:"""
    }
}


def generate_content(service_key, topic):
    service = SERVICES[service_key]
    print(f"\n⚡ Generating: {service['name']}")
    print(f"   Topic: {topic}")
    print(f"   Price to charge: ₹{service['price_inr']} / ${service['price_usd']}")
    print("\n   AI writing", end="", flush=True)

    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=2000,
        messages=[{"role": "user", "content": service["prompt"](topic)}]
    )

    content = message.content[0].text
    print(" done!\n")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_topic = "".join(c for c in topic[:30] if c.isalnum() or c == " ").replace(" ", "_")
    filename = f"{OUTPUT_DIR}/{service_key}_{safe_topic}_{timestamp}.txt"

    with open(filename, "w", encoding="utf-8") as f:
        f.write(f"SERVICE: {service['name']}\n")
        f.write(f"TOPIC: {topic}\n")
        f.write(f"PRICE: ₹{service['price_inr']} / ${service['price_usd']}\n")
        f.write(f"DATE: {datetime.now().strftime('%Y-%m-%d %H:%M')}\n")
        f.write("=" * 60 + "\n\n")
        f.write(content)

    return content, filename, service


def show_earnings_tracker():
    files = [f for f in os.listdir(OUTPUT_DIR) if f.endswith(".txt")]
    if not files:
        print("\n   No content generated yet.")
        return

    total_inr = 0
    total_usd = 0
    print(f"\n{'='*50}")
    print("  EARNINGS TRACKER")
    print(f"{'='*50}")
    for f in files:
        with open(f"{OUTPUT_DIR}/{f}", encoding="utf-8") as fp:
            lines = fp.readlines()
        for line in lines:
            if line.startswith("PRICE:"):
                parts = line.replace("PRICE:", "").strip().split("/")
                inr = int(parts[0].replace("₹", "").strip())
                usd = int(parts[1].replace("$", "").strip())
                total_inr += inr
                total_usd += usd
                break
        print(f"  ✓ {f[:40]}...")

    print(f"\n  Total earned (if sold): ₹{total_inr} / ${total_usd}")
    print(f"  Files generated: {len(files)}")
    needed = max(0, 20 - total_usd)
    print(f"  Remaining to hit $20/day: ${needed}")
    print(f"{'='*50}")


def main():
    print("\n" + "="*50)
    print("  AI MONEY AGENT - Real Content Generator")
    print("  Sell output → Get paid via UPI / Bank")
    print("="*50)

    print("\nSERVICES YOU CAN SELL:")
    for key, s in SERVICES.items():
        print(f"  [{key}] {s['name']:<35} ₹{s['price_inr']} / ${s['price_usd']}")

    print("\n  [T] View earnings tracker")
    print("  [Q] Quit")

    while True:
        print("\n" + "-"*50)
        choice = input("  Choose service (1-5) or T/Q: ").strip().upper()

        if choice == "Q":
            print("\n  Goodbye! Keep hustling.\n")
            break
        elif choice == "T":
            show_earnings_tracker()
        elif choice in SERVICES:
            topic = input(f"  Enter topic/niche for {SERVICES[choice]['name']}: ").strip()
            if not topic:
                print("  Topic cannot be empty.")
                continue
            content, filename, service = generate_content(choice, topic)
            print(f"\n{'='*50}")
            print("  PREVIEW (first 300 chars):")
            print(f"{'='*50}")
            print(content[:300] + "...")
            print(f"\n  Full content saved to: {filename}")
            print(f"\n  HOW TO GET PAID:")
            print(f"  1. Send this file to your client")
            print(f"  2. Ask them to pay ₹{service['price_inr']} via UPI/Google Pay")
            print(f"  3. Your UPI: share your number@upi")
            print(f"  4. Money lands instantly in your bank!")
        else:
            print("  Invalid choice. Try 1-5, T, or Q.")


if __name__ == "__main__":
    main()
