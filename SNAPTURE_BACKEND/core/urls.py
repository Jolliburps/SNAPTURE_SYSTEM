from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("materials/", views.materials, name="materials"),
]
