# Generated migration for social case fields on Issue model
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0121_alter_estimate_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="issue",
            name="social_case_nombre",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="issue",
            name="social_case_cedula",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="issue",
            name="social_case_foto_url",
            field=models.CharField(blank=True, default="", max_length=2048),
        ),
    ]
