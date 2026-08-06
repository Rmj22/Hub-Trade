import os
import stripe
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).parent / ".env")
stripe.api_key = os.environ.get("STRIPE_SECRET_KEY") or "sk_test_emergent"

CATALOG = [
    {
        "emergent_product_id": "startup_membership",
        "name": "Hub Trade Startup Membership",
        "tax_code": "txcd_10103001",
        "prices": [{"lookup_key": "startup_6mo", "amount": 36000, "currency": "usd", "interval": "month", "interval_count": 6}],
    },
    {
        "emergent_product_id": "medium_membership",
        "name": "Hub Trade Medium Membership",
        "tax_code": "txcd_10103001",
        "prices": [{"lookup_key": "medium_6mo", "amount": 53400, "currency": "usd", "interval": "month", "interval_count": 6}],
    },
    {
        "emergent_product_id": "large_membership",
        "name": "Hub Trade Large Membership",
        "tax_code": "txcd_10103001",
        "prices": [{"lookup_key": "large_6mo", "amount": 89400, "currency": "usd", "interval": "month", "interval_count": 6}],
    },
]


def ensure_tax_settings():
    s = stripe.tax.Settings.retrieve()
    if s.head_office and getattr(s.head_office, "address", None):
        return
    stripe.tax.Settings.modify(
        head_office={"address": {"country": "US", "line1": "1 Market St", "city": "San Francisco", "state": "CA", "postal_code": "94105"}},
        defaults={"tax_behavior": "exclusive"},
    )


def get_or_create_product(entry):
    for p in stripe.Product.list(active=True).auto_paging_iter():
        if p.to_dict().get("metadata", {}).get("emergent_product_id") == entry["emergent_product_id"]:
            return p
    return stripe.Product.create(name=entry["name"], tax_code=entry.get("tax_code"),
        metadata={"managed_by": "emergent", "emergent_product_id": entry["emergent_product_id"]})


def run():
    try:
        ensure_tax_settings()
    except Exception as e:
        print("tax settings skip:", e)
    for entry in CATALOG:
        product = get_or_create_product(entry)
        for p in entry["prices"]:
            existing = stripe.Price.list(lookup_keys=[p["lookup_key"]], active=True, limit=1).data
            if existing and (existing[0].unit_amount != p["amount"] or existing[0].currency != p["currency"]):
                stripe.Price.modify(existing[0].id, active=False)
                existing = []
            if not existing:
                stripe.Price.create(product=product.id, unit_amount=p["amount"], currency=p["currency"],
                    lookup_key=p["lookup_key"], transfer_lookup_key=True,
                    recurring={"interval": p["interval"], "interval_count": p.get("interval_count", 1)})
                print("created price", p["lookup_key"])
            else:
                print("exists", p["lookup_key"])


if __name__ == "__main__":
    run()
