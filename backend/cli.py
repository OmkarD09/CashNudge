"""Command-line interface to execute the CashNudge Risk Engine."""

import sys
import argparse
from pathlib import Path
import json

from backend.data_validator import load_and_validate_csv, InvoiceValidationError
from backend.ml_engine import (
    analyze_ledger,
    InsufficientHistoricalDataError,
    InsufficientClassDiversityError,
)
from backend.config import TabPFNConfigurationError


def main():
    parser = argparse.ArgumentParser(
        description="CashNudge — AI-powered invoice risk estimation and payment follow-up engine."
    )
    parser.add_argument(
        "csv_path",
        nargs="?",
        default="backend/sample_data/synthetic_freelancer_invoices.csv",
        help="Path to the invoice ledger CSV file (defaults to synthetic benchmark dataset).",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output full analysis payload as JSON.",
    )
    parser.add_argument(
        "--provider",
        choices=["hosted", "mock", "auto"],
        default="auto",
        help="Model inference provider: 'hosted' (Prior Labs Cloud), 'mock' (local pipeline), or 'auto'.",
    )

    args = parser.parse_args()
    csv_file = Path(args.csv_path)

    if not csv_file.exists():
        print(f"Error: File not found: {csv_file}", file=sys.stderr)
        sys.exit(1)

    try:
        print(f"Loading and validating ledger: {csv_file}...")
        df = load_and_validate_csv(csv_file)
        
        provider_type = None if args.provider == "auto" else args.provider
        from backend.model_provider import get_risk_classifier
        clf = get_risk_classifier(provider_type=provider_type)

        is_synth = "synthetic" in csv_file.name.lower()
        result = analyze_ledger(df, classifier=clf, is_synthetic=is_synth)

        if args.json:
            print(json.dumps(result.model_dump(), indent=2))
            return

        # Pretty CLI print
        s = result.summary
        print("\n========================================================")
        print("          CASHNUDGE INVOICE RISK ANALYSIS")
        print("========================================================")
        print(f"Inference Provider       : {result.metadata['model_provider']}")
        print(f"Total Invoices in Ledger : {s.total_invoices}")
        print(f"Historical Paid Invoices : {s.historical_invoices_count} ({s.historical_on_time_count} on-time, {s.historical_late_count} late | {s.historical_late_rate * 100:.1f}% late rate)")
        print(f"Outstanding Invoices     : {s.outstanding_invoices_count}")
        print(f"Total Outstanding Amount : ${s.total_outstanding_amount:,.2f}")
        print("--------------------------------------------------------")
        print(f"Low Risk (Safe) Cash     : ${s.low_risk_amount:,.2f}")
        print(f"Medium Risk Cash         : ${s.medium_risk_amount:,.2f}")
        print(f"High Risk Cash           : ${s.high_risk_amount:,.2f}")
        print(f"Total At-Risk Exposure   : ${s.at_risk_amount:,.2f}")
        print("========================================================\n")

        if result.predictions:
            print("OUTSTANDING INVOICE PREDICTIONS:")
            for p in result.predictions:
                tier_marker = {"low": "[LOW]", "medium": "[MED]", "high": "[HIGH]"}[p.risk_tier.value]
                print(f"  {tier_marker:<7} {p.invoice_id:<14} {p.client_name:<22} ${p.invoice_amount:>9,.2f} | Late Risk: {p.late_probability * 100:>5.1f}%")
                for f in p.top_risk_factors:
                    print(f"          - {f}")
                print()
        else:
            print("No open outstanding invoices in this ledger.")

    except InvoiceValidationError as e:
        print(f"\n[Validation Error] {e}", file=sys.stderr)
        sys.exit(2)
    except (InsufficientHistoricalDataError, InsufficientClassDiversityError) as e:
        print(f"\n[Data Quality Error] {e}", file=sys.stderr)
        sys.exit(3)
    except TabPFNConfigurationError as e:
        print(f"\n[Configuration Error] {e}", file=sys.stderr)
        sys.exit(4)
    except Exception as e:
        print(f"\n[System Error] Unexpected failure: {e}", file=sys.stderr)
        sys.exit(5)


if __name__ == "__main__":
    main()
