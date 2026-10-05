from django.urls import path

from . import views

urlpatterns = [
    path("", views.list_predictions, name="prediction-list"),
    path("create/", views.create_prediction, name="prediction-create"),
    path("clear/", views.delete_all_predictions, name="prediction-clear"),
    path("saved/", views.list_saved_predictions, name="prediction-saved"),
    path("<int:prediction_id>/", views.prediction_detail, name="prediction-detail"),
    path("<int:prediction_id>/recommendation/", views.select_recommendation, name="recommendation-select"),
    path("questions/<str:label>/", views.material_questions, name="material-questions"),
]
