# backend/receipts/serializers.py
from rest_framework import serializers
from .models import Receipt, ReceiptItem


class ReceiptItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReceiptItem
        fields = [
            "id",
            "description",
            "quantity",
            "unit_price",
            "line_total",
        ]


class ReceiptSerializer(serializers.ModelSerializer):
    items = ReceiptItemSerializer(many=True, read_only=True)

    # expose the raw file (optional) and a computed URL
    file = serializers.FileField(read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Receipt
        fields = [
            "id",
            "store_name",
            "date",
            "category",
            "total_amount",
            "tax_amount",
            "currency",
            "items",
            "file",       # <--- model field
            "file_url",   # <--- computed field
            "created_at",
            "updated_at",
        ]

        read_only_fields = ["id", "created_at", "updated_at"]

    def create(self, validated_data):
        # pop nested items data
        items_data = validated_data.pop("items", [])

        # user will come from request context, not from payload
        user = self.context["request"].user

        receipt = Receipt.objects.create(user=user, **validated_data)

        for item_data in items_data:
            ReceiptItem.objects.create(receipt=receipt, **item_data)

        return receipt
    
    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file:
            url = obj.file.url
            if request is not None:
                return request.build_absolute_uri(url)
            return url
        return None