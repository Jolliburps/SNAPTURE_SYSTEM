from django.urls import path

from . import views

urlpatterns = [
    path("health/", views.health, name="health"),
    path("materials/", views.materials, name="materials"),
    path("learning/", views.learning_information, name="learning-information"),
    path("collection/", views.collection_notices, name="collection-notices"),
]
