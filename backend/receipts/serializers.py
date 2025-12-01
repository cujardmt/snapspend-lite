from rest_framework import serializers
from .models import Receipt

class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = ["id", "file", "extracted_data", "created_at"]
        read_only_fields = ["extracted_data", "created_at"]
