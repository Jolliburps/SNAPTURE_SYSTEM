from django.urls import path

from . import views

urlpatterns = [
    path("counts/", views.counts, name="dataset-counts"),
    path("upload/", views.upload, name="dataset-upload"),
]
