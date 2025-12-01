from django.urls import path
from .views import ReceiptUploadView

urlpatterns = [
    path("upload/", ReceiptUploadView.as_view(), name="receipt-upload"),
]
