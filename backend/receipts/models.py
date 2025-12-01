from django.db import models

class Receipt(models.Model):
    file = models.FileField(upload_to="receipts/")
    extracted_data = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Receipt #{self.id}"
