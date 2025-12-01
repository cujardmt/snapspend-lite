from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.core.files.storage import default_storage
from django.conf import settings

from .models import Receipt
from .serializers import ReceiptSerializer
from .services import extract_receipt_data


class ReceiptUploadView(APIView):
    def post(self, request, *args, **kwargs):
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)

        # Save the file first
        receipt = Receipt.objects.create(file=file)

        # Full path to the saved file
        file_path = receipt.file.path

        # Call OpenAI to extract data
        try:
            data = extract_receipt_data(file_path)
            receipt.extracted_data = data
            receipt.save()
        except Exception as e:
            # On error, you still have the receipt record
            return Response(
                {"detail": "Error extracting data", "error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        serializer = ReceiptSerializer(receipt)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
