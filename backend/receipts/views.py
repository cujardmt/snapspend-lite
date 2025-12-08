# backend/receipts/views.py

from datetime import datetime

from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Receipt, ReceiptItem
from .serializers import ReceiptSerializer, ReceiptItemSerializer
from .services import extract_receipt_data

from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from rest_framework.authentication import SessionAuthentication, BasicAuthentication


# --- CSRF-exempt SessionAuthentication for DRF ---
class CsrfExemptSessionAuthentication(SessionAuthentication):
    """
    Same as SessionAuthentication, but does NOT enforce CSRF.
    This avoids 403 "CSRF token missing" for API calls from Next.js.
    """
    def enforce_csrf(self, request):
        # Override to do nothing instead of raising PermissionDenied
        return


@method_decorator(csrf_exempt, name="dispatch")
class ReceiptUploadView(APIView):
    """
    Accepts one or more receipt image files.

    - Single file:  "file"
    - Multiple:     "file" repeated, or "files"/"files[]" for flexibility

    Returns: { "receipts": [ ... ], "errors": [ ...optional... ] }
    """

    # IMPORTANT: disable DRF auth here (so no CSRF)
    authentication_classes: list = []  # dev-only; later you can use token/JWT
    # permission_classes = [permissions.AllowAny]
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, *args, **kwargs):
        # Try to get multiple files first
        files = request.FILES.getlist("file")

        # Also support `files` / `files[]` for flexibility
        if not files:
            files = request.FILES.getlist("files")
        if not files:
            files = request.FILES.getlist("files[]")

        if not files:
            return Response(
                {"detail": "No file(s) provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created_receipts = []
        errors = []

        for upload in files:
            # Create the Receipt with file only (no user for now)
            receipt = Receipt.objects.create(file=upload)

            file_path = receipt.file.path

            try:
                # Extract data via AI
                data = extract_receipt_data(file_path)

                # Map top-level fields into the Receipt model
                receipt.store_name = data.get("store_name")
                receipt.category = data.get("category") or ""
                receipt.total_amount = data.get("total_amount")
                receipt.tax_amount = data.get("tax_amount") or 0
                receipt.currency = data.get("currency") or "USD"

                raw_date = data.get("date")
                if raw_date:
                    try:
                        receipt.date = datetime.fromisoformat(raw_date).date()
                    except ValueError:
                        try:
                            receipt.date = datetime.strptime(
                                raw_date, "%Y-%m-%d"
                            ).date()
                        except ValueError:
                            receipt.date = None

                receipt.save()

                # Create ReceiptItem rows
                items = data.get("items") or []
                for item in items:
                    description = item.get("description")
                    if not description:
                        continue

                    quantity = item.get("quantity") or 1
                    unit_price = item.get("unit_price")
                    line_total = item.get("line_total")

                    ReceiptItem.objects.create(
                        receipt=receipt,
                        description=description,
                        quantity=quantity,
                        unit_price=unit_price if unit_price is not None else 0,
                        line_total=line_total if line_total is not None else 0,
                    )

            except Exception as e:
                # Record the error but continue with other files
                errors.append(
                    {
                        "file": upload.name,
                        "error": str(e),
                        "receipt_id": receipt.id,
                    }
                )

            created_receipts.append(receipt)

        serializer = ReceiptSerializer(created_receipts, many=True, context={"request": request})

        response_data = {"receipts": serializer.data}
        if errors:
            response_data["errors"] = errors

        return Response(response_data, status=status.HTTP_201_CREATED)


@method_decorator(csrf_exempt, name="dispatch")
class ReceiptViewSet(viewsets.ModelViewSet):
    queryset = Receipt.objects.all()
    serializer_class = ReceiptSerializer

    # Use CSRF-exempt auth to avoid 403s from DRF
    authentication_classes = (CsrfExemptSessionAuthentication,)
    # permission_classes = [permissions.AllowAny]
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request, *args, **kwargs):
        receipts = Receipt.objects.all().order_by("-id")
        serializer = ReceiptSerializer(receipts, many=True, context={"request": request})
        return Response(
            {"receipts": serializer.data},
            status=status.HTTP_200_OK,
        )

    def retrieve(self, request, *args, **kwargs):
        """
        Return a single receipt wrapped as: { "receipt": { ... } }
        """
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response({"receipt": serializer.data}, status=status.HTTP_200_OK)

    def create(self, request, *args, **kwargs):
        """
        If you ever POST directly to /api/receipts/, keep the same shape:
        { "receipt": { ... } }
        """
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            {"receipt": serializer.data},
            status=status.HTTP_201_CREATED,
            headers=headers,
        )


@method_decorator(csrf_exempt, name="dispatch")
class ReceiptItemViewSet(viewsets.ModelViewSet):
    """
    API endpoint for editing receipt line items.

    Supports:
    - GET    /api/receipt-items/<id>/
    - PATCH  /api/receipt-items/<id>/
    - DELETE /api/receipt-items/<id>/
    (and list/create if you ever need them)
    """
    queryset = ReceiptItem.objects.all()
    serializer_class = ReceiptItemSerializer

    # Disable CSRF for DRF (same pattern as ReceiptViewSet)
    authentication_classes = (CsrfExemptSessionAuthentication,)
    permission_classes = [permissions.IsAuthenticated]
