from django.urls import path
from . import views

urlpatterns=[
    path('capabilities/',views.capabilities),
    path('predictions/<int:prediction_id>/assessment/',views.assessment),
    path('predictions/<int:prediction_id>/result/',views.saved_result),
    path('predictions/<int:prediction_id>/projects/',views.project_suggestions),
    path('inventory/',views.inventory),path('inventory/<int:lot_id>/',views.inventory_detail),
    path('inventory/<int:lot_id>/prediction/',views.inventory_prediction),
    path('projects/<int:project_id>/',views.project_detail),
    path('projects/<int:project_id>/manual-confirmation/',views.enable_project_confirmation),
    path('projects/<int:project_id>/steps/<int:step_index>/',views.step_photo),
    path('projects/<int:project_id>/final/',views.final_product),
    path('completions/',views.completions),path('community/',views.community),
    path('programs/<int:program_id>/submissions/',views.program_submissions),
    path('submissions/<int:submission_id>/',views.review_submission),
    path('media/<str:kind>/<int:pk>/',views.media),
]
