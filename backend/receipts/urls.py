# backend/receipts/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import ReceiptItemViewSet, ReceiptUploadView, ReceiptViewSet

router = DefaultRouter()
router.register(r"receipts", ReceiptViewSet, basename="receipt")
router.register(r"receipt-items", ReceiptItemViewSet, basename="receipt-item")

urlpatterns = [
    # /api/receipts/upload/
    path("receipts/upload/", ReceiptUploadView.as_view(), name="receipt-upload"),
    # /api/receipts/  (list) and /api/receipts/<id>/ (detail)
    path("", include(router.urls)),
]
