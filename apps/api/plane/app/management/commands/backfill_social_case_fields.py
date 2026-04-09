"""
Backfill social_case_nombre, social_case_cedula, social_case_foto_url
for existing issues that were created before the migration.

Usage:
    python manage.py backfill_social_case_fields
    python manage.py backfill_social_case_fields --dry-run
"""

from django.core.management.base import BaseCommand
from plane.db.models.issue import Issue, _SocialCaseParser


class Command(BaseCommand):
    help = "Backfill social case fields (nombre, cedula, foto_url) for existing issues."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Preview what would be updated without making changes.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        qs = Issue.all_objects.exclude(description_html="").exclude(description_html="<p></p>")
        total = qs.count()
        self.stdout.write(f"Processing {total} issues with non-empty description_html...")

        updated = 0
        for issue in qs.iterator(chunk_size=500):
            parser = _SocialCaseParser()
            parser.feed(issue.description_html)

            update = {}
            if parser.social_data:
                nombre = parser.social_data.get("nombre", "")
                cedula = parser.social_data.get("cedula", "")
                if nombre and issue.social_case_nombre != nombre:
                    update["social_case_nombre"] = nombre
                if cedula and issue.social_case_cedula != cedula:
                    update["social_case_cedula"] = cedula
            if parser.foto_url and issue.social_case_foto_url != parser.foto_url:
                update["social_case_foto_url"] = parser.foto_url

            if update:
                if not dry_run:
                    # Use .update() to avoid triggering save() recursively
                    Issue.all_objects.filter(pk=issue.pk).update(**update)
                updated += 1
                if dry_run:
                    self.stdout.write(f"  [dry-run] Would update issue {issue.id}: {list(update.keys())}")

        verb = "Would update" if dry_run else "Updated"
        self.stdout.write(self.style.SUCCESS(f"{verb} {updated} issues out of {total}."))
