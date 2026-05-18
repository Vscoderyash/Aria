#!/usr/bin/env python3
"""
ARIA local content generator.

This is a small offline template engine. It does not call any AI API. It is
useful for creating first drafts from your own inputs, then improving them in
the ARIA browser app with local training notes and knowledge-base context.
"""

from datetime import datetime
from pathlib import Path


OUTPUT_DIR = Path("generated_content")
OUTPUT_DIR.mkdir(exist_ok=True)

SERVICES = {
    "1": {
        "name": "Blog Post Outline",
        "price_inr": 500,
        "price_usd": 6,
        "sections": [
            "Headline",
            "Opening hook",
            "Problem",
            "Core explanation",
            "Practical steps",
            "Conclusion",
        ],
    },
    "2": {
        "name": "Product Description Pack",
        "price_inr": 400,
        "price_usd": 5,
        "sections": [
            "Product promise",
            "Top benefits",
            "Buyer objections",
            "Call to action",
        ],
    },
    "3": {
        "name": "Social Media Pack",
        "price_inr": 600,
        "price_usd": 7,
        "sections": [
            "Instagram hooks",
            "Facebook captions",
            "X posts",
            "Hashtag ideas",
        ],
    },
    "4": {
        "name": "Business Email Pack",
        "price_inr": 500,
        "price_usd": 6,
        "sections": [
            "Cold outreach",
            "Follow-up",
            "Thank you",
            "Proposal",
            "Payment request",
        ],
    },
    "5": {
        "name": "Market Research Skeleton",
        "price_inr": 1200,
        "price_usd": 15,
        "sections": [
            "Executive summary",
            "Audience",
            "Competitors",
            "Opportunities",
            "30/60/90 day plan",
        ],
    },
}


def generate_local_content(service_key: str, topic: str) -> tuple[str, Path, dict]:
    service = SERVICES[service_key]
    lines = [
        f"# {service['name']}: {topic}",
        "",
        f"Generated locally by ARIA on {datetime.now():%Y-%m-%d %H:%M}",
        "",
    ]

    for section in service["sections"]:
        lines.extend([
            f"## {section}",
            f"- Write this section using your own notes about {topic}.",
            "- Add proof, examples, benefits, and client-specific details.",
            "- Keep it clear, useful, and ready to edit.",
            "",
        ])

    content = "\n".join(lines)
    safe_topic = "".join(c for c in topic[:30] if c.isalnum() or c == " ").replace(" ", "_")
    filename = OUTPUT_DIR / f"{service_key}_{safe_topic}_{datetime.now():%Y%m%d_%H%M%S}.md"
    filename.write_text(content, encoding="utf-8")
    return content, filename, service


def main():
    print("\nARIA Local Content Generator - no API\n")
    for key, service in SERVICES.items():
        print(f"[{key}] {service['name']} - INR {service['price_inr']} / ${service['price_usd']}")

    choice = input("\nChoose service (1-5): ").strip()
    if choice not in SERVICES:
        print("Invalid choice.")
        return

    topic = input("Topic or niche: ").strip()
    if not topic:
        print("Topic cannot be empty.")
        return

    content, filename, service = generate_local_content(choice, topic)
    print(f"\nCreated: {filename}")
    print(f"Suggested price: INR {service['price_inr']} / ${service['price_usd']}")
    print("\nPreview:\n")
    print(content[:800])


if __name__ == "__main__":
    main()
