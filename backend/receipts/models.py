# backend/receipts/models.py
from django.conf import settings
from django.db import models


class Receipt(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="receipts",
        null=True,
        blank=True,
    )
    # optional: link to uploaded file if you store it in this model
    file = models.FileField(upload_to="receipts/", blank=True, null=True)

    store_name = models.CharField(max_length=255, null=True, blank=True)
    date = models.DateField(null=True, blank=True)
    category = models.CharField(max_length=100, blank=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    tax_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    currency = models.CharField(
        max_length=3,
        default="PHP",  # SnapSpend Lite is PH-focused
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # optional integration flags/ids
    synced_to_quickbooks = models.BooleanField(default=False)
    synced_to_xero = models.BooleanField(default=False)
    synced_to_google_sheets = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.store_name} - {self.date} - {self.total_amount}"


class ReceiptItem(models.Model):
    receipt = models.ForeignKey(
        Receipt,
        on_delete=models.CASCADE,
        related_name="items",
    )
    description = models.CharField(max_length=255, null=True, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=1, null=True, blank=True)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    line_total = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)

    def __str__(self):
        return f"{self.description} ({self.quantity} x {self.unit_price})"
